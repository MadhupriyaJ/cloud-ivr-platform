import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeenIcon } from '@/components';
import { fetchDomains } from './api';
import { LAST_TESTED_DOMAIN_KEY } from './DomainTestPage';

const IvrEntryPage = () => {
  const [fallbackDomain, setFallbackDomain] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const remembered = localStorage.getItem(LAST_TESTED_DOMAIN_KEY);
    if (remembered) {
      setFallbackDomain(remembered);
      setLoaded(true);
      return () => {
        active = false;
      };
    }

    void fetchDomains()
      .then((items) => {
        if (!active) return;
        setFallbackDomain(items[0]?.domain_id ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative w-screen min-h-[100dvh] overflow-hidden bg-gray-950">
      <video
        className="fixed inset-0 h-[100dvh] w-screen object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/media/landing/ivr-hero.mp4" type="video/mp4" />
      </video>

      <div className="fixed inset-0 bg-gray-950/65" />
      <div className="fixed inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.92)_12%,rgba(15,23,42,0.65)_45%,rgba(15,23,42,0.4)_100%)]" />

      <div className="relative z-10 flex min-h-[100dvh] w-screen items-center">
        <div className="container-fluid w-full px-5 py-16 sm:px-8 lg:px-14 xl:px-20">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
              <KeenIcon icon="abstract-26" className="text-sm" />
              Voice Automation Platform
            </div>

            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
              Build, monitor, and operate your IVR workflows in one control room.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-gray-200 md:text-lg">
              Configure domains, manage prompts and rules, run realtime sessions, and track
              escalations from a single Metronic-based workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/ivr/overview" className="btn btn-primary btn-lg">
                <KeenIcon icon="chart-line-up-2" className="me-2" />
                Open Dashboard
              </Link>
              <Link to="/domains/new" className="btn btn-light btn-lg">
                <KeenIcon icon="plus" className="me-2" />
                Create Domain
              </Link>
              {loaded && fallbackDomain && (
                <Link
                  to={`/domains/${fallbackDomain}/test`}
                  className="btn btn-outline btn-lg border-white/30 text-white hover:bg-white/10"
                >
                  <KeenIcon icon="phone" className="me-2" />
                  Resume Last Test
                </Link>
              )}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <div className="text-sm font-medium text-white/70">Module</div>
                <div className="mt-2 text-lg font-semibold text-white">Domain Studio</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <div className="text-sm font-medium text-white/70">Module</div>
                <div className="mt-2 text-lg font-semibold text-white">Realtime Testing</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <div className="text-sm font-medium text-white/70">Module</div>
                <div className="mt-2 text-lg font-semibold text-white">Escalation Ops</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { IvrEntryPage };
