import React, { useRef, useEffect, useCallback } from 'react';

export default function QueryInput({ value, onChange, onRun, isRunning }) {
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun();
    }
  }, [onRun]);

  const examples = [
    'What is the compound interest on $10,000 at 8% annually for 5 years?',
    'Calculate the kinetic energy of a 1500kg car moving at 60 mph',
    'What is 15% of 847.50?',
  ];

  const handleExampleClick = (ex) => {
    onChange(ex);
    textareaRef.current?.focus();
  };

  return (
    <div>
      <div className="query-input-wrapper">
        <textarea
          id="query-textarea"
          ref={textareaRef}
          className="query-textarea"
          placeholder="Enter a calculation, formula, or analytical question…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          rows={3}
        />
        <div className="query-footer">
          <span className="query-hint">Ctrl+Enter to run • Supports math, finance, engineering, logic</span>
          <button
            id="run-button"
            className="btn btn-primary btn-run"
            onClick={onRun}
            disabled={isRunning || !value.trim()}
          >
            {isRunning ? (
              <>
                <LoadingSpinner />
                Querying…
              </>
            ) : (
              <>
                <span>⚡</span>
                Run Verification
              </>
            )}
          </button>
        </div>
      </div>

      {/* Example queries */}
      {!isRunning && !value && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {examples.map((ex, i) => (
            <button
              key={i}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => handleExampleClick(ex)}
            >
              {ex.slice(0, 45)}…
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
