import archivedSeed from './curriculum-versions/0.1-review-draft.json';

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
export const curriculumRegistry = createCurriculumRegistry(seedSnapshots);

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
