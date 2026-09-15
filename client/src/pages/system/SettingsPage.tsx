/**
 * System → Site Settings: General / SEO / Contact tabs.
 * Real contact information is never invented — fields start empty.
 */
import { Globe, Save, Search, Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import type { Settings } from '../../lib/types';
import { Button, FormField, Input, PageHeader, Textarea } from '../../components/ui/primitives';
import { ImageInput } from '../../components/ui/inputs';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

type Tab = 'general' | 'seo' | 'contact';

const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'contact', label: 'Contact', icon: Mail },
];

export function SettingsPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('settings:write');
  const { success, error: toastError } = useToast();
  const { data, refetch } = useApiQuery(() => api.get<Settings>('/api/admin/settings'), []);

  const [tab, setTab] = useState<Tab>('general');
  const [values, setValues] = useState<Settings>({ general: { site_name: '', site_description: '', site_logo: '', site_favicon: '' }, seo: { seo_title: '', seo_description: '', seo_og_image: '' }, contact: { contact_email: '', contact_discord: '', contact_other: '' } });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const set = (group: Tab, key: string, value: string) =>
    setValues((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put(`/api/admin/settings/${tab}`, values[tab]);
      success('Settings saved');
      refetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.fieldErrors());
        toastError('Please fix the highlighted fields');
      } else {
        toastError(err instanceof ApiError ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Site Settings" description="Centralized settings shared across the RJNX websites." />

      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-900/60 p-1 ring-1 ring-white/5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-violet-500/20 text-violet-200 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.3)]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="rj-card mx-auto max-w-2xl space-y-5 p-6">
        {tab === 'general' && (
          <>
            <FormField label="Site name" error={errors.site_name} required>
              <Input value={values.general.site_name} onChange={(e) => set('general', 'site_name', e.target.value)} placeholder="RJNX" disabled={!canWrite} />
            </FormField>
            <FormField label="Site description" error={errors.site_description} help="Short description used around the sites.">
              <Textarea rows={3} value={values.general.site_description} onChange={(e) => set('general', 'site_description', e.target.value)} disabled={!canWrite} />
            </FormField>
            <ImageInput label="Logo" value={values.general.site_logo} onChange={(v) => set('general', 'site_logo', v)} error={errors.site_logo} />
            <ImageInput label="Favicon" value={values.general.site_favicon} onChange={(v) => set('general', 'site_favicon', v)} error={errors.site_favicon} />
          </>
        )}

        {tab === 'seo' && (
          <>
            <FormField label="Default title" error={errors.seo_title} required>
              <Input value={values.seo.seo_title} onChange={(e) => set('seo', 'seo_title', e.target.value)} disabled={!canWrite} />
            </FormField>
            <FormField label="Meta description" error={errors.seo_description}>
              <Textarea rows={3} value={values.seo.seo_description} onChange={(e) => set('seo', 'seo_description', e.target.value)} disabled={!canWrite} />
            </FormField>
            <ImageInput label="OG image" value={values.seo.seo_og_image} onChange={(v) => set('seo', 'seo_og_image', v)} error={errors.seo_og_image} help="Default social-sharing preview image." />
          </>
        )}

        {tab === 'contact' && (
          <>
            <FormField label="Contact email" error={errors.contact_email} help="Shown by the public sites' contact sections.">
              <Input type="email" value={values.contact.contact_email} onChange={(e) => set('contact', 'contact_email', e.target.value)} placeholder="you@example.com" disabled={!canWrite} />
            </FormField>
            <FormField label="Discord" error={errors.contact_discord} help="Invite link or username, e.g. https://discord.gg/…">
              <Input value={values.contact.contact_discord} onChange={(e) => set('contact', 'contact_discord', e.target.value)} disabled={!canWrite} />
            </FormField>
            <FormField label="Other contact information" error={errors.contact_other}>
              <Textarea rows={3} value={values.contact.contact_other} onChange={(e) => set('contact', 'contact_other', e.target.value)} disabled={!canWrite} />
            </FormField>
          </>
        )}

        {canWrite && (
          <div className="flex justify-end border-t border-white/5 pt-4">
            <Button type="submit" variant="primary" loading={saving}>
              <Save size={14} /> Save settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
