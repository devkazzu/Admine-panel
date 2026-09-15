/**
 * RJNX Website → Social Links: which platforms appear on the public site.
 * Only active links with a URL are exposed publicly.
 */
import { Share2 } from 'lucide-react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { Badge, Switch } from '../../components/ui/primitives';
import { PLATFORMS } from '../../lib/constants';
import type { SocialLink } from '../../lib/types';

const fields: FieldDef[] = [
  {
    name: 'platform',
    label: 'Platform',
    type: 'select',
    required: true,
    options: PLATFORMS.map((p) => ({ value: p.value, label: p.label })),
  },
  { name: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://…' },
  { name: 'label', label: 'Custom label', type: 'text', placeholder: 'optional display label' },
  { name: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
  { name: 'is_active', label: 'Active (visible publicly)', type: 'switch', defaultValue: true },
];

export function SocialLinksPage() {
  return (
    <CrudPage
      title="Social Links"
      description="One link per platform. Inactive or empty links never appear on the public website."
      endpoint="/api/admin/website/socials"
      resource="socials"
      createLabel="Add link"
      searchPlaceholder="Search links…"
      fields={fields}
      defaults={{ platform: 'youtube', is_active: true, sort_order: 0 }}
      filters={[
        {
          name: 'platform',
          options: PLATFORMS.map((p) => ({ value: p.value, label: p.label })),
        },
      ]}
      emptyIcon={Share2}
      emptyTitle="No social links"
      emptyDescription="Add the platforms you want shown in the website footer and social sections."
      columns={[
        {
          key: 'platform',
          label: 'Platform',
          render: (row: SocialLink) => (
            <span className="font-medium capitalize text-zinc-100">{PLATFORMS.find((p) => p.value === row.platform)?.label ?? row.platform}</span>
          ),
        },
        {
          key: 'url',
          label: 'URL',
          render: (row: SocialLink) => (
            <a href={row.url} target="_blank" rel="noreferrer" className="block max-w-xs truncate text-sm text-violet-400 hover:text-violet-300">
              {row.url}
            </a>
          ),
        },
        { key: 'label', label: 'Label', render: (row: SocialLink) => row.label || <span className="text-zinc-700">—</span> },
        { key: 'sort_order', label: 'Order' },
        {
          key: 'is_active',
          label: 'Active',
          render: (row: SocialLink) => <Badge tone={row.is_active ? 'emerald' : 'zinc'}>{row.is_active ? 'Active' : 'Hidden'}</Badge>,
        },
      ]}
    />
  );
}
