export type BeforeStartSummary = { prerequisites: string[]; passRule: string | null };
export function deriveBeforeStartSummary(input?: {
  snapshot?: unknown;
  globalSeed?: unknown;
}): BeforeStartSummary | null;
