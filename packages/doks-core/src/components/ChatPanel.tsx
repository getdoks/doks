'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; href: string }[];
}

const SUGGESTED_CHIPS = [
  'How does authentication work?',
  'What is a chunk?',
  'How do I write RAG-friendly MDX?',
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      {
        role: 'assistant',
        content:
          'The RAG backend is not wired up yet. This is the chat shell. Step 4 of the build plan plugs this into the live retrieval pipeline.',
      },
    ]);
    setInput('');
  }

  return (
    <>
      <div className="cs-head">
        <div className="cs-head-top">
          <div className="cs-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
            </svg>
          </div>
          <div>
            <div className="cs-title">Ask the docs</div>
            <div className="cs-online">Demo · stub</div>
          </div>
        </div>
        <div className="cs-sub">Try a question or pick a suggestion below.</div>
      </div>

      <div className="cs-msgs">
        {messages.length === 0 && (
          <div className="msg a">
            <div className="mav">D</div>
            <div className="bub">
              <p>
                Hi! I&apos;ll answer questions about doks using retrieval over the MDX
                content. The pipeline is being built. For now this is a UI shell.
              </p>
              <div className="chips">
                {SUGGESTED_CHIPS.map((c) => (
                  <button key={c} className="chip" onClick={() => send(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'u' : 'a'}`}>
            <div className="mav">{m.role === 'user' ? 'You' : 'D'}</div>
            <div className="bub">
              <p>{m.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="cs-foot">
        <form
          className="cs-inp-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            id="ci"
            placeholder="Ask about the docs…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
          />
          <div className="cs-inp-actions">
            <span className="kbd-hint cs-kbd">↵</span>
          </div>
        </form>
      </div>
    </>
  );
}
