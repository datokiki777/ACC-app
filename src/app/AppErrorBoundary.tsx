import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ACC application error', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error" role="alert">
          <img alt="ACC" src={`${import.meta.env.BASE_URL}icons/icon-192x192.png`} />
          <h1>ACC could not start</h1>
          <p>Your existing data has not been changed. Reload to try again.</p>
          <button onClick={() => window.location.reload()} type="button">
            Reload
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
