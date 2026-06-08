import { useEffect, useState } from 'react';
import { fetchApiHealth } from '../api/health.ts';

export type ProbeState =
  | { kind: 'loading' }
  | { kind: 'ok'; service: string }
  | { kind: 'error'; message: string };

/** Polls the API liveness probe once on mount. */
export function useApiHealth(): ProbeState {
  const [state, setState] = useState<ProbeState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchApiHealth(controller.signal)
      .then((h) => setState({ kind: 'ok', service: h.service }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, []);

  return state;
}
