import { useContext } from 'react';
import { useStore } from 'zustand';

import type { AppStoreState } from './app-store';
import { AppStoreContext } from './context';

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider');
  return useStore(store, selector);
}
