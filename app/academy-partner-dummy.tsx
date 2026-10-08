'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plug, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CONSENT_SCOPES,
  LIMITS,
  type ConsentScope,
  type PartnerLink,
  type Delivery,
} from '@/lib/academy-partner-dummy';
import { useAcademy } from './academy-context';
import { Head, Tag, Empty, Pick, date } from './academy-ui';
type View = {
  label: string;
  partnerConfigured: boolean;
  now: string;
  links: (PartnerLink & { activeScopes: ConsentScope[] })[];
  deliveries: Delivery[];
  pendingClaims: { id: string; memberCode: string; pathwayId: string; expiresAt: string }[];
};
const scopeLabel: Record<ConsentScope, string> = {
  progress: 'Progress status (enrolled / in progress) and start date',
  completion: 'Completion (yes or no) and completion date',
  'credential-status': 'Credential status (the issuer is not connected in this build)',
};
const send = async (url: string, body?: unknown) => {
  const r = await fetch(
    url,
    body === undefined
      ? { cache: 'no-store' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'This could not be completed. Nothing was sent.');
  return j;
};
/**
 * DUMMY partner panel. Mount in a personal-lab view only. Everything here talks to a fictional registry
 * on this computer's loopback address; no real organisation is contacted.
 */
export default function PartnerDummyView() {
  const { state, team } = useAcademy();
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(''),
    [code, setCode] = useState(''),
    [enrollmentId, setEnrollmentId] = useState(''),
    [days, setDays] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    try {
      setView(await send('/api/partner/links'));
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    if (!team) void refresh();
  }, [team, refresh]);
  const act = async (url: string, body: unknown, done: string) => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const j = await send(url, body);
      if (j.view) setView(j.view);
      else setView(j);
      setNote(j.result?.note ?? done);
    } catch (e: any) {
      setError(e.message);
      void refresh();
    } finally {
      setBusy(false);
    }
  };
  if (team)
    return (
      <Empty
        icon={Plug}
        title="The dummy partner belongs in your personal lab"
        body="Shared workspaces do not link to or send learning data to any partner, including the dummy."
      />
    );
  const enrollments = (state?.enrollments ?? []).filter((e: any) => !e.withdrawn);
  const live = view?.links.filter((l) => l.unlinkedAt === null) ?? [];
  return (
    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Head
        eyebrow="DUMMY PARTNER · LOOPBACK ONLY"
        title="Link a partner member. You choose what it can see."
        body="A fictional DEMO Partner Registry runs on this computer. Nothing here reaches a real organisation."
      />
      <div className="notice">
        <ShieldCheck />
        <div>
          <strong>DUMMY partner, loopback only, no real organisation contacted.</strong>
          <p>
            Each item below is separately granted, expires, and can be withdrawn. Your name, email, answers,
            evidence, scores and feedback are never sent or shown. Real partner connections are not built.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="notice error-notice mt">
          <p>
            <strong>This needs your attention.</strong> {error}
          </p>
        </div>
      )}
      {note && (
        <p className="notice mt" role="status">
          {note}
        </p>
      )}
      {view && !view.partnerConfigured && (
        <p className="notice mt" role="status">
          Dummy partner not running. Start it with <code>node scripts/demo/dummy-partner.mjs</code> and set
          ACADEMY_DUMMY_PARTNER_URL to its loopback address. Linking and sending stay unavailable until then.
        </p>
      )}
      <section className="panel mt">
        <h2>Link a DEMO member code</h2>
        <div className="field mt">
          <label htmlFor="partner-code">DEMO member code (for example DEMO-AAA001)</label>
          <Input
            id="partner-code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
            maxLength={16}
            autoComplete="off"
          />
        </div>
        <Pick
          label="Learning to link"
          value={enrollmentId}
          onChange={setEnrollmentId}
          options={enrollments.map((e: any) => ({ value: e.id, label: e.programId }))}
        />
        <div className="actions mt">
          <Button
            disabled={
              busy || !view?.partnerConfigured || !code || !enrollmentId || live.length >= LIMITS.links
            }
            onClick={() =>
              act(
                '/api/partner/links',
                { type: 'link', memberCode: code, enrollmentId },
                'Linked. Nothing is shared until you grant an item below.',
              )
            }
          >
            Link member (dummy)
          </Button>
        </div>
        <p className="form-hint">Linking shares nothing by itself.</p>
      </section>
      {live.map((l) => {
        const pending = view?.pendingClaims.find((c) => c.memberCode === l.memberCode);
        return (
          <section className="panel mt" key={l.id}>
            <div className="section-title no-top">
              <h2>{l.memberCode}</h2>
              <Tag>DUMMY</Tag>
            </div>
            <p className="form-hint">
              Pathway {l.pathwayId} · edition {l.edition} · linked {date(l.linkedAt)}
            </p>
            {pending && (
              <p className="form-hint">
                The dummy partner left a pending enrolment request for this code ({pending.pathwayId}). It
                created no account or enrolment.
              </p>
            )}
            {CONSENT_SCOPES.map((scope) => {
              const active = l.activeScopes.includes(scope),
                c = [...l.consents].reverse().find((c) => c.scope === scope),
                d = days[l.id + scope] ?? '7';
              return (
                <div key={scope} className="mt">
                  <p>
                    <strong>{scopeLabel[scope]}</strong> ·{' '}
                    {active
                      ? 'granted until ' + date(c!.expiresAt)
                      : c?.withdrawnAt
                        ? 'withdrawn'
                        : c && Date.parse(c.expiresAt) <= Date.parse(view!.now)
                          ? 'expired'
                          : 'not granted'}
                  </p>
                  <div className="actions">
                    <Pick
                      label={`Days for ${scope}`}
                      value={d}
                      onChange={(v: string) => setDays((p) => ({ ...p, [l.id + scope]: v }))}
                      options={[
                        { value: '1', label: '1 day' },
                        { value: '7', label: '7 days' },
                        { value: '30', label: '30 days' },
                        { value: '90', label: '90 days' },
                      ]}
                    />
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        act(
                          '/api/partner/links',
                          { type: 'grant', linkId: l.id, scope, days: Number(d) },
                          'Granted. Withdraw any time.',
                        )
                      }
                    >
                      {active ? 'Renew' : 'Grant'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || !active}
                      onClick={() =>
                        act(
                          '/api/partner/links',
                          { type: 'withdraw', linkId: l.id, scope },
                          'Withdrawn. Nothing further will be sent for this item.',
                        )
                      }
                    >
                      Withdraw
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="actions mt">
              <Button
                disabled={busy || !l.activeScopes.length || !view?.partnerConfigured}
                onClick={() => act('/api/partner/deliver', { linkId: l.id }, '')}
              >
                {view?.partnerConfigured ? 'Send progress to partner (dummy)' : 'Dummy partner not running'}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(
                    '/api/partner/links',
                    { type: 'unlink', linkId: l.id },
                    'Unlinked. All grants withdrawn and unsent updates blocked.',
                  )
                }
              >
                Unlink and withdraw everything
              </Button>
            </div>
            <p className="form-hint">
              Sending happens only when you press the button. An update already accepted by the dummy partner
              cannot be recalled.
            </p>
          </section>
        );
      })}
      <section className="panel mt">
        <h2>Delivery log (dummy)</h2>
        {!view?.deliveries.length ? (
          <p className="mt">Nothing sent yet.</p>
        ) : (
          view.deliveries.map((d) => (
            <details className="source-packet" key={d.id}>
              <summary>
                {d.status} · {date(d.createdAt)} · {d.scopes.join(', ')} · {d.attempts.length} attempt
                {d.attempts.length === 1 ? '' : 's'}
              </summary>
              <p>{d.note}</p>
              {d.nextAttemptAt && <p>Retry allowed after {d.nextAttemptAt}</p>}
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  maxWidth: '100%',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(d.payload, null, 2)}
              </pre>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
