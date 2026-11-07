import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../pages/auth/LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

let mockAuthState = {
  login: mockLogin,
  user: null as any,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    path: '/login',
  }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('LoginPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthState = {
      login: mockLogin,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
  });

  it('should render login form with email/username and password inputs', () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText(/enter your email or username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should show client-side validation errors when submitted empty', async () => {
    render(<LoginPage />);

    const submitBtn = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Username or email is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('should call login function with credentials upon valid submission', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);

    const identifierInput = screen.getByPlaceholderText(/enter your email or username/i);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    const submitBtn = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(identifierInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        identifier: 'testuser',
        password: 'Password123!',
        rememberMe: false,
      });
    });
  });

  it('should remember identifier and set remember_me flag in localStorage when Keep me logged in is checked', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);

    const identifierInput = screen.getByPlaceholderText(/enter your email or username/i);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    const rememberMeCheckbox = screen.getByLabelText(/keep me logged in/i);
    const submitBtn = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(identifierInput, { target: { value: 'remembered_user' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.click(rememberMeCheckbox);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        identifier: 'remembered_user',
        password: 'Password123!',
        rememberMe: true,
      });
      expect(localStorage.getItem('dboard_remember_me')).toBe('true');
      expect(localStorage.getItem('dboard_remembered_identifier')).toBe('remembered_user');
      expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard');
    });
  });

  it('should prefill remembered identifier and check the checkbox if previously remembered', () => {
    localStorage.setItem('dboard_remember_me', 'true');
    localStorage.setItem('dboard_remembered_identifier', 'saved_user@example.com');

    render(<LoginPage />);

    const identifierInput = screen.getByPlaceholderText(/enter your email or username/i) as HTMLInputElement;
    const rememberMeCheckbox = screen.getByLabelText(/keep me logged in/i) as HTMLInputElement;

    expect(identifierInput.value).toBe('saved_user@example.com');
    expect(rememberMeCheckbox.checked).toBe(true);
  });

  it('should automatically redirect to /app/dashboard if user is already authenticated', async () => {
    mockAuthState = {
      login: mockLogin,
      user: { id: 'u1', username: 'testuser' } as any,
      isAuthenticated: true,
      isLoading: false,
    };

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app/dashboard');
    });
  });

  it('should not render Google Sign-In button or OR divider when Google Auth is disabled', () => {
    render(<LoginPage />);

    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^OR$/)).not.toBeInTheDocument();
  });
});
