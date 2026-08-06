import { useEffect, useState } from 'react';

const SPLASH_DURATION_MS = 700;

export function StartupScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div aria-label="ACC is loading" className="startup-screen" role="status">
      <img alt="ACC" src={`${import.meta.env.BASE_URL}icons/icon-512x512.png`} />
      <strong>ACC</strong>
      <span>Personal · Work · Balance</span>
    </div>
  );
}
