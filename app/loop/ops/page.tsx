// APLYD operations: organisations (2.5), packs (3.1), owner decisions, AI assurance (7.2, 7.3), reports (6.3, 10.x),
// retention runs (6.5). Every action is checked and audited in lib/loop.
import Link from 'next/link';
import { Shell, pageContext } from '../shell';
import { operatorRole, pendingDecisions } from '@/lib/loop/core';
import { aiStatus, incidents } from '@/lib/loop/ai';
import { listReports } from '@/lib/loop/metrics';
import { retentionRuns } from '@/lib/loop/retention';
import { securityQueue } from '@/lib/loop/help';
import { s05, invoices } from '@/lib/loop/billing';
import { decision } from '@/lib/loop/core';
import { ActionForm, ActionButton } from '../client';
import s from '../loop.module.css';
export const dynamic = 'force-dynamic';

const AI_REASON: Record<string, string> = {
  on: 'On: the current configuration passed the evaluation',
  server_off: 'Off on this server (ACADEMY_AI_PROVIDER)',
  owner_off: 'Switched off by the owner',
  not_evaluated: 'Waiting: no passing evaluation of the current configuration and thresholds',
  evaluation_failed: 'Off: the latest evaluation failed',
};

/** A collapsed card: the page opens on what needs attention; everything else is one click away. */
function Fold({
  id,
  title,
  note,
  open = false,
  children,
}: {
  id?: string;
  title: string;
  note?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className={s.card} id={id} open={open} data-fold>
      <summary>
        <strong>{title}</strong>
        {note && <span className={s.muted}> · {note}</span>}
      </summary>
      {children}
    </details>
  );
}

export default async function Ops() {
  const { db, user } = await pageContext('/loop/ops');
  const role = await operatorRole(db, user.userId);
  if (!role)
    return (
      <Shell title="Operations" screen="ops">
        <div className={s.error} role="alert">
          Only APLYD operators can open this page.
        </div>
      </Shell>
    );
  const orgs = (
    await db
      .prepare('SELECT id, name, kind, sector FROM loop_orgs ORDER BY created_at')
      .all<{ id: string; name: string; kind: string; sector: string }>()
  ).results;
  const cohorts = (
    await db
      .prepare(
        'SELECT c.id, c.name, o.name org, c.pack_id FROM loop_cohorts c JOIN loop_orgs o ON o.id=c.org_id ORDER BY c.created_at',
      )
      .all<{ id: string; name: string; org: string; pack_id: string | null }>()
  ).results;
  const packs = (
    await db
      .prepare('SELECT id, title, sector, audience, language FROM loop_packs ORDER BY created_at')
      .all<{ id: string; title: string; sector: string; audience: string; language: string }>()
  ).results;
  const decisions = await pendingDecisions(db),
    ai = await aiStatus(db),
    inc = (await incidents(db, user)) as { at: string; effect: string; action: string }[];
  const reports = (await listReports(db, user)) as {
    id: string;
    kind: string;
    cohort_id: string;
    created_at: string;
    approved_at: string | null;
  }[];
  const runs = (await retentionRuns(db, user)) as { at: string; trigger: string; counts: string }[];
  const cases = (await db.prepare('SELECT count(*) n FROM loop_eval_cases').first<{ n: number }>())!.n;
  const security =
    role === 'owner'
      ? ((await securityQueue(db, user)) as {
          id: number;
          screen: string;
          body: string;
          at: string;
          status: string;
        }[])
      : [];
  const cohortOpts = cohorts.map((c) => [c.id, `${c.org}: ${c.name}`] as [string, string]);
  const scope = (await decision<{ epics: string[] }>(db, 'scope.release'))?.value.epics ?? [];
  const renewals = await s05(db),
    inv = (await invoices(db, user)) as {
      id: string;
      kind: string;
      amount_paise: number;
      payer: string;
      status: string;
      created_at: string;
    }[];
  const sponsors = (
    await db
      .prepare('SELECT id, name, kind FROM loop_sponsors ORDER BY created_at')
      .all<{ id: string; name: string; kind: string }>()
  ).results;
  const schools = orgs.filter((o) => o.kind === 'school');
  const waiting = decisions.filter((d) => !d.recorded).length,
    openSecurity = security.filter((x) => x.status === 'open').length;

  return (
    <Shell title={`Operations (${role})`} screen="ops">
      <section className={s.card} id="cohorts">
        <h2>At a glance</h2>
        <ul className={s.list}>
          <li>
            AI coach: <strong>{AI_REASON[ai.reason]}</strong>
          </li>
          <li>
            Owner decisions waiting: <strong>{waiting}</strong> of {decisions.length}
          </li>
          {role === 'owner' && (
            <li>
              Open security or privacy reports: <strong>{openSecurity}</strong>
            </li>
          )}
        </ul>
        <h3>Workshops</h3>
        {cohorts.length === 0 ? (
          <p>
            None yet. <Link href="/loop/setup">Set up a workshop</Link>
          </p>
        ) : (
          <ul className={s.list}>
            {cohorts.map((c) => (
              <li key={c.id}>
                <strong>
                  {c.org}: {c.name}
                </strong>{' '}
                · <Link href={`/loop/cohort/${c.id}`}>People</Link> ·{' '}
                <Link href={`/loop/facilitate/${c.id}`}>Workshop session</Link> ·{' '}
                <Link href={`/loop/ops/cohort/${c.id}`}>Evidence</Link>
              </li>
            ))}
          </ul>
        )}
        <p className={s.muted}>
          New workshop: use <Link href="/loop/setup">guided set-up</Link>. The folded sections below are for
          less frequent work.
        </p>
      </section>
      <section className={s.card} id="reports">
        <h2>Reports</h2>
        <ul className={s.list}>
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/loop/ops/reports/${r.id}`}>{r.kind}</Link>{' '}
              <span className={s.muted}>
                {r.created_at.slice(0, 10)} · {r.approved_at ? 'approved' : 'draft'}
              </span>
            </li>
          ))}
        </ul>
        <ActionForm
          action="report.week6"
          fields={[{ name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts }]}
          submit="Prepare week-6 A-01 report"
          done="go:/loop/ops/reports/{id}"
          id="r6"
        />
        <details>
          <summary>Prepare a day-30 or day-90 learning review</summary>
          <ActionForm
            action="report.review"
            fields={[
              { name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts },
              {
                name: 'day',
                label: 'Review',
                type: 'select',
                options: [
                  ['30', 'Day 30'],
                  ['90', 'Day 90'],
                ],
              },
            ]}
            submit="Prepare learning review"
            done="go:/loop/ops/reports/{id}"
            id="rr"
          />
        </details>
        <details>
          <summary>Prepare an impact or year-end report</summary>
          <ActionForm
            action="report.impact"
            fields={[
              { name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts },
              {
                name: 'kind',
                label: 'Report',
                type: 'select',
                options: [
                  ['impact', 'Impact report'],
                  ['year_end', 'Year-end report'],
                ],
              },
            ]}
            submit="Prepare report"
            done="go:/loop/ops/reports/{id}"
            id="ri"
          />
        </details>
      </section>
      <Fold id="organisations" title="Organisations" note={`${orgs.length}`}>
        <ul className={s.list}>
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/loop/org/${o.id}`}>{o.name}</Link>{' '}
              <span className={s.muted}>
                {o.kind} · {o.sector}
              </span>
              <details>
                <summary>Invite this organisation’s admin</summary>
                <ActionForm
                  id={`ia-${o.id}`}
                  action="org.invite"
                  params={{ orgId: o.id, role: 'admin' }}
                  fields={[
                    { name: 'name', label: 'Admin name', required: true },
                    { name: 'email', label: 'Admin email', type: 'email', required: true },
                  ]}
                  submit="Send single-use invite"
                  done="stay"
                  success="Invite sent."
                />
              </details>
            </li>
          ))}
        </ul>
        <h3>New organisation</h3>
        <ActionForm
          action="org.create"
          fields={[
            {
              name: 'kind',
              label: 'Type',
              type: 'select',
              options: [
                ['association', 'Association'],
                ['school', 'School'],
                ['university', 'University'],
                ['institute', 'Training institute'],
              ],
            },
            { name: 'name', label: 'Name', required: true },
            {
              name: 'sector',
              label: 'Sector',
              required: true,
              hint: 'For example textile, pharma, education, public service',
            },
            {
              name: 'agreementRef',
              label: 'Signed agreement reference',
              hint: 'Required for schools, universities and institutes',
            },
          ]}
          submit="Create organisation"
        />
      </Fold>
      {role === 'owner' && (
        <Fold title="Security and privacy reports" note={`${openSecurity} open`} open={openSecurity > 0}>
          {security.length === 0 ? (
            <p>None.</p>
          ) : (
            <ul className={s.list}>
              {security.map((x) => (
                <li key={x.id}>
                  <strong>#{x.id}</strong> {x.at.slice(0, 16)} · {x.screen} · {x.status}
                  <p className={s.prewrap}>{x.body}</p>
                  {x.status === 'open' && (
                    <ActionForm
                      id={`sec-${x.id}`}
                      action="help.resolve"
                      params={{ id: x.id }}
                      fields={[{ name: 'resolution', label: 'Resolution', required: true }]}
                      submit="Resolve"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Fold>
      )}
      <Fold id="packs" title="Context packs" note={`${packs.length}`}>
        <ul className={s.list}>
          {packs.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong>{' '}
              <span className={s.muted}>
                {p.sector} · {p.audience} · {p.language}
              </span>
              <details>
                <summary>Name a reviewer</summary>
                <ActionForm
                  id={`rv-${p.id}`}
                  action="pack.assignReviewer"
                  params={{ packId: p.id }}
                  fields={[
                    {
                      name: 'email',
                      label: 'Reviewer email (must have signed in once)',
                      type: 'email',
                      required: true,
                    },
                    {
                      name: 'role',
                      label: 'Role',
                      type: 'select',
                      options: [
                        ['expert', 'Sector expert'],
                        ['reviewer', 'Education or university reviewer'],
                        ['bilingual', 'Bilingual reviewer'],
                      ],
                    },
                  ]}
                  submit="Name reviewer"
                />
              </details>
              <details>
                <summary>Import an agent-drafted file</summary>
                <ActionForm
                  id={`im-${p.id}`}
                  action="pack.importDraft"
                  params={{ packId: p.id }}
                  fields={[
                    {
                      name: 'items',
                      label: 'Items (JSON array)',
                      type: 'textarea',
                      required: true,
                      rows: 6,
                      hint: 'Each item: kind, jobRole, level, title, body, sources [{title, url}]. Imported items are unchecked.',
                    },
                  ]}
                  submit="Import as unchecked"
                />
              </details>
              <details>
                <summary>Draft with AI from approved inputs</summary>
                <ActionForm
                  id={`ai-${p.id}`}
                  action="pack.draftAi"
                  params={{ packId: p.id }}
                  fields={[
                    { name: 'roles', label: 'Association role list (comma separated)', required: true },
                    {
                      name: 'sources',
                      label: 'Public sources (JSON array of {title, url})',
                      type: 'textarea',
                      required: true,
                      rows: 3,
                    },
                    { name: 'focus', label: 'Focus' },
                  ]}
                  submit="Draft items"
                />
              </details>
              <details>
                <summary>Use this pack for a cohort</summary>
                <ActionForm
                  id={`at-${p.id}`}
                  action="pack.attach"
                  params={{ packId: p.id }}
                  fields={[{ name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts }]}
                  submit="Attach"
                />
              </details>
            </li>
          ))}
        </ul>
        <h3>New pack</h3>
        <ActionForm
          action="pack.create"
          fields={[
            { name: 'title', label: 'Title', required: true },
            { name: 'sector', label: 'Sector', required: true },
            {
              name: 'audience',
              label: 'Audience',
              type: 'select',
              options: [
                ['learner', 'Association members'],
                ['teacher', 'Teachers'],
                ['university', 'University'],
                ['student', 'Students (R3 rules)'],
              ],
            },
            { name: 'language', label: 'Language code', value: 'en', required: true },
          ]}
          submit="Create pack"
        />
      </Fold>
      <Fold id="decisions" title="Owner decisions" note={`${waiting} waiting`}>
        <p className={s.muted}>
          Values that are the product owner’s to set. Features that need one wait until it is recorded. Only
          the owner can record.
        </p>
        <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Scrollable table">
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Decision</th>
                <th scope="col">Story</th>
                <th scope="col">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.key}>
                  <td>
                    <code>{d.key}</code>
                    <br />
                    {d.what}
                    <br />
                    <span className={s.muted}>{d.shape}</span>
                  </td>
                  <td>{d.story}</td>
                  <td>{d.recorded ? 'yes' : 'waiting'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {role === 'owner' && (
          <>
            <h3>Record a decision</h3>
            <ActionForm
              action="decision.record"
              fields={[
                {
                  name: 'key',
                  label: 'Decision',
                  type: 'select',
                  options: decisions.map((d) => [d.key, d.key] as [string, string]),
                },
                { name: 'scope', label: 'Scope (cohort or organisation id; empty for all)' },
                { name: 'value', label: 'Value (JSON)', type: 'textarea', required: true, rows: 4 },
                {
                  name: 'source',
                  label: 'Where you decided this (meeting, document, message)',
                  required: true,
                },
              ]}
              submit="Record decision"
              done="stay"
              success="Recorded."
            />
          </>
        )}
      </Fold>
      <Fold id="ai" title="AI assurance and incidents" note={AI_REASON[ai.reason]}>
        <p>
          Status: <strong>{AI_REASON[ai.reason]}</strong>. Evaluation set: {cases} case(s).
        </p>
        <div className={s.row}>
          <ActionButton action="eval.run" params={{}} label="Run the evaluation" />
          {role === 'owner' && (
            <ActionButton
              action="decision.record"
              params={{
                key: 'ai.enabled',
                value: { enabled: ai.reason !== 'owner_off' ? false : true },
                source: 'Owner switch in Operations',
              }}
              label={ai.reason === 'owner_off' ? 'Switch AI back on' : 'Switch AI off now'}
              secondary
            />
          )}
        </div>
        <details>
          <summary>Add an evaluation case</summary>
          <ActionForm
            id="ev"
            action="eval.addCase"
            fields={[
              {
                name: 'category',
                label: 'Category',
                type: 'select',
                options: [
                  ['hint_first', 'Hint first'],
                  ['uncertainty', 'Admits uncertainty'],
                  ['refusal', 'Refuses unsafe'],
                  ['feedback', 'Feedback after attempt'],
                  ['privacy', 'Privacy'],
                ],
              },
              {
                name: 'mode',
                label: 'Stage',
                type: 'select',
                options: [
                  ['hint', 'Before an attempt'],
                  ['feedback', 'After an attempt'],
                ],
              },
              { name: 'sector', label: 'Sector', value: 'textile', required: true },
              { name: 'task', label: 'Task', required: true },
              { name: 'learnerMessage', label: 'Learner message', type: 'textarea', required: true, rows: 2 },
              { name: 'expected', label: 'Expected behaviour', required: true },
              {
                name: 'checks',
                label: 'Automatic checks (JSON {mustMatch:[], mustNotMatch:[]})',
                type: 'textarea',
                required: true,
                rows: 2,
              },
              { name: 'dataRights', label: 'Data rights of this material', required: true },
            ]}
            submit="Add case"
            done="stay"
          />
        </details>
        <details>
          <summary>Import an evaluation set (JSON)</summary>
          <ActionForm
            id="evi"
            action="eval.import"
            fields={[
              {
                name: 'cases',
                label: 'Cases (the docs/ai/evaluation-set-draft.json format)',
                type: 'textarea',
                required: true,
                rows: 6,
              },
            ]}
            submit="Import cases"
            done="refresh"
          />
        </details>
        <h3>Incidents</h3>
        <ul className={s.list}>
          {inc.map((i, k) => (
            <li key={k}>
              {i.at.slice(0, 16)}: {i.effect} <span className={s.muted}>→ {i.action}</span>
            </li>
          ))}
        </ul>
        <ActionForm
          action="ai.incident"
          fields={[
            { name: 'effect', label: 'Effect', required: true },
            { name: 'action', label: 'Action taken', required: true },
          ]}
          submit="Log incident"
          done="stay"
        />
      </Fold>
      <Fold title="Later releases in scope" note={scope.length ? scope.join(', ') : 'none'}>
        <p>
          {scope.length
            ? scope.join(', ')
            : 'None yet. The owner records scope.release when a strategy version brings an epic in.'}
        </p>
        {scope.includes('ACA-E13') && (
          <details>
            <summary>Draft this month’s briefs (E13)</summary>
            <ActionForm
              id="brf"
              action="brief.draft"
              fields={[
                {
                  name: 'packId',
                  label: 'Pack',
                  type: 'select',
                  options: packs.map((p) => [p.id, p.title] as [string, string]),
                },
                { name: 'month', label: 'Month (YYYY-MM)', required: true },
                { name: 'roles', label: 'Roles (comma separated)', required: true },
                { name: 'levels', label: 'Levels (comma separated, e.g. L1,L2,L3)', required: true },
                {
                  name: 'sources',
                  label: 'Approved sources (JSON array of {title, url})',
                  type: 'textarea',
                  required: true,
                  rows: 3,
                },
              ]}
              submit="Draft briefs for expert review"
            />
          </details>
        )}
        {scope.includes('ACA-E16') && (
          <ActionForm
            id="evp"
            action="report.evidencePack"
            fields={[{ name: 'cohortIds', label: 'Cohort ids (comma separated)', required: true }]}
            submit="Prepare the university evidence pack"
            done="go:/loop/ops/reports/{id}"
          />
        )}
        {scope.includes('ACA-E19') && (
          <div className={s.row}>
            <ActionButton action="ui.draft" params={{}} label="Draft interface translations" secondary />
            {packs
              .filter((p) => p.language === 'en')
              .map((p) => (
                <ActionButton
                  key={p.id}
                  action="pack.translate"
                  params={{ packId: p.id }}
                  label={`Translate ${p.title}`}
                  secondary
                />
              ))}
          </div>
        )}
      </Fold>
      {schools.length > 0 && (
        <Fold title="Student pilot (R3)">
          <ActionForm
            id="harm"
            action="harm.prepare"
            fields={[{ name: 'cohortId', label: 'School cohort', type: 'select', options: cohortOpts }]}
            submit="Prepare the harm review"
            done="go:/loop/ops/reports/{id}"
          />
          {schools.map((o) => (
            <details key={o.id}>
              <summary>End of pilot: {o.name}</summary>
              <p className={s.muted}>
                Needs the school’s written instruction recorded by the owner as school.end_instruction.
                Deletes every student record (after export if the school asked for its data back).
              </p>
              <ActionButton
                action="school.endOfPilot"
                params={{ orgId: o.id }}
                label="Carry out the school’s instruction"
                confirmText="Confirm: delete all student data now"
              />
            </details>
          ))}
        </Fold>
      )}
      <Fold title="Renewals and billing">
        <p>
          S-05 renewals:{' '}
          {renewals.S05.value === null
            ? 'no eligible organisation yet'
            : `${Math.round(renewals.S05.value * 100)}% (${renewals.S05.numerator}/${renewals.S05.denominator})`}
          ; unconfirmed entries not counted: {renewals.unconfirmed}.
        </p>
        {role === 'owner' && (
          <details>
            <summary>Record a renewal decision</summary>
            <ActionForm
              id="ren"
              action="renewal.record"
              fields={[
                {
                  name: 'orgId',
                  label: 'Organisation',
                  type: 'select',
                  options: orgs.map((o) => [o.id, o.name] as [string, string]),
                },
                {
                  name: 'decision',
                  label: 'Decision',
                  type: 'select',
                  options: [
                    ['renew', 'Renew'],
                    ['not_renew', 'Not renewing'],
                  ],
                },
                { name: 'decidedOn', label: 'Decided on', type: 'date', required: true },
                { name: 'reason', label: 'Reason', required: true },
                {
                  name: 'sourceRef',
                  label: 'Source document (letter, email, contract)',
                  hint: 'Without it the renewal is saved as unconfirmed and not counted',
                },
                { name: 'months', label: 'Months of access', type: 'number' },
              ]}
              submit="Record"
            />
          </details>
        )}
        {scope.includes('ACA-E21') && (
          <>
            <ActionForm
              id="cap"
              action="cohort.cap"
              fields={[
                { name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts },
                { name: 'cap', label: 'Participant cap', type: 'number', required: true },
              ]}
              submit="Set cap"
            />
            <ActionForm
              id="iw"
              action="invoice.workshop"
              fields={[
                { name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts },
                { name: 'payer', label: 'Payer', required: true },
              ]}
              submit="Issue workshop invoice"
              done="show"
            />
            <h3>Sponsors</h3>
            <ul className={s.list}>
              {sponsors.map((sp) => (
                <li key={sp.id}>
                  <a href={`/loop/sponsor/${sp.id}`}>{sp.name}</a> ({sp.kind})
                  <details>
                    <summary>Fund seats</summary>
                    <ActionForm
                      id={`fs-${sp.id}`}
                      action="sponsor.fund"
                      params={{ sponsorId: sp.id }}
                      fields={[
                        { name: 'cohortId', label: 'Cohort', type: 'select', options: cohortOpts },
                        { name: 'seats', label: 'Seats', type: 'number', required: true },
                      ]}
                      submit="Fund and invoice the sponsor"
                    />
                  </details>
                  <details>
                    <summary>Give sponsor staff the usage view</summary>
                    <ActionForm
                      id={`sv-${sp.id}`}
                      action="sponsor.viewer"
                      params={{ sponsorId: sp.id }}
                      fields={[
                        {
                          name: 'email',
                          label: 'Email (must have signed in once)',
                          type: 'email',
                          required: true,
                        },
                      ]}
                      submit="Add"
                    />
                  </details>
                </li>
              ))}
            </ul>
            <ActionForm
              id="sp"
              action="sponsor.create"
              fields={[
                { name: 'name', label: 'Sponsor name', required: true },
                {
                  name: 'kind',
                  label: 'Kind',
                  type: 'select',
                  options: [
                    ['philanthropy', 'Philanthropy'],
                    ['association', 'Association'],
                    ['csr', 'CSR'],
                  ],
                },
              ]}
              submit="Add sponsor"
            />
            <h3>Invoices</h3>
            <ul className={s.list}>
              {inv.map((i) => (
                <li key={i.id}>
                  {i.created_at.slice(0, 10)} · {i.kind} · {i.payer} · ₹
                  {(i.amount_paise / 100).toLocaleString('en-IN')} · {i.status}
                </li>
              ))}
            </ul>
          </>
        )}
      </Fold>
      {role === 'owner' && (
        <Fold title="Security findings: your decision on remaining risks">
          <p className={s.muted}>Findings are listed in docs/security/findings.md in the repository.</p>
          <ActionForm
            id="risk"
            action="risk.decide"
            fields={[
              { name: 'findingId', label: 'Finding id (for example F-05)', required: true },
              {
                name: 'decision',
                label: 'Decision',
                type: 'select',
                options: [
                  ['accept', 'Accept the remaining risk'],
                  ['reject', 'Reject: it must be fixed'],
                ],
              },
              { name: 'note', label: 'Note' },
            ]}
            submit="Record my decision"
            done="stay"
          />
        </Fold>
      )}
      <Fold title="Retention runs" note={`${runs.length}`}>
        <ul className={s.list}>
          {runs.map((r, k) => (
            <li key={k}>
              {r.at.slice(0, 16)} · {r.trigger} · {r.counts}
            </li>
          ))}
        </ul>
      </Fold>
    </Shell>
  );
}
