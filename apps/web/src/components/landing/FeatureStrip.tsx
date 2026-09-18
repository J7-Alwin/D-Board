import React from 'react';
import { UsersIcon, CheckSquareIcon, CalendarIcon, BarChartIcon } from '../ui/Icons';

export const FeatureStrip: React.FC = () => {
  const features = [
    {
      id: '01',
      title: 'Work together',
      description: 'Bring your team, assign work and stay aligned.',
      icon: <UsersIcon size={24} className="feature-icon" />,
    },
    {
      id: '02',
      title: 'Stay organized',
      description: 'Tasks, notes, files and deadlines in one place.',
      icon: <CheckSquareIcon size={24} className="feature-icon" />,
    },
    {
      id: '03',
      title: 'Meet your deadlines',
      description: 'Keep track of milestones with a simple calendar.',
      icon: <CalendarIcon size={24} className="feature-icon" />,
    },
    {
      id: '04',
      title: 'Make progress',
      description: 'Turn ideas into real results faster.',
      icon: <BarChartIcon size={24} className="feature-icon" />,
    },
  ];

  return (
    <section className="feature-strip-section" aria-label="Core Capabilities">
      <div className="container">
        <div className="feature-strip-grid">
          {features.map((f) => (
            <div key={f.id} className="feature-strip-item">
              <div className="feature-strip-icon-box">
                {f.icon}
              </div>
              <div className="feature-strip-content">
                <h3 className="feature-strip-title">{f.title}</h3>
                <p className="feature-strip-desc">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
