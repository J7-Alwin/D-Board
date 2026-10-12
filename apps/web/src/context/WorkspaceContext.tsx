import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  workspacesApi,
  type WorkspaceSummary,
  type WorkspaceRole,
  type CreateWorkspaceInput,
} from '../api/workspaces.api';
import { setActiveWorkspaceHeader } from '../api/client';

const ACTIVE_WS_STORAGE_KEY = 'dboard_active_workspace_id';

interface WorkspaceContextType {
  workspaces: {
    owned: WorkspaceSummary[];
    joined: WorkspaceSummary[];
  };
  activeWorkspace: WorkspaceSummary | null;
  activeRole: WorkspaceRole | null;
  isLoading: boolean;
  error: string | null;
  setActiveWorkspaceId: (id: string) => void;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<WorkspaceSummary>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<{ owned: WorkspaceSummary[]; joined: WorkspaceSummary[] }>({
    owned: [],
    joined: [],
  });
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_WS_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const allWorkspaces = useMemo(() => {
    return [...workspaces.owned, ...workspaces.joined];
  }, [workspaces]);

  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return allWorkspaces.find((w) => w.id === activeWorkspaceId) || null;
  }, [activeWorkspaceId, allWorkspaces]);

  const activeRole = useMemo(() => {
    return activeWorkspace ? activeWorkspace.userRole : null;
  }, [activeWorkspace]);

  const refreshWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces({ owned: [], joined: [] });
      setActiveWorkspaceIdState(null);
      setActiveWorkspaceHeader(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await workspacesApi.getWorkspaces();
      if (res.success && res.data) {
        const owned = res.data.owned || [];
        const joined = res.data.joined || [];
        setWorkspaces({ owned, joined });

        const available = [...owned, ...joined];

        // Resolve active workspace:
        // 1. Check current activeWorkspaceId from storage hint
        let resolvedId: string | null = null;
        try {
          resolvedId = localStorage.getItem(ACTIVE_WS_STORAGE_KEY);
        } catch {
          resolvedId = null;
        }

        const validSelection = resolvedId && available.some((w) => w.id === resolvedId);
        if (validSelection) {
          setActiveWorkspaceIdState(resolvedId);
          setActiveWorkspaceHeader(resolvedId);
        } else {
          // Fallback: personal workspace, or first owned workspace, or first joined
          const personal = owned.find((w) => w.isPersonal);
          const fallback = personal || owned[0] || joined[0];
          if (fallback) {
            setActiveWorkspaceIdState(fallback.id);
            setActiveWorkspaceHeader(fallback.id);
            try {
              localStorage.setItem(ACTIVE_WS_STORAGE_KEY, fallback.id);
            } catch {
              // Ignore storage errors
            }
          } else {
            setActiveWorkspaceIdState(null);
            setActiveWorkspaceHeader(null);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces, user?.id]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      const target = allWorkspaces.find((w) => w.id === id);
      if (!target) {
        console.warn(`Attempted to switch to unauthorized or non-existent workspace: ${id}`);
        return;
      }
      setActiveWorkspaceIdState(id);
      setActiveWorkspaceHeader(id);
      try {
        localStorage.setItem(ACTIVE_WS_STORAGE_KEY, id);
      } catch {
        // Ignore storage errors
      }
    },
    [allWorkspaces]
  );

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput): Promise<WorkspaceSummary> => {
      const res = await workspacesApi.createWorkspace(input);
      const created = (res.data as any)?.workspace || res.data;
      if (!res.success || !created) {
        throw new Error(res.message || 'Failed to create workspace');
      }

      await refreshWorkspaces();
      setActiveWorkspaceId(created.id);
      return created;
    },
    [refreshWorkspaces, setActiveWorkspaceId]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeRole,
        isLoading,
        error,
        setActiveWorkspaceId,
        createWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

const defaultWorkspaceContext: WorkspaceContextType = {
  workspaces: {
    owned: [
      {
        id: 'ws-default',
        name: 'Default Workspace',
        slug: 'default-ws',
        avatarUrl: null,
        ownerId: 'user-default',
        isPersonal: true,
        isOwner: true,
        userRole: 'OWNER',
        memberCount: 1,
        projectCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: { id: 'user-default', fullName: 'User', username: 'user', avatarUrl: null },
      },
    ],
    joined: [],
  },
  activeWorkspace: {
    id: 'ws-default',
    name: 'Default Workspace',
    slug: 'default-ws',
    avatarUrl: null,
    ownerId: 'user-default',
    isPersonal: true,
    isOwner: true,
    userRole: 'OWNER',
    memberCount: 1,
    projectCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { id: 'user-default', fullName: 'User', username: 'user', avatarUrl: null },
  },
  activeRole: 'OWNER',
  isLoading: false,
  error: null,
  setActiveWorkspaceId: () => {},
  createWorkspace: async () => ({
    id: 'ws-created',
    name: 'Created WS',
    slug: 'created-ws',
    avatarUrl: null,
    ownerId: 'user-default',
    isPersonal: false,
    isOwner: true,
    userRole: 'OWNER',
    memberCount: 1,
    projectCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { id: 'user-default', fullName: 'User', username: 'user', avatarUrl: null },
  }),
  refreshWorkspaces: async () => {},
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  return context || defaultWorkspaceContext;
};
