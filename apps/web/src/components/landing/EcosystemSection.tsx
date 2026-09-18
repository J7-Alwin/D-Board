import React from 'react';

export const EcosystemSection: React.FC = () => {
  const tools = [
    { name: 'GitHub', icon: '⌘' },
    { name: 'Vercel', icon: '▲' },
    { name: 'Linear', icon: '◰' },
    { name: 'Notion', icon: 'Ⓝ' },
    { name: 'Figma', icon: '❖' },
    { name: 'Discord', icon: '●' },
  ];

  return (
    <section className="ecosystem-section" aria-label="Ecosystem compatibility">
      <div className="container ecosystem-container">
        <div className="ecosystem-label">
          TRUSTED BY DEVELOPERS AND TEAMS
        </div>
        <div className="ecosystem-logos">
          {tools.map((t) => (
            <div key={t.name} className="ecosystem-item">
              <span className="tool-glyph" aria-hidden="true">{t.icon}</span>
              <span className="tool-name">{t.name}</span>
            </div>
          ))}
          <div className="ecosystem-item more-item">
            <span className="more-text">AND MANY MORE</span>
          </div>
        </div>
      </div>
    </section>
  );
};
