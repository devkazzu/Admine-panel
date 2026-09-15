/**
 * App shell: sidebar (collapsible groups, mobile drawer, permission-filtered),
 * topbar (breadcrumbs, global search, notifications, user menu) and the routed
 * content area.
 */
import {
  Bell, ChevronDown, ChevronRight, LogOut, Menu, Search, UserCircle2, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import { timeAgo } from '../../lib/format';
import { NAV_GROUPS, NAV_MAIN, ROUTE_LABELS } from '../../lib/constants';
import type { NotificationsData, SearchResults } from '../../lib/types';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Spinner } from '../ui/primitives';
import { useDebounce } from '../../lib/hooks';

// ── Brand block ──────────────────────────────────────────────────────────────
function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 px-4 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 font-display text-lg font-bold text-white shadow-glow">
        R
      </div>
      <div className="min-w-0">
        <p className="font-display text-[15px] font-bold leading-tight tracking-wide text-white">RJNX ADMIN</p>
        <p className="truncate text-[10px] uppercase tracking-[0.18em] text-zinc-500">Central Management</p>
      </div>
    </Link>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPerm } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('rjnx:nav-collapsed') ?? '{}');
    } catch {
      return {};
    }
  });

  const toggle = (label: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem('rjnx:nav-collapsed', JSON.stringify(next));
      return next;
    });
  };

  const { data: notifications } = useApiQuery(() => api.get<NotificationsData>('/api/admin/notifications'), []);
  const badgeFor = (badge?: 'messages' | 'applications') => {
    if (!badge) return null;
    const count = notifications?.counts[badge] ?? 0;
    if (count === 0) return null;
    return (
      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/90 px-1.5 text-[10px] font-semibold text-white">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
      {NAV_MAIN.filter((item) => hasPerm(item.perm)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => `rj-navlink ${isActive ? 'rj-navlink-active' : ''}`}
        >
          <item.icon size={16} className="shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}

      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => hasPerm(item.perm));
        if (items.length === 0) return null;
        const isCollapsed = collapsed[group.label];
        return (
          <div key={group.label} className="pt-3">
            <button type="button" className="rj-navgroup" onClick={() => toggle(group.label)} aria-expanded={!isCollapsed}>
              <span>{group.label}</span>
              <ChevronRight size={13} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
            </button>
            {!isCollapsed && (
              <div className="mt-1 space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) => `rj-navlink ${isActive ? 'rj-navlink-active' : ''}`}
                  >
                    <item.icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {badgeFor(item.badge)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Breadcrumbs ──────────────────────────────────────────────────────────────
function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbs = useMemo(() => {
    const out: { label: string; to: string }[] = [];
    let acc = '';
    for (const seg of segments) {
      acc += `/${seg}`;
      out.push({ label: ROUTE_LABELS[seg] ?? seg, to: acc });
    }
    return out;
  }, [segments]);

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm md:flex">
      <Link to="/" className="text-zinc-500 transition hover:text-zinc-300">
        Dashboard
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.to} className="flex items-center gap-1.5">
          <ChevronRight size={13} className="text-zinc-700" />
          {i === crumbs.length - 1 ? (
            <span className="text-zinc-300">{c.label}</span>
          ) : (
            <Link to={c.to} className="text-zinc-500 transition hover:text-zinc-300">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

// ── Global search ────────────────────────────────────────────────────────────
function GlobalSearch() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, loading } = useApiQuery(
    () => (debounced.length >= 2 ? api.get<SearchResults>('/api/admin/search', { q: debounced }) : Promise.resolve(null)),
    [debounced],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement === document.body)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const hasResults = (data?.groups ?? []).some((g) => g.items.length > 0);

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-sm sm:block">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Search everything…"
          className="rj-input pl-9 pr-14"
          aria-label="Global search"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-600">
          ⌘K
        </kbd>
      </div>
      {open && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[26rem] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-2xl shadow-black/60">
          {loading && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
          {!loading && !hasResults && <p className="px-3 py-5 text-center text-sm text-zinc-500">No results for “{query}”</p>}
          {!loading &&
            (data?.groups ?? []).map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.label} className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{group.label}</p>
                  {group.items.map((item) => (
                    <button
                      key={`${group.label}-${item.id}`}
                      onClick={() => {
                        navigate(item.url);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-zinc-200">{item.title}</span>
                        {item.subtitle && <span className="block truncate text-xs text-zinc-600">{item.subtitle}</span>}
                      </span>
                      <ChevronRight size={13} className="shrink-0 text-zinc-700" />
                    </button>
                  ))}
                </div>
              ),
            )}
        </div>
      )}
    </div>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, refetch } = useApiQuery(() => api.get<NotificationsData>('/api/admin/notifications'), []);

  useEffect(() => {
    const interval = setInterval(() => void refetch(), 60000);
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', onClick);
    };
  }, [refetch]);

  const total = (data?.counts.messages ?? 0) + (data?.counts.applications ?? 0);

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
        aria-label={`Notifications (${total} unread)`}
      >
        <Bell size={17} />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-200">Notifications</p>
            <div className="flex gap-1.5">
              {data && data.counts.messages > 0 && <Badge tone="sky">{data.counts.messages} unread messages</Badge>}
              {data && data.counts.applications > 0 && <Badge tone="violet">{data.counts.applications} new applications</Badge>}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(data?.items ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">You're all caught up 🎉</p>
            ) : (
              (data?.items ?? []).map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    navigate(item.url);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-0 hover:bg-white/5"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.type === 'message' ? 'bg-sky-400' : 'bg-violet-400'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-200">{item.title}</span>
                    <span className="block truncate text-xs text-zinc-600">{item.subtitle || (item.type === 'message' ? 'New message' : 'New application')}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-600">{timeAgo(item.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── User menu ────────────────────────────────────────────────────────────────
function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-white/5" aria-label="Account menu">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-bold text-white">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block text-xs font-semibold leading-tight text-zinc-200">{user.name}</span>
          <span className="block text-[10px] leading-tight text-zinc-500">{user.roleName}</span>
        </span>
        <ChevronDown size={14} className="hidden text-zinc-500 lg:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60">
          <div className="border-b border-white/5 px-4 py-3">
            <p className="truncate text-sm font-medium text-zinc-200">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
            <Badge tone={user.roleKey === 'super_admin' ? 'fuchsia' : user.roleKey === 'editor' ? 'violet' : 'sky'} className="mt-1.5">
              {user.roleName}
            </Badge>
          </div>
          <button
            onClick={() => {
              navigate('/profile');
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            <UserCircle2 size={15} /> Profile & password
          </button>
          <button
            onClick={() => {
              void logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 transition hover:bg-rose-500/10"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-600/5 blur-[120px]" />
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-zinc-950/80 backdrop-blur lg:flex">
        <Brand />
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/70 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={19} />
            </button>
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
              <GlobalSearch />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
