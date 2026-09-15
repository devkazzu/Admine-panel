/**
 * Media reference tracking — before a media file can be deleted we check
 * whether any content still points at it, and tell the admin exactly where.
 */
import { all } from '../db';
import { config } from '../config';

export interface MediaReference {
  resource: string;
  id: number;
  label: string;
}

/** Tables/columns that store a media path (like /uploads/media/...). */
const PATH_COLUMNS: { table: string; column: string; resource: string; label: string }[] = [
  { table: 'projects', column: 'image', resource: 'Project', label: 'name' },
  { table: 'teams', column: 'logo', resource: 'Team', label: 'name' },
  { table: 'players', column: 'image', resource: 'Player', label: 'gamer_tag' },
  { table: 'matches', column: 'opponent_logo', resource: 'Match', label: 'opponent_name' },
  { table: 'news', column: 'cover_image', resource: 'News article', label: 'title' },
  { table: 'achievements', column: 'image', resource: 'Achievement', label: 'title' },
  { table: 'website_home', column: 'hero_image', resource: 'Website: Home', label: 'hero image' },
  { table: 'website_about', column: 'profile_image', resource: 'Website: About', label: 'profile image' },
];

export function findMediaReferences(mediaId: number, mediaPath: string): MediaReference[] {
  const refs: MediaReference[] = [];

  for (const { table, column, resource, label } of PATH_COLUMNS) {
    try {
      const labelExpr = /^[a-z_]+$/.test(label) ? label : `'${label}'`;
      const rows = all<{ id: number; label: string }>(
        `SELECT id, ${labelExpr} AS label FROM ${table} WHERE ${column} = ? AND ${column} != ''`,
        [mediaPath],
      );
      for (const row of rows) refs.push({ resource, id: row.id, label: String(row.label ?? '') });
    } catch {
      /* table/column may not exist yet during early migrations */
    }
  }

  // Settings store values as text (logo / favicon / og image)
  try {
    const rows = all<{ key: string }>(`SELECT key FROM settings WHERE value LIKE ?`, [`%${mediaPath}%`]);
    for (const row of rows) refs.push({ resource: 'Settings', id: 0, label: row.key });
  } catch {
    /* ignore */
  }

  // Album membership
  try {
    const rows = all<{ album_id: number; title: string }>(
      `SELECT a.id AS album_id, a.title FROM media_album_images i
       JOIN media_albums a ON a.id = i.album_id WHERE i.media_id = ?`,
      [mediaId],
    );
    for (const row of rows) refs.push({ resource: 'Media album', id: row.album_id, label: row.title });
  } catch {
    /* ignore */
  }

  return refs;
}

/** Absolute URL for a stored media path (public sites need absolute URLs). */
export function absoluteUrl(pathname: string): string {
  if (!pathname) return '';
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${config.baseUrl}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}
