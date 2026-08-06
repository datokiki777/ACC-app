import { personOpenBalance, personTotals } from '../../domain/balances';
import { entryEffect } from '../../domain/entries';
import { calculateSalary, giftSummary } from '../../domain/salary';
import { useAppStore } from '../../store/hooks';
import type { PersistedPerson } from '../../types/persistence';
import { formatDate, formatMoney } from '../../utils/format';

interface PersonCardProps {
  person: PersistedPerson;
  highlighted: boolean;
  onDeletePerson: () => void;
  onDeleteEntry: (entryId: string) => void;
}

export function PersonCard({
  person,
  highlighted,
  onDeletePerson,
  onDeleteEntry,
}: PersonCardProps) {
  const mode = useAppStore((state) => state.mode);
  const expanded = useAppStore((state) => state.expandedPersonId === person.id);
  const setExpanded = useAppStore((state) => state.setExpandedPerson);
  const openSheet = useAppStore((state) => state.openSheet);
  const toggleArchive = useAppStore((state) => state.toggleArchive);
  const balance = personOpenBalance(person, mode);
  const totals = personTotals(person);
  const salary = mode === 'work' ? calculateSalary(person, new Date()) : null;
  const gifts = mode === 'work' ? giftSummary(person) : null;

  return (
    <article
      className={`person-card ${expanded ? 'is-expanded' : ''} ${highlighted ? 'is-highlighted' : ''}`}
    >
      <button
        aria-expanded={expanded}
        className="person-summary"
        onClick={() => setExpanded(expanded ? null : person.id)}
        type="button"
      >
        <span className="person-identity">
          <span className="person-name-row">
            <strong>{person.name}</strong>
            {person.archived && <span className="status-chip">Archived</span>}
            {salary?.due ? <span className="status-chip status-overdue">Overdue</span> : null}
            {(person.tagLabel || person.tagColor) && (
              <span
                className="tag-chip"
                style={
                  person.tagColor
                    ? { color: person.tagColor, borderColor: `${person.tagColor}77` }
                    : undefined
                }
              >
                {person.tagColor && (
                  <span className="tag-dot" style={{ background: person.tagColor }} />
                )}
                {person.tagLabel}
              </span>
            )}
          </span>
          <small>
            {person.currency} · {person.entries.length}{' '}
            {person.entries.length === 1 ? 'entry' : 'entries'}
          </small>
        </span>
        <span
          className={`balance-value ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : ''}`}
        >
          {formatMoney(balance, person.currency)}
        </span>
        <span className="expand-arrow">›</span>
      </button>

      {expanded && (
        <div className="person-details">
          {salary?.enabled && (
            <section className="payroll-panel">
              <div className="panel-heading">
                <div>
                  <strong>Payroll</strong>
                  <small>
                    {formatMoney(salary.monthly, salary.currency, false)} / month · every{' '}
                    {salary.periodWeeks}w
                  </small>
                </div>
                <div className="payroll-pills">
                  {salary.due > 0 && (
                    <span className="money-pill overdue">
                      Overdue {formatMoney(salary.due, salary.currency, false)}
                    </span>
                  )}
                  {salary.upcoming > 0 && (
                    <span className={`money-pill upcoming ${salary.paySoon ? 'soon' : ''}`}>
                      {salary.paySoon ? 'Due soon' : 'Upcoming'}{' '}
                      {formatMoney(salary.upcoming, salary.currency, false)}
                    </span>
                  )}
                </div>
              </div>
              <div className="panel-grid">
                <span>
                  Paid <strong>{formatMoney(salary.paid, salary.currency, false)}</strong>
                </span>
                <span>
                  {salary.ended ? 'Ended' : 'Next pay'}{' '}
                  <strong>{formatDate(salary.ended ? salary.endDate : salary.nextPayDate)}</strong>
                </span>
              </div>
              <button
                className="text-button"
                onClick={() => openSheet('salary-sync', person.id)}
                type="button"
              >
                ↻ Sync Pay Date
              </button>
            </section>
          )}

          {gifts && (gifts.gave || gifts.received) ? (
            <section className="other-panel">
              <span>
                <strong>Other</strong>
                <small>Other balance</small>
              </span>
              <strong className={gifts.net < 0 ? 'negative' : 'positive'}>
                {formatMoney(gifts.net, gifts.currency)}
              </strong>
            </section>
          ) : null}

          {!!person.entries.length && (
            <div className="totals-row">
              <span>↑ {formatMoney(totals.gave, person.currency, false)}</span>
              <span>↓ {formatMoney(totals.received, person.currency, false)}</span>
              <strong>Net {formatMoney(totals.balance, person.currency)}</strong>
            </div>
          )}
          <div className="entries-list">
            {person.entries.map((entry) => {
              const effect = entryEffect(entry.type, entry.amount);
              return (
                <div className="entry-row" key={entry.id}>
                  <div>
                    <strong className={entry.type === 'Gave' ? 'positive' : 'negative'}>
                      {mode === 'work'
                        ? entry.category === 'salary'
                          ? 'Salary'
                          : entry.category === 'gift'
                            ? 'Other'
                            : entry.type
                        : entry.type}
                    </strong>
                    {entry.comment && <p>{entry.comment}</p>}
                    <small>{formatDate(entry.date)}</small>
                  </div>
                  <strong className={effect < 0 ? 'negative' : 'positive'}>
                    {formatMoney(effect, person.currency)}
                  </strong>
                  <div className="mini-actions">
                    <button
                      aria-label="Edit entry"
                      onClick={() => openSheet('entry-form', person.id, entry.id)}
                      type="button"
                    >
                      ✎
                    </button>
                    <button
                      aria-label="Delete entry"
                      onClick={() => onDeleteEntry(entry.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
            {!person.entries.length && <p className="mini-empty">No entries yet</p>}
          </div>

          <div className="card-actions">
            <button
              className="primary-button"
              onClick={() => openSheet('entry-form', person.id)}
              type="button"
            >
              + Add Entry
            </button>
            <button
              className="secondary-button"
              onClick={() => openSheet('person-form', person.id)}
              type="button"
            >
              Edit
            </button>
            <button
              className="secondary-button"
              onClick={() => void toggleArchive(person.id)}
              type="button"
            >
              {person.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button className="danger-icon-button" onClick={onDeletePerson} type="button">
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
