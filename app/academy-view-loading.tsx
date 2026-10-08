'use client';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useAcademy } from './academy-context';
import type { DynamicOptionsLoadingProps } from 'next/dynamic';

/** Code-only loading state. It carries no current or previously returned data. */
export function AcademyViewLoading({ error }: DynamicOptionsLoadingProps) {
  const { go } = useAcademy();
  if (error)
    return (
      <section className="panel spacious" role="alert">
        <h2>This view could not open</h2>
        <p className="mt">
          Your saved learning is retained. Return to Overview to save or copy any unsent work before reloading
          Academy.
        </p>
        <div className="actions">
          <Button variant="outline" onClick={() => go('home')}>
            Back to Overview
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>Reload Academy</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reload Academy?</AlertDialogTitle>
                <AlertDialogDescription>
                  Saved learning stays intact. Unsent text in this open session will be lost. Return to
                  Overview to save or copy it first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep this session</AlertDialogCancel>
                <AlertDialogAction onClick={() => location.reload()}>Reload Academy</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    );
  return (
    <div className="empty-state" role="status" aria-live="polite" aria-busy="true">
      <Loader2 className="spin" aria-hidden="true" />
      <h2>Opening this view</h2>
      <p>Your current saved work will appear here.</p>
    </div>
  );
}
