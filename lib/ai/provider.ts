// Provider-neutral AI access (owner decision, 12 October 2026: "ability to switch to anything as per availability
// and requirement, no lock-in; test with Claude for now"). Every AI call in the Academy goes through generate().
// Switching provider is configuration only:
//   ACADEMY_AI_PROVIDER = off | anthropic | openai-compatible | fake
//   ACADEMY_AI_MODEL    = the provider's model ID (required; never defaulted, so the evaluated model is explicit)
//   anthropic:          ANTHROPIC_API_KEY (optional ACADEMY_AI_BASE_URL)
//   openai-compatible:  ACADEMY_AI_BASE_URL + ACADEMY_AI_API_KEY (OpenAI, Azure OpenAI, Gemini's compatible endpoint,
//                       or a self-hosted server that speaks the chat-completions format)
// "off" is the kill switch (ACA-US-7.3): generate() throws AiUnavailable and callers use their non-AI fallback.
// Learner text is never logged here; only provider, model, purpose, status and latency.

export type AiMessage = { role: 'user' | 'assistant'; content: string };
export type AiRequest = {
  purpose: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature?: number;
};
export type AiResult = { text: string; provider: string; model: string; latencyMs: number };
export class AiUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailable';
  }
}

type Call = (req: AiRequest, model: string, signal: AbortSignal) => Promise<string>;

const anthropic: Call = async (req, model, signal) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiUnavailable('AI is not configured.');
  const r = await fetch((process.env.ACADEMY_AI_BASE_URL ?? 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
      ...(req.temperature === undefined ? {} : { temperature: req.temperature }),
    }),
  });
  if (!r.ok)
    throw Object.assign(new AiUnavailable(`AI provider answered ${r.status}.`), { status: r.status });
  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
};

const openaiCompatible: Call = async (req, model, signal) => {
  const base = process.env.ACADEMY_AI_BASE_URL,
    key = process.env.ACADEMY_AI_API_KEY;
  if (!base || !key) throw new AiUnavailable('AI is not configured.');
  const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    signal,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      ...(req.temperature === undefined ? {} : { temperature: req.temperature }),
    }),
  });
  if (!r.ok)
    throw Object.assign(new AiUnavailable(`AI provider answered ${r.status}.`), { status: r.status });
  const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
};

// Deterministic stand-in for tests and local demos; never used in production.
// Local tests only (refused in production below). A pack draft gets well-formed JSON so the review flow can be tested.
const fake: Call = async (req) => {
  if (req.purpose === 'pack-draft') {
    const input = JSON.parse(req.messages.at(-1)?.content ?? '{}') as { sources?: { title: string }[] };
    const sources = (input.sources ?? []).slice(0, 1);
    return JSON.stringify([
      {
        kind: 'task',
        jobRole: '*',
        level: '*',
        title: '[fake] Check one real document',
        body: 'Use AI on one real document from your work, then check its answer yourself.',
        sources,
      },
      {
        kind: 'rule',
        jobRole: '*',
        level: '*',
        title: '[fake] Re-check every number',
        body: 'Always re-add any total the AI gives you.',
        sources,
      },
    ]);
  }
  return `[fake:${req.purpose}] ${req.messages.at(-1)?.content.slice(0, 80) ?? ''}`;
};

const providers: Record<string, Call> = { anthropic, 'openai-compatible': openaiCompatible, fake };

export function aiEnabled(): boolean {
  const p = process.env.ACADEMY_AI_PROVIDER ?? 'off';
  return p !== 'off' && p in providers && !!process.env.ACADEMY_AI_MODEL;
}

export async function generate(req: AiRequest): Promise<AiResult> {
  const name = process.env.ACADEMY_AI_PROVIDER ?? 'off',
    model = process.env.ACADEMY_AI_MODEL ?? '';
  if (name === 'off') throw new AiUnavailable('AI is switched off.');
  const call = providers[name];
  if (!call || !model) throw new AiUnavailable('AI is not configured.');
  if (name === 'fake' && process.env.ACADEMY_ENVIRONMENT === 'production')
    throw new AiUnavailable('AI is not configured.');
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      const text = await call(
        req,
        model,
        AbortSignal.timeout(Number(process.env.ACADEMY_AI_TIMEOUT_MS ?? 30_000)),
      );
      const latencyMs = Date.now() - started;
      console.info(
        JSON.stringify({
          event: 'ai_call',
          provider: name,
          model,
          purpose: req.purpose,
          ok: true,
          latencyMs,
        }),
      );
      return { text, provider: name, model, latencyMs };
    } catch (e) {
      const status = (e as { status?: number }).status;
      const retryable =
        attempt === 1 &&
        (status === 429 || (status !== undefined && status >= 500) || (e as Error).name === 'TimeoutError');
      if (retryable) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.info(
        JSON.stringify({
          event: 'ai_call',
          provider: name,
          model,
          purpose: req.purpose,
          ok: false,
          status: status ?? null,
          latencyMs: Date.now() - started,
        }),
      );
      if (e instanceof AiUnavailable) throw e;
      throw new AiUnavailable('AI is unavailable right now.');
    }
  }
}
