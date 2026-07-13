import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { subscribe } from '../lib/sse';
import AnimatedBackdrop from '../components/build/AnimatedBackdrop';
import ScreenshotReveal from '../components/build/ScreenshotReveal';
import StageChecklist from '../components/build/StageChecklist';
import LogStream from '../components/build/LogStream';

/**
 * Full-screen build experience at /build/:projectId.
 * Live progress + page screenshots stream in over SSE while Genni builds the
 * site; refresh-safe via an initial project fetch.
 */
export default function BuildExperience() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Starting...');
  const [logs, setLogs] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [status, setStatus] = useState('processing');
  const [retrying, setRetrying] = useState(false);
  const logSeq = useRef(0);

  const pushLog = useCallback((text) => {
    if (!text) return;
    setLogs((prev) => {
      if (prev.length && prev[prev.length - 1].text === text) return prev;
      return [...prev.slice(-24), { text, at: ++logSeq.current }];
    });
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/project/${projectId}`);
      setProject(data);
      setStatus(data.status);
      setProgress(data.buildProgress || 0);
      if (data.buildProgressMessage) {
        setMessage(data.buildProgressMessage);
        pushLog(data.buildProgressMessage);
      }
    } catch (e) {
      if (e.response?.status === 404) navigate('/sites');
    }
  }, [projectId, navigate, pushLog]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    const offProgress = subscribe('project:progress', (data) => {
      if (data.projectId !== projectId) return;
      if (typeof data.progress === 'number') setProgress(data.progress);
      if (data.message) { setMessage(data.message); pushLog(data.message); }
      setStatus('processing');
    });
    const offPreview = subscribe('project:preview', (data) => {
      if (data.projectId !== projectId) return;
      setPreviews((prev) => [...prev, data].sort((a, b) => a.seq - b.seq));
    });
    const offUpdated = subscribe('project:updated', (data) => {
      if (data.projectId !== projectId) return;
      setStatus(data.status);
      if (data.status === 'completed') setProgress(100);
      if (data.status === 'failed' && data.error) { setMessage(data.error); pushLog(data.error); }
    });
    return () => { offProgress(); offPreview(); offUpdated(); };
  }, [projectId, pushLog]);

  const retry = async () => {
    setRetrying(true);
    try {
      await axios.post(`/api/project/${projectId}/retry`);
      setStatus('processing');
      setProgress(0);
      setPreviews([]);
      setMessage('Starting...');
    } catch (e) {
      pushLog(e.response?.data?.error || 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  const businessName = project?.query && project.query !== 'Manual Context' ? project.query : '';
  const done = status === 'completed';
  const failed = status === 'failed';

  return (
    <div className="relative min-h-screen bg-[#0B0F1A] text-white overflow-hidden">
      <AnimatedBackdrop intensity={done ? 1.4 : 1} />

      <div className="relative z-10 min-h-screen flex flex-col max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 sm:mb-10">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Gen<span className="text-orange-500">Web</span>
          </Link>
          {!done && !failed && (
            <span className="text-xs text-slate-400 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1.5">
              Usually 3–6 minutes
            </span>
          )}
        </header>

        <main className="flex-1 flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
          {/* Left rail (desktop) / bottom section (mobile) */}
          <div className="order-2 lg:order-1 lg:w-64 shrink-0 flex flex-col gap-6">
            <StageChecklist progress={progress} failed={failed} />
            {!done && !failed && (
              <div className="hidden sm:block border-t border-white/10 pt-4">
                <LogStream messages={logs} />
              </div>
            )}
          </div>

          {/* Preview + headline */}
          <div className="order-1 lg:order-2 flex-1 min-w-0 flex flex-col gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-orange-400/90 mb-2">
                {done ? 'Ready' : failed ? 'Something went wrong' : 'Genni is building'}
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight min-h-[2.5rem]" aria-live="polite">
                {done
                  ? `${businessName || 'Your website'} is ready`
                  : failed
                    ? 'The build stopped'
                    : message}
              </h1>
            </div>

            <ScreenshotReveal previews={previews} businessName={businessName} />

            {/* Completion / failure cards */}
            {done && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate(`/editor/${projectId}`)}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors"
                >
                  Open your site
                </button>
                <Link
                  to="/sites"
                  className="flex-1 text-center bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white font-medium rounded-xl px-6 py-3.5 transition-colors"
                >
                  View my sites
                </Link>
              </div>
            )}

            {failed && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm text-red-200 mb-3">{message}</p>
                <button
                  onClick={retry}
                  disabled={retrying}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
                >
                  {retrying ? 'Restarting…' : 'Retry build'}
                </button>
              </div>
            )}

            {!done && !failed && (
              <p className="text-xs text-slate-500">
                You can leave this page — we'll email you when your site is ready.
              </p>
            )}

            {/* Mobile log strip */}
            {!done && !failed && (
              <div className="sm:hidden border-t border-white/10 pt-3">
                <LogStream messages={logs} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
