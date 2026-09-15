/**
 * News article editor — Markdown content with live preview, SEO fields,
 * slug management and publish control.
 */
import { ArrowLeft, Eye, Save, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api, ApiError } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import { fromLocalInput, slugify, toLocalInput } from '../../lib/format';
import { NEWS_STATUS } from '../../lib/constants';
import type { NewsArticle } from '../../lib/types';
import { Badge, Button, FormField, Input, PageHeader, Select, Spinner, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { ImageInput } from '../../components/ui/inputs';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export function NewsEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const { data: existing, loading, error } = useApiQuery(
    () => (isNew ? Promise.resolve(null) : api.get<NewsArticle>(`/api/admin/esports/news/${id}`)),
    [id],
  );

  const [values, setValues] = useState<Partial<NewsArticle>>({ status: 'draft', author: user?.name ?? '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (existing) setValues(existing);
  }, [existing]);

  const set = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }));

  const payload = useMemo(
    () => ({
      title: values.title ?? '',
      slug: values.slug ?? '',
      cover_image: values.cover_image ?? '',
      category: values.category ?? '',
      author: values.author ?? '',
      content: values.content ?? '',
      published_at: fromLocalInput((values.published_at as any) ?? '') ?? (values.published_at ?? null),
      seo_title: values.seo_title ?? '',
      seo_description: values.seo_description ?? '',
      status: values.status ?? 'draft',
    }),
    [values],
  );

  const save = async (publish = false) => {
    setSaving(true);
    setPublishing(publish);
    setFormErrors({});
    try {
      const body = publish ? { ...payload, status: 'published' as const } : payload;
      let saved: NewsArticle;
      if (isNew) {
        saved = await api.post<NewsArticle>('/api/admin/esports/news', body);
        success('Article created');
        navigate(`/esports/news/${saved.id}/edit`, { replace: true });
      } else {
        saved = await api.patch<NewsArticle>(`/api/admin/esports/news/${id}`, body);
        success(publish ? 'Article published — live on the esports site' : 'Article saved');
        setValues(saved);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.fieldErrors());
        toastError('Please fix the highlighted fields');
      } else {
        toastError(err instanceof ApiError ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  if (!isNew && loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="!h-6 !w-6" />
      </div>
    );
  }
  if (!isNew && error) {
    return (
      <div className="rj-card p-8 text-center">
        <p className="text-sm text-rose-400">{error.message}</p>
        <Link to="/esports/news" className="mt-3 inline-block text-sm text-violet-400">
          ← Back to news
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New article' : 'Edit article'}
        description={isNew ? 'Draft, preview and publish news for the esports site.' : values.title}
        actions={
          <>
            <Link to="/esports/news">
              <Button variant="ghost">
                <ArrowLeft size={14} /> Back
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye size={14} /> Preview
            </Button>
            <Button variant="secondary" onClick={() => save(false)} loading={saving && !publishing}>
              <Save size={14} /> Save
            </Button>
            {values.status !== 'published' && (
              <Button variant="primary" onClick={() => save(true)} loading={saving && publishing}>
                <Send size={14} /> Publish
              </Button>
            )}
          </>
        }
      >
        {values.status && <Badge tone={NEWS_STATUS[values.status]?.tone} className="mt-2">{NEWS_STATUS[values.status]?.label}</Badge>}
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <div className="rj-card space-y-4 p-5">
            <FormField label="Title" error={formErrors.title} required>
              <Input
                value={values.title ?? ''}
                onChange={(e) => set('title', e.target.value)}
                invalid={!!formErrors.title}
                placeholder="Article headline"
                className="!text-base"
              />
            </FormField>
            <FormField label="Slug" error={formErrors.slug} help="Lowercase with dashes. Leave empty to auto-generate.">
              <div className="flex gap-2">
                <Input value={values.slug ?? ''} onChange={(e) => set('slug', e.target.value)} invalid={!!formErrors.slug} placeholder="auto-generated" />
                <Button type="button" variant="outline" onClick={() => set('slug', slugify(values.title ?? ''))} disabled={!values.title}>
                  Generate
                </Button>
              </div>
            </FormField>
          </div>

          <div className="rj-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex gap-1 rounded-lg bg-zinc-950/70 p-1">
                {(['write', 'preview'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                      tab === t ? 'bg-violet-500/20 text-violet-200' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-zinc-600">Markdown</span>
            </div>
            {tab === 'write' ? (
              <Textarea
                rows={18}
                value={values.content ?? ''}
                onChange={(e) => set('content', e.target.value)}
                placeholder={'## Heading\n\nWrite the article in **Markdown**…'}
                className="min-h-[28rem] rounded-none border-0 bg-transparent font-mono text-[13px] leading-6 focus:ring-0"
              />
            ) : (
              <div className="md-content min-h-[28rem] px-5 py-4">
                <ReactMarkdown>{values.content || '_Nothing to preview yet._'}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <div className="rj-card space-y-4 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Publication</h3>
            <FormField label="Status" error={formErrors.status}>
              <Select value={values.status ?? 'draft'} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(NEWS_STATUS).map(([value, m]) => (
                  <option key={value} value={value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Category" error={formErrors.category}>
              <Input value={values.category ?? ''} onChange={(e) => set('category', e.target.value)} placeholder="Announcements" />
            </FormField>
            <FormField label="Author" error={formErrors.author}>
              <Input value={values.author ?? ''} onChange={(e) => set('author', e.target.value)} />
            </FormField>
            <FormField label="Publish date" error={formErrors.published_at} help="Leave empty to publish now.">
              <Input
                type="datetime-local"
                value={toLocalInput(values.published_at ?? null)}
                onChange={(e) => set('published_at', e.target.value)}
              />
            </FormField>
          </div>

          <div className="rj-card space-y-4 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cover</h3>
            <ImageInput label="Cover image" value={values.cover_image ?? ''} onChange={(v) => set('cover_image', v)} error={formErrors.cover_image} />
          </div>

          <div className="rj-card space-y-4 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">SEO</h3>
            <FormField label="SEO title" error={formErrors.seo_title} help="Defaults to the article title when empty.">
              <Input value={values.seo_title ?? ''} onChange={(e) => set('seo_title', e.target.value)} />
            </FormField>
            <FormField label="SEO description" error={formErrors.seo_description} help="Shown in search results and link previews.">
              <Textarea rows={3} value={values.seo_description ?? ''} onChange={(e) => set('seo_description', e.target.value)} />
            </FormField>
          </div>
        </div>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={values.title || 'Untitled article'} size="lg">
        <article>
          {values.cover_image && <img src={values.cover_image} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" />}
          <div className="md-content">
            <ReactMarkdown>{values.content || '_No content yet._'}</ReactMarkdown>
          </div>
        </article>
      </Modal>
    </div>
  );
}
