import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, Link } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi } from '../../api/projects.api';
import { workspacesApi, type WorkspaceMemberItem } from '../../api/workspaces.api';
import { Button } from '../../components/ui/Button';
import { CreateProjectHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  UsersIcon,
  FileTextIcon,
  LayersIcon,
  CalendarIcon,
  EditIcon,
  FolderPlusIcon,
  GlobeIcon,
  LockIcon,
  SearchIcon,
} from '../../components/ui/Icons';

export interface ProjectParticipant {
  userId: string;
  email: string;
  name: string;
  workspaceRole: string;
  projectRole: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  isAutoIncluded: boolean;
  isLocked: boolean;
  message?: string;
}


const CATEGORY_OPTIONS = [
  { value: 'Web Application', label: 'Web Application', icon: '🌐', desc: 'SaaS, SPA, dashboards & web portals' },
  { value: 'Mobile App', label: 'Mobile App', icon: '📱', desc: 'iOS, Android & cross-platform apps' },
  { value: 'Backend & API', label: 'Backend & API', icon: '⚙️', desc: 'Microservices, REST & GraphQL APIs' },
  { value: 'Cloud Infrastructure', label: 'Cloud Infrastructure', icon: '☁️', desc: 'DevOps, CI/CD, IaC & Kubernetes' },
  { value: 'Data Science & AI', label: 'Data Science & AI', icon: '🤖', desc: 'ML models, analytics & AI workflows' },
  { value: 'Tooling & Library', label: 'Tooling & Library', icon: '📦', desc: 'SDKs, CLI tools, npm packages & components' },
  { value: 'Product & Design', label: 'Product & Design', icon: '🎨', desc: 'Design systems, prototyping & UI kits' },
  { value: 'Other', label: 'Other', icon: '📁', desc: 'General project workspace domain' },
];

const PRESET_LOGOS = ['⚡', '🚀', '💎', '🛡️', '🌐', '🔥', '👾', '📦', '🎨', '💡'];

const ALL_AVAILABLE_TECH = [
  'React',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'PostgreSQL',
  'MongoDB',
  'Python',
  'Rust',
  'Go',
  'GraphQL',
  'Docker',
  'Next.js',
  'TailwindCSS',
  'Prisma',
  'Redis',
  'AWS',
  'Vue.js',
];

export const CreateProjectPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { activeWorkspace, activeRole } = useWorkspace();

  const canCreateProject = useMemo(() => {
    if (!activeWorkspace) return true;
    if (activeWorkspace.isPersonal) return true;
    if (activeRole === 'OWNER' || activeWorkspace.isOwner) return true;
    const perms = activeWorkspace.adminPermissions;
    if (activeRole === 'WORKSPACE_ADMIN') {
      return perms?.workspaceAdmin?.canCreateProjects ?? perms?.canCreateProjects ?? true;
    }
    if (activeRole === 'PROJECT_ADMIN') {
      return perms?.projectAdmin?.canCreateProjects ?? false;
    }
    if (activeRole === 'WORKSPACE_MEMBER') {
      return perms?.workspaceMember?.canCreateProjects ?? false;
    }
    return false;
  }, [activeWorkspace, activeRole]);

  useEffect(() => {
    if (activeWorkspace && !canCreateProject) {
      navigate('/app/projects');
    }
  }, [activeWorkspace, canCreateProject, navigate]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [visibility, setVisibility] = useState<'WORKSPACE' | 'RESTRICTED'>('WORKSPACE');

  // Helper for color-coding tech badges in review matching screenshot
  const getTechBadgeStyle = (tech: string) => {
    const t = tech.toLowerCase();
    if (t.includes('react') || t.includes('typescript') || t.includes('postgres') || t.includes('python') || t.includes('go')) {
      return { backgroundColor: '#E0F2FE', color: '#0284C7' };
    }
    if (t.includes('node') || t.includes('vue') || t.includes('mongo') || t.includes('spring')) {
      return { backgroundColor: '#DCFCE7', color: '#16A34A' };
    }
    if (t.includes('docker') || t.includes('graphql') || t.includes('prisma') || t.includes('redis') || t.includes('rust')) {
      return { backgroundColor: '#F3E8FF', color: '#9333EA' };
    }
    if (t.includes('aws') || t.includes('cloud') || t.includes('firebase')) {
      return { backgroundColor: '#FEF3C7', color: '#D97706' };
    }
    return { backgroundColor: '#F1F5F9', color: '#334155' };
  };

  // Step 1: Project Info state (clean initial states)
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Web Application');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [showAddTechDropdown, setShowAddTechDropdown] = useState(false);
  const [customTechInput, setCustomTechInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Step 2: Team & Workspace Members
  const [wsMembers, setWsMembers] = useState<WorkspaceMemberItem[]>([]);
  const [loadingWsMembers, setLoadingWsMembers] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<Map<string, ProjectParticipant>>(new Map());
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Form & submission state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ title: string; message: string } | null>(null);

  // Project fallback monogram
  const projectMonogram = useMemo(() => {
    if (name.trim()) {
      return name.trim()[0].toUpperCase();
    }
    return 'P';
  }, [name]);

  // Helper to check if avatar is emoji preset
  const isEmojiOrPreset = (url: string) => Boolean(url && url.length <= 4);

  // Logo upload & preset selection handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, logo: 'Logo file size should be less than 2.5MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        if (errors.logo) {
          setErrors((prev) => ({ ...prev, logo: '' }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setAvatarUrl('');
  };

  const handlePresetLogoSelect = (emoji: string) => {
    setAvatarUrl(emoji);
  };

  // Smart Key auto-generation from project name
  const handleNameChange = (val: string) => {
    setName(val);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: '' }));
    }
    if (!key && val.trim().length >= 2) {
      const words = val.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        setKey(words[0].slice(0, 3).toUpperCase());
      } else {
        const generated = words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
        setKey(generated);
      }
    }
  };

  // Tech stack removal and addition
  const handleRemoveTech = (techToRemove: string) => {
    setTechStack(techStack.filter((t) => t !== techToRemove));
  };

  const handleAddTech = (techToAdd: string) => {
    if (!techStack.includes(techToAdd)) {
      setTechStack([...techStack, techToAdd]);
    }
    setShowAddTechDropdown(false);
    setCustomTechInput('');
  };

  const handleAddCustomTech = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!customTechInput.trim()) return;
    handleAddTech(customTechInput.trim());
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'Project name is required';
    } else if (name.trim().length < 2) {
      errs.name = 'Project name must be at least 2 characters';
    } else if (name.trim().length > 100) {
      errs.name = 'Project name cannot exceed 100 characters';
    }

    if (!description.trim()) {
      errs.description = 'Project description is required';
    } else if (description.trim().length < 5) {
      errs.description = 'Project description must be at least 5 characters';
    } else if (description.trim().length > 1000) {
      errs.description = 'Project description cannot exceed 1000 characters';
    }

    if (key.trim() && !/^[A-Z0-9_-]{2,10}$/i.test(key.trim())) {
      errs.key = 'Project key must be 2-10 alphanumeric characters';
    }

    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        errs.date = 'Start date cannot be later than end date';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Load active workspace members and set default participants
  useEffect(() => {
    if (!activeWorkspace?.id) return;

    let mounted = true;
    setLoadingWsMembers(true);

    workspacesApi
      .getMembers(activeWorkspace.id, { limit: 100 })
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.data?.members) {
          const activeList = res.data.members.filter((m) => !m.user.isDeactivated);
          setWsMembers(activeList);

          const perms = activeWorkspace.adminPermissions;
          const autoIncludeAdmins =
            perms?.autoIncludeAdminsInNewProjects === true ||
            perms?.workspaceAdmin?.autoIncludeAdminsInNewProjects === true;

          const defaultMap = new Map<string, ProjectParticipant>();

          for (const m of activeList) {
            const isOwner = m.role === 'OWNER' || m.userId === activeWorkspace.ownerId;
            const isCreator = Boolean(user?.id && m.userId === user.id);
            const isWsAdmin = m.role === 'WORKSPACE_ADMIN';
            const name = m.user.fullName || m.user.username;

            if (isOwner) {
              defaultMap.set(m.userId, {
                userId: m.userId,
                email: m.user.email,
                name,
                workspaceRole: 'OWNER',
                projectRole: 'PROJECT_ADMIN',
                isAutoIncluded: true,
                isLocked: true,
              });
            } else if (isCreator) {
              defaultMap.set(m.userId, {
                userId: m.userId,
                email: m.user.email,
                name,
                workspaceRole: m.role,
                projectRole: 'PROJECT_ADMIN',
                isAutoIncluded: true,
                isLocked: true,
              });
            } else if (isWsAdmin && autoIncludeAdmins) {
              defaultMap.set(m.userId, {
                userId: m.userId,
                email: m.user.email,
                name,
                workspaceRole: 'WORKSPACE_ADMIN',
                projectRole: 'PROJECT_ADMIN',
                isAutoIncluded: true,
                isLocked: false,
              });
            }
          }

          setSelectedParticipants(defaultMap);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingWsMembers(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeWorkspace?.id, activeWorkspace?.ownerId, activeWorkspace?.adminPermissions, user?.id]);

  // Group and sort active workspace members:
  // 1. Workspace Owner
  // 2. Workspace Admins
  // 3. Workspace Members
  // Alphabetical within each group
  const groupedWorkspaceMembers = useMemo(() => {
    const owners: WorkspaceMemberItem[] = [];
    const admins: WorkspaceMemberItem[] = [];
    const members: WorkspaceMemberItem[] = [];

    const query = memberSearchQuery.trim().toLowerCase();

    for (const m of wsMembers) {
      const name = (m.user.fullName || '').toLowerCase();
      const username = (m.user.username || '').toLowerCase();
      const email = (m.user.email || '').toLowerCase();

      if (query && !name.includes(query) && !username.includes(query) && !email.includes(query)) {
        continue;
      }

      if (m.role === 'OWNER' || m.userId === activeWorkspace?.ownerId) {
        owners.push(m);
      } else if (m.role === 'WORKSPACE_ADMIN') {
        admins.push(m);
      } else {
        members.push(m);
      }
    }

    const sortFn = (a: WorkspaceMemberItem, b: WorkspaceMemberItem) => {
      const nameA = (a.user.fullName || a.user.username).toLowerCase();
      const nameB = (b.user.fullName || b.user.username).toLowerCase();
      return nameA.localeCompare(nameB);
    };

    owners.sort(sortFn);
    admins.sort(sortFn);
    members.sort(sortFn);

    return [
      { title: 'Workspace Owner', items: owners },
      { title: 'Workspace Admins', items: admins },
      { title: 'Workspace Members', items: members },
    ].filter((g) => g.items.length > 0);
  }, [wsMembers, activeWorkspace?.ownerId, memberSearchQuery]);

  const toggleSelectParticipant = (wm: WorkspaceMemberItem) => {
    const existing = selectedParticipants.get(wm.userId);
    if (existing?.isLocked) return;

    setSelectedParticipants((prev) => {
      const next = new Map(prev);
      if (next.has(wm.userId)) {
        next.delete(wm.userId);
      } else {
        const isProjectAdmin = wm.role === 'WORKSPACE_ADMIN' || wm.role === 'PROJECT_ADMIN';
        next.set(wm.userId, {
          userId: wm.userId,
          email: wm.user.email,
          name: wm.user.fullName || wm.user.username,
          workspaceRole: wm.role,
          projectRole: isProjectAdmin ? 'PROJECT_ADMIN' : 'PROJECT_MEMBER',
          isAutoIncluded: false,
          isLocked: false,
        });
      }
      return next;
    });
  };

  const handleUpdateParticipantRole = (userId: string, newRole: 'PROJECT_ADMIN' | 'PROJECT_MEMBER') => {
    setSelectedParticipants((prev) => {
      const next = new Map(prev);
      const cur = next.get(userId);
      if (cur) {
        next.set(userId, { ...cur, projectRole: newRole });
      }
      return next;
    });
  };

  const handleUpdateParticipantNote = (userId: string, note: string) => {
    setSelectedParticipants((prev) => {
      const next = new Map(prev);
      const cur = next.get(userId);
      if (cur) {
        next.set(userId, { ...cur, message: note });
      }
      return next;
    });
  };

  // Navigation between steps
  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
    }
  };

  // Helper to format repo url
  const normalizeRepoUrl = (repo: string) => {
    const trimmed = repo.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      return `https://github.com/${trimmed}`;
    }
    return trimmed;
  };

  // Final submission & project creation
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setGeneralError(null);

    const finalRepo = normalizeRepoUrl(repositoryUrl);

    try {
      const res = await projectsApi.createProject({
        name: name.trim(),
        key: key.trim() ? key.trim().toUpperCase() : null,
        description: description.trim(),
        category: category || null,
        technologyStack: techStack,
        startDate: startDate || null,
        endDate: endDate || null,
        repositoryUrl: finalRepo || null,
        liveUrl: liveUrl.trim() || null,
        avatarUrl: avatarUrl || null,
        visibility: activeWorkspace?.isPersonal ? 'RESTRICTED' : visibility,
        workspaceId: activeWorkspace?.id,
        invitations: Array.from(selectedParticipants.values())
          .filter((p) => p.userId !== user?.id && p.userId !== activeWorkspace?.ownerId)
          .map((p) => ({
            email: p.email,
            role: p.projectRole,
            message: p.message || null,
          })),
      }, activeWorkspace?.id);

      if (res.success && res.data?.project?.id) {
        setToastMessage({
          title: 'Project Initialized! 🎉',
          message: `Workspace "${res.data.project.name}" is live and ready.`,
        });

        setTimeout(() => {
          navigate(`/app/projects/${res.data.project.id}`);
        }, 1000);
      } else {
        navigate('/app/dashboard');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to create project. Please check the fields and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date display for Preview card
  const formattedDatesPreview = useMemo(() => {
    if (!startDate && !endDate) return 'Ongoing';
    const startStr = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const endStr = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    if (startStr && endStr) return `${startStr}  →  ${endStr}`;
    if (startStr) return `From ${startStr}`;
    return `Due ${endStr}`;
  }, [startDate, endDate]);

  // Format today's date for header badge (matching My Work)
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);



  return (
    <div className="create-project-pixel-root">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="project-created-toast-banner animate-slide-down">
          <div className="toast-icon-wrap">🔔</div>
          <div className="toast-content">
            <span className="toast-title">{toastMessage.title}</span>
            <span className="toast-msg">{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Header Card Container (Matching My Work UI/UX) */}
      <div className="cp-header-card">
        <div className="cp-header-left">
          <div className="cp-title-icon-box">
            <FolderPlusIcon size={26} />
          </div>
          <div className="cp-banner-titles">
            <div className="cp-title-row">
              <h1>Create Project</h1>
              <span className="cp-date-badge">{todayFormatted}</span>
            </div>
            <p className="cp-subtitle">
              Configure project details, collaborate with your team, and launch your workspace.
            </p>
          </div>
        </div>

        {/* Center / Atmosphere artwork matching My Work */}
        <CreateProjectHeaderAtmosphere />

        {/* Right side back to dashboard button */}
        <div className="cp-header-right">
          <Link to="/app/dashboard" className="cp-back-btn">
            <ArrowLeftIcon size={16} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Floating Stepper Bar */}
      <div className="cp-stepper-floating-card">
        <div className="cp-stepper-inner">
          {/* Step 1 */}
          <div className={`cp-step-item ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
            <div className="cp-step-circle">{step > 1 ? <CheckIcon size={12} /> : '1'}</div>
            <span className="cp-step-text">Project Info</span>
          </div>
          <div className={`cp-step-divider ${step > 1 ? 'completed' : ''}`} />

          {/* Step 2 */}
          <div className={`cp-step-item ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <div className="cp-step-circle">{step > 2 ? <CheckIcon size={12} /> : '2'}</div>
            <span className="cp-step-text">Team & Access</span>
          </div>
          <div className={`cp-step-divider ${step > 2 ? 'completed' : ''}`} />

          {/* Step 3 */}
          <div className={`cp-step-item ${step === 3 ? 'active' : ''}`}>
            <div className="cp-step-circle">3</div>
            <span className="cp-step-text">Review & Create</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Main Content on Left, Preview & Guide on Right */}
      <div className="cp-layout-columns">
        {/* Left Column: Form Card */}
        <div className="cp-main-form-card">
          {generalError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <span>{generalError}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: PROJECT DETAILS & CONFIGURATION                      */}
          {/* ============================================================ */}
          {step === 1 && (
            <div className="cp-step-view">
              <div className="cp-inputs-section">
                {/* Section Header */}
                <div className="cp-section-header-row" style={{ marginBottom: '1.25rem' }}>
                  <div>
                    <h3 className="cp-section-title">Project Details</h3>
                    <p className="cp-section-subtitle">
                      Set up your workspace name, key prefix, description, and stack.
                    </p>
                  </div>
                </div>

                {/* Optional Project Logo / Avatar Picker */}
                <div className="cp-logo-picker-card">
                  <div className="cp-logo-preview-box">
                    {avatarUrl ? (
                      isEmojiOrPreset(avatarUrl) ? (
                        <span className="cp-logo-preset-display">{avatarUrl}</span>
                      ) : (
                        <img src={avatarUrl} alt="Project Logo Preview" className="cp-logo-preview-img" />
                      )
                    ) : (
                      <div className="cp-logo-monogram-placeholder">
                        <span>{name.trim() ? projectMonogram : 'P'}</span>
                      </div>
                    )}
                  </div>

                  <div className="cp-logo-picker-details">
                    <div className="cp-logo-title-row">
                      <span className="cp-field-label">Project Logo / Icon</span>
                      <span className="cp-optional-tag">Optional</span>
                    </div>
                    <p className="cp-logo-picker-helper">
                      Upload a brand icon, logo, or mascot to personalize your project workspace. (PNG, JPG, SVG, max 2.5MB)
                    </p>

                    <div className="cp-logo-actions-row">
                      <label className="cp-logo-upload-btn">
                        <span>📁 Upload Image</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          onChange={handleLogoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {avatarUrl && (
                        <button
                          type="button"
                          className="cp-logo-remove-btn"
                          onClick={handleRemoveLogo}
                        >
                          Remove logo
                        </button>
                      )}

                      {/* Quick preset icons */}
                      <div className="cp-logo-presets-list">
                        <span className="cp-presets-label">Presets:</span>
                        {PRESET_LOGOS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className={`cp-preset-icon-btn ${avatarUrl === preset ? 'active' : ''}`}
                            onClick={() => handlePresetLogoSelect(preset)}
                            title={`Select ${preset} icon`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    {errors.logo && <span className="cp-field-error">{errors.logo}</span>}
                  </div>
                </div>

                {/* Workspace Destination Indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: '#3B82F6',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}>
                      {activeWorkspace ? activeWorkspace.name.slice(0, 2).toUpperCase() : 'WS'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>
                        Creating in: {activeWorkspace?.name || 'Workspace'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {activeWorkspace?.isPersonal ? 'Personal Workspace' : 'Team Workspace'} • {activeWorkspace?.isPersonal ? 'Restricted to owner' : 'Collaborative workspace'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Visibility Selector */}
                <div className="cp-field-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="cp-field-label">
                    Project Visibility <span className="cp-req">*</span>
                  </label>
                  {activeWorkspace?.isPersonal ? (
                    <div style={{
                      padding: '0.625rem 0.875rem',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <LockIcon size={14} />
                      <span>Restricted (Projects in personal workspaces are restricted to the owner)</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setVisibility('WORKSPACE')}
                        style={{
                          flex: '1 1 200px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.625rem',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: visibility === 'WORKSPACE' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                          backgroundColor: visibility === 'WORKSPACE' ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <GlobeIcon size={18} style={{ color: visibility === 'WORKSPACE' ? '#2563EB' : '#64748B', marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>Workspace</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                            Visible to all members of this workspace.
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVisibility('RESTRICTED')}
                        style={{
                          flex: '1 1 200px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.625rem',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: visibility === 'RESTRICTED' ? '2px solid #8B5CF6' : '1px solid #E2E8F0',
                          backgroundColor: visibility === 'RESTRICTED' ? '#F5F3FF' : '#FFFFFF',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <LockIcon size={18} style={{ color: visibility === 'RESTRICTED' ? '#7C3AED' : '#64748B', marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>Restricted</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                            Accessible only to assigned project members.
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                  <span className="cp-field-helper">
                    Control whether all workspace members can view this project or only invited members.
                  </span>
                </div>

                {/* Row 1: Name & Key */}
                <div className="cp-form-row-2col">
                  <div className="cp-field-group">
                    <label className="cp-field-label">
                      Project Name <span className="cp-req">*</span>
                    </label>
                    <input
                      type="text"
                      className={`cp-text-input ${errors.name ? 'error' : ''}`}
                      placeholder="e.g. Phoenix Web App, Customer Portal"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                    <span className="cp-field-helper">The public display name for your project workspace</span>
                    {errors.name && <span className="cp-field-error">{errors.name}</span>}
                  </div>

                  <div className="cp-field-group">
                    <label className="cp-field-label">
                      Project Key (Prefix) <span className="cp-req">*</span>
                    </label>
                    <input
                      type="text"
                      className={`cp-text-input ${errors.key ? 'error' : ''}`}
                      placeholder="e.g. PHX"
                      value={key}
                      onChange={(e) => {
                        setKey(e.target.value.toUpperCase());
                        if (errors.key) setErrors((prev) => ({ ...prev, key: '' }));
                      }}
                    />
                    <span className="cp-field-helper">2–10 uppercase letters, prefixes task IDs (e.g. {key || 'PHX'}-101)</span>
                    {errors.key && <span className="cp-field-error">{errors.key}</span>}
                  </div>
                </div>

                {/* Row 2: Description with Char Counter */}
                <div className="cp-field-group">
                  <label className="cp-field-label">
                    Description <span className="cp-req">*</span>
                  </label>
                  <div className="cp-textarea-wrap">
                    <textarea
                      className={`cp-textarea ${errors.description ? 'error' : ''}`}
                      rows={3}
                      placeholder="Provide a clear description of the project deliverables, architecture, and milestones..."
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
                      }}
                    />
                    <span className="cp-char-counter">{description.length}/500</span>
                  </div>
                  <span className="cp-field-helper">A concise overview helping collaborators understand project scope</span>
                  {errors.description && <span className="cp-field-error">{errors.description}</span>}
                </div>

                {/* Row 3: Category & Tech Stack */}
                <div className="cp-form-row-2col">
                  <div className="cp-field-group">
                    <label className="cp-field-label">
                      Category / Domain <span className="cp-req">*</span>
                    </label>
                    {/* Custom Dropdown with Icons */}
                    <div className="cp-custom-dropdown-wrap">
                      <button
                        type="button"
                        className="cp-custom-dropdown-trigger"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      >
                        <span className="cp-cdd-left">
                          <span className="cp-cdd-icon">
                            {CATEGORY_OPTIONS.find((c) => c.value === category)?.icon || '🌐'}
                          </span>
                          <span className="cp-cdd-label">{category}</span>
                        </span>
                        <span className="cp-cdd-arrow">{isCategoryDropdownOpen ? '▴' : '▾'}</span>
                      </button>

                      {isCategoryDropdownOpen && (
                        <div className="cp-custom-dropdown-menu">
                          {CATEGORY_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`cp-cdd-item ${opt.value === category ? 'selected' : ''}`}
                              onClick={() => {
                                setCategory(opt.value);
                                setIsCategoryDropdownOpen(false);
                              }}
                            >
                              <span className="cp-cdd-item-icon">{opt.icon}</span>
                              <div className="cp-cdd-item-text">
                                <span className="cp-cdd-item-title">{opt.label}</span>
                                <span className="cp-cdd-item-desc">{opt.desc}</span>
                              </div>
                              {opt.value === category && <span className="cp-cdd-check">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="cp-field-helper">Primary industry or functional domain</span>
                  </div>

                  <div className="cp-field-group">
                    <label className="cp-field-label">Technology Stack</label>
                    <div className="cp-tech-chips-input-container">
                      <div className="cp-tech-chips-list">
                        {techStack.map((tech) => (
                          <span key={tech} className="cp-tech-removable-chip">
                            {tech}
                            <button
                              type="button"
                              className="cp-chip-remove-x"
                              onClick={() => handleRemoveTech(tech)}
                              title={`Remove ${tech}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {/* Add... Dropdown button */}
                        <div className="cp-add-tech-popover-wrap">
                          <button
                            type="button"
                            className="cp-add-tech-btn"
                            onClick={() => setShowAddTechDropdown(!showAddTechDropdown)}
                          >
                            <span>+ Add tech...</span>
                            <span className="cp-add-arrow">▾</span>
                          </button>

                          {showAddTechDropdown && (
                            <div className="cp-add-tech-menu">
                              <div className="cp-tech-quick-add-input">
                                <input
                                  type="text"
                                  placeholder="Type custom tech & Enter..."
                                  value={customTechInput}
                                  onChange={(e) => setCustomTechInput(e.target.value)}
                                  onKeyDown={handleAddCustomTech}
                                  autoFocus
                                />
                              </div>
                              <div className="cp-tech-available-list">
                                {ALL_AVAILABLE_TECH.filter((t) => !techStack.includes(t)).map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    className="cp-tech-option-item"
                                    onClick={() => handleAddTech(t)}
                                  >
                                    + {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick popular suggestion pills */}
                    <div className="cp-quick-tech-suggestions">
                      <span className="cp-quick-label">Suggestions:</span>
                      {['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Next.js', 'TailwindCSS', 'Python']
                        .filter((t) => !techStack.includes(t))
                        .slice(0, 5)
                        .map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="cp-quick-tech-btn"
                            onClick={() => handleAddTech(t)}
                          >
                            + {t}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Row 4: Target Dates */}
                <div className="cp-form-row-2col">
                  <div className="cp-field-group">
                    <label className="cp-field-label">Target Start Date</label>
                    <div className="cp-input-icon-wrap">
                      <span className="cp-input-inner-icon">📅</span>
                      <input
                        type="date"
                        className="cp-text-input icon-padded"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <span className="cp-field-helper">When project sprint / execution begins</span>
                  </div>

                  <div className="cp-field-group">
                    <label className="cp-field-label">Target Delivery / End Date</label>
                    <div className="cp-input-icon-wrap">
                      <span className="cp-input-inner-icon">📅</span>
                      <input
                        type="date"
                        className="cp-text-input icon-padded"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <span className="cp-field-helper">Milestone completion or release deadline</span>
                    {errors.date && <span className="cp-field-error">{errors.date}</span>}
                  </div>
                </div>

                {/* Row 5: Repository & Live URLs */}
                <div className="cp-form-row-2col">
                  <div className="cp-field-group">
                    <label className="cp-field-label">Code Repository URL (Optional)</label>
                    <div className="cp-input-icon-wrap">
                      <span className="cp-input-inner-icon">🔗</span>
                      <input
                        type="text"
                        className="cp-text-input icon-padded"
                        placeholder="https://github.com/organization/repository"
                        value={repositoryUrl}
                        onChange={(e) => setRepositoryUrl(e.target.value)}
                      />
                    </div>
                    <span className="cp-field-helper">Link to GitHub or GitLab source repository</span>
                  </div>

                  <div className="cp-field-group">
                    <label className="cp-field-label">Live Deployment URL (Optional)</label>
                    <div className="cp-input-icon-wrap">
                      <span className="cp-input-inner-icon">🔗</span>
                      <input
                        type="text"
                        className="cp-text-input icon-padded"
                        placeholder="https://app.yourproject.com"
                        value={liveUrl}
                        onChange={(e) => setLiveUrl(e.target.value)}
                      />
                    </div>
                    <span className="cp-field-helper">Staging, preview, or production endpoint</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: TEAM & ACCESS INVITATIONS                            */}
          {/* ============================================================ */}
          {step === 2 && (
            <div className="cp-step-view">
              {/* Header with Green Icon Box */}
              <div className="cp-team-header-row">
                <div className="cp-team-header-icon-box">
                  <UsersIcon size={20} />
                </div>
                <div className="cp-team-header-titles">
                  <h3 className="cp-team-header-title">Team & Workspace Access</h3>
                  <p className="cp-team-header-subtitle">
                    Select eligible members from {activeWorkspace?.name || 'this workspace'}. Project Admins manage the project; Project Members work on tasks.
                  </p>
                </div>
              </div>

              {/* Search & Selection Summary Bar */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <SearchIcon
                    size={16}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                  />
                  <input
                    type="text"
                    placeholder="Search workspace members by name or email..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.875rem',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '0.5rem 0.85rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {selectedParticipants.size} Selected
                  </span>
                  <span style={{ color: '#94A3B8' }}>•</span>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>
                    {Array.from(selectedParticipants.values()).filter((p) => p.projectRole === 'PROJECT_ADMIN').length} Admins
                  </span>
                  <span style={{ color: '#94A3B8' }}>•</span>
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>
                    {Array.from(selectedParticipants.values()).filter((p) => p.projectRole === 'PROJECT_MEMBER').length} Members
                  </span>
                </div>
              </div>

              {/* Grouped Workspace Member Selector List */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  maxHeight: '420px',
                  overflowY: 'auto',
                }}
              >
                {loadingWsMembers ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                    <div className="btn-spinner" style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading workspace members...</p>
                  </div>
                ) : groupedWorkspaceMembers.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                    <UsersIcon size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No workspace members found matching your search.</p>
                  </div>
                ) : (
                  groupedWorkspaceMembers.map((group) => (
                    <div key={group.title}>
                      <div
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#F8FAFC',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#64748B',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        {group.title} ({group.items.length})
                      </div>

                      {group.items.map((wm) => {
                        const participant = selectedParticipants.get(wm.userId);
                        const isSelected = Boolean(participant);
                        const isLocked = participant?.isLocked ?? false;
                        const isAuto = participant?.isAutoIncluded ?? false;
                        const name = wm.user.fullName || wm.user.username;

                        return (
                          <div
                            key={wm.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '0.75rem 1rem',
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isLocked ? 'default' : 'pointer' }}
                                onClick={() => !isLocked && toggleSelectParticipant(wm)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isLocked}
                                  onChange={() => !isLocked && toggleSelectParticipant(wm)}
                                  style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}
                                />
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    backgroundColor: isSelected ? '#DCFCE7' : '#E2E8F0',
                                    color: isSelected ? '#16A34A' : '#475569',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>{name}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>@{wm.user.username}</span>
                                    {wm.userId === user?.id && (
                                      <span style={{ fontSize: '0.7rem', color: '#2563EB', fontWeight: 600 }}>(You)</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.78125rem', color: '#64748B' }}>{wm.user.email}</div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                {/* Workspace Role Badge */}
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    backgroundColor:
                                      wm.role === 'OWNER'
                                        ? '#FEF3C7'
                                        : wm.role === 'WORKSPACE_ADMIN'
                                        ? '#EFF6FF'
                                        : wm.role === 'PROJECT_ADMIN'
                                        ? '#EEF2FF'
                                        : '#F1F5F9',
                                    color:
                                      wm.role === 'OWNER'
                                        ? '#B45309'
                                        : wm.role === 'WORKSPACE_ADMIN'
                                        ? '#1D4ED8'
                                        : wm.role === 'PROJECT_ADMIN'
                                        ? '#4F46E5'
                                        : '#475569',
                                  }}
                                  title={`Workspace role: ${wm.role}`}
                                >
                                  {wm.role === 'OWNER'
                                    ? 'Workspace Owner'
                                    : wm.role === 'WORKSPACE_ADMIN'
                                    ? 'Workspace Admin'
                                    : wm.role === 'PROJECT_ADMIN'
                                    ? 'Project Admin'
                                    : 'Workspace Member'}
                                </span>

                                {/* Auto-included tag */}
                                {isAuto && (
                                  <span
                                    style={{
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '6px',
                                      backgroundColor: '#F1F5F9',
                                      color: '#475569',
                                    }}
                                  >
                                    Auto-included
                                  </span>
                                )}

                                {/* Project Role Selector if selected */}
                                {isSelected && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Project:</span>
                                    <select
                                      value={participant?.projectRole || 'PROJECT_MEMBER'}
                                      disabled={isLocked && wm.role === 'OWNER'}
                                      onChange={(e) => handleUpdateParticipantRole(wm.userId, e.target.value as any)}
                                      style={{
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '8px',
                                        border: '1px solid #CBD5E1',
                                        backgroundColor: participant?.projectRole === 'PROJECT_ADMIN' ? '#EFF6FF' : '#FFFFFF',
                                        color: participant?.projectRole === 'PROJECT_ADMIN' ? '#1D4ED8' : '#0F172A',
                                        fontWeight: 600,
                                        fontSize: '0.78125rem',
                                        cursor: isLocked && wm.role === 'OWNER' ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      <option value="PROJECT_MEMBER">Project Member</option>
                                      <option value="PROJECT_ADMIN">Project Admin</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Optional note when participant is explicitly selected and not owner */}
                            {isSelected && !isLocked && (
                              <div style={{ marginTop: '0.5rem', paddingLeft: '2.5rem' }}>
                                <input
                                  type="text"
                                  placeholder="Add an invitation note (optional)..."
                                  value={participant?.message || ''}
                                  onChange={(e) => handleUpdateParticipantNote(wm.userId, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    border: '1px solid #E2E8F0',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#FFFFFF',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: REVIEW & CONFIRMATION (MATCHING UI/UX SCREENSHOT)    */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="cp-step-view cp-review-step-container">
              {/* Header with Green Document Icon Box */}
              <div className="cp-review-header-row">
                <div className="cp-review-header-icon-box">
                  <FileTextIcon size={22} className="cp-review-header-icon" />
                </div>
                <div className="cp-review-header-titles">
                  <h3 className="cp-review-header-title">Review Project Workspace</h3>
                  <p className="cp-review-header-subtitle">
                    Confirm your configuration details below before initializing the workspace.
                  </p>
                </div>
              </div>

              {/* 2x2 Grid of Clean Review Cards */}
              <div className="cp-review-2x2-grid">
                {/* 1. Project Details Card */}
                <div className="cp-review-card">
                  <div className="cp-review-card-head">
                    <div className="cp-review-card-title-flex">
                      <FileTextIcon size={17} className="cp-review-card-icon" />
                      <h4 className="cp-review-card-title">Project Details</h4>
                    </div>
                    <button
                      type="button"
                      className="cp-review-edit-btn"
                      onClick={() => setStep(1)}
                    >
                      <EditIcon size={13} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="cp-review-card-body">
                    <div className="cp-review-proj-top">
                      <div className="cp-review-logo-sq">
                        {avatarUrl ? (
                          isEmojiOrPreset(avatarUrl) ? (
                            <span className="cp-review-preset-emoji">{avatarUrl}</span>
                          ) : (
                            <img src={avatarUrl} alt="Logo" className="cp-review-avatar-img" />
                          )
                        ) : (
                          <span className="cp-review-monogram-text">{name.trim() ? projectMonogram : 'P'}</span>
                        )}
                      </div>
                      <div className="cp-review-proj-info">
                        <h4 className="cp-review-proj-name">{name.trim() || 'Untitled Project'}</h4>
                        <span className="cp-review-proj-cat">{category || 'Web Application'}</span>
                      </div>
                    </div>

                    <div className="cp-review-card-divider" />

                    <div className="cp-review-desc-wrap">
                      <span className="cp-review-sublabel">Description</span>
                      <p className="cp-review-desc-text">
                        {description.trim() || 'No description provided.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Technology Stack Card */}
                <div className="cp-review-card">
                  <div className="cp-review-card-head">
                    <div className="cp-review-card-title-flex">
                      <LayersIcon size={17} className="cp-review-card-icon" />
                      <h4 className="cp-review-card-title">Technology Stack</h4>
                    </div>
                    <button
                      type="button"
                      className="cp-review-edit-btn"
                      onClick={() => setStep(1)}
                    >
                      <EditIcon size={13} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="cp-review-card-body">
                    <div className="cp-review-tech-wrap">
                      {techStack.length === 0 ? (
                        <span className="cp-review-empty-text">No technology stack configured</span>
                      ) : (
                        techStack.map((tech) => (
                          <span
                            key={tech}
                            className="cp-review-tech-badge"
                            style={getTechBadgeStyle(tech)}
                          >
                            {tech}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Timeline Card */}
                <div className="cp-review-card">
                  <div className="cp-review-card-head">
                    <div className="cp-review-card-title-flex">
                      <CalendarIcon size={17} className="cp-review-card-icon" />
                      <h4 className="cp-review-card-title">Timeline</h4>
                    </div>
                    <button
                      type="button"
                      className="cp-review-edit-btn"
                      onClick={() => setStep(1)}
                    >
                      <EditIcon size={13} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="cp-review-card-body">
                    <div className="cp-review-timeline-grid">
                      <div className="cp-review-tl-col">
                        <span className="cp-review-sublabel">Start Date</span>
                        <div className="cp-review-tl-val">
                          <CalendarIcon size={15} className="cp-review-cal-icon" />
                          <span>
                            {startDate
                              ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="cp-review-tl-col">
                        <span className="cp-review-sublabel">End Date</span>
                        <div className="cp-review-tl-val">
                          <CalendarIcon size={15} className="cp-review-cal-icon" />
                          <span>
                            {endDate
                              ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'Ongoing'}
                          </span>
                        </div>
                      </div>

                      <div className="cp-review-tl-col">
                        <span className="cp-review-sublabel">Status</span>
                        <div className="cp-review-tl-val status">
                          <span className="cp-review-green-dot" />
                          <span>Ongoing</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Team Members Card */}
                <div className="cp-review-card">
                  <div className="cp-review-card-head">
                    <div className="cp-review-card-title-flex">
                      <UsersIcon size={17} className="cp-review-card-icon" />
                      <h4 className="cp-review-card-title">Team Members</h4>
                    </div>
                    <button
                      type="button"
                      className="cp-review-edit-btn"
                      onClick={() => setStep(2)}
                    >
                      <EditIcon size={13} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="cp-review-card-body">
                    <div className="cp-review-members-list">
                      {Array.from(selectedParticipants.values()).map((p) => (
                        <div key={p.userId} className="cp-review-member-item">
                          <div className={`cp-review-user-avatar ${p.isAutoIncluded ? '' : 'invited'}`}>
                            {p.name.charAt(0).toLowerCase()}
                          </div>
                          <div className="cp-review-user-info">
                            <div className="cp-review-user-name-line">
                              <span className="cp-review-user-name">
                                {p.name} {p.userId === user?.id && <span className="cp-review-you-tag">(You)</span>}
                              </span>
                            </div>
                            <span className="cp-review-user-sub">
                              {p.workspaceRole === 'OWNER'
                                ? 'Workspace Owner'
                                : p.workspaceRole === 'WORKSPACE_ADMIN'
                                ? 'Workspace Admin'
                                : p.workspaceRole === 'PROJECT_ADMIN'
                                ? 'Project Admin'
                                : 'Workspace Member'}
                            </span>
                          </div>
                          <span
                            className={`cp-review-role-pill ${
                              p.projectRole === 'PROJECT_ADMIN' ? 'admin' : 'member'
                            }`}
                          >
                            {p.projectRole === 'PROJECT_ADMIN' ? 'Project Admin' : 'Project Member'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="cp-review-card-divider" />

                    <div className="cp-review-members-footer">
                      <span className="cp-review-total-label">Total Participants</span>
                      <span className="cp-review-total-count">{selectedParticipants.size}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="cp-stepper-footer">
            {step > 1 && (
              <button
                type="button"
                className="cp-review-footer-back-btn"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ArrowLeftIcon size={16} />
                <span>Back</span>
              </button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                rightIcon={<ArrowRightIcon size={16} />}
                onClick={handleNext}
                style={{ marginLeft: 'auto' }}
              >
                Continue
              </Button>
            ) : (
              <button
                type="button"
                className="cp-review-footer-submit-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ marginLeft: 'auto' }}
              >
                <span>{isSubmitting ? 'Creating Project...' : 'Create Project'}</span>
                {!isSubmitting && <CheckIcon size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar (Project Preview, Setup Guide) */}
        <div className="cp-sidebar-column">
          {/* Card 1: Project Preview */}
          <div className="cp-sidebar-card">
            <div className="cp-card-header-block">
              <div className="cp-prev-card-title-row">
                <span className="cp-prev-eye-icon">👁</span>
                <h4 className="cp-card-title">Project Preview</h4>
              </div>
              <p className="cp-card-subtitle">This is how your project will appear.</p>
            </div>

            <div className="cp-project-preview-box">
              <div className="cp-prev-top-row">
                <div className="cp-prev-avatar">
                  {avatarUrl ? (
                    isEmojiOrPreset(avatarUrl) ? (
                      <span className="cp-prev-preset-icon">{avatarUrl}</span>
                    ) : (
                      <img src={avatarUrl} alt="Project Logo" className="cp-prev-avatar-img" />
                    )
                  ) : (
                    <span>{name.trim() ? projectMonogram : 'P'}</span>
                  )}
                </div>
                <div className="cp-prev-titles">
                  <div className="cp-prev-name-row">
                    <h5 className="cp-prev-name">{name.trim() || 'Phoenix Web App'}</h5>
                    <span className="cp-prev-ext-link">↗</span>
                  </div>
                  <div className="cp-prev-meta-line">
                    <span className="cp-prev-category">{category || 'Web Application'}</span>
                    <span className="cp-prev-dot">•</span>
                    <span className="cp-prev-active-badge">Active</span>
                  </div>
                </div>
              </div>

              <p className="cp-prev-description" title={description.trim()}>
                {(() => {
                  const trimmed = description.trim();
                  if (!trimmed) {
                    return 'Agile development workspace for sprint planning, feature iterations, and task tracking.';
                  }
                  const words = trimmed.split(/\s+/);
                  if (words.length > 7) {
                    return words.slice(0, 7).join(' ') + '...';
                  }
                  if (trimmed.length > 50) {
                    return trimmed.slice(0, 47) + '...';
                  }
                  return trimmed;
                })()}
              </p>

              <div className="cp-prev-tech-list">
                {(techStack.length > 0 ? techStack : ['React', 'TypeScript', 'Node.js', 'PostgreSQL']).slice(0, 4).map((tech) => (
                  <span key={tech} className="cp-prev-tech-tag">
                    {tech}
                  </span>
                ))}
                {techStack.length > 4 && (
                  <span className="cp-prev-tech-tag more">+{techStack.length - 4}</span>
                )}
              </div>

              {/* Members Avatar Stack */}
              <div className="cp-prev-members-row">
                <div className="cp-avatar-stack">
                  <div className="cp-stack-avatar img-avatar">
                    <span className="cp-avatar-mini-initial">👤</span>
                  </div>
                  <div className="cp-stack-avatar purple-avatar">
                    <span>A</span>
                  </div>
                  <div className="cp-stack-avatar add-avatar">
                    <span>+</span>
                  </div>
                </div>
                <span className="cp-prev-members-text">
                  {selectedParticipants.size > 0 ? `${selectedParticipants.size} members` : '2 members'}
                </span>
              </div>

              {/* Date footer */}
              <div className="cp-prev-date-footer">
                <span className="cp-date-icon">📅</span>
                <span className="cp-date-text">
                  {startDate || endDate ? formattedDatesPreview : 'Sep 8, 2026  →  Sep 30, 2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Setup Guide (3-step checklist progression) */}
          <div className="cp-sidebar-card">
            <div className="cp-card-header-block cp-guide-header-row">
              <div className="cp-guide-title-flex">
                <span className="cp-guide-bulb">💡</span>
                <h4 className="cp-card-title">Setup Guide</h4>
              </div>
              <span className="cp-guide-step-badge">
                {step === 1 ? 'Step 1 of 3 • Details' : step === 2 ? 'Step 2 of 3 • Team' : 'Step 3 of 3 • Launch'}
              </span>
            </div>

            <div className="cp-wizard-checklist">
              {[
                {
                  num: 1,
                  title: 'Configure project details',
                  desc: 'Add name, key, category, and tech stack.',
                },
                {
                  num: 2,
                  title: 'Invite your team',
                  desc: 'Add team members and set permissions.',
                },
                {
                  num: 3,
                  title: 'Review and create',
                  desc: 'Confirm settings and create your project.',
                },
              ].map((s) => {
                const isCompleted = step > s.num;
                const isCurrent = step === s.num;
                return (
                  <div
                    key={s.num}
                    className={`cp-guide-step-card ${isCurrent ? 'is-current' : isCompleted ? 'is-completed' : 'is-pending'}`}
                  >
                    <div className={`cp-guide-step-badge-circle ${isCurrent ? 'current' : isCompleted ? 'completed' : 'pending'}`}>
                      {isCompleted ? <CheckIcon size={12} /> : s.num}
                    </div>
                    <div className="cp-guide-step-info">
                      <h6 className={`cp-guide-step-name ${isCompleted ? 'completed' : isCurrent ? 'current' : ''}`}>{s.title}</h6>
                      <p className="cp-guide-step-sub">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
