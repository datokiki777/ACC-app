import { useState } from 'react';

import type { AppMode } from '../types/domain';
import type { PersistedPerson } from '../types/persistence';
import { BottomSheet } from './BottomSheet';

interface PersonPickerSheetProps {
  people: PersistedPerson[];
  mode: AppMode;
  onSelect: (person: PersistedPerson) => void;
  onClose: () => void;
}

export function PersonPickerSheet({ people, mode, onSelect, onClose }: PersonPickerSheetProps) {
  const [search, setSearch] = useState('');
  const label = mode === 'work' ? 'team' : 'person';
  const active = people.filter((person) => !person.archived);
  const filtered = active.filter((person) =>
    person.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <BottomSheet onClose={onClose} title="Add entry for…">
      {active.length > 6 && (
        <div className="search-field picker-search">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${label}s`}
            type="text"
            value={search}
          />
        </div>
      )}
      {active.length === 0 ? (
        <p className="mini-empty">
          No {label}s yet. Add {mode === 'work' ? 'a team' : 'a person'} first.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mini-empty">No matches.</p>
      ) : (
        <div className="picker-options">
          {filtered.map((person) => (
            <button
              className="picker-option"
              key={person.id}
              onClick={() => onSelect(person)}
              type="button"
            >
              <span className="picker-option-text">
                <span>{person.name}</span>
                <small>
                  {person.currency} · {person.entries.length} entries
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
