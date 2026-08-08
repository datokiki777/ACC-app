export type AppDestination = 'home' | 'statistics' | 'backup' | 'settings';

interface BottomNavigationProps {
  active: AppDestination;
  onNavigate: (destination: AppDestination) => void;
}

const items: Array<{ destination: AppDestination; label: string }> = [
  { destination: 'home', label: 'Home' },
  { destination: 'statistics', label: 'Stats' },
  { destination: 'backup', label: 'Backup' },
  { destination: 'settings', label: 'Settings' },
];

export function BottomNavigation({ active, onNavigate }: BottomNavigationProps) {
  return (
    <nav aria-label="Primary navigation" className="bottom-navigation">
      {items.map((item) => (
        <button
          aria-current={active === item.destination ? 'page' : undefined}
          className={active === item.destination ? 'is-active' : undefined}
          key={item.destination}
          onClick={() => onNavigate(item.destination)}
          type="button"
        >
          <NavigationIcon destination={item.destination} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function NavigationIcon({ destination }: { destination: AppDestination }) {
  if (destination === 'home') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m3 11 9-8 9 8v9H6v-9M9 20v-6h6v6" />
      </svg>
    );
  }
  if (destination === 'statistics') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20" />
      </svg>
    );
  }
  if (destination === 'backup') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}
