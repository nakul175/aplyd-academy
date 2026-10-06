/**
 * Pure, read-only discovery facets over catalog programs (BR-06).
 *
 * Nothing here edits curriculum.json or a pinned edition. Where a pathway has no stored
 * value for a facet, the value is DERIVED here from existing metadata and labelled
 * DERIVED_LABEL so a learner is never told it is an authored fact. Missing data becomes
 * 'Not stated', never a guess.
 */
export const DERIVED_LABEL = 'Derived label (illustrative, not authored course data)';
export const NOT_STATED = 'Not stated';
export const FACET_KEYS = ['role', 'topic', 'language', 'level', 'format', 'effort'] as const;
export type FacetKey = typeof FACET_KEYS[number];
export const FACET_LABELS: Record<FacetKey, string> = { role: 'Work context', topic: 'Topic', language: 'Language', level: 'Level', format: 'Format', effort: 'Total effort' };
/** Facets whose values are derived here rather than stored on the pathway. */
export const DERIVED_FACETS: readonly FacetKey[] = ['topic', 'format', 'effort', 'language'];

export type FacetProgram = {
  id: string; title?: string; summary?: string; role?: string; ecosystem?: string; level?: string;
  estimatedMinutes?: number; outcomes?: readonly string[]; lessons?: readonly unknown[]; language?: string;
};
export type Facets = Record<FacetKey, string>;
export type Selection = { query: string } & Partial<Record<FacetKey, string>>;
export const EMPTY_SELECTION: Selection = { query: '' };

const TOPICS: Record<string, string> = { 'agri saha': 'Agriculture records', msme: 'Small business operations', government: 'Public administration' };
const LANGUAGES: Record<string, string> = { en: 'English' };
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

export function effortBand(minutes: unknown): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return NOT_STATED;
  if (minutes <= 60) return 'Up to 1 hour';
  if (minutes <= 120) return '1 to 2 hours';
  if (minutes <= 240) return '2 to 4 hours';
  return 'More than 4 hours';
}

/** editionLanguage is the edition-level language code (curriculum.language), shown as a derived label. */
export function deriveFacets(p: FacetProgram, editionLanguage = ''): Facets {
  const eco = text(p.ecosystem).toLowerCase();
  const lang = text(p.language) || text(editionLanguage).toLowerCase();
  return {
    role: text(p.role) || NOT_STATED,
    topic: TOPICS[eco] || text(p.ecosystem) || NOT_STATED,
    language: LANGUAGES[lang] || (lang ? lang : NOT_STATED),
    level: text(p.level) || NOT_STATED,
    format: Array.isArray(p.lessons) && p.lessons.length ? 'Self-paced lessons with a practical assessment' : NOT_STATED,
    effort: effortBand(p.estimatedMinutes),
  };
}

export function searchableText(p: FacetProgram, facets: Facets): string {
  return [p.title, p.summary, p.role, p.ecosystem, facets.topic, ...(p.outcomes ?? [])].filter(x => typeof x === 'string').join(' ').toLowerCase();
}

const tokens = (q: string) => q.toLowerCase().split(/\s+/).map(t => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);

export type CatalogItem<P extends FacetProgram = FacetProgram> = { program: P; facets: Facets; haystack: string; index: number };
export function indexCatalog<P extends FacetProgram>(programs: readonly P[], editionLanguage = ''): CatalogItem<P>[] {
  return programs.map((program, index) => { const facets = deriveFacets(program, editionLanguage); return { program, facets, haystack: searchableText(program, facets), index }; });
}

function matches(item: CatalogItem, sel: Selection, skip?: FacetKey): boolean {
  for (const key of FACET_KEYS) if (key !== skip && sel[key] && item.facets[key] !== sel[key]) return false;
  const words = tokens(sel.query ?? '');
  return words.every(w => item.haystack.includes(w));
}

/** Stable: results keep catalog order. Every facet is an exact AND filter; search words are AND-ed. */
export function filterCatalog<P extends FacetProgram>(items: readonly CatalogItem<P>[], sel: Selection): CatalogItem<P>[] {
  return items.filter(item => matches(item, sel));
}

/** Options for one facet with counts computed under all OTHER active filters, so a count is what you would get by choosing it. */
export function facetOptions(items: readonly CatalogItem[], sel: Selection, key: FacetKey): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) { if (!matches(item, sel, key)) continue; counts.set(item.facets[key], (counts.get(item.facets[key]) ?? 0) + 1); }
  for (const item of items) if (!counts.has(item.facets[key])) counts.set(item.facets[key], 0);
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
}

export function activeFilterCount(sel: Selection): number {
  return FACET_KEYS.filter(k => sel[k]).length + (tokens(sel.query ?? '').length ? 1 : 0);
}

export function resultsAnnouncement(shown: number, total: number, sel: Selection): string {
  if (!shown) return activeFilterCount(sel) ? 'No pathways match. Clear filters to see all ' + total + '.' : 'No pathways are available.';
  return `${shown} of ${total} pathway${total === 1 ? '' : 's'} shown.`;
}
