import React, { useState, useEffect } from 'react';
import { checkServerHealth, sendPrompt, HealthResponse } from './api/ai-client';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [prompt, setPrompt] = useState('Analyze system architecture scalability');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkServerHealth().then(setHealth);
  }, []);

  const handleRunInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    const result = await sendPrompt(prompt);
    setResponse(result.response);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                {{PROJECT_NAME}}
              </span>
              <span className="ml-2 text-xs uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                AI SaaS
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs font-mono bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-slate-300">
                {health ? `Backend: ${health.service}` : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col gap-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            Enterprise AI Operating System & Intelligent Cloud Service
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            High-performance fullstack architecture powered by AI-Builder-Brain Universal Operating System.
            Engineered with zero-drift contracts, live multi-layer verification, and native MCP intelligence.
          </p>
        </div>

        {/* Interactive AI Inference Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <span>🤖</span> Model Execution Playground
              </h2>
              <span className="text-xs text-slate-400 font-mono">Model: GPT-4o / Claude 3.5 / Gemini</span>
            </div>

            <form onSubmit={handleRunInference} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider font-mono">
                  Input Prompt Directive
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                  placeholder="Enter prompt directive..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Execute Inference</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {response && (
              <div className="mt-6 bg-slate-950/80 border border-indigo-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-indigo-400 font-mono border-b border-slate-800/60 pb-2">
                  <span>Inference Output</span>
                  <span className="text-emerald-400">Status 200 OK</span>
                </div>
                <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {response}
                </div>
              </div>
            )}
          </div>

          {/* Architecture & Telemetry Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-5">
              <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <span>🏛️</span> Operating System Telemetry
              </h3>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Zero-Copy Brain Bridge:</span>
                  <span className="text-emerald-400 font-semibold">ESTABLISHED (Read-Only)</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Runtime Platform:</span>
                  <span className="text-indigo-400 font-semibold">Node.js + Express API</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Frontend Client:</span>
                  <span className="text-indigo-400 font-semibold">React 19 + Vite + Tailwind v4</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Verification Engine:</span>
                  <span className="text-emerald-400 font-semibold">7+ Dynamic Pillars Active</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every mutation is protected by the non-destructive invariant and live verification gates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 font-mono">
        {{PROJECT_NAME}} • Universal Project Operating System • AI-Builder-Brain
      </footer>
    </div>
  );
}
