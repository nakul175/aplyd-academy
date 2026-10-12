// ACA-US-19.2 voice input (in scope only with scope.release including ACA-E19, and only when the owner records that
// AIA-ACADEMY-01 covers the speech provider). The recording is held in memory only, sent once for transcription and
// discarded; it is never written to disk or the database, and never used to train a model. The learner edits the text
// before submitting. Students under the R3 rules cannot use voice.
import {type Db, type Actor, LoopError, audit, requireSelf, requireDecision, requireEpic, iso} from './core';

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export type Transcriber = (audio: Uint8Array, mime: string) => Promise<string>;

export function configuredTranscriber(): Transcriber {
  const p = process.env.ACADEMY_SPEECH_PROVIDER ?? 'off';
  if (p === 'fake' && process.env.ACADEMY_ENVIRONMENT !== 'production') return async (a) => `[fake transcript of ${a.byteLength} bytes]`;
  if (p === 'openai-compatible') {
    const base = process.env.ACADEMY_SPEECH_BASE_URL, key = process.env.ACADEMY_SPEECH_API_KEY, model = process.env.ACADEMY_SPEECH_MODEL;
    if (!base || !key || !model) throw new LoopError('Voice input is not set up on this server.', 503);
    return async (audio, mime) => {
      const form = new FormData();
      form.append('model', model);
      form.append('file', new Blob([new Uint8Array(audio)], {type: mime}), 'answer.' + (mime.split('/')[1] ?? 'webm').split(';')[0]);
      const r = await fetch(base.replace(/\/$/, '') + '/audio/transcriptions', {method: 'POST', headers: {authorization: `Bearer ${key}`}, body: form, signal: AbortSignal.timeout(60_000)});
      if (!r.ok) throw new LoopError('Voice input is unavailable right now. Please type your answer.', 503);
      return String(((await r.json()) as {text?: string}).text ?? '');
    };
  }
  throw new LoopError('Voice input is not available.', 503);
}

export async function transcribe(db: Db, actor: Actor, memberId: string, audio: Uint8Array, mime: string, t: Transcriber = configuredTranscriber(), now = Date.now()) {
  await requireEpic(db, 'ACA-E19');
  const m = await requireSelf(db, actor, memberId, 'voice.transcribe', now);
  if (m.role === 'student') throw new LoopError('Voice input is not available for students.', 403);
  const allowed = await requireDecision<{allowed: boolean}>(db, 'speech.provider');
  if (!allowed.allowed) throw new LoopError('Voice input is not available.', 403);
  if (!/^audio\//.test(mime)) throw new LoopError('Send an audio recording.', 415);
  if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) throw new LoopError('The recording is empty or longer than about five minutes.', 413);
  try {
    const textOut = (await t(audio, mime)).trim().slice(0, 8000);
    await audit(db, actor.userId, 'voice.transcribe', {org: m.org_id, now}); // no content and no recording kept
    return {text: textOut, recordingKept: false, at: iso(now)};
  } finally { audio.fill(0); } // the recording is discarded (ACA-US-19.2-AC2)
}
