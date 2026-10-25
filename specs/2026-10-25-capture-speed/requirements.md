# Phase 11 — Capture speed: requirements

Roadmap: [Phase 11](../roadmap.md). Same branch and PR as Phase 10.

## Scope

### Included

| Item                 | What it does                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Moment templates** | Built-in presets in the composer: Coffee, Meal, Call, Gift given, Visit. Choosing one sets kind, activity type, default text and the focus.                                           |
| **Log a call**       | "Log a call" action on the profile (and `c` shortcut variant `Log call` in the ⋯ menu) that opens the composer as an outgoing/incoming call for that contact with the time prefilled. |
| **Gift photos**      | Add, replace and remove a photo on a gift using the existing crop/encode pipeline; shown on the gift row and in the brief.                                                            |

### Out of scope

- **Voice dictation.** Dropped after the interview: Chrome's `SpeechRecognition` sends audio to a server, which conflicts with mission §1.2. It stays a backlog idea until an on-device API is widely available.
- User-defined templates (mission §2.3 "custom record templates" stays backlog).
- Schema changes: templates are code, and `Gift.photoBlobId` already exists.

## Acceptance criteria

- **AC-1** Choosing the "Coffee" template in the composer sets kind `activity` and `activityType: coffee`, prefills the localized text and keeps any contacts already picked.
- **AC-2** Templates never overwrite text the user already typed: the prefill is skipped (and the preset still applies kind/type) when the body is non-empty.
- **AC-3** "Log a call" on a profile opens the composer with kind `call`, that contact selected, `happenedAt` now, and direction choice focused; saving updates the contact's `lastInteractionAt` (D-028).
- **AC-4** A gift can have a photo added, replaced and removed. Replacing or removing deletes the old blob; deleting the gift's contact purge removes it (cascade, D-016).
- **AC-5** Gift photos are resized with the existing pipeline (≤ 1600 px) with a ≤ 600 px thumbnail and survive a JSON export → import round trip (`includesPhotos`).
- **AC-6** Templates and Log a call work offline and are keyboard-operable; axe passes in all three themes; en and es are complete.

## Decisions

- **D-A: Templates are constants** in `domain/momentTemplates.ts` keyed by id; labels and default text come from i18n (`compose.templates.*`). _Project-wide: no._
- **D-B: Prefill never clobbers.** See AC-2; chosen so a template can't destroy a half-written note.
- **D-C: Gift photos reuse moment photo thumbnails.** Same `<id>:thumb` blob convention as D-026, no new table. _Project-wide: yes (D-070)._
- **D-D: Voice dictation dropped** for the privacy reason above. _Project-wide: yes, recorded in D-070._

## Context

- Extends `features §8.4` and `§8.7`, `ui §6.5` (composer). New subsections: features §8.12, ui §6.12.
- Files: `src/features/compose/Composer.tsx`, `src/features/gifts/*`, `src/features/data/preparePhoto.ts`, `src/lib/` image helpers, `src/db/repositories/profileItems.ts`, `blobRepo.ts`.
- i18n under `compose.templates.*`, `profile.logCall`, `gifts.photo*`. Accessibility: template picker is a labelled listbox/menu, photo buttons have text labels.
- Privacy: photos stay in IndexedDB only.
