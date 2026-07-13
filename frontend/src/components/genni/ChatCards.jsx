import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * Structured chat messages. Every card receives:
 *   meta     - the message's meta payload from the server
 *   active   - true only for the newest message; frozen cards render muted
 *   onAction - ({type, payload, file?}) => void  (posts back into the flow)
 */

const cardShell = 'max-w-[92%] sm:max-w-[78%] ml-9';

export function ChipRow({ meta, active, onAction }) {
  const [picked, setPicked] = useState(null);
  const options = meta?.options || [];
  if (!options.length) return null;
  return (
    <div className={`${cardShell} flex flex-wrap gap-2`}>
      {options.map((o) => (
        <button
          key={o.id}
          disabled={!active || picked}
          onClick={() => { setPicked(o.id); onAction({ type: 'chip', payload: { id: o.id } }); }}
          className={`min-h-[40px] px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            picked === o.id
              ? 'bg-orange-500 text-white border-orange-500'
              : active && !picked
                ? 'bg-white dark:bg-[#1e1c2e] border-orange-300 dark:border-orange-500/40 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 cursor-default'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LanguagePickerMessage({ meta, active, onAction }) {
  const [picked, setPicked] = useState(null);
  const languages = meta?.languages || [];
  return (
    <div className={`${cardShell} grid grid-cols-2 sm:grid-cols-3 gap-2`}>
      {languages.map((l) => (
        <button
          key={l.code}
          disabled={!active || picked}
          onClick={() => { setPicked(l.code); onAction({ type: 'chip', payload: { id: `lang:${l.code}` } }); }}
          className={`min-h-[52px] rounded-xl border px-3 py-2.5 text-left transition-colors ${
            picked === l.code
              ? 'bg-orange-500 border-orange-500 text-white'
              : active && !picked
                ? 'bg-white dark:bg-[#1e1c2e] border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500/60'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60 cursor-default'
          }`}
        >
          <span className={`block text-sm font-semibold ${picked === l.code ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
            {l.nativeLabel}
          </span>
          {l.nativeLabel !== l.label && (
            <span className={`block text-xs ${picked === l.code ? 'text-orange-100' : 'text-slate-400'}`}>{l.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function BusinessResultCards({ meta, active, onAction }) {
  const [picked, setPicked] = useState(null);
  const candidates = meta?.candidates || [];
  return (
    <div className={`${cardShell} flex flex-col gap-2`}>
      {candidates.map((c) => (
        <button
          key={c.placeId}
          disabled={!active || picked}
          onClick={() => { setPicked(c.placeId); onAction({ type: 'select', payload: { placeId: c.placeId } }); }}
          className={`text-left rounded-xl border p-3.5 transition-colors ${
            picked === c.placeId
              ? 'bg-orange-500 border-orange-500 text-white'
              : active && !picked
                ? 'bg-white dark:bg-[#1e1c2e] border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500/60'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60 cursor-default'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`font-semibold text-[15px] ${picked === c.placeId ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {c.name}
            </span>
            {c.rating ? (
              <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium rounded-md px-1.5 py-0.5 ${
                picked === c.placeId ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                ★ {c.rating}{c.ratingCount ? ` (${c.ratingCount})` : ''}
              </span>
            ) : null}
          </div>
          {c.primaryType && (
            <span className={`block text-xs mt-0.5 ${picked === c.placeId ? 'text-orange-100' : 'text-orange-600 dark:text-orange-400'}`}>
              {c.primaryType}
            </span>
          )}
          <span className={`block text-xs mt-1 leading-relaxed ${picked === c.placeId ? 'text-orange-50' : 'text-slate-500 dark:text-slate-400'}`}>
            {c.address}
          </span>
        </button>
      ))}
      {active && !picked && (
        <button
          onClick={() => { setPicked('none'); onAction({ type: 'chip', payload: { id: 'none' } }); }}
          className="min-h-[40px] self-start px-4 py-2 rounded-full text-sm font-medium border bg-white dark:bg-[#1e1c2e] border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-orange-400"
        >
          {meta?.noneLabel || 'None of these'}
        </button>
      )}
    </div>
  );
}

export function InlineFormMessage({ meta, active, onAction }) {
  const [values, setValues] = useState(meta?.values || {});
  const [sent, setSent] = useState(false);
  const fields = meta?.fields || [];

  const submit = (e) => {
    e.preventDefault();
    if (sent) return;
    setSent(true);
    onAction({ type: 'form', payload: { formId: meta.formId, values } });
  };

  return (
    <form onSubmit={submit} className={`${cardShell} w-full bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md p-4 flex flex-col gap-3 ${!active || sent ? 'opacity-70' : ''}`}>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{meta?.title}</p>
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {f.label}{f.required && <span className="text-orange-500"> *</span>}
          </span>
          {f.type === 'textarea' ? (
            <textarea
              rows={2}
              value={values[f.key] || ''}
              disabled={!active || sent}
              required={!!f.required}
              placeholder={f.placeholder || ''}
              onChange={(e) => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:text-white"
            />
          ) : (
            <input
              type={f.type === 'tel' || f.type === 'email' || f.type === 'url' ? f.type : 'text'}
              value={values[f.key] || ''}
              disabled={!active || sent}
              required={!!f.required}
              placeholder={f.placeholder || ''}
              onChange={(e) => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              className="min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:text-white"
            />
          )}
        </label>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!active || sent}
          className="flex-1 min-h-[42px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {sent ? 'Saved ✓' : 'Continue'}
        </button>
        {meta?.skippable && !sent && active && (
          <button
            type="button"
            onClick={() => { setSent(true); onAction({ type: 'chip', payload: { id: 'skip' } }); }}
            className="min-h-[42px] px-4 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Skip
          </button>
        )}
      </div>
    </form>
  );
}

export function LogoUploadCard({ meta, active, onAction }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [sent, setSent] = useState(false);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || sent) return;
    setPreview(URL.createObjectURL(file));
    setSent(true);
    onAction({ type: 'upload', payload: { uploadId: meta?.uploadId || 'logo' }, file });
  };

  return (
    <div className={`${cardShell} bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md p-4 flex items-center gap-3 ${!active || sent ? 'opacity-70' : ''}`}>
      {preview ? (
        <img src={preview} alt="Logo preview" className="w-14 h-14 rounded-lg object-contain bg-slate-100 dark:bg-slate-800" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-orange-500">add_photo_alternate</span>
        </div>
      )}
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          disabled={!active || sent}
          onClick={() => inputRef.current?.click()}
          className="min-h-[42px] px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {sent ? 'Uploaded ✓' : (meta?.label || 'Upload logo')}
        </button>
        {meta?.skippable && active && !sent && (
          <button
            onClick={() => { setSent(true); onAction({ type: 'chip', payload: { id: 'skip' } }); }}
            className="min-h-[42px] px-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            {meta?.skipLabel || 'Skip'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={meta?.accept || 'image/*'} className="hidden" onChange={onFile} />
    </div>
  );
}

const SUMMARY_ROWS = [
  ['name', 'Business'], ['industry', 'Type'], ['description', 'About'],
  ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email'],
  ['website', 'Website'], ['openingHours', 'Hours'],
  ['competitorUrl', 'Competitor site'], ['referenceUrl', 'Reference site'],
];

export function SummaryCard({ meta, active, onAction }) {
  const [choice, setChoice] = useState(null);
  const d = meta?.draft || {};
  const extras = [
    d.services?.length ? `${d.services.length} services` : null,
    d.reviewsCount ? `${d.reviewsCount} reviews` : null,
    d.photosCount ? `${d.photosCount} photos` : null,
    d.hasLogo ? 'logo' : null,
  ].filter(Boolean);

  return (
    <div className={`${cardShell} w-full bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Your website details</p>
        {meta?.isFree ? (
          <span className="text-[11px] font-bold uppercase tracking-wide bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full px-2.5 py-1">Free</span>
        ) : meta?.cost ? (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{meta.cost} credits</span>
        ) : null}
      </div>
      <dl className="px-4 py-3 flex flex-col gap-2">
        {SUMMARY_ROWS.filter(([k]) => d[k]).map(([k, label]) => (
          <div key={k} className="flex gap-3 text-sm">
            <dt className="w-24 shrink-0 text-slate-400 dark:text-slate-500 text-xs pt-0.5">{label}</dt>
            <dd className="flex-1 text-slate-700 dark:text-slate-200 break-words whitespace-pre-wrap">{String(d[k])}</dd>
          </div>
        ))}
        {extras.length > 0 && (
          <div className="flex gap-3 text-sm">
            <dt className="w-24 shrink-0 text-slate-400 dark:text-slate-500 text-xs pt-0.5">Also included</dt>
            <dd className="flex-1 text-slate-700 dark:text-slate-200">{extras.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {meta?.confirmLabel && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            disabled={!active || choice}
            onClick={() => { setChoice('confirm'); onAction({ type: 'chip', payload: { id: 'confirm_build' } }); }}
            className="flex-1 min-h-[44px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {choice === 'confirm' ? 'Starting…' : meta.confirmLabel}
          </button>
          <button
            disabled={!active || choice}
            onClick={() => { setChoice('edit'); onAction({ type: 'chip', payload: { id: 'edit_details' } }); }}
            className="min-h-[44px] px-4 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:border-orange-400 disabled:opacity-50 transition-colors"
          >
            {meta.editLabel || 'Edit'}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConfirmActionCard({ meta, active, onAction }) {
  const [choice, setChoice] = useState(null);
  const action = meta?.action || {};
  return (
    <div className={`${cardShell} w-full bg-white dark:bg-[#1e1c2e] border-2 border-orange-300 dark:border-orange-500/40 rounded-2xl rounded-bl-md p-4 ${!active && !choice ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{action.label}</p>
        <span className="shrink-0 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 rounded-full px-2.5 py-1">
          {action.cost} credits
        </span>
      </div>
      {action.details && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{action.details}</p>}
      <div className="flex gap-2">
        <button
          disabled={!active || choice}
          onClick={() => { setChoice('confirm'); onAction({ type: 'confirm_action', payload: { actionId: meta.actionId } }); }}
          className="flex-1 min-h-[42px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
        >
          {choice === 'confirm' ? 'Working…' : `Confirm — use ${action.cost} credits`}
        </button>
        <button
          disabled={!active || choice}
          onClick={() => { setChoice('cancel'); onAction({ type: 'cancel_action', payload: { actionId: meta.actionId } }); }}
          className="min-h-[42px] px-4 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:border-slate-400 disabled:opacity-50 transition-colors"
        >
          {choice === 'cancel' ? 'Cancelled' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

export function BuildStartedCard({ meta }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!meta?.projectId) return;
    const t = setTimeout(() => navigate(`/build/${meta.projectId}`), 1800);
    return () => clearTimeout(t);
  }, [meta?.projectId, navigate]);

  return (
    <div className={`${cardShell} bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl rounded-bl-md p-4 flex items-center gap-3`}>
      <div className="w-9 h-9 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold">Building your website…</p>
        <p className="text-xs text-orange-50">Taking you to the live view</p>
      </div>
      <button
        onClick={() => navigate(`/build/${meta.projectId}`)}
        className="text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 transition-colors"
      >
        Watch now
      </button>
    </div>
  );
}
