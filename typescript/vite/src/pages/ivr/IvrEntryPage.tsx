import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
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

  if (!loaded) {
    return <div className="text-sm text-gray-600">Loading IVR entry...</div>;
  }

  if (fallbackDomain) {
    return <Navigate to={`/domains/${fallbackDomain}/test`} replace />;
  }

  return <Navigate to="/domains" replace />;
};

export { IvrEntryPage };
