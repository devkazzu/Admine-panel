/**
 * Media library picker — modal grid to select an uploaded image for content
 * fields. Supports search + upload without leaving the picker.
 */
import { CloudUpload, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import type { MediaItem } from '../../lib/types';
import { Modal } from './Modal';
import { Button, EmptyState, ErrorState, Spinner } from './primitives';
import { useToast } from './Toast';

export function useMediaList(query: string, page: number, refreshKey: number) {
  return useApiQuery(
    () => api.list<MediaItem>('/api/admin/media', { q: query || undefined, page, perPage: 24 }),
    [query, page, refreshKey],
  );
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  onSelectItem,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  /** When provided, receives the full media item instead of just the path. */
  onSelectItem?: (item: MediaItem) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { data, loading, error, refetch } = useMediaList(debounced, page, refreshKey);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await api.upload('/api/admin/media', form);
      }
      setRefreshKey((k) => k + 1);
      toast.success('Upload complete');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Media library" description="Pick an image, or upload a new one" size="xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search media…"
            className="rj-input pl-9"
          />
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
        <Button variant="primary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
          <CloudUpload size={14} /> Upload images
        </Button>
      </div>

      {loading && !data && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}
      {error && <ErrorState message={error.message} onRetry={refetch} />}
      {data && data.data.length === 0 && (
        <EmptyState
          icon={CloudUpload}
          title="No media found"
          description={debounced ? 'Try a different search, or upload a new image.' : 'Upload your first image to get started.'}
          action={
            <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
              <CloudUpload size={14} /> Upload
            </Button>
          }
        />
      )}
      {data && data.data.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.data.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.path)}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950 transition hover:border-violet-500/60 hover:shadow-glow"
                title={`Select ${item.original_name}`}
              >
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={item.thumb_url || item.url}
                    alt={item.alt_text || item.original_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <p className="truncate px-2 py-1.5 text-left text-[11px] text-zinc-500">{item.original_name}</p>
              </button>
            ))}
          </div>
          {data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
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
    </Modal>
  );
}
