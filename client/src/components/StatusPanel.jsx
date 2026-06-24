import React from 'react';

const MODELS = [
  { key: 'gemini', label: 'Gemini',  emoji: '✨', subLabel: 'Google AI' },
  { key: 'claude', label: 'Claude',  emoji: '🧠', subLabel: 'Anthropic' },
  { key: 'chatgpt', label: 'ChatGPT', emoji: '🤖', subLabel: 'Coming Soon' },
];

const STATUS_COPY = {
  idle:        'Idle',
  connecting:  'Connecting…',
  querying:    'Sending query…',
  waiting:     'Waiting for response…',
  extracting:  'Extracting answer…',
  done:        'Done',
  error:       'Error',
  coming_soon: 'Coming Soon',
};

export default function StatusPanel({ statuses }) {
  return (
    <div className="status-grid">
      {MODELS.map(({ key, label, emoji, subLabel }) => {
        const s = statuses[key] || { status: 'idle' };
        const isComingSoon = key === 'chatgpt' || s.status === 'coming_soon';
        const isDone   = s.status === 'done';
        const isError  = s.status === 'error';
        const isActive = !isDone && !isError && !isComingSoon && s.status !== 'idle';

        return (
          <div
            key={key}
            className={[
              'status-card',
              isActive     ? 'active'      : '',
              isDone       ? 'done'        : '',
              isError      ? 'error'       : '',
              isComingSoon ? 'coming-soon' : '',
            ].filter(Boolean).join(' ')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="status-model-name" style={{ color: isComingSoon ? 'var(--text-muted)' : `var(--${key === 'claude' ? 'ollama' : key})` }}>
                {emoji} {label}
              </div>
              {isComingSoon && (
                <span className="coming-soon-chip">Soon</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{subLabel}</div>

            <div className="status-indicator">
              <div className={`status-dot ${isComingSoon ? 'idle' : s.status}`} />
              <span>{STATUS_COPY[s.status] || s.status}</span>
            </div>

            {isError && s.message && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                {s.message.slice(0, 80)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
