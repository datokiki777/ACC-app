import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { AppStoreProvider } from './store/provider';
import './styles/index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('ACC root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppStoreProvider>
        <App />
        <PwaUpdatePrompt />
      </AppStoreProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
