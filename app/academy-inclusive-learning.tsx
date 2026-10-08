'use client';
import { useEffect, useRef, useState } from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  readAccessPreferences,
  freshAccessPreferences,
  languageAvailability,
  readAloudPlan,
  confirmHumanCapture,
  type AccessPreferences,
  type ConfirmedCapture,
} from '@/lib/academy-inclusive-learning';
import { useAcademy, useWorkspaceDraft } from './academy-context';
import { Pick } from './academy-ui';
const languages = [
  ['en', 'English'],
  ['hi', 'Hindi · हिन्दी'],
  ['bn', 'Bengali · বাংলা'],
  ['mr', 'Marathi · मराठी'],
  ['ta', 'Tamil · தமிழ்'],
  ['te', 'Telugu · తెలుగు'],
  ['kn', 'Kannada · ಕನ್ನಡ'],
  ['gu', 'Gujarati · ગુજરાતી'],
  ['ml', 'Malayalam · മലയാളം'],
  ['pa', 'Punjabi · ਪੰਜਾਬੀ'],
  ['ur', 'Urdu · اردو'],
].map(([value, label]) => ({ value, label }));
export function LearningAccessPreferences() {
  const { state, cmd, busy, team } = useAcademy();
  let initial: AccessPreferences,
    warning = '';
  try {
    initial = readAccessPreferences(state.learningAccess);
  } catch {
    initial = freshAccessPreferences();
    warning =
      'Your saved learning-access preferences use an unsupported format. They are retained until you explicitly save new choices here.';
  }
  const [choice, setChoice] = useWorkspaceDraft<AccessPreferences>(
    'learning-access-preferences',
    () => initial,
  );
  const options = languages.some((l) => l.value === choice.preferredLanguage)
    ? languages
    : [
        ...languages,
        { value: choice.preferredLanguage, label: choice.preferredLanguage + ' · saved request' },
      ];
  return (
    <section className="panel spacious mt">
      <Languages size={25} />
      <h2 className="mt">Language and learning help</h2>
      <p className="mt">
        Tell us what would help you learn. The interface and current course editions are in English; choosing
        a preference keeps your saved course version and progress.
      </p>
      {warning && (
        <p role="status" className="form-hint">
          {warning}
        </p>
      )}
      <div className="two-grid mt">
        <div className="field">
          <label>Preferred learning language · a request</label>
          <Pick
            label="Preferred learning language request"
            value={choice.preferredLanguage}
            onChange={(value: string) => setChoice((c) => ({ ...c, preferredLanguage: value }))}
            options={options}
          />
        </div>
        <div className="field">
          <label>Reading or response help · a request</label>
          <Pick
            label="Reading or response help request"
            value={choice.assistancePreference}
            onChange={(value: string) =>
              setChoice((c) => ({
                ...c,
                assistancePreference: value as AccessPreferences['assistancePreference'],
              }))
            }
            options={[
              { value: 'none', label: 'No help requested' },
              { value: 'read-text', label: 'Help reading the lesson' },
              { value: 'capture-response', label: 'Help capturing my own response' },
            ]}
          />
        </div>
      </div>
      <div className="toggle-line">
        <div>
          <strong>Remind me about read-aloud</strong>
          <p>Start it yourself when a matching browser voice is available.</p>
        </div>
        <Switch
          aria-label="Remind me about read-aloud"
          checked={choice.readAloudMode === 'ask'}
          onCheckedChange={(enabled) => setChoice((c) => ({ ...c, readAloudMode: enabled ? 'ask' : 'off' }))}
        />
      </div>
      <Button
        disabled={busy}
        onClick={() =>
          cmd(
            {
              type: 'learning-access-preferences',
              preferredLanguage: choice.preferredLanguage,
              readAloudMode: choice.readAloudMode,
              assistancePreference: choice.assistancePreference,
            },
            'Language and learning-help preferences saved',
          )
        }
      >
        Save learning-help preferences
      </Button>
      <p className="form-hint">
        These choices stay in your own {team ? 'shared-workspace learning profile' : 'personal lab'}. They do
        not request a helper automatically or share your evidence.
      </p>
    </section>
  );
}
export function SavedContentLanguage({ enrollment }: { enrollment: any }) {
  const { state, contentContext, go } = useAcademy();
  let preferences: AccessPreferences;
  try {
    preferences = readAccessPreferences(state.learningAccess);
  } catch {
    preferences = freshAccessPreferences();
  }
  const available = languageAvailability(enrollment, contentContext, preferences),
    label = languages.find((l) => l.value === available.contentLanguage)?.label ?? available.contentLanguage;
  return (
    <div className="notice">
      <Languages size={21} />
      <div>
        <strong>Saved content language: {label ?? 'unavailable'}</strong>
        {available.status === 'requested-language-unavailable' ? (
          <>
            <p>
              Your requested language is not available in this saved version. Your current version and
              progress are retained.
            </p>
            <Button variant="outline" className="mt" size="sm" onClick={() => go('support')}>
              Ask about language support
            </Button>
          </>
        ) : (
          <p>Read and practise using the saved course edition.</p>
        )}
      </div>
    </div>
  );
}
/** User-started exact public lesson text; local browser-reported voice only. */
export function LessonReadAloud({ lesson, enrollment }: { lesson: any; enrollment: any }) {
  const { state, contentContext, accountKey, activeWorkspace } = useAcademy();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [loaded, setLoaded] = useState(false),
    [supported, setSupported] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState('');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null),
    generation = useRef(0);
  let preferences: AccessPreferences;
  try {
    preferences = readAccessPreferences(state.learningAccess);
  } catch {
    preferences = freshAccessPreferences();
  }
  const available = languageAvailability(enrollment, contentContext, preferences),
    plan = readAloudPlan(available, {
      supported,
      voicesLoaded: loaded,
      voices: voices.map((v) => ({ language: v.lang, localService: v.localService })),
    });

  function cancelOwnSpeech() {
    ++generation.current;
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current = null;
    }
    window.speechSynthesis?.cancel();
  }
  useEffect(() => {
    const synth = window.speechSynthesis;
    setSpeaking(false);
    setError('');
    setLoaded(false);
    setSupported(!!synth);
    if (!synth) {
      setLoaded(true);
      return;
    }
    const update = () => {
      const found = synth.getVoices();
      setVoices(found);
      setLoaded(found.length > 0);
    };
    update();
    synth.addEventListener('voiceschanged', update);
    const timer = window.setTimeout(() => {
      update();
      setLoaded(true);
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      synth.removeEventListener('voiceschanged', update);
      cancelOwnSpeech();
    };
  }, [
    accountKey,
    activeWorkspace,
    enrollment.id,
    JSON.stringify(enrollment.contentRef ?? enrollment.version),
    lesson.id,
  ]);
  function listen() {
    if (speaking) {
      cancelOwnSpeech();
      setSpeaking(false);
      setError('');
      return;
    }
    if (plan.status !== 'ready') return;
    const voice = voices.find(
      (v) => v.localService && v.lang.toLowerCase() === plan.utteranceLanguage!.toLowerCase(),
    );
    if (!voice) {
      setError('That browser voice is no longer available. Try again after the voice list refreshes.');
      return;
    }
    // Detach the earlier utterance's handlers before cancel. A delayed interrupted
    // event must not report an error for an intentional stop or affect a new read.
    cancelOwnSpeech();
    const ticket = generation.current,
      speech = new SpeechSynthesisUtterance(lesson.lessonText);
    utterance.current = speech;
    speech.lang = voice.lang;
    speech.voice = voice;
    const finish = (failed: boolean) => {
      if (generation.current !== ticket || utterance.current !== speech) return;
      speech.onend = null;
      speech.onerror = null;
      utterance.current = null;
      setSpeaking(false);
      if (failed)
        setError('The browser could not finish reading. Your lesson text and saved work are still here.');
    };
    speech.onend = () => finish(false);
    speech.onerror = () => finish(true);
    setError('');
    setSpeaking(true);
    window.speechSynthesis.speak(speech);
  }
  return (
    <div>
      <Button variant="outline" size="sm" disabled={!speaking && plan.status !== 'ready'} onClick={listen}>
        <Volume2 size={16} />
        {speaking ? 'Stop reading' : 'Read aloud'}
      </Button>
      {(error || plan.status !== 'ready') && (
        <p className="form-hint" role="status">
          {error || plan.message}
        </p>
      )}
      {preferences.readAloudMode === 'ask' && plan.status === 'ready' && (
        <p className="form-hint">Your read-aloud reminder: start reading when you are ready.</p>
      )}
    </div>
  );
}

export function CapturedResponseReview({
  program,
  enrollment,
  fields,
  onConfirmed,
  disabled,
}: {
  program: any;
  enrollment: any;
  fields: Record<string, string>;
  onConfirmed: (value: ConfirmedCapture) => void;
  disabled: boolean;
}) {
  const { contentContext, resolvePinned } = useAcademy(),
    [open, setOpen] = useState(false),
    [method, setMethod] = useState('human-transcription'),
    [consent, setConsent] = useState(false),
    [readBack, setReadBack] = useState(false),
    [ownReasoning, setOwnReasoning] = useState(false),
    [error, setError] = useState('');
  const resolved = resolvePinned(enrollment),
    language = resolved.available ? resolved.snapshot.language : null;
  function confirm() {
    try {
      if (!resolved.available) throw new Error(resolved.message);
      const captured = confirmHumanCapture(
        enrollment,
        contentContext,
        fields,
        {
          method,
          responseLanguage: language,
          learnerConsent: consent,
          learnerReadBackConfirmed: readBack,
          declaredNoAnswerCoaching: ownReasoning,
        },
        {
          contentRef: resolved.snapshot.ref,
          enabled: true,
          methods: ['human-reading', 'human-transcription'],
          responseLanguages: [language!],
        },
      );
      onConfirmed(captured);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review the captured response before continuing.');
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled || !language}
        onClick={() => {
          setConsent(false);
          setReadBack(false);
          setOwnReasoning(false);
          setError('');
          setOpen(true);
        }}
      >
        Review my captured response
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>Hear it back. Keep your own meaning.</DialogTitle>
            <DialogDescription>
              Ask your helper to read these words back to you. Check every response before confirming. Your
              helper receives no Academy permission or evidence access from this step.
            </DialogDescription>
          </DialogHeader>
          <div className="field">
            <label>How you received help</label>
            <Pick
              label="How you received reading or capture help"
              value={method}
              onChange={setMethod}
              options={[
                { value: 'human-reading', label: 'Someone helped me read' },
                { value: 'human-transcription', label: 'I spoke and someone typed my response' },
              ]}
            />
          </div>
          <p className="form-hint">
            Response language: {language ?? 'unavailable'} · Same saved course and assessment standard.
          </p>
          {program.practicalAssessment.submissionPrompts.map((prompt: any) => (
            <div key={prompt.id} className="source-packet">
              <strong>{prompt.label}</strong>
              <p className="pre-wrap">{fields[prompt.id] || 'No response captured yet.'}</p>
            </div>
          ))}
          <label className="check-line">
            <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />I chose to
            receive reading or capture help.
          </label>
          <label className="check-line">
            <Checkbox checked={readBack} onCheckedChange={(value) => setReadBack(value === true)} />
            These words were read back to me and match my meaning.
          </label>
          <label className="check-line">
            <Checkbox checked={ownReasoning} onCheckedChange={(value) => setOwnReasoning(value === true)} />
            The helper did not supply my reasoning or answers.
          </label>
          {error && (
            <p role="alert" className="form-hint">
              {error}
            </p>
          )}
          <p className="form-hint">
            This records your declaration of help. Formal oral-assessment arrangements require separate
            approval.
          </p>
          <Button disabled={disabled || !consent || !readBack || !ownReasoning} onClick={confirm}>
            Confirm my captured response
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
