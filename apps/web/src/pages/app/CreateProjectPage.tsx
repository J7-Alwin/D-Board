import React, { useState, useMemo } from 'react';
import { useRouter, Link } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { projectsApi } from '../../api/projects.api';
import { Button } from '../../components/ui/Button';
import { CreateProjectHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  MailIcon,
  UsersIcon,
  FileTextIcon,
  LayersIcon,
  CalendarIcon,
  EditIcon,
  FolderPlusIcon,
} from '../../components/ui/Icons';

interface InvitationDraft {
  email: string;
  role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER';
  message: string;
  invitedAt?: string;
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

const ROLE_OPTIONS = [
  { value: 'PROJECT_MEMBER', label: 'Member', icon: '👤', desc: 'Standard task, sprint & notes access' },
  { value: 'PROJECT_ADMIN', label: 'Admin', icon: '🛡️', desc: 'Full workspace & access controls' },
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

  const [step, setStep] = useState<1 | 2 | 3>(1);

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
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // Step 2: Team & Invitations
  const [invitations, setInvitations] = useState<InvitationDraft[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'PROJECT_ADMIN' | 'PROJECT_MEMBER'>('PROJECT_MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteInputError, setInviteInputError] = useState('');

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

  // Step 2: Add invitation
  const handleAddInvitation = () => {
    setInviteInputError('');
    if (!inviteEmail.trim()) {
      setInviteInputError('Email address is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteInputError('Please enter a valid email address');
      return;
    }

    if (invitations.some((inv) => inv.email.toLowerCase() === inviteEmail.trim().toLowerCase())) {
      setInviteInputError('This email has already been added to the invite list');
      return;
    }

    setInvitations([
      ...invitations,
      {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        message: inviteMessage.trim(),
      },
    ]);

    setInviteEmail('');
    setInviteMessage('');
    setInviteRole('PROJECT_MEMBER');
  };

  const handleRemoveInvitation = (index: number) => {
    setInvitations(invitations.filter((_, i) => i !== index));
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
        invitations: invitations.map((inv) => ({
          email: inv.email,
          role: inv.role,
          message: inv.message || null,
        })),
      });

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
          <div className="cp-title-row">
            <span className="cp-title-icon-box">
              <FolderPlusIcon size={24} />
            </span>
            <h1>Create Project</h1>
            <span className="cp-date-badge">{todayFormatted}</span>
          </div>
          <p className="cp-subtitle">
            Configure project details, collaborate with your team, and launch your workspace.
          </p>
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
                    Invite collaborators and assign their roles. You can also invite more members anytime in Project Settings.
                  </p>
                </div>
              </div>

              {/* Invite team members composer card */}
              <div className="cp-invite-composer-card">
                <div className="cp-icc-header">
                  <div className="cp-icc-mail-icon-box">
                    <MailIcon size={18} />
                  </div>
                  <div className="cp-icc-titles">
                    <h4 className="cp-icc-title">Invite team members</h4>
                    <p className="cp-icc-subtitle">Add your team members by email and assign a role.</p>
                  </div>
                </div>

                <div className="cp-icc-inputs-row">
                  {/* Email Input */}
                  <div className="cp-icc-field">
                    <label className="cp-icc-label">Email Address</label>
                    <div className="cp-icc-input-wrap">
                      <span className="cp-icc-inner-icon">✉</span>
                      <input
                        type="email"
                        className={`cp-icc-text-input ${inviteInputError ? 'error' : ''}`}
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          if (inviteInputError) setInviteInputError('');
                        }}
                      />
                    </div>
                    {inviteInputError && <span className="cp-field-error">{inviteInputError}</span>}
                  </div>

                  {/* Role Dropdown with Custom Icons */}
                  <div className="cp-icc-field">
                    <label className="cp-icc-label">Project Role</label>
                    <div className="cp-custom-dropdown-wrap">
                      <button
                        type="button"
                        className="cp-custom-dropdown-trigger"
                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                      >
                        <span className="cp-cdd-left">
                          <span className="cp-cdd-icon">
                            {ROLE_OPTIONS.find((r) => r.value === inviteRole)?.icon || '👤'}
                          </span>
                          <span className="cp-cdd-label">
                            {ROLE_OPTIONS.find((r) => r.value === inviteRole)?.label || 'Member'}
                          </span>
                        </span>
                        <span className="cp-cdd-arrow">{isRoleDropdownOpen ? '▴' : '▾'}</span>
                      </button>

                      {isRoleDropdownOpen && (
                        <div className="cp-custom-dropdown-menu">
                          {ROLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`cp-cdd-item ${opt.value === inviteRole ? 'selected' : ''}`}
                              onClick={() => {
                                setInviteRole(opt.value as any);
                                setIsRoleDropdownOpen(false);
                              }}
                            >
                              <span className="cp-cdd-item-icon">{opt.icon}</span>
                              <div className="cp-cdd-item-text">
                                <span className="cp-cdd-item-title">{opt.label}</span>
                                <span className="cp-cdd-item-desc">{opt.desc}</span>
                              </div>
                              {opt.value === inviteRole && <span className="cp-cdd-check">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Note Input */}
                  <div className="cp-icc-field">
                    <label className="cp-icc-label">Add a note (optional)</label>
                    <div className="cp-icc-input-wrap">
                      <span className="cp-icc-inner-icon">💬</span>
                      <input
                        type="text"
                        className="cp-icc-text-input"
                        placeholder="Welcome to the project..."
                        value={inviteMessage}
                        onChange={(e) => setInviteMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInvitation();
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Add to invitation list button */}
                <div className="cp-icc-footer-row">
                  <button
                    type="button"
                    className="cp-add-invite-btn"
                    onClick={handleAddInvitation}
                  >
                    <PlusIcon size={14} />
                    <span>Add to Invitation List</span>
                  </button>
                </div>
              </div>

              {/* Pending Invitations Section (Only displayed when invitations are added) */}
              {invitations.length > 0 && (
                <div className="cp-pending-invitations-wrap">
                  <div className="cp-pending-header-row">
                    <div className="cp-pending-title-group">
                      <span className="cp-pending-clock-icon">🕒</span>
                      <h4 className="cp-pending-title">
                        Pending Invitations ({invitations.length})
                      </h4>
                    </div>
                    <button
                      type="button"
                      className="cp-clear-all-btn"
                      onClick={() => setInvitations([])}
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="cp-pending-list">
                    {invitations.map((inv, idx) => {
                      const initial = inv.email ? inv.email[0].toLowerCase() : 'u';
                      const avatarColorClass = idx % 2 === 0 ? 'purple-bg' : 'blue-bg';
                      return (
                        <div key={idx} className="cp-pending-row-item">
                          <div className="cp-pending-left-col">
                            <div className={`cp-pending-avatar-circle ${avatarColorClass}`}>
                              <span>{initial}</span>
                            </div>
                            <span className="cp-pending-email">{inv.email}</span>
                            <span className={`cp-pending-role-pill ${inv.role === 'PROJECT_ADMIN' ? 'admin' : 'member'}`}>
                              {inv.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'}
                            </span>
                            {inv.message && (
                              <span className="cp-pending-note-text">{inv.message}</span>
                            )}
                          </div>
                          <div className="cp-pending-right-col">
                            <span className="cp-pending-time-text">
                              {inv.invitedAt || 'Invited just now'}
                            </span>
                            <button
                              type="button"
                              className="cp-pending-trash-btn"
                              onClick={() => handleRemoveInvitation(idx)}
                              title="Remove invitation"
                            >
                              <TrashIcon size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                      {/* Workspace Owner (Current User) */}
                      <div className="cp-review-member-item">
                        <div className="cp-review-user-avatar">
                          {user?.fullName?.[0]?.toLowerCase() || user?.username?.[0]?.toLowerCase() || 'a'}
                        </div>
                        <div className="cp-review-user-info">
                          <div className="cp-review-user-name-line">
                            <span className="cp-review-user-name">
                              {user?.fullName || user?.username || 'alwin'} <span className="cp-review-you-tag">(You)</span>
                            </span>
                          </div>
                          <span className="cp-review-user-sub">Workspace Owner</span>
                        </div>
                        <span className="cp-review-owner-pill">Owner</span>
                      </div>

                      {/* Invited Team Members (if any) */}
                      {invitations.map((inv, idx) => (
                        <div key={idx} className="cp-review-member-item">
                          <div className="cp-review-user-avatar invited">
                            {inv.email[0].toLowerCase()}
                          </div>
                          <div className="cp-review-user-info">
                            <span className="cp-review-user-name">{inv.email}</span>
                            <span className="cp-review-user-sub">
                              {inv.role === 'PROJECT_ADMIN' ? 'Project Admin' : 'Project Member'}
                            </span>
                          </div>
                          <span className={`cp-review-role-pill ${inv.role === 'PROJECT_ADMIN' ? 'admin' : 'member'}`}>
                            {inv.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="cp-review-card-divider" />

                    <div className="cp-review-members-footer">
                      <span className="cp-review-total-label">Total Members</span>
                      <span className="cp-review-total-count">{1 + invitations.length}</span>
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
                  {invitations.length > 0 ? `${invitations.length} members` : '2 members'}
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
