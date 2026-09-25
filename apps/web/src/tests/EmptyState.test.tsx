import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../components/ui/EmptyState';

describe('EmptyState Component Tests', () => {
  it('should render title and description text correctly', () => {
    render(
      <EmptyState
        title="No files found"
        description="Upload a new file to get started in this project."
      />
    );

    expect(screen.getByText('No files found')).toBeInTheDocument();
    expect(
      screen.getByText('Upload a new file to get started in this project.')
    ).toBeInTheDocument();
  });

  it('should render action button and fire onAction callback on click', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No work items"
        description="Create your first task to plan sprints."
        actionText="Create Task"
        onAction={handleAction}
      />
    );

    const button = screen.getByRole('button', { name: /create task/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
