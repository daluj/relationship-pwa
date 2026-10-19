import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { TextField } from '@/components/form/TextField';
import { saveGroup } from '@/db/repositories';
import { avatarPalette } from '@/domain/contact';
import type { Group } from '@/domain/types';

/** Create/edit a group: name, description, emoji, banner color (SPEC §5.1 Group). */
export function GroupDialog({
  open,
  group,
  onClose,
  onSaved,
}: {
  open: boolean;
  group?: Group;
  onClose: () => void;
  onSaved?: (g: Group) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setEmoji(group?.emoji ?? '');
    setColor(group?.bannerColor ?? avatarPalette[0]);
  }, [open, group]);

  const save = async () => {
    if (!name.trim()) return;
    const saved = await saveGroup(group?.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || undefined,
      bannerColor: color || undefined,
    });
    onSaved?.(saved);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={group ? t('groups.edit') : t('groups.new')}
      footer={
        <Button onClick={() => void save()} disabled={!name.trim()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <TextField
            label={t('groups.emoji')}
            value={emoji}
            maxLength={8}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <TextField
            label={t('groups.name')}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <TextField
          label={t('groups.description')}
          multiline
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div role="radiogroup" aria-label={t('groups.color')} className="flex flex-wrap gap-2">
          {avatarPalette.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border-2 ${color === c ? 'border-accent' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
}
