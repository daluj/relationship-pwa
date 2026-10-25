// Built-in moment templates for the composer (features §8.12). Custom templates stay in the backlog.
import type { Moment, MomentKind } from './types';

export const momentTemplateIds = ['coffee', 'meal', 'call', 'gift-given', 'visit'] as const;
export type MomentTemplateId = (typeof momentTemplateIds)[number];

interface TemplateDef {
  kind: MomentKind;
  activityType?: NonNullable<Moment['activityType']>;
  callDirection?: NonNullable<Moment['callDirection']>;
}

export const momentTemplates: Record<MomentTemplateId, TemplateDef> = {
  coffee: { kind: 'activity', activityType: 'coffee' },
  meal: { kind: 'activity', activityType: 'meal' },
  call: { kind: 'call', callDirection: 'outgoing' },
  'gift-given': { kind: 'activity', activityType: 'other' },
  visit: { kind: 'activity', activityType: 'visit' },
};

export interface TemplatePatch {
  kind: MomentKind;
  activityType?: Moment['activityType'];
  callDirection?: Moment['callDirection'];
  /** New body text; the current one when it was not empty (a template never overwrites typing). */
  body: string;
}

/** Kind and type always apply; `defaultText` only fills an empty body (AC-1, AC-2). */
export function applyTemplate(
  currentBody: string,
  id: MomentTemplateId,
  defaultText: string,
): TemplatePatch {
  const def = momentTemplates[id];
  return {
    kind: def.kind,
    activityType: def.activityType,
    callDirection: def.callDirection,
    body: currentBody.trim() ? currentBody : defaultText,
  };
}
