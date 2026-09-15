/**
 * RJNX Esports → News: article list with publish workflow.
 */
import { Eye, Newspaper, Pencil, Plus, Send, Unplug, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { formatDateTime } from '../../lib/format';
import { NEWS_STATUS } from '../../lib/constants';
import type { NewsArticle } from '../../lib/types';
import { Badge, Button, PageHeader, Select } from '../../components/ui/primitives';
import { DataTable, ListToolbar } from '../../components/ui/DataTable';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export function NewsListPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('news:write');
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<NewsArticle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsArticle | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => ({ q: debounced || undefined, status: status || undefined, page, perPage: 20 }), [debounced, status, page]);
  const { data, loading, error, refetch } = useApiQuery(() => api.list<NewsArticle>('/api/admin/esports/news', query), [query]);

  const setPublished = async (article: NewsArticle, publish: boolean) => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/esports/news/${article.id}/${publish ? 'publish' : 'unpublish'}`);
      success(publish ? 'Article published — now live on the esports site' : 'Article unpublished');
      refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/esports/news/${deleteTarget.id}`);
      success('Article deleted');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="News"
        description="Articles for the RJNX Esports website. Drafts stay private until published."
        actions={
          canWrite ? (
            <Link to="/esports/news/new">
              <Button variant="primary">
                <Plus size={15} /> New article
              </Button>
            </Link>
          ) : undefined
        }
      />

      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search articles…"
        filters={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by status">
            <option value="">Status: All</option>
            {Object.entries(NEWS_STATUS).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </Select>
        }
      />

      <DataTable
        columns={[
          {
            key: 'title',
            label: 'Article',
            render: (row) => (
              <div className="flex items-center gap-3">
                {row.cover_image ? (
                  <img src={row.cover_image} alt="" className="h-9 w-14 shrink-0 rounded object-cover ring-1 ring-white/10" />
                ) : (
                  <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded bg-white/5 ring-1 ring-white/10">
                    <Newspaper size={14} className="text-zinc-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{row.title}</p>
                  <p className="truncate text-xs text-zinc-600">
                    {row.category || 'Uncategorized'} · {row.author || '—'}
                  </p>
                </div>
              </div>
            ),
          },
          { key: 'slug', label: 'Slug', render: (row) => <span className="text-xs text-zinc-600">/{row.slug}</span> },
          { key: 'status', label: 'Status', render: (row) => <Badge tone={NEWS_STATUS[row.status]?.tone}>{NEWS_STATUS[row.status]?.label}</Badge> },
          {
            key: 'published_at',
            label: 'Published',
            render: (row) => <span className="whitespace-nowrap text-xs text-zinc-500">{row.published_at ? formatDateTime(row.published_at) : '—'}</span>,
          },
        ]}
        rows={data?.data ?? null}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refetch}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        emptyIcon={Newspaper}
        emptyTitle="No articles"
        emptyDescription="Write the first news article for the esports site."
        emptyAction={
          canWrite ? (
            <Link to="/esports/news/new">
              <Button variant="primary" size="sm">
                <Plus size={14} /> New article
              </Button>
            </Link>
          ) : undefined
        }
        rowActions={(row) => (
          <>
            <Button size="icon" variant="ghost" title="Preview" aria-label="Preview" onClick={() => setPreview(row)}>
              <Eye size={14} />
            </Button>
            {canWrite && (
              <Link to={`/esports/news/${row.id}/edit`}>
                <Button size="icon" variant="ghost" title="Edit" aria-label="Edit">
                  <Pencil size={14} />
                </Button>
              </Link>
            )}
            {canWrite && row.status !== 'published' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setPublished(row, true)}>
                <Send size={12} /> Publish
              </Button>
            )}
            {canWrite && row.status === 'published' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setPublished(row, false)}>
                <Unplug size={12} /> Unpublish
              </Button>
            )}
            {canWrite && (
              <Button size="icon" variant="ghost" title="Delete" aria-label="Delete" className="hover:text-rose-400" onClick={() => setDeleteTarget(row)}>
                <Trash2 size={14} />
              </Button>
            )}
          </>
        )}
      />

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} size="lg">
        {preview && (
          <article>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <Badge tone={NEWS_STATUS[preview.status]?.tone}>{NEWS_STATUS[preview.status]?.label}</Badge>
              {preview.category && <span>{preview.category}</span>}
              {preview.author && <span>· {preview.author}</span>}
              {preview.published_at && <span>· {formatDateTime(preview.published_at)}</span>}
            </div>
            {preview.cover_image && <img src={preview.cover_image} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" />}
            <div className="md-content">
              <ReactMarkdown>{preview.content || '_No content yet._'}</ReactMarkdown>
            </div>
          </article>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete article"
        message={
          <>
            Delete <span className="font-medium text-zinc-200">“{deleteTarget?.title}”</span>? This cannot be undone.
          </>
        }
      />
    </div>
  );
}
