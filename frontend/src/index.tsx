import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// If mobile device detector has taken over, don't mount React
if (!(window as any).__MOBILE_BLOCKED__) {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}