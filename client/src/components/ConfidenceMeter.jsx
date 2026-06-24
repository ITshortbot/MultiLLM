import React, { useEffect, useRef } from 'react';

const VERDICT_LABELS = {
  unanimous:       { label: 'Unanimous Agreement', color: 'var(--success)' },
  majority:        { label: 'Majority Agreement',  color: 'var(--info)' },
  contested:       { label: 'Contested',           color: 'var(--warning)' },
  'ollama-confirmed': { label: 'Ollama Confirmed', color: 'var(--ollama)' },
  error:           { label: 'Query Error',         color: 'var(--danger)' },
};

export default function ConfidenceMeter({ verification }) {
  const { confidence = 0, verdict = 'error', matchingModels = [], explanation = '' } = verification || {};
  const prevConf = useRef(0);
  const circleRef = useRef(null);

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (confidence / 100) * circumference;

  // Color based on confidence
  const color =
    confidence >= 80 ? 'var(--success)' :
    confidence >= 55 ? 'var(--warning)' :
    'var(--danger)';

  const verdictMeta = VERDICT_LABELS[verdict] || VERDICT_LABELS.error;

  useEffect(() => {
    // Animate the stroke-dashoffset
    if (circleRef.current) {
      circleRef.current.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
      circleRef.current.style.strokeDashoffset = offset;
    }
    prevConf.current = confidence;
  }, [confidence, offset]);

  return (
    <div className="confidence-meter-wrapper glass-card elevated">
      {/* Gauge */}
      <div className="confidence-gauge">
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset="0"
            strokeLinecap="round"
          />
          {/* Progress */}
          <circle
            ref={circleRef}
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference} /* starts at 0, animates to offset */
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="confidence-center-text">
          <div className="confidence-pct" style={{ color }}>{confidence}%</div>
          <div className="confidence-label">Confidence</div>
        </div>
      </div>

      {/* Details */}
      <div className="confidence-details">
        <div className="confidence-verdict" style={{ color: verdictMeta.color }}>
          {verdictMeta.label}
        </div>

        {matchingModels.length > 0 && (
          <div className="matching-models">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agreeing:</span>
            {matchingModels.map(m => (
              <span key={m} className={`agreement-badge agree`}>{m}</span>
            ))}
          </div>
        )}

        {explanation && (
          <div className="confidence-explanation">{explanation}</div>
        )}

        {/* Confidence bar breakdown */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Confidence breakdown</div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${confidence}%`,
                background: `linear-gradient(90deg, ${color} 0%, ${color}99 100%)`,
                borderRadius: 3,
                transition: 'width 0.8s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
