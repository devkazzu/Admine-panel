/**
 * RJNX Website → YouTube: channel settings + featured videos CRUD.
 * No statistics are invented — only what the admin configures is shown.
 */
import { ExternalLink, Plus, Save, Youtube } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import type { YoutubeChannel } from '../../lib/types';
import { Button, FormField, Input, PageHeader, Textarea } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';

const videoFields: FieldDef[] = [
  { name: 'title', label: 'Video title', type: 'text', required: true },
  { name: 'url', label: 'Video URL or ID', type: 'text', required: true, placeholder: 'https://www.youtube.com/watch?v=… or 11-char ID' },
  { name: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
];

function ChannelForm() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('website_content:write');
  const { success, error: toastError } = useToast();
  const { data, refetch } = useApiQuery(() => api.get<YoutubeChannel>('/api/admin/website/youtube'), []);
  const [values, setValues] = useState<Partial<YoutubeChannel>>({});
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
      await api.put('/api/admin/website/youtube', {
        channel_url: values.channel_url ?? '',
        channel_description: values.channel_description ?? '',
      });
      success('YouTube settings saved');
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
    <form onSubmit={submit} className="rj-card mb-8 space-y-5 p-6">
      <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-zinc-400">Channel</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Channel URL" error={errors.channel_url} required>
          <Input
            value={values.channel_url ?? ''}
            onChange={(e) => setValues((p) => ({ ...p, channel_url: e.target.value }))}
            placeholder="https://www.youtube.com/@…"
            invalid={!!errors.channel_url}
            disabled={!canWrite}
          />
        </FormField>
        <div className="flex items-end">
          {values.channel_url ? (
            <a href={values.channel_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300">
              <ExternalLink size={13} /> Open channel
            </a>
          ) : null}
        </div>
      </div>
      <FormField label="Channel description" error={errors.channel_description}>
        <Textarea
          rows={3}
          value={values.channel_description ?? ''}
          onChange={(e) => setValues((p) => ({ ...p, channel_description: e.target.value }))}
          disabled={!canWrite}
        />
      </FormField>
      {canWrite && (
        <div className="flex justify-end border-t border-white/5 pt-4">
          <Button type="submit" variant="primary" loading={saving}>
            <Save size={14} /> Save channel
          </Button>
        </div>
      )}
    </form>
  );
}

export function YouTubePage() {
  return (
    <div>
      <PageHeader
        title="YouTube"
        description="Channel link, description and featured videos for the personal website."
        actions={
          <a href="/api/public/website/youtube" target="_blank" rel="noreferrer" className="inline-flex">
            <Button variant="outline" size="sm" type="button">
              <ExternalLink size={13} /> Public JSON
            </Button>
          </a>
        }
      />
      <ChannelForm />
      <CrudPage
        title="Featured videos"
        description="Order in which videos appear on the site."
        endpoint="/api/admin/website/youtube/videos"
        resource="videos"
        createLabel="Add video"
        searchPlaceholder="Search videos…"
        fields={videoFields}
        defaults={{ sort_order: 0 }}
        emptyIcon={Youtube}
        emptyTitle="No featured videos"
        columns={[
          {
            key: 'title',
            label: 'Video',
            render: (row) => (
              <div>
                <p className="font-medium text-zinc-100">{row.title}</p>
                <p className="truncate text-xs text-zinc-600">{row.url}</p>
              </div>
            ),
          },
          { key: 'sort_order', label: 'Order' },
          {
            key: 'open',
            label: '',
            render: (row) => (
              <a
                href={/^https?:/.test(row.url) ? row.url : `https://www.youtube.com/watch?v=${row.url}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Open ↗
              </a>
            ),
          },
        ]}
      />
    </div>
  );
}
