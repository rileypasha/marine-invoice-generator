// React Test Entry Point
import React from 'react';
import { createRoot } from 'react-dom/client';
import PureMagicUITest from '../react/PureMagicUITest.jsx';

// Import shadcn/ui global styles
import '../styles/globals.css';

// Initialize React app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('react-test-root');
  if (container) {
    const root = createRoot(container);
    root.render(React.createElement(PureMagicUITest));
    console.log('✅ React test page loaded successfully!');
  } else {
    console.error('❌ React test container not found');
  }
});