/**
 * Request "shape" types shared by middleware + routes.
 */
export interface SessionUser {
  id: number;
  email: string;
  username: string;
  name: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
  avatarUrl: string;
  sessionId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser | null;
      validated: {
        body?: any;
        query?: any;
        params?: any;
      };
    }
  }
}

export {};
