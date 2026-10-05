import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isNativeWidget } from './features/native/runtime';

import AppLayout from './AppLayout';
import RequireAuth from './app/RequireAuth';
import { ARCANA_ENABLED } from './constants/features';

const AuthRoute = lazy(() => import('./pages/auth/AuthRoute'));
const ContactRoute = lazy(() => import('./pages/contact/ContactRoute'));
const OnboardingRoute = lazy(() => import('./pages/onboarding/OnboardingRoute'));
const InviteRoute = lazy(() => import('./pages/invite/InviteRoute'));
const HomeRoute = lazy(() => import('./pages/home/HomeRoute'));
const TodayRoute = lazy(() => import('./pages/today/TodayRoute'));
const BoardRoute = lazy(() => import('./pages/board/BoardRoute'));
const CalendarRoute = lazy(() => import('./pages/board/CalendarRoute'));
const TableRoute = lazy(() => import('./pages/board/TableRoute'));
const WorkspaceMembersRoute = lazy(() => import('./pages/workspace/WorkspaceMembersRoute'));
const ArcanaRoute = lazy(() => import('./pages/arcana/ArcanaRoute'));
const NotFoundRoute = lazy(() => import('./pages/not-found/NotFoundRoute'));

const routeFallback = <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">Loading workspace...</div>;

export default function App() {
  const Router = isNativeWidget() ? HashRouter : BrowserRouter;
  return (
    <Router>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="auth/sign-in" element={<AuthRoute />} />
            <Route path="invite/:token" element={<InviteRoute />} />
            <Route path="contact" element={<ContactRoute />} />
            <Route element={<RequireAuth />}>
              <Route path="onboarding" element={<OnboardingRoute />} />
              <Route path="home" element={<HomeRoute />} />
              <Route path="today" element={<TodayRoute />} />
              <Route path="arcana" element={ARCANA_ENABLED ? <ArcanaRoute /> : <Navigate to="/home" replace />} />
              <Route path="workspaces/:workspaceId/members" element={<WorkspaceMembersRoute />} />
              <Route path="workspaces/:workspaceId/boards/:boardId" element={<BoardRoute />} />
              <Route path="workspaces/:workspaceId/boards/:boardId/calendar" element={<CalendarRoute />} />
              <Route path="workspaces/:workspaceId/boards/:boardId/table" element={<TableRoute />} />
            </Route>
            <Route path="*" element={<NotFoundRoute />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
