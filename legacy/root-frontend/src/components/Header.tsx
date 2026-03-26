import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <span className="logo-text">Mello</span>
          <span className="logo-badge">minds</span>
        </div>
      </div>
    </header>
  );
};

export default Header;