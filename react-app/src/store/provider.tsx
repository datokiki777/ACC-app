import { type ReactNode, useState } from 'react';

import { accReactDatabase } from '../db/database';
import { createAppRepository } from '../db/repository';
import { createAppStore } from './app-store';
import { AppStoreContext, type AppStore } from './context';

export function AppStoreProvider({
  children,
  store: providedStore,
}: {
  children: ReactNode;
  store?: AppStore;
}) {
  const [store] = useState(
    () => providedStore ?? createAppStore({ repository: createAppRepository(accReactDatabase) }),
  );
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}
