export const profileTabs = ['timeline', 'details', 'reminders', 'gifts', 'money', 'tasks'] as const;
export type ProfileTab = (typeof profileTabs)[number];

export const isProfileTab = (v: string | undefined): v is ProfileTab =>
  (profileTabs as readonly string[]).includes(v ?? '');
