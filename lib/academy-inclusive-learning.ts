/** Own learning preferences and exact-version assistance checks. No translation, recording or speech side effects. */
import {
  contentKey,
  pinnedRef,
  tryResolvePinnedContent,
  deepFreeze,
  type ContentRef,
  type ContentContext,
} from './academy-curriculum';

export class InclusiveLearningError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = 'InclusiveLearningError';
  }
}
const plain = (v: unknown): v is Record<string, any> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function exact(value: unknown, keys: readonly string[], label: string): Record<string, any> {
  if (
    !plain(value) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    keys.some((k) => !Object.hasOwn(value, k))
  )
    throw new InclusiveLearningError(label + ' has missing or unsupported fields.', 400);
  return value;
}
/** A language request is not an assertion that its content, voice or assessment is available. */
export function canonicalLearningLanguage(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 35 ||
    !/^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|\d{3}))?$/.test(value)
  )
    throw new InclusiveLearningError('Choose an ordinary language tag, such as en, hi or mr-IN.');
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    throw new InclusiveLearningError('Choose a valid language tag.');
  }
}
export type AccessPreferences = Readonly<{
  schemaVersion: 1;
  preferredLanguage: string;
  readAloudMode: 'off' | 'ask';
  assistancePreference: 'none' | 'read-text' | 'capture-response';
}>;
export function freshAccessPreferences(): AccessPreferences {
  return Object.freeze({
    schemaVersion: 1,
    preferredLanguage: 'en',
    readAloudMode: 'off',
    assistancePreference: 'none',
  });
}
export function readAccessPreferences(value: unknown): AccessPreferences {
  if (value === undefined) return freshAccessPreferences();
  const p = exact(
    value,
    ['schemaVersion', 'preferredLanguage', 'readAloudMode', 'assistancePreference'],
    'Learning preferences',
  );
  if (
    p.schemaVersion !== 1 ||
    !['off', 'ask'].includes(p.readAloudMode) ||
    !['none', 'read-text', 'capture-response'].includes(p.assistancePreference)
  )
    throw new InclusiveLearningError('The saved learning preferences need a format review.', 409);
  return Object.freeze({
    schemaVersion: 1,
    preferredLanguage: canonicalLearningLanguage(p.preferredLanguage),
    readAloudMode: p.readAloudMode,
    assistancePreference: p.assistancePreference,
  });
}
/** Caller must supply the authenticated learner's own state and existing sizing/CAS policy. */
export function applyAccessPreferences<T extends object>(
  ownState: T,
  input: unknown,
): T & { learningAccess: AccessPreferences } {
  const c = exact(
    input,
    ['type', 'preferredLanguage', 'readAloudMode', 'assistancePreference'],
    'Preference action',
  );
  if (c.type !== 'learning-access-preferences')
    throw new InclusiveLearningError('Choose the learning preference action.', 400);
  const learningAccess = readAccessPreferences({
    schemaVersion: 1,
    preferredLanguage: c.preferredLanguage,
    readAloudMode: c.readAloudMode,
    assistancePreference: c.assistancePreference,
  });
  return { ...structuredClone(ownState), learningAccess };
}
function sameLanguage(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
export type LanguageAvailability = Readonly<{
  status: 'pinned-content-unavailable' | 'matches-pinned-content' | 'requested-language-unavailable';
  contentRef: ContentRef | null;
  contentLanguage: string | null;
  requestedLanguage: string;
  message: string;
}>;
/** Looks at only the exact saved reference. No catalog/latest/language substitution or action permission. */
export function languageAvailability(
  record: unknown,
  context: ContentContext,
  preferences: AccessPreferences,
): LanguageAvailability {
  const p = readAccessPreferences(preferences),
    resolved = tryResolvePinnedContent(record, context.allowedScopes, context.registry);
  if (!resolved.available)
    return Object.freeze({
      status: 'pinned-content-unavailable',
      contentRef: null,
      contentLanguage: null,
      requestedLanguage: p.preferredLanguage,
      message: resolved.message,
    });
  const language = canonicalLearningLanguage(resolved.snapshot.language);
  const matches = sameLanguage(language, p.preferredLanguage);
  return Object.freeze({
    status: matches ? 'matches-pinned-content' : 'requested-language-unavailable',
    contentRef: resolved.snapshot.ref,
    contentLanguage: language,
    requestedLanguage: p.preferredLanguage,
    message: matches
      ? 'This saved version is in your requested language. Its published classification and assessment rules still apply.'
      : 'Your requested language is not available in this exact saved version. The original version remains pinned; no translated layer has been substituted.',
  });
}
export type SpeechCapability = Readonly<{
  supported: boolean;
  voicesLoaded: boolean;
  voices: readonly Readonly<{ language: string; localService: boolean }>[];
}>;
export type ReadAloudPlan = Readonly<{
  status: 'content-unavailable' | 'unsupported' | 'voices-loading' | 'voice-unavailable' | 'ready';
  utteranceLanguage: string | null;
  message: string;
}>;
/** Candidate accepts only browser-reported local voices. Metadata is not an independent device audit. */
export function readAloudPlan(available: LanguageAvailability, capability: SpeechCapability): ReadAloudPlan {
  if (!available.contentLanguage)
    return Object.freeze({
      status: 'content-unavailable',
      utteranceLanguage: null,
      message: 'The saved lesson content is unavailable.',
    });
  if (!capability.supported)
    return Object.freeze({
      status: 'unsupported',
      utteranceLanguage: null,
      message: 'This browser cannot read this lesson aloud. The text and your saved work remain available.',
    });
  if (!capability.voicesLoaded)
    return Object.freeze({
      status: 'voices-loading',
      utteranceLanguage: null,
      message: 'Checking the browser voices for the saved lesson language.',
    });
  const voices: string[] = [];
  for (const voice of capability.voices) {
    if (voice?.localService !== true) continue;
    try {
      voices.push(canonicalLearningLanguage(voice.language));
    } catch {
      /* Unsupported voice metadata grants no language availability. */
    }
  }
  const language = available.contentLanguage,
    voice =
      voices.find((v) => sameLanguage(v, language)) ??
      voices.find((v) => v.split('-')[0] === language.split('-')[0]);
  return Object.freeze(
    voice
      ? {
          status: 'ready',
          utteranceLanguage: voice,
          message: 'Read the exact saved lesson using a browser-reported local voice.',
        }
      : {
          status: 'voice-unavailable',
          utteranceLanguage: null,
          message:
            'No matching local browser voice is available for this saved lesson. Do not substitute another language.',
        },
  );
}
export type CaptureMethod = 'human-reading' | 'human-transcription';
/** Future trusted offering policy; current v0.10 has no persisted accommodation approval object. */
export type CapturePolicy = Readonly<{
  contentRef: ContentRef;
  enabled: boolean;
  methods: readonly CaptureMethod[];
  responseLanguages: readonly string[];
}>;
export type ConfirmedCapture = Readonly<{
  contentRef: ContentRef;
  fields: Readonly<Record<string, string>>;
  declaration: Readonly<{
    method: CaptureMethod;
    responseLanguage: string;
    learnerConsent: true;
    learnerReadBackConfirmed: true;
    declaredNoAnswerCoaching: true;
  }>;
}>;
function captureFields(
  record: unknown,
  context: ContentContext,
  value: unknown,
): { ref: ContentRef; fields: Record<string, string> } {
  const resolved = tryResolvePinnedContent(record, context.allowedScopes, context.registry);
  if (!resolved.available) throw new InclusiveLearningError(resolved.message, 409);
  const prompts = resolved.snapshot.program.practicalAssessment.submissionPrompts;
  const input = exact(
      value,
      prompts.map((p) => p.id),
      'Captured response',
    ),
    fields: Record<string, string> = {};
  for (const prompt of prompts) {
    const v = input[prompt.id];
    if (typeof v !== 'string' || v.trim().length < 30 || v.length > 10000)
      throw new InclusiveLearningError(
        'Capture a complete response for ' +
          prompt.label +
          '. Current pilot text limits remain 30–10,000 characters.',
      );
    fields[prompt.id] = v.trim();
  }
  return { ref: resolved.snapshot.ref, fields };
}
/** In-memory confirmation copy only: no extra stored transcript, actor/helper access or approval proof. */
export function confirmHumanCapture(
  record: unknown,
  context: ContentContext,
  fields: unknown,
  declaration: unknown,
  policy: CapturePolicy,
): ConfirmedCapture {
  const captured = captureFields(record, context, fields);
  if (!policy.enabled || contentKey(policy.contentRef) !== contentKey(captured.ref))
    throw new InclusiveLearningError('This exact offering has no enabled assisted-capture policy.', 409);
  const d = exact(
    declaration,
    ['method', 'responseLanguage', 'learnerConsent', 'learnerReadBackConfirmed', 'declaredNoAnswerCoaching'],
    'Assistance declaration',
  );
  if (!['human-reading', 'human-transcription'].includes(d.method) || !policy.methods.includes(d.method))
    throw new InclusiveLearningError('This assistance method is not enabled for the exact offering.', 409);
  const responseLanguage = canonicalLearningLanguage(d.responseLanguage);
  if (!policy.responseLanguages.map(canonicalLearningLanguage).includes(responseLanguage))
    throw new InclusiveLearningError(
      'This offering has not enabled assessment of that response language.',
      409,
    );
  if (d.learnerConsent !== true || d.learnerReadBackConfirmed !== true || d.declaredNoAnswerCoaching !== true)
    throw new InclusiveLearningError(
      'Confirm consent, the captured response and the learner’s own reasoning before continuing.',
    );
  return deepFreeze({
    contentRef: captured.ref,
    fields: captured.fields,
    declaration: {
      method: d.method,
      responseLanguage,
      learnerConsent: true,
      learnerReadBackConfirmed: true,
      declaredNoAnswerCoaching: true,
    },
  });
}
/** Any field/pin edit requires another learner confirmation. No new submit action or bypass is created. */
export function assertConfirmedCapture(
  capture: ConfirmedCapture,
  record: unknown,
  context: ContentContext,
  currentFields: unknown,
  currentPolicy: CapturePolicy,
): void {
  const current = captureFields(record, context, currentFields);
  if (
    contentKey(current.ref) !== contentKey(capture.contentRef) ||
    Object.keys(current.fields).some((key) => current.fields[key] !== capture.fields[key])
  )
    throw new InclusiveLearningError(
      'Your captured response changed. Review it and confirm again before submitting.',
      409,
    );
  if (contentKey(pinnedRef(record)) !== contentKey(capture.contentRef))
    throw new InclusiveLearningError(
      'The saved learning reference changed. Confirm against its exact version.',
      409,
    );
  // Confirmation is not a lasting authorisation: current offering policy must still permit it.
  confirmHumanCapture(record, context, currentFields, capture.declaration, currentPolicy);
}
