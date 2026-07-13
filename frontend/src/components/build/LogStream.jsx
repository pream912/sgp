import React from 'react';

// The craftsman's bench: the last few progress messages in a dim monospace
// strip. New lines slide up; older ones fade toward the top.
export default function LogStream({ messages }) {
  const recent = messages.slice(-6);

  return (
    <div className="font-mono text-[11px] leading-5 select-none" aria-live="polite">
      {recent.map((m, i) => (
        <p
          key={`${m.at}-${i}`}
          className="truncate build-log-line"
          style={{ opacity: 0.25 + 0.75 * ((i + 1) / recent.length) }}
        >
          <span className="text-orange-400/60 mr-2">▸</span>
          <span className="text-slate-400">{m.text}</span>
        </p>
      ))}
    </div>
  );
}
