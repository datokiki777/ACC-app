import { useContext, useEffect } from 'react';

import { AppNavigationContext } from './app-navigation-context';

export function useAppNavigation() {
  const context = useContext(AppNavigationContext);
  if (!context) throw new Error('useAppNavigation must be used inside AppNavigationProvider');
  return context;
}

export function useUnsavedForm(isDirty: boolean) {
  const { reportFormDirty } = useAppNavigation();

  useEffect(() => {
    reportFormDirty(isDirty);
    return () => reportFormDirty(false);
  }, [isDirty, reportFormDirty]);
}
