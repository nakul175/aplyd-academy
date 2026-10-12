/** A parser failure carries status metadata only, never the received body. */
export class AcademyResponseError extends Error {
  readonly status: number;
  readonly unverified: boolean;
  constructor(status: number, successful: boolean, mode: 'read' | 'write') {
    super(
      mode === 'write'
        ? 'The save response could not be verified. Refresh saved progress before saving again.'
        : 'The learning-space response could not be read. Refresh saved progress to verify your access.',
    );
    this.name = 'AcademyResponseError';
    this.status = status;
    this.unverified = successful || [401, 403, 404].includes(status);
  }
}
export const academyObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
/** Side-effect-free: callers apply their sequence fence before handling the error. */
export async function readAcademyResponse(response: Response, mode: 'read' | 'write'): Promise<any> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AcademyResponseError(response.status, response.ok, mode);
  }
  if (!academyObject(data)) throw new AcademyResponseError(response.status, response.ok, mode);
  return data;
}
export const verifiedAcademySubject = (id: unknown): id is string =>
  typeof id === 'string' && id.trim().length > 0;

/** Basic profile/enrollment render shape, not domain or permission validation. */
export const verifiedAcademyState = (state: unknown): boolean =>
  academyObject(state) &&
  academyObject(state.profile) &&
  typeof state.profile.name === 'string' &&
  state.profile.name.trim().length > 0 &&
  ['farmer', 'msme', 'public'].includes(state.profile.context) &&
  typeof state.profile.reading === 'boolean' &&
  typeof state.profile.networking === 'boolean' &&
  Array.isArray(state.enrollments) &&
  state.enrollments.every(
    (e: any) =>
      academyObject(e) &&
      verifiedAcademySubject(e.id) &&
      verifiedAcademySubject(e.programId) &&
      Array.isArray(e.completed) &&
      e.completed.every((id: unknown) => typeof id === 'string') &&
      Array.isArray(e.attempts) &&
      e.attempts.every(academyObject) &&
      Array.isArray(e.appeals) &&
      e.appeals.every(academyObject) &&
      academyObject(e.practice) &&
      academyObject(e.draft) &&
      (e.record == null || academyObject(e.record)),
  );
