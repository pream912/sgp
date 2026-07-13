import React, { useEffect, useRef } from 'react';
import {
  ChipRow, LanguagePickerMessage, BusinessResultCards,
  InlineFormMessage, LogoUploadCard, SummaryCard, BuildStartedCard, ConfirmActionCard,
} from './ChatCards';

export function GenniAvatar({ size = 32 }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      G
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <GenniAvatar size={28} />
      <div className="bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function TextBubble({ message, pendingText }) {
  const isUser = message.role === 'user';
  const text = pendingText !== undefined ? pendingText : message.content;
  if (!text) return null;
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <GenniAvatar size={28} />}
      <div
        className={`max-w-[82%] sm:max-w-[70%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
          isUser
            ? 'bg-orange-500 text-white rounded-br-md'
            : 'bg-white dark:bg-[#1e1c2e] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-md'
        }`}
      >
        {text}
        {pendingText !== undefined && <span className="inline-block w-0.5 h-4 ml-0.5 bg-orange-400 align-middle animate-pulse" />}
      </div>
    </div>
  );
}

function UserStructuredEcho({ message }) {
  // A compact echo of the user's non-text turns (upload, form submit, chip tap).
  if (message.type === 'upload') {
    return (
      <div className="flex justify-end">
        <div className="bg-orange-500/90 text-white rounded-2xl rounded-br-md px-4 py-2 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>image</span>
          {message.meta?.fileName || 'File uploaded'}
        </div>
      </div>
    );
  }
  return null; // chip/select/form taps are reflected by the cards themselves
}

/**
 * Renders the message list. Interactive cards are only active on the LAST
 * message block — earlier cards freeze (the flow has moved on).
 */
export default function ChatThread({ messages, pending, typing, onAction, speechLang }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending, typing]);

  const lastId = messages.length ? messages[messages.length - 1].id : null;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      {messages.map((m) => {
        const active = m.id === lastId && !typing;
        switch (m.type) {
          case 'text':
            return <TextBubble key={m.id} message={m} pendingText={pending[m.id]} />;
          case 'chips':
            return <ChipRow key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          case 'language_picker':
            return <LanguagePickerMessage key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          case 'business_results':
            return <BusinessResultCards key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          case 'form':
            return <InlineFormMessage key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          case 'upload':
            return m.role === 'user'
              ? <UserStructuredEcho key={m.id} message={m} />
              : <LogoUploadCard key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          case 'summary':
            return <SummaryCard key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          case 'build_started':
            return <BuildStartedCard key={m.id} meta={m.meta} />;
          case 'confirm_action':
            return <ConfirmActionCard key={m.id} meta={m.meta} active={active} onAction={onAction} />;
          default:
            return m.role === 'user' ? <UserStructuredEcho key={m.id} message={m} /> : null;
        }
      })}

      {/* Streaming messages not yet in `messages` */}
      {Object.entries(pending)
        .filter(([id]) => !messages.some(m => m.id === id))
        .map(([id, text]) => (
          <TextBubble key={id} message={{ id, role: 'genni', type: 'text' }} pendingText={text} />
        ))}

      {typing && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
