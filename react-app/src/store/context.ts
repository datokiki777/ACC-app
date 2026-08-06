import { createContext } from 'react';

import type { createAppStore } from './app-store';

export type AppStore = ReturnType<typeof createAppStore>;

export const AppStoreContext = createContext<AppStore | null>(null);
