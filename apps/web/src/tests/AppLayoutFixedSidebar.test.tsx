import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppLayout } from '../components/layout/AppLayout';

const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'alex@example.com',
      username: 'alexdev',
      fullName: 'Alex Developer',
      role: 'MEMBER',
      avatarUrl: null,
    },
    token: 'mock-token',
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    updateUser: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    path: '/app/dashboard',
    navigate: mockNavigate,
    params: {},
  }),
  Link: ({ children, to, onClick, className, ...props }: any) => (
    <a href={to} onClick={onClick} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../api/projects.api', () => ({
  projectsApi: {
    getUserProjects: vi.fn().mockResolvedValue({
      success: true,
      data: {
        owned: [
          { id: 'proj-1', name: 'Alpha Project', key: 'ALP', color: '#4F46E5' },
          { id: 'proj-2', name: 'Beta Core', key: 'BET', color: '#059669' },
        ],
        joined: [
          { id: 'proj-3', name: 'Gamma Shared', key: 'GAM', color: '#D97706' },
        ],
      },
    }),
  },
}));

vi.mock('../api/invitations.api', () => ({
  invitationsApi: {
    getPendingCount: vi.fn().mockResolvedValue({
      success: true,
      data: { count: 3 },
    }),
  },
}));

vi.mock('../api/notifications.api', () => ({
  notificationsApi: {
    getUnreadCount: vi.fn().mockResolvedValue({
      success: true,
      data: { count: 2 },
    }),
  },
}));

describe('AppLayout Fixed Sidebar and Layout Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required sidebar elements: logo, nav, projects, action buttons, and user profile', async () => {
    const { container } = render(
      <AppLayout>
        <div data-testid="main-content">Page Content Body</div>
      </AppLayout>
    );

    // 1. Logo link
    const logoLink = screen.getByLabelText('D-Board Dashboard');
    expect(logoLink).toBeInTheDocument();

    // 2. Navigation items inside main nav
    const nav = screen.getByRole('navigation', { name: 'Main Navigation' });
    expect(nav).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/dashboard"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/my-work"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/calendar"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/files"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/notes"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/activity"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="/app/notifications"]')).toBeInTheDocument();

    // 3. Projects section header
    expect(screen.getByText('MY PROJECTS')).toBeInTheDocument();

    // 4. Action buttons
    const createBtn = screen.getByRole('button', { name: /create project/i });
    expect(createBtn).toBeInTheDocument();

    const invitesBtn = screen.getByRole('button', { name: /invitations/i });
    expect(invitesBtn).toBeInTheDocument();

    // 5. User Profile section in sidebar
    const userCard = container.querySelector('.sidebar-user-card');
    expect(userCard).toBeInTheDocument();
    expect(userCard?.querySelector('.sidebar-user-name')).toHaveTextContent('Alex Developer');
    expect(userCard?.querySelector('.sidebar-user-sub')).toHaveTextContent('@alexdev');
  });

  it('contains dedicated internal scrollable container in sidebar', () => {
    const { container } = render(
      <AppLayout>
        <div data-testid="main-content">Page Content Body</div>
      </AppLayout>
    );

    const sidebar = container.querySelector('.app-workspace-sidebar');
    expect(sidebar).toBeInTheDocument();

    // Internal scroll container should hold nav and projects
    const scrollContainer = sidebar?.querySelector('.workspace-sidebar-scroll');
    expect(scrollContainer).toBeInTheDocument();

    const nav = scrollContainer?.querySelector('.workspace-nav');
    expect(nav).toBeInTheDocument();

    const projectsList = scrollContainer?.querySelector('.workspace-projects-list');
    expect(projectsList).toBeInTheDocument();

    // Logo brand and bottom action area remain outside scrollable container
    const brand = sidebar?.querySelector('.workspace-brand');
    expect(brand).toBeInTheDocument();
    expect(scrollContainer?.contains(brand!)).toBe(false);

    const actionArea = sidebar?.querySelector('.workspace-action-area');
    expect(actionArea).toBeInTheDocument();
    expect(scrollContainer?.contains(actionArea!)).toBe(false);

    const footer = sidebar?.querySelector('.workspace-sidebar-footer');
    expect(footer).toBeInTheDocument();
    expect(scrollContainer?.contains(footer!)).toBe(false);
  });

  it('renders main content area inside app-workspace-main with sticky topbar', () => {
    const { container } = render(
      <AppLayout>
        <div data-testid="main-content">Page Content Body</div>
      </AppLayout>
    );

    const mainArea = container.querySelector('.app-workspace-main');
    expect(mainArea).toBeInTheDocument();

    const topbar = mainArea?.querySelector('.workspace-topbar');
    expect(topbar).toBeInTheDocument();

    const contentBody = mainArea?.querySelector('.workspace-content-body');
    expect(contentBody).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('supports responsive mobile drawer open and backdrop dismissal', () => {
    const { container } = render(
      <AppLayout>
        <div data-testid="main-content">Page Content Body</div>
      </AppLayout>
    );

    const sidebar = container.querySelector('.app-workspace-sidebar');
    expect(sidebar).not.toHaveClass('mobile-open');

    // Open drawer via menu button
    const menuBtn = screen.getByLabelText('Open navigation drawer');
    fireEvent.click(menuBtn);

    expect(sidebar).toHaveClass('mobile-open');

    // Backdrop should appear and clicking it closes drawer
    const backdrop = container.querySelector('.sidebar-overlay');
    expect(backdrop).toBeInTheDocument();
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(sidebar).not.toHaveClass('mobile-open');
    }
  });
});
