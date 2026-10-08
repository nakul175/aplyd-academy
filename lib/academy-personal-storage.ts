import { readTestGrants, readTestReceipts, AdapterError } from './academy-ecosystems';
export const PERSONAL_MAX_BYTES = 1000000;
export const WITHDRAWAL_GROWTH_BYTES = 22; // null (4) -> quoted canonical 24-char UTC ISO (26)
export class PersonalSizingError extends Error {
  constructor(
    message: string,
    public status = 413,
  ) {
    super(message);
    this.name = 'PersonalSizingError';
  }
}
export function personalSizing(state: any) {
  let grants;
  try {
    grants = readTestGrants(state?.ecosystemGrants);
  } catch (e) {
    if (e instanceof AdapterError) throw new PersonalSizingError(e.message, 409);
    throw e;
  }
  // Receipt history is not authority for closure; measure raw owner bytes even when it is unavailable.
  let receiptHistoryValid = true;
  try {
    readTestReceipts(state?.ecosystemReceipts, grants);
  } catch (e) {
    if (e instanceof AdapterError) receiptHistoryValid = false;
    else throw e;
  }
  let data;
  try {
    data = JSON.stringify(state);
  } catch {
    throw new PersonalSizingError('Your saved learning cannot be measured.', 409);
  }
  if (typeof data !== 'string') throw new PersonalSizingError('Your saved learning is unavailable.', 409);
  const actualBytes = new TextEncoder().encode(data).length,
    reservedBytes = grants.filter((g) => g.revokedAt === null).length * WITHDRAWAL_GROWTH_BYTES;
  return {
    actualBytes,
    reservedBytes,
    effectiveBytes: actualBytes + reservedBytes,
    maxBytes: PERSONAL_MAX_BYTES,
    receiptHistoryValid,
  };
}
/** Applied by the personal API to every mutation, including plan/legacy/reset growth. */
export function ensurePersonalSizing(state: any) {
  const size = personalSizing(state);
  if (size.effectiveBytes > PERSONAL_MAX_BYTES)
    throw new PersonalSizingError(
      'This personal lab has reached its storage limit. Export your work before resetting it. Existing local choices can still be withdrawn.',
    );
  return size;
}
