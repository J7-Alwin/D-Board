import React from 'react';
import { Router, useRouter } from './router/Router';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { SocketProvider } from './context/SocketContext';
import { ActiveTimerProvider } from './context/ActiveTimerContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { HomePage } from './pages/HomePage';
import { FeaturesPage } from './pages/FeaturesPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { PricingPage } from './pages/PricingPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { CheckEmailPage } from './pages/auth/CheckEmailPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ResetSuccessPage } from './pages/auth/ResetSuccessPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/app/DashboardPage';
import { ProjectsPage } from './pages/app/ProjectsPage';
import { CreateProjectPage } from './pages/app/CreateProjectPage';
import { ProjectWorkspaceShell } from './pages/app/ProjectWorkspaceShell';
import { InvitationsPage } from './pages/app/InvitationsPage';
import { MyWorkPage } from './pages/app/MyWorkPage';
import { NotesPage } from './pages/app/NotesPage';
import { CalendarPage } from './pages/app/CalendarPage';
import { FilesPage } from './pages/app/FilesPage';
import { NotificationsPage } from './pages/app/NotificationsPage';
import { ActivityPage } from './pages/app/ActivityPage';
import { AccountSettingsPage } from './pages/app/AccountSettingsPage';
import { WorkspaceSettingsPage } from './pages/app/WorkspaceSettingsPage';
import { AllWorkspacesPage } from './pages/app/AllWorkspacesPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

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
              <AppRoutes />
            </Router>
          </ActiveTimerProvider>
        </SocketProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
