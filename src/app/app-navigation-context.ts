import { createContext } from 'react';

export interface AppNavigationContextValue {
  closeAfterSave: () => void;
  reportFormDirty: (dirty: boolean) => void;
  requestClose: () => void;
}

export const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);
