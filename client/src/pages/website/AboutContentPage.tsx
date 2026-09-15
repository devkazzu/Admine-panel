/**
 * RJNX Website → About: biography, profile image, interests and skills.
 */
import { Save, ExternalLink } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import type { WebsiteAbout } from '../../lib/types';
import { Button, FormField, Input, PageHeader, Textarea } from '../../components/ui/primitives';
import { ImageInput, SkillsInput, TagInput } from '../../components/ui/inputs';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export function AboutContentPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('website_content:write');
  const { success, error: toastError } = useToast();
  const { data, refetch } = useApiQuery(() => api.get<WebsiteAbout>('/api/admin/website/about'), []);

  const [values, setValues] = useState<Partial<WebsiteAbout>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.put('/api/admin/website/about', {
        biography: values.biography ?? '',
        profile_image: values.profile_image ?? '',
        interests: values.interests ?? [],
        skills: values.skills ?? [],
      });
      success('About section saved');
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
        title="About"
        description="Biography, profile image, interests and skills shown on the personal website."
        actions={
          <a href="/api/public/website/about" target="_blank" rel="noreferrer" className="inline-flex">
            <Button variant="outline" size="sm" type="button">
              <ExternalLink size={13} /> Public JSON
            </Button>
          </a>
        }
      />
      <form onSubmit={submit} className="rj-card mx-auto max-w-3xl space-y-5 p-6">
        <FormField label="Biography" error={errors.biography}>
          <Textarea rows={7} value={values.biography ?? ''} onChange={(e) => setValues((p) => ({ ...p, biography: e.target.value }))} disabled={!canWrite} placeholder="Tell the RJNX story…" />
        </FormField>
        <ImageInput label="Profile image" value={values.profile_image ?? ''} onChange={(v) => setValues((p) => ({ ...p, profile_image: v }))} error={errors.profile_image} circular />
        <FormField label="Interests" error={errors.interests} help="Shown as chips on the public site.">
          <TagInput value={values.interests ?? []} onChange={(v) => setValues((p) => ({ ...p, interests: v }))} placeholder="e.g. Gaming" />
        </FormField>
        <FormField label="Skills" error={errors.skills} help="Name + level (0–100) — rendered as progress bars.">
          <SkillsInput value={values.skills ?? []} onChange={(v) => setValues((p) => ({ ...p, skills: v }))} />
        </FormField>
        {canWrite && (
          <div className="flex justify-end border-t border-white/5 pt-4">
            <Button type="submit" variant="primary" loading={saving}>
              <Save size={14} /> Save about section
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
