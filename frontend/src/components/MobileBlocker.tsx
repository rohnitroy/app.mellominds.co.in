import React, { useEffect, useState } from 'react';
import './MobileBlocker.css';

interface MobileBlockerProps {
  children: React.ReactNode;
}

const MobileBlocker: React.FC<MobileBlockerProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const isMobileDevice = mobileRegex.test(userAgent.toLowerCase()) || window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="mobile-blocker-container">
        <div className="mobile-blocker-content">
          <div className="mobile-blocker-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
          </div>
          <h1 className="mobile-blocker-title">Desktop Experience</h1>
          <p className="mobile-blocker-message">
            MelloMinds is optimized for desktop. Please access from a desktop or laptop for the best experience and full functionality.
          </p>
          <div className="mobile-blocker-footer">
            <p className="mobile-blocker-hint">Visit us on a larger screen for better experience</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileBlocker;
