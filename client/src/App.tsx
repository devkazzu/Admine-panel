/**
 * Application routes with authentication + permission guards.
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/ui/primitives';
import { ForbiddenPage, NotFoundPage } from './pages/StatusPages';
import { LoginPage, ResetPasswordPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomeContentPage } from './pages/website/HomeContentPage';
import { AboutContentPage } from './pages/website/AboutContentPage';
import { ProjectsPage } from './pages/website/ProjectsPage';
import { YouTubePage } from './pages/website/YouTubePage';
import { SocialLinksPage } from './pages/website/SocialLinksPage';
import { MessagesPage } from './pages/website/MessagesPage';
import { TeamsPage } from './pages/esports/TeamsPage';
import { PlayersPage } from './pages/esports/PlayersPage';
import { MatchesPage, ResultsPage } from './pages/esports/MatchesPage';
import { TournamentsPage } from './pages/esports/TournamentsPage';
import { AchievementsPage } from './pages/esports/AchievementsPage';
import { NewsListPage } from './pages/esports/NewsListPage';
import { NewsEditorPage } from './pages/esports/NewsEditorPage';
import { AlbumsPage } from './pages/esports/AlbumsPage';
import { RecruitmentPage } from './pages/esports/RecruitmentPage';
import { ApplicationsPage } from './pages/esports/ApplicationsPage';
import { MediaLibraryPage } from './pages/system/MediaLibraryPage';
import { SettingsPage } from './pages/system/SettingsPage';
import { AdminUsersPage } from './pages/system/AdminUsersPage';
import { ActivityLogsPage } from './pages/system/ActivityLogsPage';
import { ProfilePage } from './pages/profile/ProfilePage';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <Spinner className="!h-6 !w-6" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPerm } = useAuth();
  if (!hasPerm(perm)) return <ForbiddenPage />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<RequirePerm perm="dashboard:read"><DashboardPage /></RequirePerm>} />

        <Route path="/website/home" element={<RequirePerm perm="website_content:read"><HomeContentPage /></RequirePerm>} />
        <Route path="/website/about" element={<RequirePerm perm="website_content:read"><AboutContentPage /></RequirePerm>} />
        <Route path="/website/projects" element={<RequirePerm perm="projects:read"><ProjectsPage /></RequirePerm>} />
        <Route path="/website/youtube" element={<RequirePerm perm="videos:read"><YouTubePage /></RequirePerm>} />
        <Route path="/website/socials" element={<RequirePerm perm="socials:read"><SocialLinksPage /></RequirePerm>} />
        <Route path="/website/messages" element={<RequirePerm perm="messages:read"><MessagesPage /></RequirePerm>} />

        <Route path="/esports/teams" element={<RequirePerm perm="teams:read"><TeamsPage /></RequirePerm>} />
        <Route path="/esports/players" element={<RequirePerm perm="players:read"><PlayersPage /></RequirePerm>} />
        <Route path="/esports/matches" element={<RequirePerm perm="matches:read"><MatchesPage /></RequirePerm>} />
        <Route path="/esports/results" element={<RequirePerm perm="matches:read"><ResultsPage /></RequirePerm>} />
        <Route path="/esports/tournaments" element={<RequirePerm perm="tournaments:read"><TournamentsPage /></RequirePerm>} />
        <Route path="/esports/achievements" element={<RequirePerm perm="achievements:read"><AchievementsPage /></RequirePerm>} />
        <Route path="/esports/news" element={<RequirePerm perm="news:read"><NewsListPage /></RequirePerm>} />
        <Route path="/esports/news/new" element={<RequirePerm perm="news:write"><NewsEditorPage /></RequirePerm>} />
        <Route path="/esports/news/:id/edit" element={<RequirePerm perm="news:write"><NewsEditorPage /></RequirePerm>} />
        <Route path="/esports/media" element={<RequirePerm perm="media_albums:read"><AlbumsPage /></RequirePerm>} />
        <Route path="/esports/recruitment" element={<RequirePerm perm="recruitment:read"><RecruitmentPage /></RequirePerm>} />
        <Route path="/esports/applications" element={<RequirePerm perm="applications:read"><ApplicationsPage /></RequirePerm>} />

        <Route path="/system/media" element={<RequirePerm perm="media:read"><MediaLibraryPage /></RequirePerm>} />
        <Route path="/system/settings" element={<RequirePerm perm="settings:read"><SettingsPage /></RequirePerm>} />
        <Route path="/system/users" element={<RequirePerm perm="admin_users:read"><AdminUsersPage /></RequirePerm>} />
        <Route path="/system/logs" element={<RequirePerm perm="activity_logs:read"><ActivityLogsPage /></RequirePerm>} />

        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
