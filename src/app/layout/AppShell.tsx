import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { Toaster } from '@/components/Toaster';
import { ComposerDialog } from '@/features/compose/ComposerDialog';
import { EntityLookupProvider } from '@/features/moments/lookup';
import { BackupNudge } from '@/features/data/BackupNudge';
import { DueBanner } from '@/features/reminders/DueBanner';
import { useReminderNotifications } from '@/features/reminders/useReminderNotifications';
import { useGlobalShortcuts } from '../useGlobalShortcuts';
import { useOnboardingGate } from '@/features/onboarding/useOnboardingGate';
import { ShortcutsDialog } from './ShortcutsDialog';
import { UpdatePrompt } from '../UpdatePrompt';
import { BottomTabBar } from './BottomTabBar';
import { Fab } from './Fab';
import { LeftNav } from './LeftNav';
import { MobileDrawer } from './MobileDrawer';
import { MobileTopBar } from './MobileTopBar';
import { RightRail } from './RightRail';

/** X-style responsive shell (ui §6.1–6.3). */
export function AppShell() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const { helpOpen, setHelpOpen } = useGlobalShortcuts();
  useOnboardingGate();
  useReminderNotifications();

  return (
    <EntityLookupProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {t('app.skipToContent')}
      </a>
      <div className="mx-auto flex w-full max-w-[1265px] justify-center">
        <LeftNav />
        <div className="flex min-w-0 flex-1 justify-center md:flex-none">
          <main
            id="main"
            data-testid="center-column"
            className="min-h-dvh w-full min-w-0 pb-[calc(53px+env(safe-area-inset-bottom))] md:w-[600px] md:border-x md:border-border md:pb-0"
          >
            <MobileTopBar onOpenMenu={() => setDrawerOpen(true)} />
            <DueBanner />
            <BackupNudge />
            <Outlet />
          </main>
        </div>
        <RightRail />
      </div>
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />
      <Fab />
      <BottomTabBar />
      <Toaster />
      <UpdatePrompt />
      <ComposerDialog />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </EntityLookupProvider>
  );
}
