import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ImagePlus, MapPin, X } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { inputClass } from '@/components/form/fieldClass';
import {
  findOrCreateTag,
  momentRepo,
  saveContact,
  saveMoment,
  thumbId,
  useBlobUrl,
  type MomentPhotoDraft,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import {
  applyCompletion,
  bodyToDraft,
  displayFor,
  draftToBody,
  findTrigger,
  type DraftEntity,
  type Trigger,
} from '@/domain/momentText';
import { toDateTimeLocal } from '@/domain/relativeTime';
import { momentKinds } from '@/domain/schemas';
import type { Contact, Moment, MomentKind } from '@/domain/types';
import { prepareMomentPhoto } from '@/lib/image';
import { activityTypes, kindIcon, lifeEventTypes } from '@/features/moments/kindMeta';
import { useLookup } from '@/features/moments/useLookup';
import { PeoplePicker } from './PeoplePicker';
import { handleListKeys } from './listKeys';
import { SuggestionList } from './SuggestionList';
import { contactSuggestions, tagSuggestions } from './suggestions';

const MAX_PHOTOS = 4;
const MAX_CHARS = 5000; // soft limit (ui §6.5)

type PhotoItem =
  | { key: string; existingId: string }
  | { key: string; image: Awaited<ReturnType<typeof prepareMomentPhoto>>; url: string };

interface Extra {
  activityType?: Moment['activityType'];
  callDirection?: Moment['callDirection'];
  callDurationMin?: string;
  lifeEventType?: Moment['lifeEventType'];
  mood?: Moment['mood'];
  location: string;
}

interface Props {
  momentId?: string;
  prefill?: { contactIds?: string[]; text?: string };
  variant: 'inline' | 'modal';
  onDone?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function ExistingPhoto({ id }: { id: string }) {
  const url = useBlobUrl(thumbId(id));
  return url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null;
}

/** "What happened?" composer (ui §6.5): kinds, @mentions, #tags, photos, date, location, kind fields. */
export function Composer({ momentId, prefill, variant, onDone, onDirtyChange }: Props) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [loaded, setLoaded] = useState(!momentId);
  const [kind, setKind] = useState<MomentKind>('note');
  const [text, setText] = useState(prefill?.text ?? '');
  const [entities, setEntities] = useState<DraftEntity[]>([]);
  const [explicit, setExplicit] = useState<string[]>(prefill?.contactIds ?? []);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [happenedAt, setHappenedAt] = useState(() => toDateTimeLocal(new Date()));
  const [extra, setExtra] = useState<Extra>({ location: '' });
  const [showDate, setShowDate] = useState(false);
  /** Untouched → the moment is stamped with the exact save time, not the time the composer opened. */
  const [dateEdited, setDateEdited] = useState(false);
  const [originalHappenedAt, setOriginalHappenedAt] = useState<string>();
  const [showLocation, setShowLocation] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load an existing moment for editing.
  useEffect(() => {
    if (!momentId) return;
    void momentRepo.get(momentId).then((m) => {
      if (!m) return;
      const draft = bodyToDraft(m.body, {
        contact: (id) => {
          const c = lookup.contact(id);
          return c && fullName(c);
        },
        tag: (id) => lookup.tag(id)?.name,
      });
      const mentioned = new Set(
        draft.entities.filter((e) => e.kind === 'contact').map((e) => e.id),
      );
      setKind(m.kind);
      setText(draft.text);
      setEntities(draft.entities);
      setExplicit(m.contactIds.filter((id) => !mentioned.has(id)));
      setPhotos(m.photoBlobIds.map((id) => ({ key: id, existingId: id })));
      setHappenedAt(toDateTimeLocal(new Date(m.happenedAt)));
      setOriginalHappenedAt(m.happenedAt);
      setShowDate(true);
      setShowLocation(!!m.location);
      setExtra({
        activityType: m.activityType,
        callDirection: m.callDirection,
        callDurationMin: m.callDurationMin?.toString(),
        lifeEventType: m.lifeEventType,
        mood: m.mood,
        location: m.location ?? '',
      });
      setLoaded(true);
    });
    // Load once per moment; lookup names are read at load time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentId]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(
    () => () => photos.forEach((p) => 'url' in p && URL.revokeObjectURL(p.url)),
    // Revoke preview URLs on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Auto-grow the textarea, and place the caret after a completion synchronously with the new
  // text, so fast typing right after picking a suggestion lands in the right place.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight is 0 while hidden (e.g. before the dialog opens) — keep the CSS min-height then.
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
    if (pendingCaret.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  const touch = () => setDirty(true);
  const liveEntities = entities.filter((e) => text.includes(e.display));
  const mentionedIds = liveEntities.filter((e) => e.kind === 'contact').map((e) => e.id);
  const peopleIds = [...new Set([...mentionedIds, ...explicit])];
  const people = peopleIds.map((id) => lookup.contact(id)).filter((c): c is Contact => !!c);
  const canSave = loaded && !saving && (text.trim().length > 0 || peopleIds.length > 0);

  // ── Autocomplete ──
  const insert = (display: string, entity: DraftEntity) => {
    const el = textRef.current;
    if (!el || !trigger) return;
    const { text: next, caret } = applyCompletion(text, trigger, el.selectionStart, display);
    setText(next);
    setEntities((list) => [...list.filter((e) => e.display !== display), entity]);
    setTrigger(null);
    touch();
    pendingCaret.current = caret;
  };
  const pickContact = (c: Contact) => {
    const display = displayFor('contact', fullName(c));
    insert(display, { kind: 'contact', id: c.id, display });
  };
  const createContact = async (name: string) => {
    const [firstName, ...rest] = name.split(/\s+/);
    const c = await saveContact(undefined, {
      contact: { firstName: firstName!, lastName: rest.join(' ') || undefined },
      fields: [],
      addresses: [],
    });
    return c;
  };
  const suggestions = useMemo(() => {
    // Until contacts/tags have loaded, "Create …" would be the only option and Enter would create a duplicate.
    if (!trigger || !lookup.loaded) return [];
    return trigger.sigil === '@'
      ? contactSuggestions(
          lookup.contacts,
          trigger.query,
          t,
          pickContact,
          (name) => void createContact(name).then(pickContact),
        )
      : tagSuggestions(
          lookup.tags,
          trigger.query,
          t,
          (tag) => {
            const display = displayFor('tag', tag.name);
            insert(display, { kind: 'tag', id: tag.id, display });
          },
          (name) =>
            void findOrCreateTag(name).then((tag) => {
              const display = displayFor('tag', tag.name);
              insert(display, { kind: 'tag', id: tag.id, display });
            }),
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, lookup, text]);

  const updateTrigger = (value: string, caret: number) => {
    const next = findTrigger(value, caret);
    setTrigger(next);
    if (next?.query !== trigger?.query || next?.sigil !== trigger?.sigil) setActive(0);
  };

  // ── Photos ──
  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const image = await prepareMomentPhoto(file);
        const url = URL.createObjectURL(image.thumb.data);
        setPhotos((p) => [...p, { key: url, image, url }].slice(0, MAX_PHOTOS));
        touch();
      } catch {
        showToast({ message: t('composer.photoError') });
      }
    }
  };

  // ── Save ──
  const reset = () => {
    setText('');
    setEntities([]);
    setExplicit([]);
    setPhotos([]);
    setExtra({ location: '' });
    setHappenedAt(toDateTimeLocal(new Date()));
    setShowDate(false);
    setDateEdited(false);
    setShowLocation(false);
    setDirty(false);
  };

  const savingRef = useRef(false);
  const save = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const photoDrafts: MomentPhotoDraft[] = photos.map((p) =>
        'existingId' in p
          ? { existingId: p.existingId }
          : { image: p.image.image, thumb: p.image.thumb },
      );
      const duration = extra.callDurationMin ? Number(extra.callDurationMin) : undefined;
      await saveMoment(momentId, {
        kind,
        body: draftToBody(text.trim(), liveEntities),
        happenedAt: dateEdited
          ? new Date(happenedAt).toISOString()
          : (originalHappenedAt ?? new Date().toISOString()),
        contactIds: explicit,
        photos: photoDrafts,
        activityType: extra.activityType,
        callDirection: extra.callDirection,
        callDurationMin: duration !== undefined && Number.isFinite(duration) ? duration : undefined,
        lifeEventType: extra.lifeEventType,
        mood: extra.mood,
        location: extra.location,
      });
      showToast({ message: t('composer.saved') });
      if (variant === 'inline') reset();
      else setDirty(false);
      onDone?.();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Ctrl/⌘+Enter is handled once, on the composer container.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (trigger) {
      const handled = handleListKeys(e, suggestions, active, setActive, () => setTrigger(null));
      if (handled && e.key === 'Escape') e.stopPropagation(); // don't close the modal
    }
  };

  const select = (cls = '') => `${inputClass} py-1.5 text-sm ${cls}`;
  const setX = (patch: Partial<Extra>) => {
    setExtra((x) => ({ ...x, ...patch }));
    touch();
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          void save();
        }
      }}
    >
      {/* Kind chips */}
      <div role="radiogroup" aria-label={t('composer.kind')} className="flex flex-wrap gap-2">
        {momentKinds.map((k) => {
          const Icon = kindIcon({ kind: k });
          const selected = k === kind;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setKind(k);
                touch();
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${selected ? 'border-accent bg-accent-tint text-accent-text' : 'border-border text-muted hover:bg-surface-2'}`}
            >
              <Icon size={14} aria-hidden /> {t(`moment.kinds.${k}`)}
            </button>
          );
        })}
      </div>

      {/* Body with @/# autocomplete */}
      <div className="relative">
        <textarea
          ref={textRef}
          role="combobox"
          aria-label={t('composer.placeholder')}
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={suggestions.length ? `${listId}-${active}` : undefined}
          placeholder={t('composer.placeholder')}
          value={text}
          maxLength={MAX_CHARS}
          rows={variant === 'modal' ? 4 : 2}
          autoFocus={variant === 'modal'}
          onChange={(e) => {
            setText(e.target.value);
            updateTrigger(e.target.value, e.target.selectionStart);
            touch();
          }}
          onSelect={(e) => updateTrigger(e.currentTarget.value, e.currentTarget.selectionStart)}
          // Close suggestions shortly after blur (so a click on an option still lands), but only if focus
          // hasn't come back — a stale timer must not close a list opened by typing after refocusing.
          onBlur={(e) => {
            const el = e.currentTarget;
            setTimeout(() => document.activeElement !== el && setTrigger(null), 150);
          }}
          onKeyDown={onKeyDown}
          className="min-h-14 w-full resize-none bg-transparent text-xl placeholder:text-muted focus:outline-none"
        />
        <SuggestionList
          id={listId}
          label={t('composer.suggestions')}
          items={suggestions}
          active={active}
          onHover={setActive}
        />
      </div>

      {/* People */}
      <div
        aria-label={t('composer.people')}
        role="group"
        className="flex flex-wrap items-center gap-2"
      >
        {people.map((c) => {
          const removable = explicit.includes(c.id) && !mentionedIds.includes(c.id);
          return (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-1 pl-0.5 text-sm"
            >
              <Avatar contact={c} size={22} />
              {fullName(c)}
              {removable && (
                <button
                  type="button"
                  aria-label={t('composer.removePerson', { name: fullName(c) })}
                  onClick={() => {
                    setExplicit((ids) => ids.filter((id) => id !== c.id));
                    touch();
                  }}
                  className="rounded-full p-0.5 hover:bg-bg"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </span>
          );
        })}
        <PeoplePicker
          contacts={lookup.contacts}
          exclude={peopleIds}
          onPick={(c) => {
            setExplicit((ids) => [...ids, c.id]);
            touch();
          }}
          onCreate={async (name) => {
            const c = await createContact(name);
            setExplicit((ids) => [...ids, c.id]);
            touch();
          }}
        />
      </div>

      {/* Kind-specific fields */}
      {kind === 'activity' && (
        <select
          aria-label={t('composer.activityType')}
          value={extra.activityType ?? ''}
          onChange={(e) =>
            setX({ activityType: (e.target.value || undefined) as Extra['activityType'] })
          }
          className={select('w-48')}
        >
          <option value="">{t('composer.activityType')}</option>
          {activityTypes.map((a) => (
            <option key={a} value={a}>
              {t(`moment.activityTypes.${a}`)}
            </option>
          ))}
        </select>
      )}
      {kind === 'call' && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t('composer.callDirection')}
            value={extra.callDirection ?? ''}
            onChange={(e) =>
              setX({ callDirection: (e.target.value || undefined) as Extra['callDirection'] })
            }
            className={select('w-48')}
          >
            <option value="">{t('composer.callDirection')}</option>
            <option value="incoming">{t('moment.callDirections.incoming')}</option>
            <option value="outgoing">{t('moment.callDirections.outgoing')}</option>
          </select>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={t('composer.duration')}
            placeholder={t('composer.duration')}
            value={extra.callDurationMin ?? ''}
            onChange={(e) => setX({ callDurationMin: e.target.value })}
            className={select('w-40')}
          />
        </div>
      )}
      {kind === 'life-event' && (
        <select
          aria-label={t('composer.lifeEventType')}
          value={extra.lifeEventType ?? ''}
          onChange={(e) =>
            setX({ lifeEventType: (e.target.value || undefined) as Extra['lifeEventType'] })
          }
          className={select('w-56')}
        >
          <option value="">{t('composer.lifeEventType')}</option>
          {lifeEventTypes.map((l) => (
            <option key={l} value={l}>
              {t(`moment.lifeEventTypes.${l}`)}
            </option>
          ))}
        </select>
      )}
      {kind === 'journal' && (
        <div role="radiogroup" aria-label={t('composer.mood')} className="flex gap-1">
          {([1, 2, 3, 4, 5] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={extra.mood === m}
              onClick={() => setX({ mood: extra.mood === m ? undefined : m })}
              className={`rounded-full border px-3 py-1 text-sm ${extra.mood === m ? 'border-accent bg-accent-tint font-bold text-accent-text' : 'border-border text-muted hover:bg-surface-2'}`}
            >
              {t(`moment.moods.${m}`)}
            </button>
          ))}
        </div>
      )}

      {showDate && (
        <label className="flex items-center gap-2 text-sm">
          <CalendarClock size={16} className="text-muted" aria-hidden />
          <span className="sr-only">{t('composer.date')}</span>
          <input
            type="datetime-local"
            value={happenedAt}
            onChange={(e) => {
              if (e.target.value) setHappenedAt(e.target.value);
              setDateEdited(true);
              touch();
            }}
            className={select('w-60')}
          />
        </label>
      )}
      {showLocation && (
        <label className="flex items-center gap-2 text-sm">
          <MapPin size={16} className="text-muted" aria-hidden />
          <span className="sr-only">{t('composer.location')}</span>
          <input
            value={extra.location}
            placeholder={t('composer.locationPlaceholder')}
            onChange={(e) => setX({ location: e.target.value })}
            className={select('w-60')}
          />
        </label>
      )}

      {/* Photo previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div
              key={p.key}
              className="relative aspect-square overflow-hidden rounded-xl bg-surface-2"
            >
              {'existingId' in p ? (
                <ExistingPhoto id={p.existingId} />
              ) : (
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                aria-label={t('composer.removePhoto', { n: i + 1 })}
                onClick={() => {
                  setPhotos((list) => list.filter((x) => x.key !== p.key));
                  touch();
                }}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <div className="-ml-2 flex items-center text-accent-text">
          <IconButton
            label={photos.length >= MAX_PHOTOS ? t('composer.maxPhotos') : t('composer.addPhoto')}
            tone="accent"
            disabled={photos.length >= MAX_PHOTOS}
            onClick={() => fileRef.current?.click()}
            className="disabled:opacity-40"
          >
            <ImagePlus size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('composer.date')}
            tone="accent"
            aria-pressed={showDate}
            onClick={() => setShowDate((v) => !v)}
          >
            <CalendarClock size={20} aria-hidden />
          </IconButton>
          <IconButton
            label={t('composer.location')}
            tone="accent"
            aria-pressed={showLocation}
            onClick={() => setShowLocation((v) => !v)}
          >
            <MapPin size={20} aria-hidden />
          </IconButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label={t('composer.addPhoto')}
            onChange={(e) => {
              void addPhotos(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">{t('composer.shortcutHint')}</span>
          <Button onClick={() => void save()} disabled={!canSave}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
