import { personOpenBalance } from '../../domain/balances';
import type { PersistedPerson } from '../../types/persistence';
import { useAppStore } from '../../store/hooks';
import { PersonCard } from './PersonCard';

const COLOR_ORDER = [
  '#5692ff',
  '#35c26b',
  '#ff6b6b',
  '#ffb84d',
  '#b98cff',
  '#4fd1c5',
  '#ff8fce',
  '#9aaac4',
];

function activityTime(person: PersistedPerson): number {
  const entryTimes = person.entries.map((entry) => Date.parse(entry.date)).filter(Number.isFinite);
  return Math.max(0, ...entryTimes, person.createdAt ? Date.parse(person.createdAt) : 0);
}

interface PeopleListProps {
  onDeletePerson: (person: PersistedPerson) => void;
  onDeleteEntry: (person: PersistedPerson, entryId: string) => void;
}

export function PeopleList({ onDeletePerson, onDeleteEntry }: PeopleListProps) {
  const mode = useAppStore((state) => state.mode);
  const people = useAppStore((state) => state.peopleByMode[state.mode]);
  const search = useAppStore((state) => state.search.trim().toLowerCase());
  const filter = useAppStore((state) => state.filter);
  const filtered = people
    .filter((person) => search || Boolean(person.archived) === (filter === 'archived'))
    .filter((person) => person.name.toLowerCase().includes(search))
    .sort((first, second) => {
      const firstColor = COLOR_ORDER.indexOf(first.tagColor ?? '');
      const secondColor = COLOR_ORDER.indexOf(second.tagColor ?? '');
      const colorDifference =
        (firstColor < 0 ? 999 : firstColor) - (secondColor < 0 ? 999 : secondColor);
      return colorDifference || activityTime(second) - activityTime(first);
    });
  const ranked = [...filtered]
    .map((person) => ({ id: person.id, balance: Math.abs(personOpenBalance(person, mode)) }))
    .filter((item) => item.balance > 0)
    .sort((first, second) => second.balance - first.balance)
    .slice(0, 3);
  const highlighted =
    filtered.length > 3 ? new Set(ranked.map((item) => item.id)) : new Set<string>();

  if (!filtered.length) {
    return (
      <section className="empty-card">
        <div className="empty-icon">{search ? '🔍' : filter === 'archived' ? '🗄️' : '📒'}</div>
        <h2>
          {search ? 'No matches' : filter === 'archived' ? 'No archived people' : 'No records yet'}
        </h2>
        <p>
          {search
            ? 'Try another name.'
            : filter === 'archived'
              ? 'Archived records will appear here.'
              : 'Tap the plus button to add your first person.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-label={mode === 'work' ? 'Teams' : 'People'} className="people-list">
      {filtered.map((person) => (
        <PersonCard
          highlighted={highlighted.has(person.id)}
          key={person.id}
          onDeleteEntry={(entryId) => onDeleteEntry(person, entryId)}
          onDeletePerson={() => onDeletePerson(person)}
          person={person}
        />
      ))}
    </section>
  );
}
