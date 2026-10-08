'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function CompareLearningDraft({
  local,
  saved,
  labels,
  onLoad,
  disabled,
}: {
  local: Record<string, string>;
  saved: Record<string, string>;
  labels: Record<string, string>;
  onLoad: (value: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    keys = Object.keys(labels),
    different = keys.some((key) => (local[key] ?? '') !== (saved[key] ?? ''));
  if (!different || !Object.values(saved).some((value) => value.trim().length > 0)) return null;
  return (
    <div className="source-packet mt">
      <strong>You have two versions of this draft.</strong>
      <p className="form-hint">
        Your current text is retained on this screen. Compare it with the saved online draft before replacing
        anything.
      </p>
      <Button variant="outline" className="mt" disabled={disabled} onClick={() => setOpen(true)}>
        Compare saved draft
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>Choose the text you want to keep here</DialogTitle>
            <DialogDescription>
              Loading saved text changes this screen only. It does not save, submit evidence or complete a
              lesson. Your current quiz choices stay in this screen.
            </DialogDescription>
          </DialogHeader>
          {keys.map((key) => (
            <section key={key}>
              <h3>{labels[key]}</h3>
              <div className="two-grid mt">
                <div className="source-packet">
                  <strong>Text on this screen</strong>
                  <p className="pre-wrap">{local[key] || 'Blank'}</p>
                </div>
                <div className="source-packet">
                  <strong>Saved online draft</strong>
                  <p className="pre-wrap">{saved[key] || 'Blank'}</p>
                </div>
              </div>
            </section>
          ))}
          <div className="actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep my screen text
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                onLoad(Object.fromEntries(keys.map((key) => [key, saved[key] ?? ''])));
                setOpen(false);
              }}
            >
              Load saved text into this screen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
