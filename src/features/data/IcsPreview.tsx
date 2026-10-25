import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { inputClass } from '@/components/form/fieldClass';
import { commitIcs, knownContacts, type IcsTarget } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { normalizeText } from '@/domain/fuzzy';
import type { ParsedIcsEvent } from '@/domain/ics';
import type { Contact } from '@/domain/types';
import { PeoplePicker } from '@/features/compose/PeoplePicker';
import { useLookup } from '@/features/moments/useLookup';

type Choice = 'skip' | 'create' | `contact:${string}`;

const choiceOf = (c: Choice, name?: string): IcsTarget =>
  c === 'skip'
    ? null
    : c === 'create'
      ? name
        ? { create: name }
        : null
      : { contactId: c.slice(8) };

function defaultChoice(e: ParsedIcsEvent, contacts: Contact[]): Choice {
  if (e.skip) return 'skip';
  const wanted = e.name ? normalizeText(e.name) : undefined;
  const match = wanted && contacts.find((c) => normalizeText(fullName(c)) === wanted);
  if (match) return `contact:${match.id}`;
  return e.name ? 'create' : 'skip';
}

/** Review `.ics` events before anything is written: match, create or skip each one (features §8.14). */
export function IcsPreview({
  events,
  onCancel,
  onDone,
}: {
  events: ParsedIcsEvent[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const { contacts } = useLookup();
  const [known, setKnown] = useState<Contact[]>();
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void knownContacts().then((k) => {
      const list = k.map((x) => x.contact);
      setKnown(list);
      setChoices(events.map((e) => defaultChoice(e, list)));
    });
  }, [events]);

  const count = useMemo(() => choices.filter((c) => c !== 'skip').length, [choices]);
  if (!known) return null;

  const fmt = (e: ParsedIcsEvent) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'long',
      day: 'numeric',
      ...(e.year && { year: 'numeric' }),
    }).format(new Date(e.year ?? 2000, e.month - 1, e.day));
  const nameOf = (id: string) => {
    const c = known.find((x) => x.id === id) ?? contacts.find((x) => x.id === id);
    return c ? fullName(c) : id;
  };
  const set = (i: number, c: Choice) => setChoices((list) => list.map((x, j) => (j === i ? c : x)));

  const commit = async () => {
    setBusy(true);
    try {
      const r = await commitIcs(
        events.map((event, i) => ({ event, target: choiceOf(choices[i]!, event.name) })),
      );
      showToast({
        message: t('ics.done', { birthdays: r.birthdays, dates: r.dates, created: r.created }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ics-title" className="px-4 py-5">
      <h2 id="ics-title" className="text-lg font-extrabold">
        {t('ics.title')}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">{t('ics.intro', { count: events.length })}</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {events.map((e, i) => {
          const choice = choices[i] ?? 'skip';
          return (
            <li key={i} data-testid="ics-row" className="flex flex-col gap-2 px-3 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{e.title || t('ics.untitled')}</p>
                {!e.skip && (
                  <p className="text-sm text-muted">
                    {t(`ics.kinds.${e.kind}`)} · {fmt(e)}
                  </p>
                )}
              </div>
              {e.skip ? (
                <p className="text-sm text-muted">{t(`ics.skip.${e.skip}`)}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={t('ics.action', { title: e.title })}
                    value={choice}
                    onChange={(ev) => set(i, ev.target.value as Choice)}
                    className={`${inputClass} w-auto py-1.5 text-sm`}
                  >
                    <option value="skip">{t('ics.choice.skip')}</option>
                    {e.name && (
                      <option value="create">{t('ics.choice.create', { name: e.name })}</option>
                    )}
                    {choice.startsWith('contact:') && (
                      <option value={choice}>
                        {t('ics.choice.add', { name: nameOf(choice.slice(8)) })}
                      </option>
                    )}
                  </select>
                  <PeoplePicker
                    contacts={contacts}
                    exclude={[]}
                    onPick={(c) => set(i, `contact:${c.id}`)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={busy || count === 0} onClick={() => void commit()}>
          {t('ics.import', { count })}
        </Button>
      </div>
    </section>
  );
}
