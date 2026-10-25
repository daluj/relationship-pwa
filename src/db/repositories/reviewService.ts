// Reads behind Year in review (features §8.13).
import { buildYearReview, yearsWithMoments, type YearReview } from '@/domain/yearReview';
import { db } from '../db';

export async function getYearReview(year: number): Promise<YearReview> {
  const [moments, contacts, gifts, debts] = await Promise.all([
    db.moments.toArray(),
    db.contacts.toArray(),
    db.gifts.toArray(),
    db.debts.toArray(),
  ]);
  return buildYearReview(year, { moments, contacts, gifts, debts });
}

export async function reviewYears(): Promise<number[]> {
  const years = yearsWithMoments(await db.moments.toArray());
  return years.length ? years : [new Date().getFullYear()];
}
