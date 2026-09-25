import React, { useState, useEffect } from 'react';
import { checkServerHealth, HealthResponse } from './api/ai-client';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    checkServerHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6 font-sans antialiased">
      <div className="max-w-xl w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-10 backdrop-blur-xl shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          ENVIRONMENT READY : CERTIFIED
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            {{PROJECT_NAME}}
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Full-stack AI SaaS development environment and architecture starter initialized. Ready for Phase B (Product Development).
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500">Frontend</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">React 19 + Vite</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500">Backend API</div>
            <div className="text-xs font-semibold text-emerald-400 mt-1">
              {health ? health.service : 'Connecting...'}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500">Styling</div>
            <div className="text-xs font-semibold text-slate-200 mt-1">Tailwind v4</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-500">Boundary</div>
            <div className="text-xs font-semibold text-emerald-400 mt-1">0 Product Code</div>
          </div>
        </div>
      </div>
    </div>
  );
}
