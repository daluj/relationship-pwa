import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useComposer } from '@/app/stores/composer';

/**
 * `/compose` deep link (manifest shortcut, share target): opens the composer over Home.
 * `?contact=<id>` pre-selects a person, `?text=` pre-fills the body.
 */
export function ComposeRoute() {
  const [params] = useSearchParams();
  const openComposer = useComposer((s) => s.openComposer);
  useEffect(() => {
    const contact = params.get('contact');
    const text = params.get('text') ?? undefined;
    openComposer({ prefill: { contactIds: contact ? [contact] : undefined, text } });
  }, [params, openComposer]);
  return <Navigate to="/" replace />;
}
