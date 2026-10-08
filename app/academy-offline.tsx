'use client';
import { useEffect, useRef, useState, useId } from 'react';
import { Download, LockKeyhole, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useAcademy } from './academy-context';
import { pinnedRef, contentKey, resolvePinnedContent } from '@/lib/academy-curriculum';
import {
  acknowledgeOfflineSave,
  buildOfflinePacket,
  createOfflineDraft,
  inspectOfflineDraft,
  offlineDraftAvailability,
  offlineDraftKey,
  offlinePacketHtml,
  prepareOfflineSave,
  putOfflineDraft,
  rebaseOfflineDraft,
  reviewOfflineDraft,
  updateOfflineDraft,
  type OfflineDraft,
  type OfflineReadContext,
  type OfflineTarget,
} from '@/lib/academy-offline';
import {
  deleteAllSealedDrafts,
  deleteSealedDraft,
  loadSealedDraft,
  parseSealedDraftFile,
  sealDraftQueue,
  sealedScopeHash,
  storeSealedDraft,
  unlockDraftQueue,
  type SealedDraftFile,
  SEALED_DRAFT_LIMITS,
} from '@/lib/academy-offline-sealed';
import styles from './academy-offline.module.css';
const now = () => new Date().toISOString();
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The offline action could not be verified. Nothing was sent.';
}
function pinStamp(e: any) {
  try {
    return [
      e.id,
      e.withdrawn,
      contentKey(pinnedRef(e)),
      e.completed,
      e.record?.status ?? null,
      e.attempts?.some((a: any) => !a.decision),
      e.appeals?.some((a: any) => a.status === 'open'),
    ];
  } catch {
    return [e?.id ?? 'unknown', 'unavailable'];
  }
}

/** Downloads reference copies; explicit online commands save own drafts only. */
export function OfflineView() {
  const { accountKey, activeWorkspace, state, loading, busy, cmd, load, go, getPersonalOfflineRead } =
    useAcademy();
  const fieldPrefix = useId();
  const read = (): OfflineReadContext | null =>
    typeof getPersonalOfflineRead === 'function' ? getPersonalOfflineRead() : null;
  const scope = JSON.stringify([
    accountKey,
    activeWorkspace,
    [...(state.paused ?? [])].sort(),
    state.enrollments.map(pinStamp),
  ]);
  const discardFocus = useRef<{ element: HTMLElement; scope: string } | null>(null);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const alive = useRef(true),
    operation = useRef(0);
  const [queue, setQueue] = useState<OfflineDraft[]>([]),
    [unlockedScope, setUnlockedScope] = useState(''),
    [enabled, setEnabled] = useState(false),
    [fictional, setFictional] = useState(false),
    [passphrase, setPassphrase] = useState(''),
    [confirmPhrase, setConfirmPhrase] = useState(''),
    [capsule, setCapsule] = useState<SealedDraftFile | null>(null),
    [scopeHash, setScopeHash] = useState(''),
    [hashScope, setHashScope] = useState(''),
    [capsuleScope, setCapsuleScope] = useState(''),
    [enrollmentId, setEnrollmentId] = useState(''),
    [activity, setActivity] = useState('practical'),
    [selectedKey, setSelectedKey] = useState(''),
    [localBusy, setLocalBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [tick, setTick] = useState(0),
    [discard, setDiscard] = useState<'lock' | 'disable' | 'account' | 'all' | null>(null),
    [showComparison, setShowComparison] = useState(false),
    [saveReadFence, setSaveReadFence] = useState<string | null>(null);
  const latestQueue = useRef(queue);
  latestQueue.current = queue;
  const visibleQueue =
      unlockedScope === scope && queue.every((d) => Date.parse(d.expiresAt) > Date.now()) ? queue : [],
    selected = visibleQueue.find((d) => offlineDraftKey(d) === selectedKey) ?? null;
  const online = read(),
    fresh = online && online.currentUserId === accountKey && online.workspaceId === 'lab' ? online : null;
  const freshToken = fresh ? JSON.stringify([fresh.currentUserId, fresh.revision, fresh.readAt]) : null,
    needsRead = saveReadFence !== null && freshToken === saveReadFence;
  const visibleCapsule = capsuleScope === scope ? capsule : null,
    deviceHash = hashScope === scope ? scopeHash : '';
  const selectedEnrollment = state.enrollments.find((e: any) => e.id === enrollmentId);
  let selectedProgram: any = null;
  try {
    if (selectedEnrollment) selectedProgram = resolvePinnedContent(selectedEnrollment, ['global']).program;
  } catch {}
  const choices = state.enrollments.filter((e: any) => {
    try {
      const s = resolvePinnedContent(e, ['global']);
      return (
        !e.withdrawn &&
        s.language === 'en' &&
        s.ref.versionId === '0.1-review-draft' &&
        !(state.paused ?? []).includes(e.programId)
      );
    } catch {
      return false;
    }
  });
  const target: OfflineTarget =
    activity === 'practical' ? { kind: 'practical' } : { kind: 'lesson', lessonId: activity };
  const availability =
    fresh && enrollmentId
      ? offlineDraftAvailability(fresh, enrollmentId, target, now())
      : { available: false, message: 'Refresh current personal access before opening a draft.' };
  const autoActivity = (id: string) => {
    const e = state.enrollments.find((v: any) => v.id === id);
    if (!e) return 'practical';
    try {
      const p = resolvePinnedContent(e, ['global']).program;
      return p.lessons.find((l) => !e.completed.includes(l.id))?.id ?? 'practical';
    } catch {
      return 'practical';
    }
  };
  const controlsDisabled = busy || loading || localBusy;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ++operation.current;
    };
  }, []);
  useEffect(() => {
    ++operation.current;
    setQueue([]);
    setUnlockedScope('');
    setEnabled(false);
    setFictional(false);
    setPassphrase('');
    setConfirmPhrase('');
    setCapsule(null);
    setScopeHash('');
    setHashScope('');
    setCapsuleScope('');
    setSelectedKey('');
    setReviewed(false);
    setError('');
    setNotice('');
    setLocalBusy(false);
    setDiscard(null);
    setShowComparison(false);
    setSaveReadFence(null);
  }, [scope]);
  useEffect(() => {
    if (!accountKey || activeWorkspace !== 'lab') return;
    let cancelled = false;
    sealedScopeHash(accountKey)
      .then((hash) => {
        if (cancelled || scopeRef.current !== scope) return;
        setScopeHash(hash);
        setHashScope(scope);
        try {
          setCapsule(loadSealedDraft(localStorage, hash, now()));
          setCapsuleScope(scope);
        } catch (e) {
          setError(message(e));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [accountKey, activeWorkspace, scope]);
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (unlockedScope === scope && queue.length && queue.some((d) => Date.parse(d.expiresAt) <= Date.now())) {
      ++operation.current;
      setQueue([]);
      setUnlockedScope('');
      setPassphrase('');
      setConfirmPhrase('');
      setNotice(
        'The 24-hour local draft period ended. Unlocked text was discarded; sealed copies can be deleted.',
      );
    }
  }, [tick, queue, unlockedScope, scope]);
  useEffect(() => {
    if (!choices.some((e: any) => e.id === enrollmentId)) {
      setEnrollmentId(choices[0]?.id ?? '');
      setActivity(autoActivity(choices[0]?.id ?? ''));
    }
  }, [scope, enrollmentId]);
  const begin = () => {
    if (!fresh || !enabled || !fictional)
      throw new Error('Refresh your personal learning space and enable fictional offline practice first.');
    return fresh;
  };
  const run = (fn: () => void) => {
    setError('');
    setNotice('');
    try {
      fn();
    } catch (e) {
      setError(message(e));
    }
  };
  function packet(format: 'html' | 'json') {
    run(() => {
      if (!fresh) throw new Error('Refresh saved progress before downloading an exact reference packet.');
      const p = buildOfflinePacket(fresh, enrollmentId, now()),
        name = `aplyd-${p.contentRef.programId}-${p.contentRef.versionId}-reference`;
      download(
        format === 'html' ? offlinePacketHtml(p) : JSON.stringify(p, null, 2),
        `${name}.${format}`,
        format === 'html' ? 'text/html' : 'application/json',
      );
      setNotice(
        'Reference copy downloaded. It contains fictional source material and blank prompts; no learning status changed.',
      );
    });
  }
  function start() {
    run(() => {
      const context = begin(),
        d = createOfflineDraft(context, enrollmentId, target, now(), true),
        existing = visibleQueue.find((v) => offlineDraftKey(v) === offlineDraftKey(d));
      if (existing) {
        setSelectedKey(offlineDraftKey(existing));
        return;
      }
      setQueue(putOfflineDraft(visibleQueue, d, now()));
      setUnlockedScope(scope);
      setSelectedKey(offlineDraftKey(d));
      setReviewed(false);
      setNotice('Draft opened in this session. It has not been sent or saved on this device.');
    });
  }
  function change(id: string, text: string) {
    if (!selected) return;
    run(() => {
      const d = updateOfflineDraft(selected, { [id]: text }, now());
      setQueue(putOfflineDraft(visibleQueue, d, now()));
      setReviewed(false);
    });
  }
  async function seal(destination: 'device' | 'file') {
    setError('');
    setNotice('');
    const current = scope,
      token = ++operation.current;
    try {
      if (
        !enabled ||
        !fictional ||
        activeWorkspace !== 'lab' ||
        !accountKey ||
        !visibleQueue.length ||
        visibleQueue.some((d) => d.ownerId !== accountKey)
      )
        throw new Error('Open your own fictional draft in this verified personal session first.');
      if (passphrase !== confirmPhrase) throw new Error('The two passphrases do not match.');
      setLocalBusy(true);
      const file = await sealDraftQueue(visibleQueue, accountKey, passphrase, now());
      if (!alive.current || scopeRef.current !== current || operation.current !== token) return;
      if (destination === 'device') {
        storeSealedDraft(localStorage, file, now());
        setCapsule(file);
        setCapsuleScope(scope);
        setNotice('Only encrypted draft bytes were saved on this device. They remain unsent.');
      } else {
        download(JSON.stringify(file, null, 2), 'aplyd-temporary-sealed-drafts.json', 'application/json');
        setNotice(
          'Encrypted temporary draft file downloaded. Keep the passphrase separately; Academy cannot recover it.',
        );
      }
      setPassphrase('');
      setConfirmPhrase('');
    } catch (e) {
      if (alive.current && scopeRef.current === current && operation.current === token) setError(message(e));
    } finally {
      if (alive.current && scopeRef.current === current && operation.current === token) setLocalBusy(false);
    }
  }
  async function unlock() {
    setError('');
    setNotice('');
    const current = scope,
      token = ++operation.current;
    try {
      const context = begin();
      if (!visibleCapsule) throw new Error('Choose a supported sealed draft file first.');
      if (visibleQueue.length)
        throw new Error('Lock this session before unlocking another file so unsent work is not replaced.');
      setLocalBusy(true);
      const entries = await unlockDraftQueue(visibleCapsule, context.currentUserId, passphrase, now());
      if (!alive.current || scopeRef.current !== current || operation.current !== token) return;
      const latest = read();
      if (!latest || latest.currentUserId !== context.currentUserId || latest.workspaceId !== 'lab')
        throw new Error('Refresh access before unlocking drafts.');
      for (const d of entries) inspectOfflineDraft(d, latest, now());
      setQueue(entries);
      setUnlockedScope(scope);
      setSelectedKey(offlineDraftKey(entries[0]));
      setPassphrase('');
      setConfirmPhrase('');
      setReviewed(false);
      setNotice('Drafts unlocked in memory. Review changed online text before any save.');
    } catch (e) {
      if (alive.current && scopeRef.current === current && operation.current === token) setError(message(e));
    } finally {
      if (alive.current && scopeRef.current === current && operation.current === token) setLocalBusy(false);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setNotice('');
    const current = scope,
      token = ++operation.current;
    try {
      if (file.size > SEALED_DRAFT_LIMITS.fileBytes) throw new Error('This sealed file is too large.');
      setLocalBusy(true);
      const parsed = parseSealedDraftFile(await file.text(), now(), true);
      if (!alive.current || scopeRef.current !== current || operation.current !== token) return;
      setCapsule(parsed);
      setCapsuleScope(scope);
      setPassphrase('');
      setConfirmPhrase('');
      setNotice('Sealed file selected. It has not been decrypted or copied into device storage.');
    } catch (e) {
      if (alive.current && scopeRef.current === current && operation.current === token) setError(message(e));
    } finally {
      if (alive.current && scopeRef.current === current && operation.current === token) setLocalBusy(false);
    }
  }
  function lock() {
    ++operation.current;
    setQueue([]);
    setUnlockedScope('');
    setPassphrase('');
    setConfirmPhrase('');
    setSelectedKey('');
    setReviewed(false);
    setLocalBusy(false);
    setNotice('Unlocked text discarded. Previously saved sealed copies remain until you delete them.');
  }
  function requestDiscard(action: 'lock' | 'disable' | 'account' | 'all') {
    discardFocus.current =
      document.activeElement instanceof HTMLElement ? { element: document.activeElement, scope } : null;
    setDiscard(action);
  }
  function confirmDiscard() {
    const action = discard;
    setDiscard(null);
    run(() => {
      if (action === 'lock' || action === 'disable') {
        lock();
        if (action === 'disable') setEnabled(false);
      } else if (action === 'account') {
        deleteSealedDraft(localStorage, deviceHash);
        setCapsule(null);
        setNotice(
          'Sealed copy removed from this browser. Downloaded files and unlocked session text are unaffected.',
        );
      } else if (action === 'all') {
        const removed = deleteAllSealedDrafts(localStorage);
        setCapsule(null);
        setNotice(
          `${removed} sealed device ${removed === 1 ? 'copy' : 'copies'} removed. Downloaded files are unaffected.`,
        );
      }
    });
  }
  function merge() {
    if (!selected) return;
    run(() => {
      const context = begin(),
        merged = Object.fromEntries(
          inputFields.map((f: any) => [f.id, selected.fields[f.id] ?? selected.baseline[f.id] ?? '']),
        ),
        next = rebaseOfflineDraft(selected, context, now(), merged, reviewed);
      setQueue(putOfflineDraft(visibleQueue, next, now()));
      setReviewed(false);
      setShowComparison(false);
      setNotice(
        'The reviewed text is still unsent. Its baseline now matches the fresh saved draft. Review it before a separate online save.',
      );
    });
  }
  async function saveOnline() {
    if (!selected) return;
    setError('');
    setNotice('');
    const current = scope,
      token = ++operation.current;
    try {
      const context = begin(),
        prepared = prepareOfflineSave(selected, context, now(), reviewed);
      setLocalBusy(true);
      const acknowledged = await cmd(prepared.command, 'Online draft saved');
      if (!alive.current || scopeRef.current !== current || operation.current !== token) return;
      if (!acknowledged) {
        setSaveReadFence(JSON.stringify([context.currentUserId, context.revision, context.readAt]));
        setReviewed(false);
        setNotice(
          'The save was not acknowledged. Refresh saved progress and compare your draft; it will not be retried automatically.',
        );
        return;
      }
      const latest = latestQueue.current.find((d) => d.entryId === selected.entryId);
      if (!latest) return;
      const result = acknowledgeOfflineSave(latest, prepared.ticket, read() ?? undefined, now());
      if (result.clear) {
        setQueue(latestQueue.current.filter((d) => d.entryId !== selected.entryId));
        setSelectedKey('');
        setReviewed(false);
        setNotice(
          'This generation was saved as an online draft only. Existing pathway inputs stay unchanged; compare or load the saved draft deliberately in the pathway. Sealed older copies remain; delete or reseal them deliberately.',
        );
      } else {
        setSaveReadFence(JSON.stringify([context.currentUserId, context.revision, context.readAt]));
        setReviewed(false);
        setNotice(
          'The response was acknowledged, but this local draft could not be cleared safely. Refresh saved progress and compare it before another action.',
        );
      }
    } catch (e) {
      if (alive.current && scopeRef.current === current && operation.current === token) setError(message(e));
    } finally {
      if (alive.current && scopeRef.current === current && operation.current === token) setLocalBusy(false);
    }
  }
  let currentFields: Record<string, string> | null = null,
    inspection: string = 'Refresh saved progress before online review.';
  if (selected && fresh)
    try {
      const review = reviewOfflineDraft(selected, fresh, now()),
        status = review.inspection;
      currentFields = review.currentFields;
      inspection =
        status.status === 'ready'
          ? 'Ready for a separate online draft save.'
          : status.status === 'already-saved'
            ? 'No unsaved changes need sending. Compare saved text before discarding this local copy.'
            : `Saved online text changed in ${status.conflictingFields.join(', ')}. Compare both versions below and choose a reviewed merge; this view will not silently overwrite it.`;
    } catch (e) {
      inspection = message(e);
    }
  let selectedDefinition: any = null;
  try {
    if (selected)
      selectedDefinition = resolvePinnedContent({ contentRef: selected.contentRef }, ['global']).program;
  } catch {}
  const inputFields = selected
    ? selected.target.kind === 'lesson'
      ? [
          {
            id: 'practice',
            label: 'Your fictional practice response',
            help: 'Check the supplied source and explain your correction.',
          },
        ]
      : (selectedDefinition?.practicalAssessment.submissionPrompts ?? [])
    : [];
  return (
    <div className={styles.view} data-offline-view="personal">
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEARN THROUGH A CONNECTION GAP</p>
          <h1>Keep your practice moving</h1>
          <p>
            Download fictional reference material. Prepare private, unsent notes and reconnect to review them.
          </p>
        </div>
        <WifiOff aria-hidden="true" size={36} />
      </div>
      <div className={styles.notice}>
        <strong>A reference copy and a draft are different.</strong>
        <p>
          Downloads and offline writing never complete lessons, submit evidence or issue a practice record. An
          already unlocked session can stay editable for 24 hours through a connection gap. The downloaded
          HTML works by itself; a cold offline Academy session cannot unlock drafts.
        </p>
      </div>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {activeWorkspace !== 'lab' ? (
        <section className={styles.panel}>
          <h2>Offline practice belongs in your personal lab</h2>
          <p>Private workspace content, staff feedback and cohort activity are not stored here.</p>
          <Button onClick={() => go('home')}>Back to Overview</Button>
        </section>
      ) : (
        <>
          <section className={styles.panel}>
            <h2>1. Download an exact reference packet</h2>
            <p>
              Each copy contains the unchanged English draft sources, supplied examples and practice prompts.
              It contains no personal work, answer keys or assessment history. A downloaded copy cannot be
              revoked or remotely deleted.
            </p>
            {choices.length ? (
              <>
                <label className={styles.field}>
                  Your enrolled global pathway
                  <select
                    value={enrollmentId}
                    disabled={controlsDisabled}
                    onChange={(e) => {
                      setEnrollmentId(e.target.value);
                      setActivity(autoActivity(e.target.value));
                    }}
                  >
                    {choices.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {resolvePinnedContent(e, ['global']).program.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.actions}>
                  <Button disabled={controlsDisabled || !fresh} onClick={() => packet('html')}>
                    <Download size={16} />
                    Download reading packet
                  </Button>
                  <Button
                    variant="outline"
                    disabled={controlsDisabled || !fresh}
                    onClick={() => packet('json')}
                  >
                    Download source JSON
                  </Button>
                </div>
              </>
            ) : (
              <p>Enroll in a supported global practice pathway online first.</p>
            )}
            <Button variant="outline" disabled={controlsDisabled} onClick={() => load()}>
              <RefreshCw size={16} />
              Refresh saved progress
            </Button>
            {!fresh && <p>Verify current personal access online before downloading, unlocking or saving.</p>}
          </section>
          <section className={styles.panel}>
            <h2>2. Enable temporary private drafts</h2>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  if (!e.target.checked && visibleQueue.length) requestDiscard('disable');
                  else setEnabled(e.target.checked);
                }}
                disabled={controlsDisabled}
              />
              Enable temporary offline practice in this session
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={fictional}
                onChange={(e) => setFictional(e.target.checked)}
                disabled={controlsDisabled}
              />
              I will use fictional information only, with no actual private records or credentials.
            </label>
            <p>
              Unsent text stays in memory until you explicitly seal it. On this device or in a downloaded
              sealed file, only encrypted bytes are saved. Remember your passphrase separately: Academy cannot
              recover it. The 24-hour limit uses this device’s time. Expiry locks the draft after 24 hours; it
              does not remotely erase files or stop someone who already has a decrypted copy.
            </p>
            <p id={`${fieldPrefix}-phrase-help`}>
              At least 12 characters. Choose a long, unique passphrase and keep it separately.
            </p>
            <div className={styles.fields}>
              <label className={styles.field}>
                Passphrase
                <input
                  type="password"
                  autoComplete="new-password"
                  aria-describedby={`${fieldPrefix}-phrase-help`}
                  value={passphrase}
                  minLength={12}
                  maxLength={256}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={controlsDisabled}
                />
              </label>
              <label className={styles.field}>
                Repeat passphrase to seal
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPhrase}
                  maxLength={256}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  disabled={controlsDisabled}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <Button
                disabled={controlsDisabled || !enabled || !fictional || !visibleQueue.length}
                onClick={() => seal('device')}
              >
                <LockKeyhole size={16} />
                Seal and save on this device
              </Button>
              <Button
                variant="outline"
                disabled={controlsDisabled || !enabled || !fictional || !visibleQueue.length}
                onClick={() => seal('file')}
              >
                Download sealed draft file
              </Button>
              <Button
                variant="outline"
                disabled={
                  controlsDisabled ||
                  !fresh ||
                  !enabled ||
                  !fictional ||
                  !visibleCapsule ||
                  !!visibleQueue.length
                }
                onClick={unlock}
              >
                Unlock selected sealed drafts
              </Button>
            </div>
            <label className={styles.field}>
              Select a sealed draft file
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
                disabled={controlsDisabled}
              />
            </label>
            {visibleCapsule && (
              <p>
                Sealed copy expires {new Date(visibleCapsule.expiresAt).toLocaleString()}.{' '}
                {Date.now() >= Date.parse(visibleCapsule.expiresAt)
                  ? 'Expired; delete this copy.'
                  : 'No plaintext was unlocked automatically.'}
              </p>
            )}
            <div className={styles.actions}>
              <Button
                variant="outline"
                disabled={controlsDisabled || !visibleQueue.length}
                onClick={() => requestDiscard('lock')}
              >
                Lock and discard unlocked text
              </Button>
              <Button
                variant="outline"
                disabled={controlsDisabled || !deviceHash}
                onClick={() => requestDiscard('account')}
              >
                Delete this account’s device copy
              </Button>
              <Button variant="outline" disabled={controlsDisabled} onClick={() => requestDiscard('all')}>
                Delete all sealed copies on this device
              </Button>
            </div>
          </section>
          <section className={styles.panel}>
            <h2>3. Write, then review online</h2>
            <div className={styles.fields}>
              <label className={styles.field}>
                Practice activity
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  disabled={controlsDisabled}
                >
                  <option value="practical">Practical draft prompts</option>
                  {selectedProgram?.lessons.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={
                  controlsDisabled ||
                  !fresh ||
                  !availability.available ||
                  !enabled ||
                  !fictional ||
                  !enrollmentId
                }
                onClick={start}
              >
                Open unsent draft
              </Button>
            </div>
            <p>{availability.message}</p>
            {visibleQueue.length > 0 && (
              <label className={styles.field}>
                Unsent drafts in this session
                <select
                  value={selectedKey}
                  onChange={(e) => {
                    setSelectedKey(e.target.value);
                    setReviewed(false);
                  }}
                  disabled={controlsDisabled}
                >
                  <option value="">Choose a draft</option>
                  {visibleQueue.map((d) => (
                    <option key={d.entryId} value={offlineDraftKey(d)}>
                      {resolvePinnedContent({ contentRef: d.contentRef }, ['global']).program.title} ·{' '}
                      {d.target.kind === 'practical' ? 'Practical draft' : d.target.lessonId}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected && (
              <>
                <p className={styles.meta}>
                  Unsent · exact source {selected.contentRef.versionId} · expires{' '}
                  {new Date(selected.expiresAt).toLocaleString()}
                </p>
                {inputFields.map((f: any) => (
                  <div className={styles.field} key={f.id}>
                    <label htmlFor={`${fieldPrefix}-${f.id}`}>{f.label}</label>
                    <span id={`${fieldPrefix}-${f.id}-help`}>{f.help}</span>
                    <textarea
                      id={`${fieldPrefix}-${f.id}`}
                      aria-describedby={`${fieldPrefix}-${f.id}-help`}
                      rows={5}
                      maxLength={10000}
                      value={selected.fields[f.id] ?? selected.baseline[f.id] ?? ''}
                      onChange={(e) => change(f.id, e.target.value)}
                      disabled={controlsDisabled}
                    />
                  </div>
                ))}
                <p className={styles.notice}>{inspection}</p>
                {needsRead && (
                  <p role="status">
                    Refresh saved progress before another save. An uncertain save is never replayed
                    automatically.
                  </p>
                )}
                {showComparison && currentFields && (
                  <div className={styles.notice}>
                    <h3>Current online text</h3>
                    <p>
                      Compare these saved fields with your editable unsent text above. Edit the unsent text to
                      the version you want to retain, then confirm your review.
                    </p>
                    {inputFields.map((f: any) => (
                      <div key={f.id}>
                        <strong>{f.label}</strong>
                        <pre className={styles.comparison}>
                          {currentFields![f.id] || '(Blank saved field)'}
                        </pre>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      disabled={controlsDisabled || !reviewed || !fresh || needsRead}
                      onClick={merge}
                    >
                      Use reviewed merge as my unsent draft
                    </Button>
                  </div>
                )}
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                    disabled={controlsDisabled}
                  />
                  I have reviewed this fictional text and want to save it as an online draft, without
                  submitting evidence.
                </label>
                <div className={styles.actions}>
                  <Button
                    disabled={controlsDisabled || !fresh || needsRead || !enabled || !fictional || !reviewed}
                    onClick={saveOnline}
                  >
                    Save as online draft
                  </Button>
                  <Button
                    variant="outline"
                    disabled={controlsDisabled || !fresh}
                    onClick={() => {
                      setShowComparison(true);
                      setReviewed(false);
                    }}
                  >
                    Compare current saved text
                  </Button>
                </div>
                <p>
                  Seal current changes before leaving this screen: unlocked notes in this screen are discarded
                  when it closes. Refresh and saving are separate actions. Failed or uncertain saves are never
                  retried automatically. Online quiz checks, lesson completion, submission and review stay in
                  the pathway.
                </p>
              </>
            )}
          </section>
        </>
      )}
      <AlertDialog
        open={discard !== null}
        onOpenChange={(open) => {
          if (!open) setDiscard(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = discardFocus.current;
            requestAnimationFrame(() => {
              if (target?.scope !== scopeRef.current) return;
              const opener = target.element,
                reachable =
                  opener.isConnected &&
                  !opener.matches(':disabled,[disabled],[aria-disabled="true"]') &&
                  !opener.closest('[hidden],[inert],[aria-hidden="true"]') &&
                  opener.getClientRects().length > 0 &&
                  getComputedStyle(opener).visibility !== 'hidden';
              (reachable ? opener : document.getElementById('main'))?.focus({ preventScroll: true });
            });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {discard === 'all'
                ? 'Delete all sealed device copies?'
                : discard === 'account'
                  ? 'Delete this sealed device copy?'
                  : 'Discard unlocked draft text?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {discard === 'account' || discard === 'all'
                ? 'This cannot be undone in Academy. Any unsent work available only in these encrypted browser copies will be lost. Downloaded files and the current unlocked session are unaffected.'
                : 'Unsent text in this session will be lost unless you have sealed its current changes. Older sealed copies may not include recent edits. Online saved work is retained.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep this session</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>
              {discard === 'account' || discard === 'all' ? 'Delete sealed copy' : 'Discard unlocked text'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
