import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import {
  userApi,
  type UserProfile,
  type NotificationPreferences,
} from '../../api/user.api';
import {
  UserIcon,
  LockIcon,
  BellIcon,
  TrashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  MailIcon,
  CloseIcon,
  DatabaseIcon,
  BriefcaseIcon,
  CameraIcon,
  UploadIcon,
  LinkIcon,
  EditIcon,
  SaveIcon,
} from '../../components/ui/Icons';
import {
  AccountSettingsHeaderAtmosphere,
  KeepAccountSafeIllustration,
  EmailNotificationsIllustration,
  ExportPersonalDataArt,
  DeleteAccountArt,
  CredentialsHeaderAtmosphere,
} from '../../components/common/HeaderAtmosphereArt';
import { TimezoneSelect } from '../../components/ui/TimezoneSelect';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'data';

export const AccountSettingsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo file size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        showFeedback('Photo loaded! Remember to click Save Changes.');
      }
    };
    reader.readAsDataURL(file);
  };
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    emailWorkAssigned: true,
    emailMentions: true,
    emailInvitations: true,
    emailDueSoon: false,
    weeklyDigest: true,
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Delete Account Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        setFullName(res.data.fullName || '');
        setUsername(res.data.username || '');
        setHeadline(res.data.headline || '');
        setBio(res.data.bio || '');
        setTimezone(res.data.timezone || 'UTC');
        setAvatarUrl(res.data.avatarUrl || '');
        if (res.data.notificationPreferences) {
          setNotifPrefs(res.data.notificationPreferences);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const showFeedback = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // 1. Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSavingProfile(true);

    try {
      const res = await userApi.updateProfile({
        fullName: fullName.trim() || null,
        username: username.trim(),
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        timezone,
        avatarUrl: avatarUrl.trim() || null,
      });

      if (res.success && res.data) {
        setProfile(res.data);
        await refreshUser();
        showFeedback('Profile information saved successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Change Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await userApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showFeedback('Password changed successfully! A security confirmation email has been dispatched.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // 3. Save Notification Preferences
  const handleToggleNotif = async (key: keyof NotificationPreferences) => {
    const updated = {
      ...notifPrefs,
      [key]: !notifPrefs[key],
    };
    setNotifPrefs(updated);
    setIsSavingNotifs(true);

    try {
      await userApi.updateNotificationPreferences(updated);
      showFeedback('Notification preferences updated!');
    } catch (err: any) {
      setError(err.message || 'Failed to update notification preferences');
      // Revert on failure
      setNotifPrefs(notifPrefs);
    } finally {
      setIsSavingNotifs(false);
    }
  };

  // 4. Export Personal Data Archive
  const handleExportData = async () => {
    setIsExportingData(true);
    setError(null);

    try {
      const data = await userApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `d-board-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback('Workspace archive downloaded successfully! A copy notification was sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to export workspace data');
    } finally {
      setIsExportingData(false);
    }
  };

  // 5. Delete Account
  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setIsDeletingAccount(true);
    setError(null);

    try {
      await userApi.deleteAccount('DELETE');
      setShowDeleteModal(false);
      window.location.href = '/login';
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setIsDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="account-settings-loading">
        <div className="spinner-dots" />
        <p>Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="account-settings-page">
      {/* Top Back Link (Outside card) */}
      <div className="as-header-top-row">
        <button
          type="button"
          className="as-back-link"
          onClick={() => navigate('/app/dashboard')}
        >
          <ArrowLeftIcon size={14} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Top Header Card */}
      <div className="account-settings-header-card">
        <div className="as-header-content">
          {/* Left: Squircle Icon + Title + Subtitle */}
          <div className="as-header-left-col">
            <div className="as-header-icon-box">
              <UserIcon size={24} />
            </div>
            <div className="as-header-text">
              <h1>Account Settings</h1>
              <p>Manage your personal profile, credentials, notifications, and workspace data.</p>
            </div>
          </div>

          {/* First Vertical Divider */}
          <div className="as-header-divider" />

          {/* Center: Quote + Illustration */}
          <div className="as-header-center-col">
            <AccountSettingsHeaderAtmosphere />
          </div>

          {/* Second Vertical Divider */}
          <div className="as-header-divider" />

          {/* Right: Stacked User Capsule Pill */}
          <div className="as-header-right-col">
            <div className="as-header-user-pill">
              <span className="as-pill-avatar">
                {(profile?.username || profile?.fullName || 'a')[0].toLowerCase()}
              </span>
              <div className="as-pill-text-col">
                <span className="as-pill-name">{profile?.username || 'alwin'}</span>
                <span className="as-pill-email">{profile?.email || 'j7alwin@gmail.com'}</span>
              </div>
              <span className="as-pill-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="as-alert as-alert-error">
          <AlertCircleIcon size={18} />
          <span>{error}</span>
          <button type="button" className="as-alert-dismiss" onClick={() => setError(null)}>
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="as-alert as-alert-success">
          <CheckCircleIcon size={18} />
          <span>{successMessage}</span>
          <button type="button" className="as-alert-dismiss" onClick={() => setSuccessMessage(null)}>
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* 2-Column Split: Left Navigation Sidebar Card + Right Form Card */}
      <div className="as-split-grid">
        {/* Left Sidebar Navigation Card */}
        <div className="as-sidebar-nav-card">
          <button
            type="button"
            className={`as-sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon size={18} />
            <span>Profile</span>
          </button>

          <button
            type="button"
            className={`as-sidebar-nav-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <LockIcon size={18} />
            <span>Credentials</span>
          </button>

          <button
            type="button"
            className={`as-sidebar-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <BellIcon size={18} />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            className={`as-sidebar-nav-item ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <DatabaseIcon size={18} />
            <span>Workspace Data</span>
          </button>
        </div>

        {/* Right Main Content Card */}
        <div className="as-main-card">
          {/* ===================================================================
              TAB 1: PROFILE INFORMATION
              =================================================================== */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="as-profile-form">
              {/* Profile Card Header with Callout */}
              <div className="as-card-header as-profile-card-header">
                <div className="as-profile-header-left">
                  <div className="as-profile-icon-box">
                    <UserIcon size={20} />
                  </div>
                  <div className="as-profile-header-text">
                    <h2>Profile Information</h2>
                    <p>Update your photo and personal details visible to team members across workspaces.</p>
                  </div>
                </div>
              </div>

              {/* Profile Photo Section Card */}
              <div className="as-photo-section">
                <div className="as-photo-avatar-wrapper">
                  <div className="as-photo-avatar-circle">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="as-photo-avatar-img" />
                    ) : (
                      <span>{(fullName || username || 'a')[0].toLowerCase()}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="as-photo-camera-badge"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload new photo"
                  >
                    <CameraIcon size={13} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </div>

                <div className="as-photo-details">
                  <h4 className="as-photo-title">Profile Photo</h4>
                  <p className="as-photo-desc">
                    Choose a photo that represents you. PNG, JPG, or WebP (max 5MB).
                  </p>

                  <div className="as-photo-controls-row">
                    <button
                      type="button"
                      className="as-upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadIcon size={14} />
                      <span>Upload Photo</span>
                    </button>

                    <span className="as-photo-or-divider">or</span>

                    <div className="as-photo-url-box">
                      <LinkIcon size={14} className="as-url-icon" />
                      <input
                        type="url"
                        placeholder="Paste image URL (https://...)"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="as-url-input"
                      />
                      {avatarUrl && (
                        <button
                          type="button"
                          className="as-url-clear-btn"
                          onClick={() => setAvatarUrl('')}
                          title="Clear URL"
                        >
                          <CloseIcon size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="as-photo-footnote-row">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="as-photo-info-icon">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>You can upload an image or provide a direct image URL.</span>
                  </div>
                </div>
              </div>

              {/* 2-Column Form Fields Grid */}
              <div className="as-fields-grid">
                {/* Full Name */}
                <div className="as-field-group">
                  <label className="as-field-label">Full Name *</label>
                  <div className="as-field-input-box">
                    <UserIcon size={16} className="as-field-icon" />
                    <input
                      type="text"
                      placeholder="alwin"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="as-field-group">
                  <label className="as-field-label">Username *</label>
                  <div className="as-field-input-box">
                    <span className="as-field-at">@</span>
                    <input
                      type="text"
                      placeholder="j7alwin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <span className="as-field-hint">This will be your unique username.</span>
                </div>

                {/* Email Address */}
                <div className="as-field-group">
                  <div className="as-label-with-pill">
                    <label className="as-field-label">Email Address *</label>
                    <span className="as-green-verified-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Verified</span>
                    </span>
                  </div>
                  <div className="as-field-input-box as-field-disabled">
                    <MailIcon size={16} className="as-field-icon" />
                    <input
                      type="email"
                      value={profile?.email || 'j7alwin@gmail.com'}
                      disabled
                    />
                  </div>
                  <span className="as-field-hint">
                    Email address is linked to your account authentication.
                  </span>
                </div>

                {/* Job Title / Role */}
                <div className="as-field-group">
                  <label className="as-field-label">Job Title / Role</label>
                  <div className="as-field-input-box">
                    <BriefcaseIcon size={16} className="as-field-icon" />
                    <input
                      type="text"
                      placeholder="e.g. Lead Software Engineer"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                    />
                  </div>
                </div>

                {/* Timezone Custom Dropdown */}
                <TimezoneSelect value={timezone} onChange={setTimezone} />

                {/* Bio / About */}
                <div className="as-field-group as-span-2">
                  <div className="as-label-with-pill">
                    <label className="as-field-label">Bio / About</label>
                    <span className="as-field-counter">{bio.length}/500</span>
                  </div>
                  <div className="as-field-textarea-box">
                    <EditIcon size={16} className="as-textarea-icon" />
                    <textarea
                      rows={3}
                      maxLength={500}
                      placeholder="Share a short bio about yourself, technical interests, or team focus..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>
                  <span className="as-field-hint">
                    This will be visible to team members across your workspaces.
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="as-card-footer as-profile-card-footer">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="as-save-changes-btn"
                >
                  <SaveIcon size={15} />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
                <button
                  type="button"
                  className="as-cancel-btn"
                  onClick={() => loadProfile()}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

        {/* ===================================================================
            TAB 2: CREDENTIALS (CONNECTED ACCOUNTS & PASSWORD)
            =================================================================== */}
        {activeTab === 'security' && (() => {
          const hasMinLength = newPassword.length >= 8;
          const hasNumber = /\d/.test(newPassword);
          const hasLetter = /[a-zA-Z]/.test(newPassword);

          return (
            <div className="as-cred-container">
              {/* Credentials Main Header */}
              <div className="as-cred-main-header">
                <div className="as-cred-main-header-left">
                  <div className="as-cred-icon-box">
                    <LockIcon size={20} />
                  </div>
                  <div className="as-cred-header-text">
                    <h2>Credentials</h2>
                    <p>Manage your connected accounts and account security.</p>
                  </div>
                </div>
                <CredentialsHeaderAtmosphere />
              </div>

              {/* Box 1: Connected Accounts */}
              <div className="as-cred-section-box">
                <div className="as-cred-box-header">
                  <div className="as-cred-box-icon as-box-icon-green">
                    <LinkIcon size={18} />
                  </div>
                  <div className="as-cred-box-text">
                    <h3>Connected Accounts</h3>
                    <p>Third-party authentication providers linked to your account.</p>
                  </div>
                </div>

                <div className="as-connected-account-card">
                  <div className="as-provider-info">
                    <div className="as-google-icon-circle">
                      <svg viewBox="0 0 24 24" width="22" height="22">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <div className="as-provider-text">
                      <span className="as-provider-name">Google Account</span>
                      <span className="as-provider-email">
                        Connected ({profile?.email || 'j7alwin@gmail.com'})
                      </span>
                    </div>
                  </div>

                  <div className="as-provider-actions">
                    <span className="as-connected-pill">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#10B981" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" fill="#10B981" />
                        <path d="m9 12 2 2 4-4" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Connected</span>
                    </span>
                    <button type="button" className="as-more-btn" title="More options">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Box 2: Change Password */}
              <div className="as-cred-section-box">
                <div className="as-cred-box-header">
                  <div className="as-cred-box-icon as-box-icon-blue">
                    <LockIcon size={18} />
                  </div>
                  <div className="as-cred-box-text">
                    <h3>Change Password</h3>
                    <p>Ensure your account is using a secure password to stay protected.</p>
                  </div>
                </div>

                <form onSubmit={handleSavePassword} className="as-password-form-layout">
                  <div className="as-pwd-split-row">
                    {/* Left Column: Form Inputs */}
                    <div className="as-pwd-inputs-col">
                      {/* Current Password */}
                      <div className="as-pwd-field">
                        <label className="as-pwd-label">Current Password</label>
                        <div className="as-pwd-input-wrap">
                          <LockIcon size={16} className="as-pwd-icon" />
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            placeholder="Enter your current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="as-pwd-input"
                            required
                          />
                          <button
                            type="button"
                            className="as-pwd-eye-btn"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            title={showCurrentPassword ? 'Hide password' : 'Show password'}
                          >
                            {showCurrentPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="as-pwd-field">
                        <label className="as-pwd-label">New Password</label>
                        <div className="as-pwd-input-wrap">
                          <LockIcon size={16} className="as-pwd-icon" />
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="At least 8 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="as-pwd-input"
                            required
                          />
                          <button
                            type="button"
                            className="as-pwd-eye-btn"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            title={showNewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showNewPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                          </button>
                        </div>

                        {/* 3 Requirement Badges */}
                        <div className="as-pwd-reqs-row">
                          <span className={`as-req-pill ${hasMinLength ? 'met' : ''}`}>
                            <span className="as-req-indicator">{hasMinLength ? '✓' : '⊙'}</span>
                            <span>At least 8 characters</span>
                          </span>
                          <span className={`as-req-pill ${hasNumber ? 'met' : ''}`}>
                            <span className="as-req-indicator">{hasNumber ? '✓' : '⊙'}</span>
                            <span>Include a number</span>
                          </span>
                          <span className={`as-req-pill ${hasLetter ? 'met' : ''}`}>
                            <span className="as-req-indicator">{hasLetter ? '✓' : '⊙'}</span>
                            <span>Include a letter</span>
                          </span>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div className="as-pwd-field">
                        <label className="as-pwd-label">Confirm New Password</label>
                        <div className="as-pwd-input-wrap">
                          <LockIcon size={16} className="as-pwd-icon" />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Repeat new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="as-pwd-input"
                            required
                          />
                          <button
                            type="button"
                            className="as-pwd-eye-btn"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            title={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: "Keep your account safe" card */}
                    <div className="as-keep-safe-card">
                      <div className="as-keep-safe-art-container">
                        <KeepAccountSafeIllustration />
                      </div>
                      <h4 className="as-keep-safe-title">Keep your account safe</h4>
                      <ul className="as-keep-safe-list">
                        <li>
                          <span className="as-safe-check-circle">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span>Use a strong, unique password</span>
                        </li>
                        <li>
                          <span className="as-safe-check-circle">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span>Don't reuse passwords</span>
                        </li>
                        <li>
                          <span className="as-safe-check-circle">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span>We'll notify you after a change</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Security Notification Banner */}
                  <div className="as-pwd-notification-banner">
                    <div className="as-banner-info-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>
                    <p className="as-banner-info-text">
                      When your password is changed, an automated security notification will be sent to{' '}
                      <strong>{profile?.email || 'j7alwin@gmail.com'}</strong>.
                    </p>
                  </div>

                  {/* Footer Action Button */}
                  <div className="as-pwd-actions-row">
                    <button
                      type="submit"
                      disabled={isSavingPassword}
                      className="as-update-pwd-btn"
                    >
                      <LockIcon size={15} />
                      <span>{isSavingPassword ? 'Updating...' : 'Update Password'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* ===================================================================
            TAB 3: NOTIFICATION PREFERENCES (MATCHING USER REFERENCE DESIGN)
            =================================================================== */}
        {activeTab === 'notifications' && (
          <div className="as-notif-container">
            {/* Header: Squircle Bell Icon + Title & 2-Line Subtitle + Art Illustration */}
            <div className="as-notif-header">
              <div className="as-notif-header-left">
                <div className="as-notif-header-icon-box">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div className="as-notif-header-text">
                  <h2>Email Notification Preferences</h2>
                  <p>
                    Configure which activities trigger automated email notifications.<br />
                    In-app notifications will continue to be delivered in real-time.
                  </p>
                </div>
              </div>

              <div className="as-notif-header-art">
                <EmailNotificationsIllustration />
              </div>
            </div>

            {/* List of 5 Notification Rows */}
            <div className="as-notif-cards-list">
              {/* 1. Work Item Assignments */}
              <div className="as-notif-row-card">
                <div className="as-notif-row-left">
                  <div className="as-notif-icon-box as-notif-icon-blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                  </div>
                  <div className="as-notif-info">
                    <h4>Work Item Assignments</h4>
                    <p>Receive an email when a task, bug, or feature is assigned to you in any project.</p>
                  </div>
                </div>
                <div className="as-notif-toggle-col">
                  <label className="as-notif-switch">
                    <input
                      type="checkbox"
                      checked={notifPrefs.emailWorkAssigned}
                      disabled={isSavingNotifs}
                      onChange={() => handleToggleNotif('emailWorkAssigned')}
                    />
                    <span className="as-notif-slider" />
                  </label>
                  <span className="as-notif-status-label">
                    {notifPrefs.emailWorkAssigned ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* 2. Comments & @Mentions */}
              <div className="as-notif-row-card">
                <div className="as-notif-row-left">
                  <div className="as-notif-icon-box as-notif-icon-purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="as-notif-info">
                    <h4>Comments & @Mentions</h4>
                    <p>Receive an email when someone mentions you or replies on a work item you follow.</p>
                  </div>
                </div>
                <div className="as-notif-toggle-col">
                  <label className="as-notif-switch">
                    <input
                      type="checkbox"
                      checked={notifPrefs.emailMentions}
                      disabled={isSavingNotifs}
                      onChange={() => handleToggleNotif('emailMentions')}
                    />
                    <span className="as-notif-slider" />
                  </label>
                  <span className="as-notif-status-label">
                    {notifPrefs.emailMentions ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* 3. Project Invitations */}
              <div className="as-notif-row-card">
                <div className="as-notif-row-left">
                  <div className="as-notif-icon-box as-notif-icon-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className="as-notif-info">
                    <h4>Project Invitations</h4>
                    <p>Receive an email whenever team members invite you to collaborate on a new project.</p>
                  </div>
                </div>
                <div className="as-notif-toggle-col">
                  <label className="as-notif-switch">
                    <input
                      type="checkbox"
                      checked={notifPrefs.emailInvitations}
                      disabled={isSavingNotifs}
                      onChange={() => handleToggleNotif('emailInvitations')}
                    />
                    <span className="as-notif-slider" />
                  </label>
                  <span className="as-notif-status-label">
                    {notifPrefs.emailInvitations ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* 4. Deadline & Due Date Alerts */}
              <div className="as-notif-row-card">
                <div className="as-notif-row-left">
                  <div className="as-notif-icon-box as-notif-icon-orange">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="as-notif-info">
                    <h4>Deadline & Due Date Alerts</h4>
                    <p>Receive an automated reminder email 24 hours prior to work item deadlines.</p>
                  </div>
                </div>
                <div className="as-notif-toggle-col">
                  <label className="as-notif-switch">
                    <input
                      type="checkbox"
                      checked={notifPrefs.emailDueSoon}
                      disabled={isSavingNotifs}
                      onChange={() => handleToggleNotif('emailDueSoon')}
                    />
                    <span className="as-notif-slider" />
                  </label>
                  <span className="as-notif-status-label">
                    {notifPrefs.emailDueSoon ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* 5. Weekly Progress Digest */}
              <div className="as-notif-row-card">
                <div className="as-notif-row-left">
                  <div className="as-notif-icon-box as-notif-icon-pink">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </div>
                  <div className="as-notif-info">
                    <h4>Weekly Progress Digest</h4>
                    <p>Receive a weekly summary email of completed tasks, upcoming goals, and team activity.</p>
                  </div>
                </div>
                <div className="as-notif-toggle-col">
                  <label className="as-notif-switch">
                    <input
                      type="checkbox"
                      checked={notifPrefs.weeklyDigest}
                      disabled={isSavingNotifs}
                      onChange={() => handleToggleNotif('weeklyDigest')}
                    />
                    <span className="as-notif-slider" />
                  </label>
                  <span className="as-notif-status-label">
                    {notifPrefs.weeklyDigest ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Info Banner: You're in control */}
            <div className="as-notif-control-banner">
              <div className="as-notif-control-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div className="as-notif-control-text">
                <h4>You're in control</h4>
                <p>You can update these preferences anytime. In-app notifications will continue to be delivered in real-time.</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: WORKSPACE DATA (MATCHING USER REFERENCE DESIGN)
            =================================================================== */}
        {activeTab === 'data' && (
          <div className="as-ws-layout">
            {/* Top Workspace Data Section Header */}
            <div className="as-ws-header">
              <div className="as-ws-header-icon-box">
                <DatabaseIcon size={24} />
              </div>
              <div className="as-ws-header-text">
                <h2>Workspace Data</h2>
                <p>Manage your data, export a copy, or permanently delete your account.</p>
              </div>
            </div>

            {/* 1. Export Personal Data Card */}
            <div className="as-ws-card as-ws-export-card">
              <div className="as-ws-card-content">
                <div className="as-ws-card-left">
                  <div className="as-ws-card-title-row">
                    <div className="as-ws-icon-box as-ws-icon-blue">
                      <DownloadIcon size={20} />
                    </div>
                    <div className="as-ws-card-title-text">
                      <h3>Export Personal Data</h3>
                      <p>
                        Download a complete backup of your profile, projects, assigned work items, notes,
                        and activity history.
                      </p>
                    </div>
                  </div>

                  {/* 3 Item Bullet Checklist with circular blue checks */}
                  <div className="as-ws-checklist">
                    <div className="as-ws-check-item">
                      <div className="as-ws-check-circle">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span>All your profile information</span>
                    </div>
                    <div className="as-ws-check-item">
                      <div className="as-ws-check-circle">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span>Projects and team memberships</span>
                    </div>
                    <div className="as-ws-check-item">
                      <div className="as-ws-check-circle">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span>Work items, notes, and activity history</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="as-ws-action-row">
                    <button
                      type="button"
                      className="as-ws-btn-download"
                      onClick={handleExportData}
                      disabled={isExportingData}
                    >
                      <DownloadIcon size={16} />
                      <span>{isExportingData ? 'Exporting Archive...' : 'Download Data Archive (.json)'}</span>
                    </button>
                  </div>

                  {/* Footnote */}
                  <p className="as-ws-footnote">
                    Your data will be packaged into a structured <span className="as-ws-code-pill">.json</span> file for portability and backup.
                  </p>
                </div>

                {/* Right Column Artwork */}
                <div className="as-ws-card-art">
                  <ExportPersonalDataArt />
                </div>
              </div>
            </div>

            {/* 2. Delete Account Card */}
            <div className="as-ws-card as-ws-delete-card">
              <div className="as-ws-card-content">
                <div className="as-ws-card-left">
                  <div className="as-ws-card-title-row">
                    <div className="as-ws-icon-box as-ws-icon-red">
                      <TrashIcon size={20} />
                    </div>
                    <div className="as-ws-card-title-text">
                      <h3 className="as-ws-delete-heading">Delete Account</h3>
                      <p>
                        Permanently delete your D-Board user account, profile details, and team memberships.
                        This action is irreversible.
                      </p>
                    </div>
                  </div>

                  {/* Warning Box */}
                  <div className="as-ws-warning-box">
                    <div className="as-ws-warning-header">
                      <div className="as-ws-warning-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                          <circle cx="12" cy="17" r="1" fill="#FFFFFF" />
                        </svg>
                      </div>
                      <h4>This action cannot be undone</h4>
                    </div>
                    <ul className="as-ws-warning-bullets">
                      <li>All your data, including projects, work items, notes, and activity history will be permanently deleted.</li>
                      <li>You will lose access to all your workspaces and team memberships.</li>
                      <li>Once deleted, your account cannot be recovered.</li>
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="as-ws-action-row">
                    <button
                      type="button"
                      className="as-ws-btn-delete"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <TrashIcon size={16} />
                      <span>Delete Account</span>
                    </button>
                  </div>
                </div>

                {/* Right Column Artwork */}
                <div className="as-ws-card-art">
                  <DeleteAccountArt />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* =====================================================================
          DELETE ACCOUNT CONFIRMATION MODAL
          ===================================================================== */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="as-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="as-delete-modal-header">
              <div className="as-delete-icon-box">
                <AlertCircleIcon size={24} />
              </div>
              <div>
                <h3>Delete Your Account?</h3>
                <p>This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="as-delete-modal-body">
              <p>
                All your profile details, task assignments, and personal workspace permissions will be
                permanently purged.
              </p>
              <p className="as-confirm-prompt">
                To confirm, please type <strong>DELETE</strong> below:
              </p>
              <input
                type="text"
                placeholder="Type DELETE"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="as-input as-input-delete"
                autoFocus
              />
            </div>

            <div className="as-delete-modal-footer">
              <button
                type="button"
                className="as-btn-cancel"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="as-btn-confirm-delete"
                disabled={deleteConfirmationText !== 'DELETE' || isDeletingAccount}
                onClick={handleDeleteAccount}
              >
                {isDeletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettingsPage;
