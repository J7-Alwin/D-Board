import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { projectsApi, type Project } from '../../api/projects.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { ProjectOverviewPage } from './ProjectOverviewPage';
import { ProjectBoardPage } from './ProjectBoardPage';
import { ProjectActivityPage } from './ProjectActivityPage';
import { ProjectMembersPage } from './ProjectMembersPage';
import { CalendarPage } from './CalendarPage';
import { NotesPage } from './NotesPage';
import { FilesPage } from './FilesPage';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { ProjectSettingsModal } from '../../components/workspace/ProjectSettingsModal';
import { AlertCircleIcon } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';

export const ProjectWorkspaceShell: React.FC = () => {
  const { path, navigate } = useRouter();

  // Extract projectId from path e.g. /app/projects/:projectId/...
  const pathParts = path.split('/');
  const projectId = pathParts[3];

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createWorkModalOpen, setCreateWorkModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Determine current active tab from the URL path
  const currentTab = useMemo(() => {
    if (path.includes('/board')) return 'board';
    if (path.includes('/activity') || path.includes('/list')) return 'list';
    if (path.includes('/members') || path.includes('/team')) return 'members';
    if (path.includes('/calendar')) return 'calendar';
    if (path.includes('/notes')) return 'notes';
    if (path.includes('/files')) return 'files';
    return 'overview';
  }, [path]);

  // Fetch project once and keep it cached so it never flickers on tab switches
  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const res = await projectsApi.getProjectById(projectId);
      if (res.success && res.data.project) {
        setProject(res.data.project);
      } else {
        setError('Project not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (loading && !project) {
    return (
      <div className="workspace-loading-state" style={{ minHeight: '60vh' }}>
        <div className="btn-spinner" />
        <p>Loading project workspace...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="workspace-error-state" style={{ minHeight: '60vh' }}>
        <AlertCircleIcon size={36} />
        <h2>Unable to load project</h2>
        <p>{error || 'Project not found or you do not have permission to view it.'}</p>
        <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="project-workspace-page">
      {/* 
        PERSISTENT TOP SECTION (shown for tabs other than overview):
        For board, list, members, calendar, notes, files tabs.
      */}
      {currentTab !== 'overview' && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab={currentTab}
          showHeroCard={true}
          onOpenCreateWorkModal={() => setCreateWorkModalOpen(true)}
          onOpenSettingsModal={() => setSettingsModalOpen(true)}
        />
      )}

      {/* 
        CONTENT PANE:
        On overview tab, ProjectOverviewPage renders the complete 2-column layout matching the reference image.
        On other tabs, the respective tab page is displayed cleanly.
      */}
      <div className={currentTab === 'overview' ? 'project-workspace-overview-pane' : 'project-workspace-content-pane'}>
        {currentTab === 'overview' && (
          <ProjectOverviewPage
            project={project}
            hideHeader={false}
            onOpenSettingsModal={() => setSettingsModalOpen(true)}
            onOpenCreateWorkModal={() => setCreateWorkModalOpen(true)}
          />
        )}
        {currentTab === 'board' && (
          <ProjectBoardPage project={project} hideHeader={true} />
        )}
        {currentTab === 'list' && (
          <ProjectActivityPage project={project} hideHeader={true} />
        )}
        {currentTab === 'members' && (
          <ProjectMembersPage project={project} hideHeader={true} />
        )}
        {currentTab === 'calendar' && (
          <CalendarPage project={project} hideHeader={true} />
        )}
        {currentTab === 'notes' && (
          <NotesPage project={project} hideHeader={true} />
        )}
        {currentTab === 'files' && (
          <FilesPage project={project} hideHeader={true} />
        )}
      </div>

      {/* Global Workspace Create Work Item Modal */}
      {createWorkModalOpen && (
        <CreateWorkItemModal
          project={project}
          isOpen={createWorkModalOpen}
          onClose={() => setCreateWorkModalOpen(false)}
          onCreated={() => {
            setCreateWorkModalOpen(false);
          }}
        />
      )}

      {/* Global Workspace Project Settings Modal */}
      {settingsModalOpen && (
        <ProjectSettingsModal
          project={project}
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          onUpdated={(updated) => {
            setProject(updated);
          }}
          onDeleted={() => {
            navigate('/app/dashboard');
          }}
        />
      )}
    </div>
  );
};
export default ProjectWorkspaceShell;
