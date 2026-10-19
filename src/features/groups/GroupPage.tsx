import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Ellipsis, Pencil, Trash2, UserMinus } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { IconButton } from '@/components/IconButton';
import { Menu } from '@/components/Menu';
import { PageHeader } from '@/components/PageHeader';
import { Tabs } from '@/components/Tabs';
import {
  addToGroup,
  deleteGroup,
  groupMembers,
  groupRepo,
  groupTimeline,
  removeFromGroup,
  restoreGroup,
  saveContact,
  useLiveQuery,
  useLiveRecord,
} from '@/db/repositories';
import { avatarPalette, fullName } from '@/domain/contact';
import { ContactRow } from '@/features/contacts/ContactRow';
import { PeoplePicker } from '@/features/compose/PeoplePicker';
import { Feed } from '@/features/moments/Feed';
import { useLookup } from '@/features/moments/useLookup';
import { GroupDialog } from './GroupDialog';

/** `/groups/:id`: banner, members (add/remove) and group timeline (SPEC §6.7, §8.8). */
export function GroupPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const group = useLiveRecord(groupRepo, id);
  const members = useLiveQuery(() => (id ? groupMembers(id) : []), [id]);
  const moments = useLiveQuery(() => (id ? groupTimeline(id) : []), [id]);
  const [tab, setTab] = useState<'timeline' | 'members'>('timeline');
  const [editing, setEditing] = useState(false);

  if (group === undefined) return null;
  if (group === null) {
    return (
      <>
        <PageHeader title={t('pages.group')} back />
        <p className="px-8 py-12 text-center text-muted">{t('groups.notFound')}</p>
      </>
    );
  }

  const remove = async () => {
    await deleteGroup(group.id);
    navigate('/groups', { replace: true });
    showToast({
      message: t('groups.deleted'),
      action: { label: t('common.undo'), onClick: () => void restoreGroup(group.id) },
    });
  };

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={members ? t('groups.members', { count: members.length }) : undefined}
        back
        actions={
          <Menu
            label={t('common.more')}
            triggerClassName="rounded-full p-2 hover:bg-surface-2"
            trigger={<Ellipsis size={20} aria-hidden />}
            items={[
              { label: t('groups.edit'), icon: Pencil, onSelect: () => setEditing(true) },
              {
                label: t('groups.delete'),
                icon: Trash2,
                danger: true,
                onSelect: () => void remove(),
              },
            ]}
          />
        }
      />
      <div
        className="flex aspect-[3/1] items-center justify-center text-6xl"
        style={{ backgroundColor: group.bannerColor ?? avatarPalette[0] }}
        aria-hidden
      >
        {group.emoji ?? '👥'}
      </div>
      <div className="px-4 py-3">
        <h2 className="text-xl font-extrabold">{group.name}</h2>
        {group.description && <p className="mt-1 whitespace-pre-line">{group.description}</p>}
        <p className="mt-1 text-sm text-muted">
          {t('groups.members', { count: members?.length ?? 0 })}
        </p>
      </div>
      <Tabs
        label={group.name}
        items={(['timeline', 'members'] as const).map((x) => ({
          id: x,
          label: t(`groups.tabs.${x}`),
        }))}
        active={tab}
        onChange={(x) => setTab(x as 'timeline' | 'members')}
        className="sticky top-[106px] z-10 border-b border-border bg-bg/80 backdrop-blur-md md:top-[53px]"
      />
      {tab === 'timeline' ? (
        moments && moments.length === 0 ? (
          <p className="px-8 py-12 text-center text-muted">{t('groups.emptyTimeline')}</p>
        ) : (
          <Feed moments={moments ?? []} />
        )
      ) : (
        <div>
          <div className="border-b border-border px-4 py-3">
            <PeoplePicker
              contacts={lookup.contacts}
              exclude={(members ?? []).map((m) => m.id)}
              onPick={(c) => void addToGroup(c.id, group.id)}
              onCreate={async (name) => {
                const [firstName, ...rest] = name.split(/\s+/);
                const c = await saveContact(undefined, {
                  contact: { firstName: firstName!, lastName: rest.join(' ') || undefined },
                  fields: [],
                  addresses: [],
                });
                await addToGroup(c.id, group.id);
              }}
            />
          </div>
          {members && members.length === 0 && (
            <p className="px-8 py-12 text-center text-muted">{t('groups.emptyMembers')}</p>
          )}
          <ul>
            {[...(members ?? [])]
              .sort((a, b) => fullName(a).localeCompare(fullName(b)))
              .map((m) => (
                <li key={m.id} className="border-b border-border">
                  <ContactRow
                    contact={m}
                    actions={
                      <IconButton
                        label={t('groups.removeMember', { name: fullName(m) })}
                        onClick={() => void removeFromGroup(m.id, group.id)}
                      >
                        <UserMinus size={18} aria-hidden />
                      </IconButton>
                    }
                  />
                </li>
              ))}
          </ul>
        </div>
      )}
      <GroupDialog open={editing} group={group} onClose={() => setEditing(false)} />
    </>
  );
}
