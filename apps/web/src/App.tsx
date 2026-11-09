import React, { Suspense, lazy } from 'react';
import { Router, useRouter } from './router/Router';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { SocketProvider } from './context/SocketContext';
import { ActiveTimerProvider } from './context/ActiveTimerContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { AppLayout } from './components/layout/AppLayout';
import './App.css';

// Route-level code-splitting for blazing fast page loads
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage').then((m) => ({ default: m.FeaturesPage })));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const CheckEmailPage = lazy(() => import('./pages/auth/CheckEmailPage').then((m) => ({ default: m.CheckEmailPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const ResetSuccessPage = lazy(() => import('./pages/auth/ResetSuccessPage').then((m) => ({ default: m.ResetSuccessPage })));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));

const DashboardPage = lazy(() => import('./pages/app/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('./pages/app/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const CreateProjectPage = lazy(() => import('./pages/app/CreateProjectPage').then((m) => ({ default: m.CreateProjectPage })));
const ProjectWorkspaceShell = lazy(() => import('./pages/app/ProjectWorkspaceShell').then((m) => ({ default: m.ProjectWorkspaceShell })));
const InvitationsPage = lazy(() => import('./pages/app/InvitationsPage').then((m) => ({ default: m.InvitationsPage })));
const MyWorkPage = lazy(() => import('./pages/app/MyWorkPage').then((m) => ({ default: m.MyWorkPage })));
const NotesPage = lazy(() => import('./pages/app/NotesPage').then((m) => ({ default: m.NotesPage })));
const CalendarPage = lazy(() => import('./pages/app/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const FilesPage = lazy(() => import('./pages/app/FilesPage').then((m) => ({ default: m.FilesPage })));
const NotificationsPage = lazy(() => import('./pages/app/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ActivityPage = lazy(() => import('./pages/app/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const AccountSettingsPage = lazy(() => import('./pages/app/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage })));
const WorkspaceSettingsPage = lazy(() => import('./pages/app/WorkspaceSettingsPage').then((m) => ({ default: m.WorkspaceSettingsPage })));
const AllWorkspacesPage = lazy(() => import('./pages/app/AllWorkspacesPage').then((m) => ({ default: m.AllWorkspacesPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-8">
    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppRoutes: React.FC = () => {
  const { path } = useRouter();

  // Toggle 90% scaled density exclusively for authenticated app routes (/app/*)
  React.useEffect(() => {
    if (path.startsWith('/app')) {
      document.documentElement.classList.add('app-authenticated-mode');
    } else {
      document.documentElement.classList.remove('app-authenticated-mode');
    }
  }, [path]);

  // Exact & Prefix Routing
  if (path === '/login') {
    return <LoginPage />;
  }

  if (path === '/register') {
    return <RegisterPage />;
  }

  if (path === '/forgot-password') {
    return <ForgotPasswordPage />;
  }

  if (path === '/check-email' || path.startsWith('/check-email?')) {
    return <CheckEmailPage />;
  }

  if (path === '/reset-password' || path.startsWith('/reset-password?')) {
    return <ResetPasswordPage />;
  }

  if (path === '/reset-success') {
    return <ResetSuccessPage />;
  }

  if (path === '/verify-email' || path.startsWith('/verify-email?')) {
    return <VerifyEmailPage />;
  }

  // Authenticated App Routes
  if (path === '/app/notifications') {
    return (
      <AppLayout>
        <NotificationsPage />
      </AppLayout>
    );
  }

  if (path === '/app/settings' || path === '/app/settings/profile') {
    return (
      <AppLayout>
        <AccountSettingsPage />
      </AppLayout>
    );
  }

  if (
    path === '/app/workspace/settings' ||
    path.startsWith('/app/workspace/settings') ||
    path === '/app/workspace/members' ||
    path.startsWith('/app/workspace/members') ||
    path === '/app/workspaces/settings' ||
    path.startsWith('/app/workspaces/settings')
  ) {
    return (
      <AppLayout>
        <WorkspaceSettingsPage />
      </AppLayout>
    );
  }

  if (path === '/app/workspaces' || (path.startsWith('/app/workspaces') && !path.startsWith('/app/workspaces/settings') && !path.startsWith('/app/workspaces/invitations'))) {
    return (
      <AppLayout>
        <AllWorkspacesPage />
      </AppLayout>
    );
  }

  if (path === '/app/my-work' || path === '/app/work') {
    return (
      <AppLayout>
        <MyWorkPage />
      </AppLayout>
    );
  }

  if (path === '/app/invitations' || path === '/app/workspaces/invitations/accept' || path.startsWith('/app/workspaces/invitations/accept')) {
    return (
      <AppLayout>
        <InvitationsPage />
      </AppLayout>
    );
  }

  if (path === '/app/projects') {
    return (
      <AppLayout>
        <ProjectsPage />
      </AppLayout>
    );
  }

  if (path === '/app/projects/create') {
    return (
      <AppLayout>
        <CreateProjectPage />
      </AppLayout>
    );
  }

  // Global Standalone Pages
  if (path === '/app/files') {
    return (
      <AppLayout>
        <FilesPage />
      </AppLayout>
    );
  }

  if (path === '/app/calendar') {
    return (
      <AppLayout>
        <CalendarPage />
      </AppLayout>
    );
  }

  if (path === '/app/notes') {
    return (
      <AppLayout>
        <NotesPage />
      </AppLayout>
    );
  }

  // Unified Project Workspace Shell
  if (path.match(/^\/app\/projects\/[^/]+/)) {
    return (
      <AppLayout>
        <ProjectWorkspaceShell />
      </AppLayout>
    );
  }

  if (path === '/app/activity') {
    return (
      <AppLayout>
        <ActivityPage />
      </AppLayout>
    );
  }

  if (path === '/app/dashboard' || path === '/app' || path.startsWith('/app')) {
    return (
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    );
  }



  if (path === '/features') {
    return (
      <PublicLayout>
        <FeaturesPage />
      </PublicLayout>
    );
  }

  if (path === '/how-it-works') {
    return (
      <PublicLayout>
        <HowItWorksPage />
      </PublicLayout>
    );
  }

  if (path === '/pricing') {
    return (
      <PublicLayout>
        <PricingPage />
      </PublicLayout>
    );
  }

  if (path === '/about') {
    return (
      <PublicLayout>
        <AboutPage />
      </PublicLayout>
    );
  }

  if (path === '/terms') {
    return (
      <PublicLayout>
        <TermsPage />
      </PublicLayout>
    );
  }

  if (path === '/privacy') {
    return (
      <PublicLayout>
        <PrivacyPolicyPage />
      </PublicLayout>
    );
  }

  if (path === '/') {
    return (
      <PublicLayout>
        <HomePage />
      </PublicLayout>
    );
  }

  // Fallback 404 Not Found Page
  return (
    <PublicLayout>
      <NotFoundPage />
    </PublicLayout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <SocketProvider>
          <ActiveTimerProvider>
            <Router>
              <Suspense fallback={<RouteLoadingFallback />}>
                <AppRoutes />
              </Suspense>
            </Router>
          </ActiveTimerProvider>
        </SocketProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
