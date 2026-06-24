import React from 'react';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function confidenceColor(c) {
  if (c >= 80) return 'var(--success)';
  if (c >= 55) return 'var(--warning)';
  return 'var(--danger)';
}

export default function HistoryPanel({ history, activeId, onSelect, onClear }) {
  return (
    <>
      <div style={{ padding: '0 var(--space-5) var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
          History
        </div>
        {history.length > 0 && (
          <button
            className="btn btn-danger"
            style={{ fontSize: '10px', padding: '2px 8px' }}
            onClick={onClear}
            title="Clear all history"
          >
            Clear
          </button>
        )}
      </div>

      <div className="history-scroll">
        {history.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No history yet.
            <br />Run a query to get started.
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className={`history-item ${activeId === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(item)}
            >
              <div className="history-question">{item.question}</div>
              <div className="history-meta">
                <span
                  className="history-confidence"
                  style={{ color: confidenceColor(item.confidence) }}
                >
                  {item.confidence}%
                </span>
                <span className={`history-verdict-chip ${item.verdict}`}>
                  {item.verdict}
                </span>
                <span className="history-time">{timeAgo(item.timestamp)}</span>
              </div>
              {item.final_answer !== null && (
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {item.final_answer}{item.final_unit ? ` ${item.final_unit}` : ''}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
