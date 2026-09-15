/**
 * RJNX Website → Home: hero title, subtitle, description, hero image and CTA
 * buttons. Single-record form — changes go live on the public site instantly.
 */
import { Save, ExternalLink } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import type { WebsiteHome } from '../../lib/types';
import { Button, FormField, Input, PageHeader, Textarea } from '../../components/ui/primitives';
import { ImageInput } from '../../components/ui/inputs';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export function HomeContentPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('website_content:write');
  const { success, error: toastError } = useToast();
  const { data, loading, error, refetch } = useApiQuery(() => api.get<WebsiteHome>('/api/admin/website/home'), []);

  const [values, setValues] = useState<Partial<WebsiteHome>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const set = (key: keyof WebsiteHome, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put('/api/admin/website/home', {
        hero_title: values.hero_title ?? '',
        hero_subtitle: values.hero_subtitle ?? '',
        description: values.description ?? '',
        hero_image: values.hero_image ?? '',
        cta_primary_label: values.cta_primary_label ?? '',
        cta_primary_url: values.cta_primary_url ?? '',
        cta_secondary_label: values.cta_secondary_label ?? '',
        cta_secondary_url: values.cta_secondary_url ?? '',
      });
      success('Home section saved — live on the public site');
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
      <PageHeader
        title="Home"
        description="Hero section of the RJNX personal website — updates are reflected on the public site immediately."
        actions={
          <a href="/api/public/website/home" target="_blank" rel="noreferrer" className="inline-flex">
            <Button variant="outline" size="sm" type="button">
              <ExternalLink size={13} /> Public JSON
            </Button>
          </a>
        }
      />
      <form onSubmit={submit} className="rj-card mx-auto max-w-3xl space-y-5 p-6">
        {error && <p className="text-sm text-rose-400">{error.message}</p>}
        {loading && !data && <p className="text-sm text-zinc-500">Loading…</p>}

        <FormField label="Hero title" error={errors.hero_title} required>
          <Input value={values.hero_title ?? ''} onChange={(e) => set('hero_title', e.target.value)} invalid={!!errors.hero_title} placeholder="RJNX" disabled={!canWrite} />
        </FormField>
        <FormField label="Hero subtitle" error={errors.hero_subtitle}>
          <Input value={values.hero_subtitle ?? ''} onChange={(e) => set('hero_subtitle', e.target.value)} invalid={!!errors.hero_subtitle} placeholder="Gaming • Creativity • Technology" disabled={!canWrite} />
        </FormField>
        <FormField label="Description" error={errors.description}>
          <Textarea rows={4} value={values.description ?? ''} onChange={(e) => set('description', e.target.value)} invalid={!!errors.description} disabled={!canWrite} />
        </FormField>
        <ImageInput label="Hero image" value={values.hero_image ?? ''} onChange={(v) => set('hero_image', v)} error={errors.hero_image} help="Wide image recommended (≥1600×900). Automatically optimized on upload." />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Primary CTA label" error={errors.cta_primary_label}>
            <Input value={values.cta_primary_label ?? ''} onChange={(e) => set('cta_primary_label', e.target.value)} placeholder="Watch on YouTube" disabled={!canWrite} />
          </FormField>
          <FormField label="Primary CTA URL" error={errors.cta_primary_url}>
            <Input value={values.cta_primary_url ?? ''} onChange={(e) => set('cta_primary_url', e.target.value)} placeholder="https://…" invalid={!!errors.cta_primary_url} disabled={!canWrite} />
          </FormField>
          <FormField label="Secondary CTA label" error={errors.cta_secondary_label}>
            <Input value={values.cta_secondary_label ?? ''} onChange={(e) => set('cta_secondary_label', e.target.value)} placeholder="View Projects" disabled={!canWrite} />
          </FormField>
          <FormField label="Secondary CTA URL" error={errors.cta_secondary_url}>
            <Input value={values.cta_secondary_url ?? ''} onChange={(e) => set('cta_secondary_url', e.target.value)} placeholder="https://… or #section" invalid={!!errors.cta_secondary_url} disabled={!canWrite} />
          </FormField>
        </div>

        {canWrite && (
          <div className="flex justify-end border-t border-white/5 pt-4">
            <Button type="submit" variant="primary" loading={saving}>
              <Save size={14} /> Save home section
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
