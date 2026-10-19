export const profileTabs = ['timeline', 'details', 'reminders', 'gifts', 'money', 'tasks'] as const;
export type ProfileTab = (typeof profileTabs)[number];

/** Milestone that delivers each not-yet-built tab (SPEC §14). */
export const tabMilestone: Partial<Record<ProfileTab, number>> = {
  gifts: 5,
  money: 5,
  tasks: 5,
};

export const isProfileTab = (v: string | undefined): v is ProfileTab =>
  (profileTabs as readonly string[]).includes(v ?? '');
