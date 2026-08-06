import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import './styles/index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('ACC root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <PwaUpdatePrompt />
    </AppErrorBoundary>
  </StrictMode>,
);
