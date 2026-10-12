// Generates docs/data/data-dictionary-loop.md and docs/api/practice-loop-api.md from the code, so the documents
// change in the same change as the code (ACA-US-12.4-AC2). tests/loop/docs.test.mjs fails when they are stale.
// Usage: node scripts/gen-loop-docs.mjs [--check]
import {DatabaseSync} from 'node:sqlite';
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..');

// Personal data and retention type per table: maintained by hand next to the generator.
const NOTES = {
  loop_decisions: ['Owner decisions (append-only).', 'none (owner user id)', 'kept'],
  loop_operators: ['APLYD operators and the owner.', 'user id', 'until revoked'],
  loop_orgs: ['Organisations.', 'none', 'kept'],
  loop_cohorts: ['Cohorts with workshop date and access period.', 'none', 'kept'],
  loop_start_groups: ['Staggered start groups (only with a recorded agreement).', 'none', 'kept'],
  loop_members: ['People in an organisation with one role each.', 'name, email, phone (only with a phone channel), job role', 'erasure on request; staff anonymised'],
  loop_invites: ['Single-use invite tokens (SHA-256).', 'none directly', 'retention type `invites`'],
  loop_audit: ['Who did what and when; never content.', 'actor user id (replaced by "erased" on erasure)', 'retention type `audit`'],
  loop_notices: ['Privacy notice versions.', 'none', 'kept'],
  loop_consents: ['Consent choices with notice version and time (append-only).', 'member id', 'erasure on request'],
  loop_levels: ['AI level history (placement and facilitator changes).', 'member id, placement score', 'erasure on request'],
  loop_level_requests: ['Requests to review a level.', 'free text reason', 'erasure on request'],
  loop_packs: ['Context packs.', 'none', 'kept'],
  loop_pack_reviewers: ['Named experts and reviewers per pack.', 'user id', 'until removed'],
  loop_pack_items: ['Immutable pack items with sources and status.', 'none', 'kept'],
  loop_pack_reviews: ['Expert decisions with reviewer and time.', 'reviewer user id', 'kept'],
  loop_pack_versions: ['Published versions with change lists.', 'none', 'kept'],
  loop_flags: ['Learner flags (error log).', 'member id (nulled on erasure), free text reason', 'kept for pack improvement'],
  loop_eval_cases: ['AI evaluation cases with data rights.', 'none (synthetic)', 'kept'],
  loop_eval_runs: ['Evaluation runs with replies and thresholds.', 'none', 'kept'],
  loop_ai_incidents: ['AI incident log.', 'reporter user id', 'kept'],
  loop_tasks: ['Practice tasks per learner and week.', 'member id', 'erasure on request'],
  loop_files: ['Own-work file metadata; bytes on disk under ACADEMY_FILES_PATH.', 'file name and content (learner work)', 'retention type `files`; erasure on request'],
  loop_coach_messages: ['Questions to the AI coach and replies.', 'learner text', 'retention type `coach_messages`; erasure on request'],
  loop_attempts: ['Learner attempts.', 'learner text', 'retention type `attempts`; erasure on request'],
  loop_submissions: ['Completed practice cycles (S-01, S-02).', 'note, link', 'retention type `submissions`; erasure on request'],
  loop_check_results: ['Unaided check scores with starting level.', 'member id, score', 'erasure on request'],
  loop_catch_results: ['Catch-the-AI results (S-03).', 'member id, counts', 'erasure on request'],
  loop_workshops: ['Workshop practice sessions.', 'facilitator user id', 'kept'],
  loop_reminders: ['Reminder log (channel, status), never content.', 'member id', 'retention type `reminders`'],
  loop_message_outbox: ['Local-only outbox for WhatsApp/SMS (refused in production).', 'phone, message', 'retention type `message_outbox`'],
  loop_cadence_assignments: ['Recorded cadence assignment (A-03).', 'member id', 'erasure on request'],
  loop_followups: ['Facilitator follow-up log.', 'free text outcome', 'erasure on request'],
  loop_reports: ['Prepared reports with approval and sharing record.', 'aggregates only (consented examples)', 'kept'],
  loop_deletion_runs: ['Retention job runs with counts.', 'none', 'kept'],
  loop_deletion_log: ['Deleted record ids, re-applied after a restore.', 'internal ids only', 'kept'],
  loop_help_reports: ['Help and problem reports.', 'free text', 'retention type `help_reports`'],
  loop_live_sessions: ['Live sessions per level.', 'none', 'kept'],
  loop_session_invites: ['Invites and attendance (context only).', 'member id', 'erasure on request'],
  loop_threads: ['Follow-up threads per session.', 'none', 'kept'],
  loop_posts: ['Thread posts with moderation fields.', 'first name, free text', 'retention type `community_posts`; erasure on request'],
  loop_confirmations: ['Supervisor or peer confirmations (S-04).', 'confirmer email, shared text', 'erasure on request'],
  loop_interviews: ['Consented interviews and anonymised summaries.', 'notes (free text)', 'erasure on request'],
  loop_change_list: ['Changes after the A-01 decision, with evidence.', 'none', 'kept'],
  loop_fix_proposals: ['Proposed fixes per logged error (pack v2).', 'none', 'kept'],
  loop_guardian_consents: ['Parent or guardian consent requests and answers (R3).', 'guardian email (erased on refusal or withdrawal)', 'until the end of the pilot'],
  loop_class_teachers: ['Which teacher sees which class (R3).', 'member ids', 'until the end of the pilot'],
  loop_renewals: ['Renewal decisions with source document (S-05).', 'none', 'kept'],
  loop_user_prefs: ['Interface language per user.', 'user id', 'erasure on request'],
  loop_ui_strings: ['Interface translations with review status.', 'reviewer user id', 'kept'],
  loop_pack_links: ['Translated pack ↔ source pack.', 'none', 'kept'],
  loop_item_translations: ['Translated item ↔ source lineage.', 'none', 'kept'],
  loop_annotations: ['Highlights and notes on pack items, with position.', 'user id, free text note', 'kept for pack improvement; erasure removes the person link'],
  loop_refinements: ['AI-proposed refinements and the expert decision.', 'none', 'kept'],
  loop_sponsors: ['Sponsors (philanthropy, association, CSR).', 'none', 'kept'],
  loop_sponsor_viewers: ['Sponsor staff who may see aggregate usage.', 'user id', 'until removed'],
  loop_invoices: ['Invoices and payment status; no card or bank details.', 'payer name', 'kept as required for accounts'],
  loop_sponsored_seats: ['Seats funded by a sponsor per cohort.', 'none', 'kept'],
};

function dataDictionary() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(join(root, 'drizzle')).filter(f => f.endsWith('.sql')).sort()) for (const p of readFileSync(join(root, 'drizzle', f), 'utf8').split('--> statement-breakpoint')) if (p.trim()) db.exec(p);
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'loop_%' ORDER BY name`).all().map(r => r.name);
  const out = ['# Data dictionary: practice loop', '', 'Generated by `node scripts/gen-loop-docs.mjs` from `drizzle/*.sql`. Do not edit by hand; edit the migration or the notes in the generator.', ''];
  const missing = [];
  for (const t of tables) {
    const n = NOTES[t]; if (!n) missing.push(t);
    out.push(`## ${t}`, '', n ? `${n[0]} Personal data: ${n[1]}. Retention: ${n[2]}.` : '**Undocumented table.**', '', '| Column | Type | Not null | Default | Key |', '| --- | --- | --- | --- | --- |');
    for (const c of db.prepare(`PRAGMA table_info(${t})`).all()) out.push(`| ${c.name} | ${c.type.toLowerCase()} | ${c.notnull ? 'yes' : ''} | ${c.dflt_value ?? ''} | ${c.pk ? 'PK' : ''} |`);
    out.push('');
  }
  return {text: out.join('\n'), missing};
}

async function apiDoc() {
  // Action names come from the running table (bundled with esbuild); the library function from the source line.
  const {build} = await import('esbuild');
  const out = join(root, '.sites-runtime/gen-docs/api.mjs');
  await build({stdin: {contents: "export {ACTIONS, PUBLIC_ACTIONS} from './lib/loop/api'; import './lib/loop/extensions';", resolveDir: root, loader: 'ts'}, bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'silent', alias: {'@': root}});
  const {ACTIONS, PUBLIC_ACTIONS} = await import(out + '?' + Date.now());
  const src = ['lib/loop/api.ts', 'lib/loop/extensions.ts'].map(f => readFileSync(join(root, f), 'utf8')).join('\n').split('\n');
  const fnOf = name => { const i = src.findIndex(l => l.includes(`'${name}'`)); if (i < 0) return '?'; const text = src.slice(i, i + 8).join(' '); const m = text.match(/\b(E|Lv|P|A|F|Pr|R|M|H|C|Ev|recordDecision)\b(?:\.(\w+))?\(/); return m ? (m[2] ? `${m[1]}.${m[2]}` : m[1]) : '?'; };
  const lines = ['# API contract: practice loop', '', 'Generated by `node scripts/gen-loop-docs.mjs` from `lib/loop/api.ts` and `lib/loop/extensions.ts`.', '',
    '`POST /api/loop` with `Content-Type: application/json` and body `{"action": "<name>", "params": {...}}`. Same-origin only; 300 KB limit. Answers JSON; errors are `{"error": "<plain English>"}` with 400 (invalid), 401 (sign in), 403 (refused, audited), 404, 409 (waiting for an owner decision or a conflict), 410 (link used or expired), 413, 415, 429 (rate limit), 503 (unavailable). Permission checks are inside the named library function.', '',
    'Other routes: `PUT /api/loop/files/<id>` (header `x-upload-offset`, body at most 512 KB) and `GET /api/loop/files/<id>` (owner only); `GET /api/loop/export` (my data as JSON); `POST /api/loop/jobs?job=all|reminders|retention|reapply-deletions` (Bearer `ACADEMY_JOBS_SECRET`); `POST /api/loop/inbound/whatsapp|sms` (header `x-academy-inbound-secret`, body `{from, text}`); `GET /api/health`.', '',
    'Module prefixes: E enrolment, Lv levels, P packs, A ai, F files, Pr practice, R reminders, M metrics, H help, C community, Ev evidence.', '',
    '| Action | Sign-in | Library function |', '| --- | --- | --- |'];
  const names = [...Object.keys(PUBLIC_ACTIONS), ...Object.keys(ACTIONS)];
  for (const n of names) lines.push(`| \`${n}\` | ${n in PUBLIC_ACTIONS ? 'no (single-use token)' : 'yes'} | \`${fnOf(n)}\` |`);
  return {text: lines.join('\n') + '\n', actions: names};
}

const dd = dataDictionary(), api = await apiDoc();
if (process.argv.includes('--check')) {
  const stale = [];
  if (readFileSync(join(root, 'docs/data/data-dictionary-loop.md'), 'utf8') !== dd.text) stale.push('data dictionary');
  if (readFileSync(join(root, 'docs/api/practice-loop-api.md'), 'utf8') !== api.text) stale.push('API contract');
  console.log(JSON.stringify({stale, undocumentedTables: dd.missing, actions: api.actions.length}));
  process.exit(stale.length || dd.missing.length ? 1 : 0);
}
writeFileSync(join(root, 'docs/data/data-dictionary-loop.md'), dd.text);
writeFileSync(join(root, 'docs/api/practice-loop-api.md'), api.text);
console.log(JSON.stringify({tables: dd.text.match(/^## /gm).length, undocumentedTables: dd.missing, actions: api.actions.length}));
