import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onboardingSnapshot, useLiveQuery } from '@/db/repositories';
import { markOnboarded, onboardedLocally } from './onboardingState';

/**
 * Opens onboarding on Home when the database is empty and onboarding was never completed (SPEC §8.1 AC).
 * Existing data without the flag (upgrades) simply marks onboarding as done. Deep links are never
 * redirected. Reads one consistent snapshot (see `onboardingSnapshot`).
 */
export function useOnboardingGate(): void {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const state = useLiveQuery(onboardingSnapshot, []);

  useEffect(() => {
    if (!state || state.onboarded || onboardedLocally()) return;
    if (state.hasData) void markOnboarded();
    else if (pathname === '/') navigate('/onboarding', { replace: true });
  }, [state, pathname, navigate]);
}
