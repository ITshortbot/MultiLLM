import React, { useState, useEffect, useCallback, useRef } from 'react';
import QueryInput from './components/QueryInput.jsx';
import StatusPanel from './components/StatusPanel.jsx';
import ResponseCard from './components/ResponseCard.jsx';
import ConfidenceMeter from './components/ConfidenceMeter.jsx';
import VerdictPanel from './components/VerdictPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import CreditDisplay from './components/CreditDisplay.jsx';

const INITIAL_STATUSES = {
  gemini:  { status: 'idle', message: '' },
  claude:  { status: 'idle', message: '' },
  chatgpt: { status: 'coming_soon', message: '' },
};

export default function App() {
  const [query, setQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [statuses, setStatuses] = useState(INITIAL_STATUSES);
  const [responses, setResponses] = useState([]);
  const [verification, setVerification] = useState(null);
  const [ollamaResult, setOllamaResult] = useState(null);
  const [phaseMessage, setPhaseMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [credits, setCredits] = useState(null);
  const [creditWarning, setCreditWarning] = useState(null);
  const contentRef = useRef(null);

  // Register IPC event listeners
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.onStatusUpdate((data) => {
      if (data.model) {
        setStatuses(prev => ({
          ...prev,
          [data.model]: { status: data.status, message: data.message || '' },
        }));
      }
      if (data.phase) setPhaseMessage(data.message || '');
    });

    api.onResultReady((data) => {
      setResponses(data.responses || []);
    });

    api.onVerificationComplete((data) => {
      setVerification(data.verification);
      setOllamaResult(data.ollamaResult);
      setIsRunning(false);
      setPhaseMessage('');
      loadHistory();
      setTimeout(() => {
        contentRef.current?.scrollTo({ top: 300, behavior: 'smooth' });
      }, 100);
    });

    api.onQueryError((data) => {
      setIsRunning(false);
      setPhaseMessage('');
      if (data.credits) setCredits(data.credits);
    });

    api.onCreditsUpdate((data) => {
      setCredits(data);
    });

    api.onCreditsWarning((data) => {
      setCreditWarning(data.message);
      setTimeout(() => setCreditWarning(null), 5000);
    });

    return () => {
      ['status:update', 'result:ready', 'verification:complete', 'query:error', 'credits:update', 'credits:warning']
        .forEach(ch => api.removeAllListeners(ch));
    };
  }, []);

  // Load initial credits snapshot
  useEffect(() => {
    const api = window.electronAPI;
    if (api) {
      api.getCredits?.().then(setCredits).catch(() => {});
    } else {
      fetch('/api/credits').then(r => r.json()).then(setCredits).catch(console.error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const api = window.electronAPI;
    if (api) {
      try {
        const items = await api.getHistory(50);
        setHistory(items || []);
      } catch (e) { console.error('History error:', e); }
    } else {
      try {
        const items = await fetch('/api/history').then(r => r.json());
        setHistory(items || []);
      } catch (e) { console.error('History error:', e); }
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);


  const handleRun = useCallback(async () => {
    if (!query.trim() || isRunning) return;

    // Check if credits are blocked before running
    if (credits?.isBlocked) return;

    setIsRunning(true);
    setStatuses({
      ...INITIAL_STATUSES,
      gemini: { status: 'idle', message: '' },
      claude: { status: 'idle', message: '' },
    });
    setResponses([]);
    setVerification(null);
    setOllamaResult(null);
    setPhaseMessage('Starting...');
    setActiveHistoryId(null);
    setCreditWarning(null);

    const api = window.electronAPI;
    if (api) {
      try {
        await api.runQuery(query.trim());
      } catch (err) {
        setIsRunning(false);
        setPhaseMessage('');
      }
    } else {
      // Standalone web browser mode fallback
      try {
        const response = await fetch('/api/query/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query.trim() })
        });
        if (!response.ok) throw new Error('HTTP error ' + response.status);
        const data = await response.json();
        if (data.success) {
          // Poll / fetch updated history and state
          loadHistory();
          // Fetch full result details
          const fullRes = await fetch(`/api/history/${data.queryId}`).then(r => r.json());
          if (fullRes) {
            setVerification(fullRes.verification_result || null);
            setOllamaResult(fullRes.ollamaResult || null);
            const reconstructed = [];
            if (fullRes.gemini_raw)  reconstructed.push({ model: 'Gemini',  modelKey: 'gemini',  raw: fullRes.gemini_raw,  error: fullRes.gemini_error });
            if (fullRes.chatgpt_raw) reconstructed.push({ model: 'ChatGPT', modelKey: 'chatgpt', raw: '', comingSoon: true });
            const claudeRaw = fullRes.perplexity_raw || fullRes.claude_raw;
            if (claudeRaw) reconstructed.push({ model: 'Claude', modelKey: 'claude', raw: claudeRaw, error: fullRes.perplexity_error || fullRes.claude_error });
            setResponses(reconstructed);
          }
        } else {
          alert('Error: ' + data.error);
        }
      } catch (err) {
        console.error(err);
        alert('Failed to contact backend: ' + err.message);
      } finally {
        setIsRunning(false);
        setPhaseMessage('');
      }
    }
  }, [query, isRunning, credits, loadHistory]);

  const handleHistorySelect = useCallback(async (item) => {
    setActiveHistoryId(item.id);
    const api = window.electronAPI;
    let full = null;
    if (api) {
      full = await api.getHistoryById(item.id);
    } else {
      try {
        full = await fetch(`/api/history/${item.id}`).then(r => r.json());
      } catch (e) {
        console.error(e);
      }
    }
    if (!full) return;

    setQuery(full.question || '');
    setVerification(full.verification_result || null);
    setStatuses(INITIAL_STATUSES);
    setPhaseMessage('');
    setIsRunning(false);

    const reconstructed = [];
    if (full.gemini_raw)  reconstructed.push({ model: 'Gemini',  modelKey: 'gemini',  raw: full.gemini_raw,  error: full.gemini_error });
    if (full.chatgpt_raw) reconstructed.push({ model: 'ChatGPT', modelKey: 'chatgpt', raw: '', comingSoon: true });
    const claudeRaw = full.perplexity_raw || full.claude_raw;
    if (claudeRaw) reconstructed.push({ model: 'Claude', modelKey: 'claude', raw: claudeRaw, error: full.perplexity_error || full.claude_error });
    setResponses(reconstructed);
  }, []);

  const handleClearHistory = useCallback(async () => {
    const api = window.electronAPI;
    if (api) {
      await api.clearHistory();
    } else {
      await fetch('/api/history/clear', { method: 'POST' }).catch(console.error);
    }
    setHistory([]);
  }, []);

  const handleResetCredits = useCallback(async () => {
    const api = window.electronAPI;
    let snapshot = null;
    if (api) {
      snapshot = await api.resetCredits();
    } else {
      snapshot = await fetch('/api/credits/reset', { method: 'POST' }).then(r => r.json()).catch(console.error);
    }
    if (snapshot) setCredits(snapshot);
  }, []);

  // Poll for status updates in web mode if active
  useEffect(() => {
    if (!isRunning || window.electronAPI) return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const snap = await fetch('/api/credits').then(r => r.json());
        if (snap && active) setCredits(snap);
      } catch {}
    }, 1500);
    return () => { active = false; clearInterval(interval); };
  }, [isRunning]);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {window.electronAPI && (
          <div className="titlebar" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', WebkitAppRegion: 'drag' }}>
            <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' }}>
              <button className="titlebar-btn close"    onClick={() => window.electronAPI?.closeWindow()} />
              <button className="titlebar-btn minimize" onClick={() => window.electronAPI?.minimizeWindow()} />
              <button className="titlebar-btn maximize" onClick={() => window.electronAPI?.maximizeWindow()} />
            </div>
            <span className="titlebar-title">LLM Verifier</span>
            <div style={{ width: 60 }} />
          </div>
        )}


        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">⚡</div>
            <div>
              <div className="sidebar-logo-text">Multi-LLM</div>
              <div className="sidebar-logo-sub">Verification System</div>
            </div>
          </div>

          {/* Credit Display */}
          <CreditDisplay credits={credits} onReset={handleResetCredits} />
        </div>

        <HistoryPanel
          history={history}
          activeId={activeHistoryId}
          onSelect={handleHistorySelect}
          onClear={handleClearHistory}
        />
      </aside>

      {/* Main Content */}
      <div className="main-area">
        <div className="content-scroll" ref={contentRef}>

          {/* Credit warning toast */}
          {creditWarning && (
            <div className="credit-warning-toast fade-in">
              ⚠ {creditWarning}
            </div>
          )}

          {/* Credit blocked banner */}
          {credits?.isBlocked && (
            <div className="credit-blocked-banner fade-in">
              🚫 Session credit limit reached. Reset in the sidebar to continue.
            </div>
          )}

          {/* Query Input */}
          <div className="query-section">
            <div className="section-header">
              <h1 className="section-title">Query</h1>
              {phaseMessage && (
                <div className="phase-badge">
                  <span className="status-dot querying" />
                  {phaseMessage}
                </div>
              )}
            </div>
            <QueryInput
              value={query}
              onChange={setQuery}
              onRun={handleRun}
              isRunning={isRunning}
              isBlocked={credits?.isBlocked}
            />
          </div>

          {/* Status Panel */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div className="section-header">
              <div className="section-title">Model Status</div>
            </div>
            <StatusPanel statuses={statuses} />
          </div>

          {/* Response Cards */}
          {responses.length > 0 && (
            <div className="fade-in" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="section-header">
                <div className="section-title">Responses</div>
              </div>
              <div className="response-grid">
                {responses.map((r) => (
                  <ResponseCard key={r.modelKey} response={r} verification={verification} />
                ))}
              </div>
            </div>
          )}

          {/* Confidence Meter */}
          {verification && (
            <div className="fade-in" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="section-header">
                <div className="section-title">Confidence Analysis</div>
              </div>
              <ConfidenceMeter verification={verification} />
            </div>
          )}

          {/* Verdict Panel */}
          {verification && (
            <div className="fade-in">
              <div className="section-header">
                <div className="section-title">Final Verdict</div>
              </div>
              <VerdictPanel verification={verification} ollamaResult={ollamaResult} />
            </div>
          )}

          {/* Empty state */}
          {!isRunning && responses.length === 0 && !verification && (
            <div className="empty-state" style={{ marginTop: 40 }}>
              <div className="empty-icon">🧮</div>
              <div className="empty-title">Ready to Verify</div>
              <div className="empty-subtitle">
                Enter any mathematical calculation, financial equation, or logical problem.
                Gemini and Claude will be queried simultaneously and results cross-verified.
              </div>
            </div>
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}
