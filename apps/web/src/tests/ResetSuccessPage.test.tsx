import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResetSuccessPage } from '../pages/auth/ResetSuccessPage';

const mockNavigate = vi.fn();

vi.mock('../router/Router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    path: '/reset-success',
  }),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('ResetSuccessPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the redesigned success illustration, heading, checklist, and sign in button', () => {
    render(<ResetSuccessPage />);

    // Heading & Subtitle
    expect(screen.getByRole('heading', { level: 1, name: /password reset successful!/i })).toBeInTheDocument();
    expect(
      screen.getByText(/your password has been changed\. you can now use your new password to sign in\./i)
    ).toBeInTheDocument();

    // Security Checklist Items
    expect(
      screen.getByText(/your d-board account password was updated successfully\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/old reset links are now invalidated for security\./i)
    ).toBeInTheDocument();

    // Sign in Button
    const signInBtn = screen.getByRole('button', { name: /sign in to your account/i });
    expect(signInBtn).toBeInTheDocument();

    // Click navigates to /login
    fireEvent.click(signInBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
