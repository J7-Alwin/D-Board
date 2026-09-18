import React from 'react';
import { useRouter } from '../router/Router';
import { Button } from '../components/ui/Button';
import { ArrowRightIcon } from '../components/ui/Icons';

export const AboutPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="about-page">
      <section className="page-hero-section">
        <div className="container text-center">
          <div className="eyebrow">OUR PHILOSOPHY</div>
          <h1 className="heading-display page-title">Software development should feel focused, not fragmented.</h1>
          <p className="body-large page-subtitle">
            D-Board was engineered to eliminate context switching by bringing tasks, architecture notes, project assets, and deadlines together in one unified place.
          </p>
        </div>
      </section>

      <section className="about-content-section">
        <div className="container">
          <div className="about-editorial-grid">
            <div className="about-card">
              <span className="about-card-num">01</span>
              <h2 className="about-card-title">A Unified Workspace</h2>
              <p className="about-card-desc">
                Engineering teams shouldn't need six different tools just to plan a sprint, write an architecture note, and track a bug. D-Board centralizes the core essentials so developers can stay in flow.
              </p>
            </div>

            <div className="about-card">
              <span className="about-card-num">02</span>
              <h2 className="about-card-title">Modular Monolith Architecture</h2>
              <p className="about-card-desc">
                We believe in pragmatic engineering. D-Board is built as a typed modular monolith (React + Vite, Node.js + Express, PostgreSQL + Prisma 7) to provide peak responsiveness, simplicity, and maintainability.
              </p>
            </div>

            <div className="about-card">
              <span className="about-card-num">03</span>
              <h2 className="about-card-title">Project-Scoped Security</h2>
              <p className="about-card-desc">
                Permissions in D-Board are strictly project-scoped. You can manage internal services with full administrator capabilities while contributing to cross-functional tools with scoped member access.
              </p>
            </div>

            <div className="about-card">
              <span className="about-card-num">04</span>
              <h2 className="about-card-title">Fast, Restrained Design</h2>
              <p className="about-card-desc">
                No noisy neon buttons or sluggish dashboards. D-Board uses an intentional, editorial aesthetic with generous whitespace and rapid keyboard-friendly navigation.
              </p>
            </div>
          </div>

          <div className="page-bottom-cta">
            <h3 className="heading-card">Build better projects with your team.</h3>
            <div className="cta-btn-wrap">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRightIcon size={18} />}
                onClick={() => navigate('/register')}
              >
                Join D-Board
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
