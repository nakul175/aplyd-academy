'use client';
import { useState } from 'react';
import {
  JOB_TEMPLATES,
  readJobTemplateOrigin,
  jobTemplate,
  type JobTemplateId,
} from '../lib/academy-job-templates';
import styles from './academy-job-template-picker.module.css';

type Command = { type: 'content-job-template'; templateId: JobTemplateId };
/** Place only in the current-owner studio's NEW draft section, outside any editor. */
export function JobTemplatePicker({
  disabled,
  onCreate,
  onOpenReferences,
}: {
  disabled: boolean;
  onCreate: (command: Command) => Promise<boolean>;
  onOpenReferences: () => void;
}) {
  const [choice, setChoice] = useState<JobTemplateId>('msme-customer-commitments'),
    [creating, setCreating] = useState(false);
  const t = JOB_TEMPLATES.find((t) => t.id === choice)!;
  return (
    <section className={styles.panel} data-job-template-picker>
      <h2>Start with the work your learners do</h2>
      <p>
        These English fictional starting points create new private drafts. You own the adaptation; another
        current owner must review it before publication. Existing courses and saved learning versions stay
        unchanged.
      </p>
      <label className={styles.field}>
        Job-practice starting point
        <select
          value={choice}
          disabled={disabled || creating}
          onChange={(e) => setChoice(e.target.value as JobTemplateId)}
        >
          {JOB_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.detail}>
        <strong>{t.audience}</strong>
        <p>{t.summary}</p>
        <p>{t.permittedAction}</p>
      </div>
      <p>
        Three lessons, nine knowledge checks, seven practical prompts and four rubric criteria. All source
        packets and AI drafts are fictional. Review the draft for your learners before requesting independent
        review.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={disabled || creating}
          onClick={async () => {
            setCreating(true);
            try {
              await onCreate({ type: 'content-job-template', templateId: choice });
            } finally {
              setCreating(false);
            }
          }}
        >
          {creating ? 'Creating private draft…' : 'Create private job-practice draft'}
        </button>
        <button type="button" disabled={creating} onClick={onOpenReferences}>
          Read the original governance references
        </button>
      </div>
      <p className={styles.note}>
        The supplied library remains unchanged. Its teaching principles have inspired this new practice draft;
        they do not approve the adaptation or grant professional, clinical, issuer or production authority.
      </p>
    </section>
  );
}

/** Historical starting-point note only; this is never a content-review approval. */
export function JobTemplateOriginNote({
  draft,
  onOpenReferences,
}: {
  draft: unknown;
  onOpenReferences: () => void;
}) {
  const origin = readJobTemplateOrigin(draft);
  if (!origin) return null;
  const t = jobTemplate(origin.templateId);
  return (
    <aside className={styles.panel} data-job-template-origin>
      <h3>Starting point: {t.title}</h3>
      <p>
        Template {origin.templateVersion}, copied from the exact {origin.sourceRef.programId} seed version{' '}
        {origin.sourceRef.versionId}. The author may have adapted the document since creation.
      </p>
      <p>
        This retained note identifies the starting point. Review and publication status come from the current
        content workflow; the library did not approve this adaptation.
      </p>
      <ul>
        {origin.governanceReferences.map((r) => (
          <li key={r.resourceId}>
            {r.sections}. {r.limit}
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button type="button" onClick={onOpenReferences}>
          Read the original governance references
        </button>
      </div>
    </aside>
  );
}
