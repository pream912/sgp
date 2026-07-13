import React from 'react';

// Stages are derived from build_progress thresholds so the checklist works for
// both pipelines without a fixed ETA. Copy is plain and active — this is Genni
// at work, not a deploy log.
export const STAGES = [
  { at: 0,  label: 'Getting started' },
  { at: 10, label: 'Designing your look' },
  { at: 25, label: 'Writing your pages' },
  { at: 70, label: 'Reviewing and polishing' },
  { at: 86, label: 'Publishing your preview' },
];

export function currentStageIndex(progress) {
  let idx = 0;
  STAGES.forEach((s, i) => { if (progress >= s.at) idx = i; });
  return idx;
}

export default function StageChecklist({ progress, failed }) {
  const active = currentStageIndex(progress);

  return (
    <div>
      {/* Mobile: compact horizontal stepper */}
      <ol className="flex sm:hidden items-center gap-1.5" aria-label="Build stages">
        {STAGES.map((s, i) => (
          <li
            key={s.label}
            className={`h-1.5 rounded-full transition-all duration-700 ${
              i < active ? 'bg-orange-500 flex-1'
              : i === active ? (failed ? 'bg-red-500 flex-[2]' : 'bg-orange-400 flex-[2] animate-pulse')
              : 'bg-white/10 flex-1'
            }`}
          />
        ))}
      </ol>
      <p className="sm:hidden mt-2 text-sm text-slate-300">{failed ? 'Build stopped' : STAGES[active].label}</p>

      {/* Desktop: vertical checklist */}
      <ol className="hidden sm:flex flex-col gap-3" aria-label="Build stages">
        {STAGES.map((s, i) => {
          const done = i < active || progress >= 100;
          const current = i === active && progress < 100;
          return (
            <li key={s.label} className="flex items-center gap-3">
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-colors duration-500 ${
                  done ? 'bg-orange-500 border-orange-500'
                  : current ? (failed ? 'border-red-500' : 'border-orange-400')
                  : 'border-white/15'
                }`}
              >
                {done ? (
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 15 }}>check</span>
                ) : current && !failed ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
                ) : current && failed ? (
                  <span className="material-symbols-outlined text-red-500" style={{ fontSize: 15 }}>close</span>
                ) : null}
              </span>
              <span className={`text-sm transition-colors duration-500 ${
                done ? 'text-slate-400 line-through decoration-white/20'
                : current ? 'text-white font-medium'
                : 'text-slate-500'
              }`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
