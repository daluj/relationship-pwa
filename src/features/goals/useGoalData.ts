import { useMemo } from 'react';
import { listGoals, listMilestones, listReviews, useLiveQuery } from '@/db/repositories';
import { goalProgress } from '@/domain/goals';
import type { Goal, GoalMilestone, GoalReview } from '@/domain/types';

export interface GoalData {
  goals: Goal[] | undefined;
  reviews: GoalReview[];
  /** Progress percent per goal id; missing when the goal has no milestones. */
  progress: Map<string, number>;
  milestonesByGoal: Map<string, GoalMilestone[]>;
}

/** Live goals, milestones and reviews, with per-goal progress (features §8.11). */
export function useGoalData(): GoalData {
  const goals = useLiveQuery(listGoals, []);
  const milestones = useLiveQuery(listMilestones, []);
  const reviews = useLiveQuery(listReviews, []);
  return useMemo(() => {
    const milestonesByGoal = new Map<string, GoalMilestone[]>();
    for (const m of milestones ?? []) {
      milestonesByGoal.set(m.goalId, [...(milestonesByGoal.get(m.goalId) ?? []), m]);
    }
    const progress = new Map<string, number>();
    for (const [id, list] of milestonesByGoal) {
      const p = goalProgress(list);
      if (p !== undefined) progress.set(id, p);
    }
    return { goals, reviews: reviews ?? [], progress, milestonesByGoal };
  }, [goals, milestones, reviews]);
}
