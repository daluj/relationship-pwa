import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { PartialDateField } from '@/components/form/PartialDateField';
import { SelectField } from '@/components/form/SelectField';
import { TextField } from '@/components/form/TextField';
import {
  contactDetails,
  contactRepo,
  knownContacts,
  mergeContacts,
  saveContact,
  useBlobUrl,
  useLiveList,
} from '@/db/repositories';
import { avatarPalette, fullName } from '@/domain/contact';
import { candidateOf, findDuplicates, type KnownContact } from '@/domain/duplicates';
import { contactFieldTypes } from '@/domain/schemas';
import type { Contact } from '@/domain/types';
import {
  contactFormSchema,
  emptyContactForm,
  toDraft,
  toFormValues,
  type ContactFormValues,
} from './contactFormModel';
import { ImagePicker, type ImageChange } from './ImagePicker';

const stayInTouchOptions = ['', '7', '14', '30', '90', '180', '365'] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-5">
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Create (`/contacts/new`) and edit (`/c/:id/edit`) contact form (features §8.2). */
export function ContactFormPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToasts((s) => s.show);
  const [existing, setExisting] = useState<Contact | null | undefined>(id ? undefined : null);
  const [avatar, setAvatar] = useState<ImageChange>();
  const [banner, setBanner] = useState<ImageChange>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const allContacts = useLiveList(contactRepo);
  const avatarUrl = useBlobUrl(existing?.avatarBlobId);
  const bannerUrl = useBlobUrl(existing?.bannerBlobId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: emptyContactForm,
  });
  const fields = useFieldArray({ control, name: 'fields' });
  const addresses = useFieldArray({ control, name: 'addresses' });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const c = await contactRepo.get(id);
      if (cancelled) return;
      setExisting(c ?? null);
      if (c)
        reset(toFormValues(c, await contactDetails.fields(id), await contactDetails.addresses(id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reset]);

  // Possible duplicates while creating (features §8.2): same normalized name, email or phone.
  const [known, setKnown] = useState<KnownContact[]>([]);
  useEffect(() => {
    if (!id) void knownContacts().then(setKnown);
  }, [id]);
  const [wFirst, wLast, wFields] = watch(['firstName', 'lastName', 'fields']);
  const watchedKey = JSON.stringify([wFirst, wLast, wFields]);
  const duplicate = useMemo(() => {
    if (id || !known.length || !wFirst?.trim()) return undefined;
    const fieldsWithValues = (wFields ?? []).filter((f) => f.value.trim());
    return findDuplicates(
      candidateOf(fullName({ firstName: wFirst, lastName: wLast }), fieldsWithValues),
      known,
    )[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, known, watchedKey]);

  /** "Save and merge": create the contact, then merge it into the existing one. */
  const saveAndMerge = (targetId: string) =>
    handleSubmit(async (values) => {
      const saved = await saveContact(undefined, { ...toDraft(values), avatar, banner });
      await mergeContacts(targetId, saved.id);
      showToast({ message: t('merge.done') });
      navigate(`/c/${targetId}`, { replace: true });
    })();

  const dirty = isDirty || avatar !== undefined || banner !== undefined;
  const leave = () => navigate(id ? `/c/${id}` : '/contacts', { replace: true });
  const cancel = () => (dirty ? setConfirmDiscard(true) : leave());

  const onSubmit = handleSubmit(async (values) => {
    const saved = await saveContact(id, { ...toDraft(values), avatar, banner });
    showToast({ message: t('form.saved') });
    navigate(`/c/${saved.id}`, { replace: true });
  });

  const err = (msg?: string) => (msg ? t(`form.${msg}` as 'form.required') : undefined);

  if (id && existing === undefined) return null; // loading (local, instant)
  if (id && existing === null) {
    return (
      <>
        <PageHeader title={t('pages.editContact')} back />
        <p className="px-4 py-8 text-center text-muted">{t('profile.notFound')}</p>
      </>
    );
  }

  const introducerOptions = [
    { value: '', label: t('common.none') },
    ...(allContacts ?? [])
      .filter((c) => c.id !== id)
      .map((c) => ({ value: c.id, label: fullName(c) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  return (
    <>
      <PageHeader
        title={id ? t('pages.editContact') : t('pages.newContact')}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancel}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" type="submit" form="contact-form" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        }
      />
      <form id="contact-form" onSubmit={onSubmit} noValidate>
        <Section title={t('form.sections.basics')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('form.firstName')}
              autoComplete="off"
              autoFocus={!id}
              required
              {...register('firstName')}
              error={err(errors.firstName?.message)}
            />
            <TextField label={t('form.lastName')} autoComplete="off" {...register('lastName')} />
          </div>
          {duplicate && (
            <div
              role="status"
              data-testid="duplicate-warning"
              className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger/5 p-3"
            >
              <AlertTriangle size={18} className="text-danger" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{t('merge.duplicateTitle')}</p>
                <p className="text-sm text-muted">
                  {t('merge.duplicateBody', {
                    name: fullName(duplicate.contact),
                    reason: t(`importPreview.reasons.${duplicate.reason}`),
                  })}
                </p>
              </div>
              <Link
                to={`/c/${duplicate.contact.id}`}
                className="text-sm font-bold text-accent-text hover:underline"
              >
                {t('merge.open')}
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void saveAndMerge(duplicate.contact.id)}
              >
                {t('merge.mergeIntoIt')}
              </Button>
            </div>
          )}
          <TextField
            label={t('form.nickname')}
            hint={t('form.nicknameHint')}
            autoComplete="off"
            {...register('nickname')}
          />
          <TextField label={t('form.bio')} multiline {...register('bio')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('form.gender')} {...register('gender')} />
            <TextField label={t('form.pronouns')} {...register('pronouns')} />
          </div>
        </Section>

        <Section title={t('form.sections.images')}>
          <ImagePicker
            label={t('form.avatar')}
            aspect={1}
            outputWidth={400}
            currentUrl={avatarUrl}
            value={avatar}
            onChange={setAvatar}
          />
          <ImagePicker
            label={t('form.banner')}
            aspect={3}
            outputWidth={1500}
            currentUrl={bannerUrl}
            value={banner}
            onChange={setBanner}
          />
          <fieldset>
            <legend className="mb-1 text-sm font-bold text-muted">{t('form.bannerColor')}</legend>
            <div className="flex flex-wrap gap-2">
              {['', ...avatarPalette].map((color) => (
                <label key={color || 'auto'} className="cursor-pointer">
                  <input
                    type="radio"
                    value={color}
                    {...register('bannerColor')}
                    className="peer sr-only"
                  />
                  <span
                    className="block h-9 w-9 rounded-full border-2 border-transparent bg-surface-2 peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
                    style={color ? { backgroundColor: color } : undefined}
                    title={color || t('common.none')}
                  />
                  <span className="sr-only">{color || t('common.none')}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section title={t('form.sections.birthday')}>
          <PartialDateField
            legend={t('form.sections.birthday')}
            day={register('birthday.day')}
            month={register('birthday.month')}
            year={register('birthday.year')}
            error={err(errors.birthday?.message)}
          />
        </Section>

        <Section title={t('form.sections.contact')}>
          {fields.fields.map((row, i) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                <SelectField
                  label={t('form.fieldType')}
                  options={contactFieldTypes.map((v) => ({
                    value: v,
                    label: t(`form.fieldTypes.${v}`),
                  }))}
                  {...register(`fields.${i}.type`)}
                />
                <TextField
                  label={t('form.fieldValue')}
                  {...register(`fields.${i}.value`)}
                  error={err(errors.fields?.[i]?.value?.message)}
                />
                <TextField label={t('form.fieldLabel')} {...register(`fields.${i}.label`)} />
                <label className="flex items-center gap-2 self-end pb-3">
                  <input
                    type="checkbox"
                    {...register(`fields.${i}.isPrimary`)}
                    className="accent-[var(--accent)]"
                  />
                  {t('form.primary')}
                </label>
              </div>
              <IconButton
                label={t('form.remove', { item: t('form.fieldValue') })}
                onClick={() => fields.remove(i)}
              >
                <X size={18} aria-hidden />
              </IconButton>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => fields.append({ type: 'phone', label: '', value: '', isPrimary: false })}
          >
            <Plus size={16} aria-hidden /> {t('form.addField')}
          </Button>
        </Section>

        <Section title={t('form.sections.addresses')}>
          {addresses.fields.map((row, i) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border p-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <TextField label={t('form.addressLabel')} {...register(`addresses.${i}.label`)} />
                <TextField label={t('form.street')} {...register(`addresses.${i}.street`)} />
                <TextField label={t('form.city')} {...register(`addresses.${i}.city`)} />
                <TextField label={t('form.region')} {...register(`addresses.${i}.region`)} />
                <TextField
                  label={t('form.postalCode')}
                  {...register(`addresses.${i}.postalCode`)}
                />
                <TextField label={t('form.country')} {...register(`addresses.${i}.country`)} />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register(`addresses.${i}.isCurrent`)}
                    className="accent-[var(--accent)]"
                  />
                  {t('form.currentAddress')}
                </label>
              </div>
              <IconButton
                label={t('form.remove', { item: t('form.addressLabel') })}
                onClick={() => addresses.remove(i)}
              >
                <X size={18} aria-hidden />
              </IconButton>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              addresses.append({
                label: '',
                street: '',
                city: '',
                region: '',
                postalCode: '',
                country: '',
                isCurrent: addresses.fields.length === 0,
              })
            }
          >
            <Plus size={16} aria-hidden /> {t('form.addAddress')}
          </Button>
        </Section>

        <Section title={t('form.sections.howWeMet')}>
          <TextField label={t('form.howWeMetText')} multiline {...register('howWeMet.text')} />
          <TextField label={t('form.howWeMetPlace')} {...register('howWeMet.place')} />
          <PartialDateField
            legend={t('form.howWeMetDate')}
            day={register('howWeMet.date.day')}
            month={register('howWeMet.date.month')}
            year={register('howWeMet.date.year')}
            error={err(errors.howWeMet?.date?.message)}
          />
          <SelectField
            label={t('form.introducedBy')}
            options={introducerOptions}
            {...register('howWeMet.introducedById')}
          />
        </Section>

        <Section title={t('form.sections.work')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('form.jobTitle')} {...register('jobTitle')} />
            <TextField label={t('form.company')} {...register('company')} />
          </div>
        </Section>

        <Section title={t('form.sections.more')}>
          <TextField label={t('form.foodPreferences')} multiline {...register('foodPreferences')} />
          <SelectField
            label={t('form.stayInTouch')}
            options={stayInTouchOptions.map((v) => ({
              value: v,
              label: t(`form.stayInTouchOptions.${v || 'none'}` as 'form.stayInTouchOptions.none'),
            }))}
            {...register('stayInTouchDays')}
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('isDeceased')} className="accent-[var(--accent)]" />
            {t('form.deceased')}
          </label>
          <PartialDateField
            legend={t('form.deceasedDate')}
            day={register('deceasedDate.day')}
            month={register('deceasedDate.month')}
            year={register('deceasedDate.year')}
            error={err(errors.deceasedDate?.message)}
          />
        </Section>

        <div className="flex justify-end gap-2 px-4 py-5">
          <Button variant="outline" onClick={cancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {t('common.save')}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDiscard}
        title={t('common.unsavedChanges')}
        confirmLabel={t('common.discard')}
        danger
        onConfirm={leave}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
