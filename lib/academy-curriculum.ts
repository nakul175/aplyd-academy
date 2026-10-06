import archivedSeed from './curriculum-versions/0.1-review-draft.json';
import editionTwoEnglish from './curriculum-versions/0.2-review-draft.json';
import editionTwoHindi from './curriculum-versions/0.2-review-draft-hi.json';

/** Immutable content lookup. This module neither grants access nor publishes content. */
export type ContentScope = 'global' | `tw-${string}`;
export type ContentRef = Readonly<{
  scope: ContentScope;
  programId: string;
  versionId: string;
}>;
export type DeepReadonly<T> = T extends (...args: any[]) => any ? T
  : T extends readonly (infer V)[] ? readonly DeepReadonly<V>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
export type Program = DeepReadonly<(typeof archivedSeed.pathways)[number]>;
export type ContentSnapshot = Readonly<{
  ref: ContentRef;
  program: Program;
  language: string;
  audience: string;
  classification: string;
}>;

export const LEGACY_CONTENT_VERSION = '0.1-review-draft' as const;
export const LEGACY_SOURCE_SHA256 = '9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4';
/** Additional global editions. Each archive is immutable once pinned; the default for new enrollment is unchanged (see CONTENT_VERSION). */
export const EDITION_0_2_VERSION = '0.2-review-draft' as const;
export const EDITION_0_2_HINDI_VERSION = '0.2-review-draft-hi' as const;
export const EDITION_PINS = Object.freeze({
  [LEGACY_CONTENT_VERSION]: Object.freeze({file: '0.1-review-draft.json', sha256: LEGACY_SOURCE_SHA256, byteLength: 65054}),
  [EDITION_0_2_VERSION]: Object.freeze({file: '0.2-review-draft.json', sha256: '1a89fd6c7649dfefd50183344d885da3b0fd97b818399e62e0d615ba48b41080', byteLength: 192932}),
  [EDITION_0_2_HINDI_VERSION]: Object.freeze({file: '0.2-review-draft-hi.json', sha256: 'f38a738756cd67dbb3cae3e38c37f7c9311ede2b4edbee6cb5299c16a6d9b83b', byteLength: 112615}),
});
export const HINDI_DRAFT_LABEL = 'Hindi draft — machine-assisted, needs native review' as const;
/** Current discovery uses this explicit reference; historical reads must not. */
export const CONTENT_VERSION = LEGACY_CONTENT_VERSION;

export class ContentResolutionError extends Error {
  constructor(message: string, public readonly status: number = 409) {
    super(message);
    this.name = 'ContentResolutionError';
  }
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function validScope(value: unknown): value is ContentScope {
  return value === 'global'
    || (typeof value === 'string' && /^tw-[a-z0-9-]{20,80}$/i.test(value));
}
export function contentRef(value: unknown): ContentRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentResolutionError('The saved content reference is invalid. Contact support before continuing.');
  }
  const ref = value as Record<string, unknown>;
  if (Object.keys(ref).some(key => !['scope', 'programId', 'versionId'].includes(key))
      || !validScope(ref.scope)
      || typeof ref.programId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/i.test(ref.programId)
      || typeof ref.versionId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(ref.versionId)) {
    throw new ContentResolutionError('The saved content reference is invalid. Contact support before continuing.');
  }
  return Object.freeze({scope: ref.scope, programId: ref.programId, versionId: ref.versionId});
}

/** JSON tuple keys avoid ambiguous delimiter concatenation and normalize no identity. */
export function contentKey(value: ContentRef): string {
  const ref = contentRef(value);
  return JSON.stringify([ref.scope, ref.programId, ref.versionId]);
}

/** Legacy rows remain unchanged; an explicit new reference must agree with legacy fields. */
export function pinnedRef(value: unknown): ContentRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentResolutionError('The saved learning reference is invalid.');
  }
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, 'contentRef')) {
    const ref = contentRef(record.contentRef);
    if ((record.programId !== undefined && record.programId !== ref.programId)
        || (record.version !== undefined && record.version !== ref.versionId)) {
      throw new ContentResolutionError('Saved learning and content references disagree. Contact support before continuing.');
    }
    return ref;
  }
  // No default version: a malformed historical row must never select current content.
  return contentRef({scope: 'global', programId: record.programId, versionId: record.version});
}

export type CurriculumRegistry = Readonly<{
  resolve: (ref: ContentRef, allowedScopes?: readonly ContentScope[]) => ContentSnapshot;
  has: (ref: ContentRef, allowedScopes?: readonly ContentScope[]) => boolean;
}>;

/** Useful for explicit future registry assembly and isolated tests, never mutable registration. */
export function createCurriculumRegistry(entries: readonly ContentSnapshot[]): CurriculumRegistry {
  const index = new Map<string, ContentSnapshot>();
  for (const entry of entries) {
    const ref = contentRef(entry.ref);
    if (entry.program.id !== ref.programId) {
      throw new ContentResolutionError('A content snapshot has a mismatched pathway identity.');
    }
    const key = contentKey(ref);
    if (index.has(key)) throw new ContentResolutionError('An immutable content key is already registered.');
    // Detach caller-owned input before freezing so later caller edits cannot alter this registry.
    index.set(key, deepFreeze(structuredClone({...entry, ref})));
  }
  function resolve(input: ContentRef, allowedScopes: readonly ContentScope[] = ['global']): ContentSnapshot {
    const ref = contentRef(input);
    // allowedScopes must come from the caller's trusted server policy or a server-filtered projection.
    if (!allowedScopes.includes(ref.scope)) {
      throw new ContentResolutionError('This content is not available in your learning space.', 404);
    }
    const found = index.get(contentKey(ref));
    if (!found) {
      throw new ContentResolutionError('Your pinned curriculum version is unavailable. Contact support before continuing.');
    }
    return found;
  }
  return Object.freeze({resolve, has: (ref: ContentRef, allowedScopes?: readonly ContentScope[]) => {
    try { resolve(ref, allowedScopes); return true; }
    catch (error) { if (error instanceof ContentResolutionError) return false; throw error; }
  }});
}

/** Preserve the archived bytes separately; freezing applies to a detached in-memory copy. */
export const curriculum = deepFreeze(structuredClone(archivedSeed));
export const programs = curriculum.pathways;
const seedSnapshots: readonly ContentSnapshot[] = programs.map(program => ({
  ref: contentRef({scope: 'global', programId: program.id, versionId: LEGACY_CONTENT_VERSION}),
  program,
  language: curriculum.language,
  audience: curriculum.audience,
  classification: curriculum.status,
}));
/** 0.2 content is registered for EXPLICIT references only. Nothing selects it by default. */
const editionTwoSnapshots: readonly ContentSnapshot[] = [editionTwoEnglish, editionTwoHindi].flatMap(edition =>
  edition.pathways.map(program => ({
    ref: contentRef({scope: 'global', programId: program.id, versionId: edition.contentVersion}),
    program: program as unknown as Program,
    language: edition.language,
    audience: edition.audience,
    classification: edition.status,
  })));
export const additionalGlobalEditions: readonly ContentSnapshot[] = deepFreeze(structuredClone(editionTwoSnapshots as ContentSnapshot[]));
export const curriculumRegistry = createCurriculumRegistry([...seedSnapshots, ...editionTwoSnapshots]);

/** Lesson alternatives added in 0.2. Absent on 0.1 lessons, so callers must treat every field as optional. */
export type LessonFormats = Readonly<{transcript?: string; summary?: string; audio?: Readonly<{status: string; label: string; note: string}>}>;
export function lessonFormats(lesson: unknown): LessonFormats {
  const l = (lesson && typeof lesson === 'object' ? lesson : {}) as Record<string, any>;
  const audio = l.audio && typeof l.audio === 'object' && typeof l.audio.label === 'string' && typeof l.audio.note === 'string'
    ? {status: String(l.audio.status), label: l.audio.label, note: l.audio.note} : undefined;
  return {
    transcript: typeof l.transcript === 'string' && l.transcript ? l.transcript : undefined,
    summary: typeof l.summary === 'string' && l.summary ? l.summary : undefined,
    audio,
  };
}

export type EditionLanguageNotice = Readonly<{
  kind: 'none' | 'viewing-draft-translation' | 'translation-available-not-pinned' | 'fallback-english';
  message: string;
  /** Present only when a draft translation exists. Informational; it never changes an enrollment's pin. */
  availableRef: ContentRef | null;
}>;
/** Maps a language preference to what actually exists. Never substitutes content: callers keep the pinned reference they hold. */
export function editionLanguageNotice(programId: string, preferredLanguage: string, pinnedLanguage: string): EditionLanguageNotice {
  const want = String(preferredLanguage || 'en').toLowerCase().split('-')[0];
  const have = String(pinnedLanguage || 'en').toLowerCase().split('-')[0];
  if (want === have) {
    return have === 'en' ? {kind: 'none', message: '', availableRef: null}
      : {kind: 'viewing-draft-translation', message: `${HINDI_DRAFT_LABEL}. Exercise packets and the practical assessment are still in English.`, availableRef: null};
  }
  const translated = editionTwoSnapshots.find(s => s.ref.programId === programId && s.language.toLowerCase().split('-')[0] === want);
  if (translated) {
    return {kind: 'translation-available-not-pinned', availableRef: translated.ref,
      message: `${HINDI_DRAFT_LABEL}: a draft of this pathway exists in your language. Your saved edition has not changed and stays in ${have === 'en' ? 'English' : have}.`};
  }
  return {kind: 'fallback-english', availableRef: null,
    message: `No ${want} edition of this pathway exists yet, so it is shown in ${have === 'en' ? 'English' : have}. Your saved edition has not changed.`};
}

export function currentRef(programId: string): ContentRef {
  // Only discovery/new offering paths should call this function.
  return contentRef({scope: 'global', programId, versionId: CONTENT_VERSION});
}
export function resolveCurrentProgram(programId: string): Program {
  if (!programs.some(program => program.id === programId)) {
    throw new ContentResolutionError('Pathway not found.', 404);
  }
  return curriculumRegistry.resolve(currentRef(programId)).program;
}
export type ContentContext = Readonly<{registry:CurriculumRegistry;allowedScopes:readonly ContentScope[]}>;
export function resolvePinnedContent(record: unknown, allowedScopes?: readonly ContentScope[], registry:CurriculumRegistry=curriculumRegistry): ContentSnapshot {
  return registry.resolve(pinnedRef(record), allowedScopes);
}
export function resolvePinnedProgram(record: unknown, allowedScopes?: readonly ContentScope[], registry:CurriculumRegistry=curriculumRegistry): Program {
  return resolvePinnedContent(record, allowedScopes,registry).program;
}
export function tryResolvePinnedContent(record: unknown, allowedScopes?: readonly ContentScope[], registry:CurriculumRegistry=curriculumRegistry):
  {available: true; snapshot: ContentSnapshot} | {available: false; message: string} {
  try { return {available: true, snapshot: resolvePinnedContent(record, allowedScopes,registry)}; }
  catch (error) {
    if (error instanceof ContentResolutionError) return {available: false, message: error.message};
    throw error;
  }
}

export default curriculum;
