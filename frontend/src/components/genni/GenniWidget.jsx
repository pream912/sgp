import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useGenniConversation from '../../hooks/useGenniConversation';
import ChatThread, { GenniAvatar } from './ChatThread';
import ChatInput from './ChatInput';

/**
 * Floating Genni assistant, mounted once in Layout. A bottom sheet on mobile,
 * a 400px side panel on desktop. Opens the persistent 'assistant'
 * conversation lazily — nothing is created until the first tap.
 */
export default function GenniWidget() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    conversation, messages, pending, typing, currentLang, error, dispatch, sendText,
  } = useGenniConversation('assistant', { enabled: everOpened });

  // The full-screen chat routes host their own Genni — hide the widget there.
  if (location.pathname === '/builder' || location.pathname === '/chat') return null;

  const toggle = () => {
    setOpen(o => !o);
    if (!everOpened) setEverOpened(true);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggle}
        aria-label={open ? 'Close Genni' : 'Chat with Genni'}
        className={`fixed z-40 bottom-5 right-5 w-14 h-14 rounded-full shadow-xl shadow-orange-500/30 flex items-center justify-center transition-transform hover:scale-105 ${
          open ? 'bg-slate-700 dark:bg-slate-600' : 'bg-gradient-to-br from-orange-500 to-amber-400'
        }`}
      >
        {open ? (
          <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>close</span>
        ) : (
          <span className="text-white font-bold text-xl select-none">G</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed z-40 inset-x-0 bottom-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[400px] max-h-[80dvh] h-[70dvh] sm:h-[560px] bg-white dark:bg-[#121121] sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Genni assistant"
        >
          <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <GenniAvatar size={32} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">Genni</p>
              <p className="text-[11px] text-slate-400">{typing ? 'typing…' : 'Ask me anything about GenWeb'}</p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/chat'); }}
              aria-label="Open full screen"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_full</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <ChatThread
              messages={messages}
              pending={pending}
              typing={typing}
              onAction={dispatch}
              speechLang={currentLang.speechLang}
            />
          </div>

          {error && <p className="shrink-0 text-center text-xs text-red-500 py-1 bg-red-50 dark:bg-red-950/40">{error}</p>}

          <ChatInput
            onSend={sendText}
            disabled={!conversation}
            speechLang={currentLang.speechLang}
            placeholder="Ask Genni…"
          />
        </div>
      )}
    </>
  );
}
