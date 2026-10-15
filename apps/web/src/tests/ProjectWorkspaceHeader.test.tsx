import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectWorkspaceHeader } from '../components/workspace/ProjectWorkspaceHeader';
import type { Project } from '../api/projects.api';

describe('ProjectWorkspaceHeader Component Tests', () => {
  const mockProject: Project = {
    id: 'test-proj-1',
    name: 'Alpha Workspace',
    key: 'ALPHA',
    description: 'A test collaboration workspace for engineering teams.',
    category: 'ENGINEERING',
    technologyStack: ['TypeScript', 'React'],
    startDate: null,
    endDate: null,
    repositoryUrl: null,
    liveUrl: null,
    avatarUrl: null,
    status: 'ACTIVE',
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userRole: 'PROJECT_ADMIN',
  };

  it('should render project title, description, and ACTIVE status badge', () => {
    render(
      <ProjectWorkspaceHeader
        project={mockProject}
        currentTab="overview"
      />
    );

    expect(screen.getByText('Alpha Workspace')).toBeInTheDocument();
    expect(
      screen.getByText('A test collaboration workspace for engineering teams.')
    ).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should render ARCHIVED badge when project is archived', () => {
    const archivedProject: Project = {
      ...mockProject,
      status: 'ARCHIVED',
    };

    render(
      <ProjectWorkspaceHeader
        project={archivedProject}
        currentTab="overview"
      />
    );

    expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
  });

  it('should render Workspace visibility badge when visibility is WORKSPACE', () => {
    const wsProject: Project = {
      ...mockProject,
      visibility: 'WORKSPACE',
    };

    render(
      <ProjectWorkspaceHeader
        project={wsProject}
        currentTab="overview"
      />
    );

    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('should render Restricted visibility badge when visibility is RESTRICTED', () => {
    const restrictedProject: Project = {
      ...mockProject,
      visibility: 'RESTRICTED',
    };

    render(
      <ProjectWorkspaceHeader
        project={restrictedProject}
        currentTab="overview"
      />
    );

    expect(screen.getByText('Restricted')).toBeInTheDocument();
  });

  it('should render parent workspace name when project.workspace is present', () => {
    const projectWithWs: Project = {
      ...mockProject,
      workspace: {
        id: 'ws-team-1',
        name: 'Design Engineering Team',
        type: 'TEAM',
      },
    };

    render(
      <ProjectWorkspaceHeader
        project={projectWithWs}
        currentTab="overview"
      />
    );

    expect(screen.getByText('Design Engineering Team')).toBeInTheDocument();
  });

  it('should gate admin menu items for non-admin members', async () => {
    const memberProject: Project = {
      ...mockProject,
      userRole: 'PROJECT_MEMBER',
    };

    render(
      <ProjectWorkspaceHeader
        project={memberProject}
        currentTab="overview"
        onOpenSettingsModal={vi.fn()}
        onOpenInviteModal={vi.fn()}
        onOpenTransferModal={vi.fn()}
      />
    );

    // Click "••• More" menu
    const moreBtn = screen.getByRole('button', { name: /more project options/i });
    fireEvent.click(moreBtn);

    // Member should NOT see Project Settings, Invite Members, or Transfer Project
    expect(screen.queryByText('Project Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite Members')).not.toBeInTheDocument();
    expect(screen.queryByText('Transfer Project')).not.toBeInTheDocument();
    // But can still see Team Members
    expect(screen.getByText('Team Members')).toBeInTheDocument();
  });

  it('should display admin menu items for project admin and close on Escape key', async () => {
    render(
      <ProjectWorkspaceHeader
        project={mockProject}
        currentTab="overview"
        onOpenSettingsModal={vi.fn()}
        onOpenInviteModal={vi.fn()}
        onOpenTransferModal={vi.fn()}
      />
    );

    const moreBtn = screen.getByRole('button', { name: /more project options/i });
    fireEvent.click(moreBtn);

    expect(screen.getByText('Project Settings')).toBeInTheDocument();
    expect(screen.getByText('Invite Members')).toBeInTheDocument();
    expect(screen.getByText('Transfer Project')).toBeInTheDocument();

    // Press Escape to dismiss menu
    fireEvent.keyDown(window, { key: 'Escape' });

    // Menu should be closed
    expect(screen.queryByText('Project Settings')).not.toBeInTheDocument();
  });
});
