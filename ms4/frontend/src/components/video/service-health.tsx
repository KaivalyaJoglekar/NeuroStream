'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchServiceHealth, ServiceHealth } from '../../services/cognitive.service';
import { Button } from '../ui/button';

export function ServiceHealthPanel() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  const load = async () => {
    setLoading(true);
    const response = await fetchServiceHealth();
    if (response.success && response.data) {
      setServices(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex h-[500px] flex-col">
      <div className="border-b border-stroke/50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Microservice Health Matrix
        </div>
        <div className="mb-3 text-xs text-textMuted">
          Quick frontend reachability check for MS1 to MS7 base URLs.
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh Health
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {services.map((service) => (
          <div key={service.key} className="rounded-lg border border-stroke/50 bg-elevated/40 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{service.label}</div>
              <div className={`inline-flex items-center gap-1 text-xs ${service.ok ? 'text-success' : 'text-warning'}`}>
                {service.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {service.ok ? 'reachable' : 'unreachable'}
              </div>
            </div>
            <p className="text-xs text-textMuted">{service.baseUrl}</p>
            {service.statusCode ? (
              <p className="mt-1 text-xs text-textMuted">HTTP {service.statusCode}</p>
            ) : null}
            {service.error ? (
              <p className="mt-1 text-xs text-warning">{service.error}</p>
            ) : null}
          </div>
        ))}

        {!loading && services.length === 0 ? (
          <div className="mt-10 text-center text-sm text-textMuted">
            No health payload received. Check microservice URLs and CORS settings.
          </div>
        ) : null}
      </div>
    </div>
  );
}
