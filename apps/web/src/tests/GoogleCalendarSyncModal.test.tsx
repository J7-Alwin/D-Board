import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoogleCalendarSyncModal } from '../components/calendar/GoogleCalendarSyncModal';

vi.mock('../../api/calendar.api', () => ({
  calendarApi: {
    createFeedToken: vi.fn().mockResolvedValue({
      success: true,
      data: { token: 'dbcal_mocktoken123456789' },
    }),
  },
}));

describe('GoogleCalendarSyncModal Component Tests', () => {
  it('should not render anything when isOpen is false', () => {
    const { container } = render(
      <GoogleCalendarSyncModal
        isOpen={false}
        onClose={vi.fn()}
        items={[]}
        projectName="Test Project"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render modal with .ics download and feed subscription options when open', async () => {
    render(
      <GoogleCalendarSyncModal
        isOpen={true}
        onClose={vi.fn()}
        items={[]}
        projectName="Test Project"
        projectId="test-proj-id"
      />
    );

    expect(screen.getByText('Sync with Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Download .ics Calendar File')).toBeInTheDocument();
    expect(screen.getByText(/Live Calendar Subscription Feed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Private subscription token. Regenerate if ever exposed./i)
    ).toBeInTheDocument();
  });
});
