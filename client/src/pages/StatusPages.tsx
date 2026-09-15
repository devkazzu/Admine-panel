/**
 * 403 / 404 pages.
 */
import { FileQuestion, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/primitives';

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/30">
        <ShieldAlert size={28} className="text-rose-400" />
      </div>
      <h1 className="font-display text-2xl font-bold text-white">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Your role doesn't include permission for this section. Contact a Super Admin if you believe this is a mistake.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="outline">Back to dashboard</Button>
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
        <FileQuestion size={28} className="text-zinc-500" />
      </div>
      <h1 className="font-display text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-500">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/" className="mt-6">
        <Button variant="outline">Back to dashboard</Button>
      </Link>
    </div>
  );
}
