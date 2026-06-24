import React, { useState } from 'react';

const VERDICT_ICONS = {
  unanimous:          '✅',
  majority:           '✔️',
  contested:          '⚠️',
  'ollama-confirmed': '🦙',
  error:              '❌',
};

export default function VerdictPanel({ verification, ollamaResult }) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (!verification) return null;

  const {
    finalAnswer,
    finalUnit,
    confidence,
    verdict,
    explanation,
    inconsistencies = [],
    allFormulas = [],
    ollamaUsed,
    parsed = [],
  } = verification;

  const icon = VERDICT_ICONS[verdict] || '❓';
  const hasAnswer = finalAnswer !== null && finalAnswer !== undefined;

  const formatFinalAnswer = (n, unit) => {
    if (n === null || n === undefined) return 'No consensus answer';
    let str;
    if (Math.abs(n) >= 1e6) str = n.toExponential(4);
    else if (Number.isInteger(n)) str = n.toLocaleString();
    else str = parseFloat(n.toFixed(8)).toLocaleString();
    return unit ? `${str} ${unit}` : str;
  };

  return (
    <div className="verdict-panel">
      {/* Header */}
      <div className="verdict-header">
        <div className="verdict-icon">{icon}</div>
        <div>
          <div className="verdict-title">Final Verified Answer</div>
          <div className="verdict-subtitle">{confidence}% confidence • {verdict}</div>
        </div>
      </div>

      {/* Final Answer */}
      <div className="final-answer-display">
        {formatFinalAnswer(finalAnswer, finalUnit)}
      </div>

      {/* Explanation */}
      <div className="verdict-explanation">{explanation}</div>

      {/* Ollama Banner */}
      {ollamaUsed && ollamaResult && (
        <div className="ollama-banner" style={{ marginTop: 'var(--space-4)' }}>
          🦙 <strong>Ollama (llama3)</strong> was used as a fallback tiebreaker.
          {ollamaResult.raw && (
            <span style={{ marginLeft: 8, opacity: 0.8 }}>
              Answer: {ollamaResult.raw.slice(0, 60)}…
            </span>
          )}
        </div>
      )}

      {/* Inconsistencies */}
      {inconsistencies.length > 0 && (
        <div className="inconsistency-list">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Detected Inconsistencies
          </div>
          {inconsistencies.map((inc, i) => (
            <div key={i} className="inconsistency-item">
              <span>⚠</span>
              <span>{inc.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Formulas Used */}
      {allFormulas.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Formulas Detected
          </div>
          <div className="formula-chips">
            {allFormulas.map((f, i) => (
              <span key={i} className="formula-chip">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning Comparison Toggle */}
      {parsed.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowReasoning(r => !r)}
            style={{ fontSize: '12px' }}
          >
            {showReasoning ? '▲ Hide reasoning comparison' : '▼ Compare reasoning steps'}
          </button>

          {showReasoning && (
            <div style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              {parsed.filter(p => !p.error && p.raw).map((p) => (
                <div key={p.modelKey} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: `var(--${p.modelKey})`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p.model}
                  </div>
                  {p.parsed?.steps?.length > 0 ? (
                    <div className="steps-list">
                      {p.parsed.steps.slice(0, 4).map((step, i) => (
                        <div key={i} className="step-item">
                          <div className="step-num">{i + 1}</div>
                          <div style={{ fontSize: 11 }}>{step.slice(0, 120)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.parsed?.finalStatement || p.raw?.slice(0, 150) || 'No reasoning extracted'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
