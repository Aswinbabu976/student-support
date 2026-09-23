import { useEffect, useState } from 'react';
import { getRegistrationConfig } from '../services/auth-api';
import type { RegistrationConfig } from '../types/auth';

export function useRegistrationConfig() {
  const [config, setConfig] = useState<RegistrationConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRegistrationConfig()
      .then((value) => {
        if (!cancelled) {
          setConfig(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfig(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
