/**
 * Activity log service — records every important admin action.
 */
import { run } from '../db';
import { nowIso } from '../core/utils';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'status_change'
  | 'settings_update'
  | 'password_change'
  | 'password_reset'
  | 'password_reset_requested'
  | 'media_upload'
  | 'media_delete'
  | 'account_created'
  | 'account_deactivated'
  | 'account_activated'
  | 'role_changed';

export interface ActivityInput {
  userId: number | null;
  action: ActivityAction;
  resourceType?: string;
  resourceId?: string | number;
  details?: Record<string, unknown>;
  ip?: string;
}

export function logActivity(input: ActivityInput): void {
  try {
    run(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.action,
        input.resourceType ?? '',
        String(input.resourceId ?? ''),
        input.details ? JSON.stringify(input.details) : '',
        input.ip ?? '',
        nowIso(),
      ],
    );
  } catch (err) {
    // Logging must never break a request.
    console.error('⚠️ failed to write activity log', err);
  }
}
