import React from 'react';
import { Router, useRouter } from './router/Router';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
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
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/app/DashboardPage';
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
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

const AppRoutes: React.FC = () => {
  const { path } = useRouter();

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

  if (path === '/app/my-work' || path === '/app/work') {
    return (
      <AppLayout>
        <MyWorkPage />
      </AppLayout>
    );
  }

  if (path === '/app/invitations') {
    return (
      <AppLayout>
        <InvitationsPage />
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
      <SocketProvider>
        <Router>
          <AppRoutes />
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
