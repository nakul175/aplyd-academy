'use client';
import { useState, useRef, useEffect } from 'react';
import { useAcademy } from './academy-context';
import { WorkspaceOperationsView } from './academy-operations';

export function OperationsView() {
  const { team, load, saving, loading, openOperation } = useAcademy();
  const [asOf, setAsOf] = useState(() => new Date().toISOString()),
    [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const refresh = async () => {
    if (pending.current || saving || loading) return;
    pending.current = true;
    setRefreshing(true);
    try {
      if (await load()) setAsOf(new Date().toISOString());
    } finally {
      pending.current = false;
      setRefreshing(false);
    }
  };
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return (
    <WorkspaceOperationsView
      team={team}
      now={asOf}
      refreshing={refreshing || saving || loading}
      onRefresh={() => refresh()}
      onOpen={openOperation}
    />
  );
}
