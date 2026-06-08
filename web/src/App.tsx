import { useApiHealth, type ProbeState } from './hooks/useApiHealth.ts';

function statusLabel(state: ProbeState): { text: string; className: string } {
  switch (state.kind) {
    case 'loading':
      return { text: 'checking…', className: 'bg-slate-600' };
    case 'ok':
      return { text: `up · ${state.service}`, className: 'bg-emerald-600' };
    case 'error':
      return { text: state.message, className: 'bg-red-600' };
  }
}

export default function App() {
  const api = useApiHealth();
  const label = statusLabel(api);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">StreamFlix</h1>
        <p className="text-slate-400">
          Catalog, playback, and search coming soon.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-slate-400">API health:</span>
          <span className={`rounded-full px-3 py-1 font-medium text-white ${label.className}`}>
            {label.text}
          </span>
        </div>
      </div>
    </main>
  );
}
