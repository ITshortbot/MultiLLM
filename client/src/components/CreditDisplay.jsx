import React from 'react';

const MODEL_COLORS = {
  gemini:  'var(--gemini)',
  claude:  '#c97c3a',
  chatgpt: 'var(--text-muted)',
};

export default function CreditDisplay({ credits, onReset }) {
  if (!credits) return null;

  const { totalCost, limitUSD, usagePct, isWarning, isBlocked, models } = credits;

  const barColor = isBlocked  ? 'var(--danger)'  :
                   isWarning  ? 'var(--warning)' :
                                'var(--success)';

  return (
    <div className={`credit-display ${isBlocked ? 'blocked' : ''} ${isWarning ? 'warning' : ''}`}>
      {/* Header row */}
      <div className="credit-header">
        <div className="credit-title">
          <span className="credit-icon">💳</span>
          Session Credits
        </div>
        <div className="credit-cost">
          <span style={{ color: barColor, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
            ${totalCost.toFixed(4)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> / ${limitUSD.toFixed(2)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="credit-bar-track">
        <div
          className="credit-bar-fill"
          style={{ width: `${Math.min(usagePct, 100)}%`, background: barColor }}
        />
      </div>

      {/* Per-model breakdown */}
      <div className="credit-breakdown">
        {Object.entries(models || {}).filter(([k]) => k !== 'chatgpt').map(([key, usage]) => (
          <div key={key} className="credit-model-row">
            <div className="credit-model-name" style={{ color: MODEL_COLORS[key] || 'var(--text-secondary)' }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </div>
            <div className="credit-model-tokens">
              <span>{usage.inputTokens + usage.outputTokens} tok</span>
              <span style={{ color: 'var(--text-muted)' }}>${usage.cost.toFixed(5)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Warning / Blocked */}
      {(isWarning || isBlocked) && (
        <div className={`credit-alert ${isBlocked ? 'danger' : 'warn'}`}>
          {isBlocked ? '🚫 Credit limit reached' : '⚠ Approaching limit'}
        </div>
      )}

      {/* Reset button */}
      <button
        className="btn btn-secondary"
        style={{ fontSize: '11px', padding: '3px 10px', width: '100%', marginTop: 6, justifyContent: 'center' }}
        onClick={onReset}
        title="Reset session credit counter"
      >
        ↺ Reset Session
      </button>
    </div>
  );
}
