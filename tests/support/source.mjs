// Several suites assert on the text of application source files. That source is Prettier-formatted, so the
// assertions compare a canonical form: no whitespace, single quotes, no trailing commas, no parentheses around a
// lone arrow parameter, no semicolon before a closing brace.
export const canonicalSource = (text) =>
  String(text)
    .replace(/\s+/g, '')
    .replace(/"/g, "'")
    .replace(/,([)\]}])/g, '$1')
    .replace(/;(\})/g, '$1')
    .replace(/\(([A-Za-z_$][\w$]*)\)=>/g, '$1=>');

/** True when `source` contains `needle` once both are reduced to the canonical form. */
export const includesSource = (source, needle) => canonicalSource(source).includes(canonicalSource(needle));

/** `assert.match` for source text: the subject is canonicalised, the pattern is written for the canonical form. */
export const canonical = canonicalSource;

/** A pattern written against minified source, reduced to the canonical form (spaces and double quotes removed). */
export const canonicalPattern = (re) =>
  new RegExp(re.source.replace(/ /g, '').replace(/"/g, "'").replace(/;\\\}/g, '\\}'), re.flags);
