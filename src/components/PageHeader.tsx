import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Tabs, type TabItem } from './Tabs';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  actions?: ReactNode;
}

/** Sticky translucent header with blur and optional tabs (ui §6.1). */
export function PageHeader({
  title,
  subtitle,
  back,
  tabs,
  activeTab,
  onTabChange,
  actions,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <header className="sticky top-[53px] z-10 border-b border-border bg-bg/80 backdrop-blur-md md:top-0">
      <div className="flex min-h-[53px] items-center gap-6 px-4">
        {back && (
          <button
            type="button"
            aria-label={t('nav.back')}
            onClick={() => navigate(-1)}
            className="-ml-2 rounded-full p-2 hover:bg-surface-2"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {tabs && <Tabs label={title} items={tabs} active={activeTab} onChange={onTabChange} />}
    </header>
  );
}
