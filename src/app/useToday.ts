import { useEffect, useState } from 'react';
import { toIsoDate } from '@/domain/partialDate';

const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * Today's date (local midnight), updated when the day changes or the app becomes visible again,
 * so "due today", badges and groups stay right in a long-open tab.
 */
export function useToday(): Date {
  const [today, setToday] = useState(startOfToday);
  useEffect(() => {
    const check = () =>
      setToday((cur) => (toIsoDate(cur) === toIsoDate(startOfToday()) ? cur : startOfToday()));
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
