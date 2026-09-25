import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../pages/auth/LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }),
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
});
