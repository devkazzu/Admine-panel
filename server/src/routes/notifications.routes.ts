/**
 * Topbar notifications — unread contact messages + new recruitment applications.
 */
import { Router } from 'express';
import { all, get } from '../db';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, (req, res) => {
  const unreadMessages = (get<{ c: number }>(`SELECT COUNT(*) c FROM contact_messages WHERE status = 'unread'`) ?? { c: 0 }).c;
  const newApplications = (get<{ c: number }>(`SELECT COUNT(*) c FROM applications WHERE status = 'new'`) ?? { c: 0 }).c;

  const messages = all<any>(
    `SELECT id, name AS title, subject AS subtitle, created_at, 'message' AS type
     FROM contact_messages WHERE status = 'unread' ORDER BY created_at DESC LIMIT 5`,
  );
  const applications = all<any>(
    `SELECT id, gamer_tag AS title, game AS subtitle, created_at, 'application' AS type
     FROM applications WHERE status = 'new' ORDER BY created_at DESC LIMIT 5`,
  );

  const items = [...messages, ...applications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)
    .map((i) => ({
      ...i,
      url: i.type === 'message' ? `/website/messages?focus=${i.id}` : `/esports/applications?focus=${i.id}`,
    }));

  res.json({
    data: {
      counts: { messages: unreadMessages, applications: newApplications },
      items,
    },
  });
});
