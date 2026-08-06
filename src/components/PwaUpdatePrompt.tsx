import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <aside aria-label="Application update" className="update-prompt" role="dialog">
      <strong>New ACC version available</strong>
      <p>Reload when you are ready to use the updated offline app.</p>
      <div>
        <button onClick={() => setNeedRefresh(false)} type="button">
          Later
        </button>
        <button onClick={() => void updateServiceWorker(true)} type="button">
          Update
        </button>
      </div>
    </aside>
  );
}
