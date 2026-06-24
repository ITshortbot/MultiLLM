import React, { useState } from 'react';

const MODEL_META = {
  gemini:  { label: 'Gemini',  emoji: '✨', sub: 'Google AI',  colorVar: '--gemini' },
  claude:  { label: 'Claude',  emoji: '🧠', sub: 'Anthropic',  colorVar: '--ollama' },
  chatgpt: { label: 'ChatGPT', emoji: '🤖', sub: 'Coming Soon', colorVar: '--text-muted' },
};

export default function ResponseCard({ response, verification }) {
  const [expanded, setExpanded] = useState(false);
  const { modelKey, model, raw, error, comingSoon, tokens } = response;
  const meta = MODEL_META[modelKey] || { label: model, emoji: '🤖', sub: '', colorVar: '--text-muted' };

  // Coming Soon card
  if (comingSoon) {
    return (
      <div className={`response-card ${modelKey} coming-soon-card`}>
        <div className="response-card-header">
          <div className="model-badge" style={{ color: 'var(--text-muted)' }}>
            <div className="model-dot" style={{ background: 'var(--text-muted)' }} />
            {meta.emoji} {meta.label}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <div style={{ fontSize: 32, marginBottom: 'var(--space-3)', opacity: 0.4 }}>🚀</div>
          <div className="coming-soon-chip" style={{ fontSize: 13, padding: '6px 16px' }}>
            Coming Soon
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-3)', lineHeight: 1.6 }}>
            OpenAI GPT-4o integration<br />will be available in v1.1
          </div>
        </div>
      </div>
    );
  }

  // Get parsed data from verification
  const parsedEntry = verification?.parsed?.find(p => p.modelKey === modelKey);
  const parsed = parsedEntry?.parsed;

  const matchingModels = verification?.matchingModels || [];
  const isAgreed    = matchingModels.includes(model);
  const isDisagreed = verification && matchingModels.length > 0 && !isAgreed;

  const cardClass = `response-card ${modelKey} ${isAgreed ? 'agreed' : ''} ${isDisagreed ? 'disagreed' : ''}`;

  if (error) {
    return (
      <div className={cardClass} style={{ borderTopColor: `var(${meta.colorVar})` }}>
        <div className="response-card-header">
          <div className="model-badge">
            <div className="model-dot" style={{ background: `var(${meta.colorVar})` }} />
            {meta.emoji} {meta.label}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{meta.sub}</span>
          </div>
          <span className="agreement-badge differ">Error</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{error}</div>
      </div>
    );
  }

  return (
    <div className={cardClass} style={{ borderTopColor: `var(${meta.colorVar})` }}>
      {/* Header */}
      <div className="response-card-header">
        <div className="model-badge">
          <div className="model-dot" style={{ background: `var(${meta.colorVar})` }} />
          {meta.emoji} {meta.label}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 2 }}>{meta.sub}</span>
        </div>
        {verification && (
          <span className={`agreement-badge ${isAgreed ? 'agree' : isDisagreed ? 'differ' : 'pending'}`}>
            {isAgreed ? '✓ Agrees' : isDisagreed ? '✗ Differs' : '—'}
          </span>
        )}
      </div>

      {/* Extracted Answer */}
      {parsed?.hasNumericalAnswer && (
        <div className="extracted-answer">
          <span className="extracted-value">{formatNumber(parsed.numerical)}</span>
          {parsed.unit && <span className="extracted-unit">{parsed.unit}</span>}
        </div>
      )}

      {/* Formula chips */}
      {parsed?.formulas?.length > 0 && (
        <div className="formula-chips">
          {parsed.formulas.slice(0, 3).map((f, i) => (
            <span key={i} className="formula-chip">{f.slice(0, 30)}</span>
          ))}
        </div>
      )}

      {/* Raw response */}
      <div>
        <div className="response-raw" style={{ maxHeight: expanded ? 'none' : '80px' }}>
          {raw || <span style={{ color: 'var(--text-muted)' }}>No response</span>}
        </div>
        {raw && raw.length > 200 && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: '11px', padding: '2px 8px', marginTop: 6 }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Show less ↑' : 'Show more ↓'}
          </button>
        )}
      </div>

      {/* Steps */}
      {expanded && parsed?.steps?.length > 0 && (
        <div className="steps-list">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Reasoning steps
          </div>
          {parsed.steps.slice(0, 5).map((step, i) => (
            <div key={i} className="step-item">
              <div className="step-num">{i + 1}</div>
              <div>{step}</div>
            </div>
          ))}
        </div>
      )}

      {/* Token usage */}
      {tokens && (tokens.input > 0 || tokens.output > 0) && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 4 }}>
          <span>↑ {tokens.input} in</span>
          <span>↓ {tokens.output} out</span>
        </div>
      )}

      {/* Uncertainty hint */}
      {parsed?.confidenceHints?.isUncertain && (
        <div style={{ fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ Model expressed uncertainty
        </div>
      )}
    </div>
  );
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  if (Number.isInteger(n)) return n.toLocaleString();
  return parseFloat(n.toFixed(6)).toLocaleString();
}
