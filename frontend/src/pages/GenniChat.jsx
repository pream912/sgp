import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useGenniConversation from '../hooks/useGenniConversation';
import ChatThread, { GenniAvatar } from '../components/genni/ChatThread';
import ChatInput from '../components/genni/ChatInput';

/**
 * Genni full-screen chat. mode="onboarding" lives at /builder (site creation);
 * mode="assistant" lives at /chat (app-wide helper).
 * Mobile-first: sticky header, scrollable thread, bottom input with safe area.
 */
export default function GenniChat({ mode = 'onboarding' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  const {
    conversation, messages, pending, typing, languages, currentLang, error,
    dispatch, sendText, pickLanguage,
  } = useGenniConversation(mode);

  return (
    <div className="h-dvh flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121121]">
        <button
          onClick={() => navigate(mode === 'onboarding' ? '/' : -1)}
          aria-label="Back"
          className="w-9 h-9 -ml-1.5 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
        </button>
        <GenniAvatar size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white leading-tight">Genni</p>
          <p className="text-xs text-slate-400 truncate">
            {typing ? t('chat.typing', 'typing…') : t('chat.subtitle', 'Your website assistant')}
          </p>
        </div>
        <button
          onClick={() => setLangSheetOpen(true)}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full px-3 py-1.5 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>translate</span>
          {currentLang.nativeLabel}
        </button>
      </header>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto">
          <ChatThread
            messages={messages}
            pending={pending}
            typing={typing}
            onAction={dispatch}
            speechLang={currentLang.speechLang}
          />
        </div>
      </div>

      {error && (
        <p className="shrink-0 text-center text-xs text-red-500 py-1.5 bg-red-50 dark:bg-red-950/40">{error}</p>
      )}

      {/* Input */}
      <div className="shrink-0 max-w-2xl mx-auto w-full">
        <ChatInput
          onSend={sendText}
          disabled={!conversation}
          speechLang={currentLang.speechLang}
          placeholder={t('chat.placeholder', 'Type a message')}
        />
      </div>

      {/* Language sheet */}
      {langSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-label="Choose chat language">
          <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setLangSheetOpen(false)} />
          <div className="relative w-full sm:w-96 bg-white dark:bg-[#1e1c2e] rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[70vh] overflow-y-auto">
            <p className="font-semibold text-slate-900 dark:text-white mb-3">{t('chat.chooseLanguage', 'Chat language')}</p>
            <div className="grid grid-cols-2 gap-2">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLangSheetOpen(false); pickLanguage(l.code); }}
                  className={`min-h-[52px] rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    l.code === currentLang.code
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-400'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{l.nativeLabel}</span>
                  {l.nativeLabel !== l.label && <span className="block text-xs text-slate-400">{l.label}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
