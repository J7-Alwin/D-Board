import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActivityPage } from '../pages/app/ActivityPage';

// Mock Router
vi.mock('../router/Router', () => ({
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className} data-testid="project-link">
      {children}
    </a>
  ),
  useRouter: () => ({
    path: '/app/activity',
    navigate: vi.fn(),
  }),
}));

// Mock APIs
vi.mock('../api/activity.api', () => ({
  activityApi: {
    getGlobalActivities: vi.fn().mockResolvedValue({
      success: true,
      data: {
        activities: [],
        total: 0,
        limit: 100,
        offset: 0,
      },
    }),
  },
}));

vi.mock('../api/projects.api', () => ({
  projectsApi: {
    getUserProjects: vi.fn().mockResolvedValue({
      success: true,
      data: {
        all: [
          { id: 'proj-yiwu-desk', name: 'Yiwu-Desk', key: 'YIWU' },
          { id: 'proj-alwin', name: 'Alwin', key: 'ALW' },
        ],
        owned: [],
        joined: [],
      },
    }),
  },
}));

describe('ActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders top header with exact atmosphere quote and subtitle', async () => {
    render(<ActivityPage />);

    expect(screen.getByText('Workspace Activity')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Real-time chronological stream of events across all projects you collaborate on.'
      )
    ).toBeInTheDocument();

    // Atmosphere quote matching image
    expect(screen.getByText(/Small updates today/i)).toBeInTheDocument();
    expect(screen.getByText(/bigger milestones tomorrow/i)).toBeInTheDocument();
  });

  it('renders search input on left in single unified toolbar line', async () => {
    render(<ActivityPage />);

    const searchInput = screen.getByPlaceholderText('Search activity...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput.closest('.wap-search-pill-box')).toBeInTheDocument();
  });

  it('renders project divisions with project cards and timeline events', async () => {
    render(<ActivityPage />);

    // Wait for demo/fallback activities to appear
    await waitFor(() => {
      expect(screen.getByText('Yiwu-Desk')).toBeInTheDocument();
      expect(screen.getAllByText('Alwin').length).toBeGreaterThan(0);
    });

    // Check project activity items
    expect(screen.getAllByText(/changed status of/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/completed task/i)).toBeInTheDocument();
    expect(screen.getByText(/added a comment on/i)).toBeInTheDocument();
    expect(screen.getByText(/uploaded file/i)).toBeInTheDocument();
  });

  it('filters activities when a specific project is selected and clears with cross', async () => {
    render(<ActivityPage />);

    await waitFor(() => {
      expect(screen.getByText('Yiwu-Desk')).toBeInTheDocument();
    });

    // Open project filter dropdown
    const filterBtn = screen.getByRole('button', { name: /filter by project/i });
    fireEvent.click(filterBtn);

    // Select "Yiwu-Desk" in the dropdown menu
    const dropdownOptions = document.querySelectorAll('.wap-project-dropdown-item');
    const yiwuOption = Array.from(dropdownOptions).find((el) =>
      el.textContent?.includes('Yiwu-Desk')
    );
    expect(yiwuOption).toBeDefined();
    fireEvent.click(yiwuOption!);

    // Now only Yiwu-Desk should be shown in project cards
    await waitFor(() => {
      const projectCardTitles = Array.from(
        document.querySelectorAll('.wap-project-card-title')
      ).map((el) => el.textContent?.trim());
      expect(projectCardTitles).toContain('Yiwu-Desk');
      expect(projectCardTitles).not.toContain('Alwin');
    });

    // Clear filter via the clear cross button
    const clearCross = document.querySelector('.wap-project-filter-clear-cross');
    expect(clearCross).toBeDefined();
    fireEvent.click(clearCross!);

    // Both should be visible again
    await waitFor(() => {
      const projectCardTitles = Array.from(
        document.querySelectorAll('.wap-project-card-title')
      ).map((el) => el.textContent?.trim());
      expect(projectCardTitles).toContain('Yiwu-Desk');
      expect(projectCardTitles).toContain('Alwin');
    });
  });

  it('allows collapsing and expanding project cards', async () => {
    render(<ActivityPage />);

    await waitFor(() => {
      expect(screen.getByText('Yiwu-Desk')).toBeInTheDocument();
    });

    // Find collapse buttons
    const collapseButtons = screen.getAllByTitle(/collapse project/i);
    expect(collapseButtons.length).toBeGreaterThan(0);

    // Collapse first project card
    fireEvent.click(collapseButtons[0]);

    // Button title changes to expand
    expect(screen.getAllByTitle(/expand project/i).length).toBeGreaterThan(0);
  });
});
