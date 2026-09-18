import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="public-layout">
      <Header />
      <main className="public-main">
        {children}
      </main>
      <Footer />
    </div>
  );
};
