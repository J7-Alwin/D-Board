import React from 'react';
import { useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { ArrowRightIcon, CheckSquareIcon, UsersIcon, FolderIcon, CalendarIcon, ActivityIcon } from '../components/ui/Icons';

export const HowItWorksPage: React.FC = () => {
  const { navigate } = useRouter();

  const steps = [
    {
      num: '01',
      title: 'Create a project',
      description: 'Set up your project workspace in seconds. Define goals, attach documentation repositories, and configure project settings.',
      icon: <FolderIcon size={24} />,
    },
    {
      num: '02',
      title: 'Invite your team',
      description: 'Send secure email invitations with explicit role assignments (PROJECT_ADMIN or PROJECT_MEMBER). Members accept cleanly with one click.',
      icon: <UsersIcon size={24} />,
    },
    {
      num: '03',
      title: 'Assign and organize work',
      description: 'Break down work into Tasks, Features, Bugs, Improvements, and Documentation. Assign ownership and set priorities without clutter.',
      icon: <CheckSquareIcon size={24} />,
    },
    {
      num: '04',
      title: 'Track progress and deadlines',
      description: 'Monitor live completion percentages, sprint deadlines, and blockers with a unified view across all your active initiatives.',
      icon: <CalendarIcon size={24} />,
    },
    {
      num: '05',
      title: 'Ship together',
      description: 'Review completed items, preserve architecture notes, and log release activity as a single coherent engineering unit.',
      icon: <ActivityIcon size={24} />,
    },
  ];

  return (
    <div className="how-it-works-page">
      <section className="page-hero-section">
        <div className="container text-center">
          <div className="eyebrow">SIMPLE WORKFLOW</div>
          <h1 className="heading-display page-title">From initial concept to production release.</h1>
          <p className="body-large page-subtitle">
            A linear, predictable process built around the way software engineering teams actually build.
          </p>
        </div>
      </section>

      <section className="workflow-section">
        <div className="container">
          <div className="workflow-timeline">
            {steps.map((step) => (
              <div key={step.num} className="workflow-step-card">
                <div className="step-num-badge">{step.num}</div>
                <div className="step-icon-box">{step.icon}</div>
                <div className="step-content">
                  <h2 className="step-title">{step.title}</h2>
                  <p className="step-desc">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="page-bottom-cta">
            <h3 className="heading-card">Start organizing your development work today.</h3>
            <div className="cta-btn-wrap">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRightIcon size={18} />}
                onClick={() => navigate('/register')}
              >
                Get started — Free
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
