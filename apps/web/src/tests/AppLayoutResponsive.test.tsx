import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppLayout } from '../components/layout/AppLayout';

const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'user@example.com',
      username: 'janedev',
      name: 'Jane Developer',
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
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../components/workspace/WorkspaceSearch', () => ({
  WorkspaceSearch: () => <div data-testid="workspace-search-mock">Workspace Search</div>,
}));

describe('AppLayout Responsive Controls Tests', () => {
  it('renders mobile navigation toggle and mobile search toggle', () => {
    render(
      <AppLayout>
        <div data-testid="layout-child">Content</div>
      </AppLayout>
    );

    const menuBtn = screen.getByLabelText('Open navigation drawer');
    expect(menuBtn).toBeInTheDocument();

    const searchBtn = screen.getByLabelText('Open search');
    expect(searchBtn).toBeInTheDocument();
  });

  it('toggles mobile search expanded state when search button is clicked', () => {
    render(
      <AppLayout>
        <div data-testid="layout-child">Content</div>
      </AppLayout>
    );

    const searchToggleBtn = screen.getByLabelText('Open search');
    fireEvent.click(searchToggleBtn);

    // Close button should now appear
    const closeSearchBtn = screen.getByLabelText('Close search');
    expect(closeSearchBtn).toBeInTheDocument();

    // Clicking close should dismiss it
    fireEvent.click(closeSearchBtn);
    expect(screen.queryByLabelText('Close search')).not.toBeInTheDocument();
  });

  it('toggles mobile sidebar drawer when menu button is clicked', () => {
    render(
      <AppLayout>
        <div data-testid="layout-child">Content</div>
      </AppLayout>
    );

    const menuBtn = screen.getByLabelText('Open navigation drawer');
    fireEvent.click(menuBtn);

    // Sidebar should have mobile-open class and backdrop should appear
    const sidebar = document.querySelector('.app-workspace-sidebar');
    expect(sidebar).toHaveClass('mobile-open');

    const backdrop = document.querySelector('.sidebar-overlay');
    expect(backdrop).toBeInTheDocument();

    // Clicking backdrop should close drawer
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(sidebar).not.toHaveClass('mobile-open');
    }
  });
});
