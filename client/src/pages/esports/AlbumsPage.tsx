/**
 * RJNX Esports → Media: gallery albums referencing media library items.
 */
import { ArrowDown, ArrowUp, Images, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { ALBUM_STATUS } from '../../lib/constants';
import type { MediaAlbum, MediaItem } from '../../lib/types';
import { Button, Input, PageHeader, Spinner } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { MediaPicker } from '../../components/ui/MediaPicker';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

const fields: FieldDef[] = [
  { name: 'title', label: 'Album title', type: 'text', required: true, placeholder: 'Launch day gallery' },
  { name: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title' },
  { name: 'event_date', label: 'Event date', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ], defaultValue: 'draft' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
];

/** Album image manager modal. */
function AlbumImagesModal({ album, onClose, onDone }: { album: MediaAlbum | null; onClose: () => void; onDone: () => void }) {
  const { success, error: toastError } = useToast();
  const [images, setImages] = useState<{ media_id: number; caption: string; sort_order: number; url: string; name: string }[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load the album's current images when opened
  useState(() => {
    if (album) {
      setLoading(true);
      api
        .get<MediaAlbum>(`/api/admin/esports/media-albums/${album.id}/full`)
        .then((a) => setImages((a.images ?? []).map((img) => ({ media_id: img.id, caption: img.caption, sort_order: img.sort_order, url: img.url, name: `#${img.id}` }))))
        .catch(() => setImages([]))
        .finally(() => setLoading(false));
    }
  });

  if (!album) return null;

  const addItem = (item: MediaItem) => {
    setImages((prev) => [
      ...(prev ?? []),
      { media_id: item.id, caption: item.alt_text || item.original_name, sort_order: (prev?.length ?? 0), url: item.thumb_url || item.url, name: item.original_name },
    ]);
  };

  const move = (index: number, dir: -1 | 1) => {
    setImages((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((img, i) => ({ ...img, sort_order: i }));
    });
  };

  const save = async () => {
    if (!images) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/esports/media-albums/${album.id}/images`, {
        images: images.map((img, i) => ({ media_id: img.media_id, caption: img.caption, sort_order: i })),
      });
      success('Album images saved');
      onDone();
      onClose();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!album}
      onClose={onClose}
      title={`Manage images — ${album.title}`}
      description="Images are referenced from the media library (files are never duplicated)."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            <Save size={14} /> Save images
          </Button>
        </>
      }
    >
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {images && (
        <>
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus size={13} /> Add images
            </Button>
          </div>
          {images.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No images in this album yet.</p>
          ) : (
            <ul className="space-y-2">
              {images.map((img, i) => (
                <li key={img.media_id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-950/40 p-2.5">
                  <img src={img.url} alt="" className="h-12 w-16 shrink-0 rounded object-cover ring-1 ring-white/10" />
                  <Input
                    value={img.caption}
                    onChange={(e) => setImages((prev) => (prev ?? []).map((x, j) => (i === j ? { ...x, caption: e.target.value } : x)))}
                    placeholder="Caption (optional)"
                    className="flex-1"
                  />
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove"
                      className="hover:text-rose-400"
                      onClick={() => setImages((prev) => (prev ?? []).filter((_, j) => j !== i))}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={() => undefined} onSelectItem={addItem} />
    </Modal>
  );
}

export function AlbumsPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('media_albums:write');
  const [managing, setManaging] = useState<MediaAlbum | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <CrudPage
        title="Media"
        description="Photo albums for the esports site gallery. Published albums appear on the public website."
        endpoint="/api/admin/esports/media-albums"
        resource="media_albums"
        createLabel="New album"
        searchPlaceholder="Search albums…"
        fields={fields}
        defaults={{ status: 'draft' }}
        filters={[{ name: 'status', options: Object.entries(ALBUM_STATUS).map(([value, m]) => ({ value, label: m.label })) }]}
        emptyIcon={Images}
        emptyTitle="No albums"
        emptyDescription="Create an album, then add images from the media library."
        listQuery={{ _r: String(refreshKey) }}
        columns={[
          {
            key: 'title',
            label: 'Album',
            render: (row: MediaAlbum) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{row.title}</p>
                <p className="truncate text-xs text-zinc-600">/{row.slug}</p>
              </div>
            ),
          },
          {
            key: 'image_count',
            label: 'Images',
            render: (row: MediaAlbum) => <span className="font-display text-sm text-zinc-300">{row.image_count ?? 0}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: (row: MediaAlbum) => (
              <span className={`text-xs ${row.status === 'published' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {ALBUM_STATUS[row.status]?.label}
              </span>
            ),
          },
        ]}
        rowActions={
          canWrite
            ? (row: MediaAlbum) => (
                <Button size="sm" variant="outline" onClick={() => setManaging(row)}>
                  <Images size={12} /> Images
                </Button>
              )
            : undefined
        }
      />
      <AlbumImagesModal album={managing} onClose={() => setManaging(null)} onDone={() => setRefreshKey((k) => k + 1)} />
    </>
  );
}
