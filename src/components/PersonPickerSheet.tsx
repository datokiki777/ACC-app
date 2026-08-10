import { useState } from 'react';

import { sortPeopleByTagAndActivity } from '../domain/people-sort';
import type { AppMode } from '../types/domain';
import type { PersistedPerson } from '../types/persistence';
import { formatDate } from '../utils/format';
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
  const active = sortPeopleByTagAndActivity(people.filter((person) => !person.archived));
  const nameCounts = new Map<string, number>();
  active.forEach((person) => {
    const key = person.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });
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
          {filtered.map((person) => {
            const isDuplicateName = (nameCounts.get(person.name.trim().toLowerCase()) ?? 0) > 1;
            return (
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
                    {isDuplicateName && person.createdAt
                      ? ` · added ${formatDate(person.createdAt.slice(0, 10))}`
                      : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
