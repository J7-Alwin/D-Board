import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
