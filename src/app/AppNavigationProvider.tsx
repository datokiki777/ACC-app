import type { ReactNode } from 'react';

import { AppNavigationContext, type AppNavigationContextValue } from './app-navigation-context';

interface AppNavigationProviderProps extends AppNavigationContextValue {
  children: ReactNode;
}

export function AppNavigationProvider({
  children,
  closeAfterSave,
  reportFormDirty,
  requestClose,
}: AppNavigationProviderProps) {
  return (
    <AppNavigationContext.Provider value={{ closeAfterSave, reportFormDirty, requestClose }}>
      {children}
    </AppNavigationContext.Provider>
  );
}
