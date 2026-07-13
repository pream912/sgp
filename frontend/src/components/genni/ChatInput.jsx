import React, { useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

/**
 * Bottom input bar: text + mic (Web Speech API, language-aware) + send.
 * The mic hides itself when the browser doesn't support speech recognition.
 * speechLang: BCP-47 tag from the selected chat language (ta-IN, hi-IN, ...).
 */
export default function ChatInput({ onSend, disabled, speechLang, placeholder }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');

  useEffect(() => () => { recognitionRef.current?.abort?.(); }, []);

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  const startListening = () => {
    if (!SpeechRecognition || listening) return;
    const rec = new SpeechRecognition();
    rec.lang = speechLang || 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    baseTextRef.current = text ? `${text} ` : '';

    rec.onresult = (event) => {
      let transcript = '';
      for (const result of event.results) transcript += result[0].transcript;
      setText(baseTextRef.current + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const send = (e) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    stopListening();
    setText('');
    onSend(value);
  };

  return (
    <form
      onSubmit={send}
      className="flex items-end gap-2 px-3 py-3 sm:px-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121121]"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex-1 flex items-end bg-slate-100 dark:bg-slate-800/70 rounded-3xl px-4 py-1.5">
        <textarea
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={listening ? 'Listening…' : (placeholder || 'Type a message')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
          className="flex-1 bg-transparent resize-none max-h-28 py-2 text-[15px] text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
          style={{ fieldSizing: 'content' }}
        />
        {SpeechRecognition && (
          <button
            type="button"
            aria-label={listening ? 'Stop voice input' : 'Speak instead of typing'}
            onClick={listening ? stopListening : startListening}
            className={`shrink-0 w-9 h-9 mb-0.5 rounded-full flex items-center justify-center transition-colors ${
              listening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-orange-500'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {listening ? 'stop' : 'mic'}
            </span>
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Send"
        className="shrink-0 w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 text-white flex items-center justify-center transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
      </button>
    </form>
  );
}
