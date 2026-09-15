/**
 * System → Media Library: upload (auto-optimized), preview, search, filter,
 * copy URL, alt-text editing and safe delete (blocked while referenced).
 */
import { CloudUpload, Copy, Eye, ImagePlus, Info, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { formatBytes, formatDate } from '../../lib/format';
import type { MediaItem } from '../../lib/types';
import { Badge, Button, EmptyState, ErrorState, FormField, Input, PageHeader, Select, Spinner } from '../../components/ui/primitives';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export function MediaLibraryPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('media:write');
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [format, setFormat] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [altText, setAltText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useMemo(() => ({ q: debounced || undefined, format: format || undefined, page, perPage: 24 }), [debounced, format, page]);
  const { data, loading, error, refetch } = useApiQuery(() => api.list<MediaItem>('/api/admin/media', query), [query, refreshKey]);

  const upload = async (files: FileList | File[] | null) => {
    if (!files || (files as any).length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await api.upload('/api/admin/media', form);
      }
      success('Upload complete — images optimized automatically');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void upload(e.dataTransfer.files);
  };

  const copyUrl = async (item: MediaItem) => {
    const absolute = new URL(item.url, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absolute);
      success('URL copied to clipboard');
    } catch {
      toastError('Could not copy — select the URL manually');
      window.prompt('Copy this URL:', absolute);
    }
  };

  const saveAlt = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/media/${editing.id}`, { alt_text: altText });
      success('Alt text saved');
      setEditing(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api.del(`/api/admin/media/${deleteTarget.id}`);
      success('Media deleted');
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        const refs = Array.isArray(err.details) ? (err.details as unknown as string[]).slice(0, 8) : [];
        setDeleteError(`${err.message}${refs.length ? `: ${refs.join(', ')}` : ''}`);
      } else {
        setDeleteError('Delete failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="All uploaded images. Uploads are resized to max 1920px and converted to WebP automatically."
        actions={
          canWrite ? (
            <Button variant="primary" loading={uploading} onClick={() => fileRef.current?.click()}>
              <CloudUpload size={15} /> Upload images
            </Button>
          ) : undefined
        }
      />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-xs">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or alt text…"
            className="rj-input"
          />
        </div>
        <Select value={format} onChange={(e) => { setFormat(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by format">
          <option value="">Format: All</option>
          <option value="webp">WebP</option>
          <option value="gif">GIF</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
        </Select>
        <p className="text-xs text-zinc-600 sm:ml-auto">
          {data ? `${data.meta.total} item${data.meta.total === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      {canWrite && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mb-6 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
            dragOver ? 'border-violet-500/60 bg-violet-500/5' : 'border-white/10 bg-zinc-900/30'
          }`}
        >
          <CloudUpload size={22} className="mx-auto text-zinc-500" />
          <p className="mt-2 text-sm text-zinc-400">Drag & drop images here, or use the upload button</p>
          <p className="mt-1 text-xs text-zinc-600">JPEG, PNG, WebP, GIF, AVIF · optimized on upload</p>
        </div>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <Spinner className="!h-6 !w-6" />
        </div>
      )}
      {error && <ErrorState message={error.message} onRetry={refetch} />}
      {data && data.data.length === 0 && (
        <EmptyState
          icon={ImagePlus}
          title={debounced ? 'No media matches your search' : 'The media library is empty'}
          description={debounced ? 'Try a different search term.' : 'Upload images to use them across both websites.'}
          action={
            canWrite && !debounced ? (
              <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
                <CloudUpload size={14} /> Upload
              </Button>
            ) : undefined
          }
        />
      )}
      {data && data.data.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.data.map((item) => (
              <div key={item.id} className="rj-card group overflow-hidden">
                <button type="button" onClick={() => setPreview(item)} className="block w-full" title="Preview">
                  <div className="aspect-square w-full overflow-hidden bg-zinc-950">
                    <img
                      src={item.thumb_url || item.url}
                      alt={item.alt_text || item.original_name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                </button>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium text-zinc-300" title={item.original_name}>
                    {item.original_name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                    {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
                    {formatBytes(item.size)}
                  </p>
                  <div className="mt-2 flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" title="Copy URL" aria-label="Copy URL" onClick={() => void copyUrl(item)}>
                      <Copy size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Preview" aria-label="Preview" onClick={() => setPreview(item)}>
                      <Eye size={13} />
                    </Button>
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit alt text"
                        aria-label="Edit alt text"
                        onClick={() => {
                          setEditing(item);
                          setAltText(item.alt_text);
                        }}
                      >
                        <Info size={13} />
                      </Button>
                    )}
                    {canWrite && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete"
                        aria-label="Delete"
                        className="hover:text-rose-400"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(item);
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {data.meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-xs text-zinc-500">
                Page {page} / {data.meta.totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.original_name ?? ''} size="lg">
        {preview && (
          <div className="space-y-4">
            <img src={preview.url} alt={preview.alt_text} className="max-h-[55vh] w-full rounded-lg object-contain bg-zinc-950" />
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <Badge tone="violet">{preview.format.toUpperCase()}</Badge>
              <span>
                {preview.width}×{preview.height}
              </span>
              <span>{formatBytes(preview.size)}</span>
              <span>Uploaded {formatDate(preview.created_at)}</span>
            </div>
            {preview.alt_text && <p className="text-sm text-zinc-400">Alt text: {preview.alt_text}</p>}
            <Button variant="outline" size="sm" onClick={() => void copyUrl(preview)}>
              <Copy size={13} /> Copy URL
            </Button>
          </div>
        )}
      </Modal>

      {/* Alt text editor */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit alt text"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveAlt} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <img src={editing.thumb_url || editing.url} alt="" className="max-h-40 rounded-lg object-contain" />
            <FormField label="Alt text" help="Describes the image for accessibility and SEO.">
              <Input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="e.g. RJNX team celebrating a win" />
            </FormField>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete media"
        message={
          <>
            {deleteError ? (
              <span className="block text-rose-300">{deleteError}</span>
            ) : (
              <>
                Delete <span className="font-medium text-zinc-200">{deleteTarget?.original_name}</span> permanently? Media still
                referenced by content cannot be deleted.
              </>
            )}
          </>
        }
        confirmLabel={deleteError ? 'OK' : 'Delete'}
      />
    </div>
  );
}
