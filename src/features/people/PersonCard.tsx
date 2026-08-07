import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';

import { personOpenBalance, personTotals } from '../../domain/balances';
import { entryEffect } from '../../domain/entries';
import { calculateSalary, giftSummary } from '../../domain/salary';
import { useAppStore } from '../../store/hooks';
import type { PersistedPerson } from '../../types/persistence';
import { formatDate, formatMoney } from '../../utils/format';

export type PersonSwipeAction = 'archive' | 'delete';

const SWIPE_ACTION_WIDTH = 92;
const SWIPE_OPEN_THRESHOLD = 46;
const SWIPE_AXIS_THRESHOLD = 7;

interface SwipeDrag {
  pointerId: number;
  startX: number;
  startY: number;
  baseOffset: number;
  axis: 'pending' | 'horizontal' | 'vertical';
}

interface PersonCardProps {
  person: PersistedPerson;
  highlighted: boolean;
  onDeletePerson: () => void;
  onDeleteEntry: (entryId: string) => void;
  swipeOpen: PersonSwipeAction | null;
  onSwipeOpen: (action: PersonSwipeAction | null) => void;
}

export function PersonCard({
  person,
  highlighted,
  onDeletePerson,
  onDeleteEntry,
  swipeOpen,
  onSwipeOpen,
}: PersonCardProps) {
  const dragRef = useRef<SwipeDrag | null>(null);
  const currentOffsetRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mode = useAppStore((state) => state.mode);
  const expanded = useAppStore((state) => state.expandedPersonId === person.id);
  const setExpanded = useAppStore((state) => state.setExpandedPerson);
  const openSheet = useAppStore((state) => state.openSheet);
  const toggleArchive = useAppStore((state) => state.toggleArchive);
  const balance = personOpenBalance(person, mode);
  const totals = personTotals(person);
  const salary = mode === 'work' ? calculateSalary(person, new Date()) : null;
  const gifts = mode === 'work' ? giftSummary(person) : null;
  const restingOffset =
    swipeOpen === 'archive' ? SWIPE_ACTION_WIDTH : swipeOpen === 'delete' ? -SWIPE_ACTION_WIDTH : 0;
  const visibleOffset = dragOffset ?? restingOffset;

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseOffset: restingOffset,
      axis: 'pending',
    };
    currentOffsetRef.current = restingOffset;
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (drag.axis === 'pending') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_AXIS_THRESHOLD) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        drag.axis = 'vertical';
        return;
      }
      drag.axis = 'horizontal';
      suppressClickRef.current = true;
      setIsDragging(true);
    }

    if (drag.axis !== 'horizontal') return;
    event.preventDefault();
    const nextOffset = Math.max(
      -SWIPE_ACTION_WIDTH,
      Math.min(SWIPE_ACTION_WIDTH, drag.baseOffset + deltaX),
    );
    currentOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  }

  function finishPointerGesture(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.axis === 'horizontal') {
      const offset = currentOffsetRef.current;
      onSwipeOpen(
        offset >= SWIPE_OPEN_THRESHOLD
          ? 'archive'
          : offset <= -SWIPE_OPEN_THRESHOLD
            ? 'delete'
            : null,
      );
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
    setDragOffset(null);
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function cancelPointerGesture(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    currentOffsetRef.current = restingOffset;
    setDragOffset(null);
    setIsDragging(false);
    suppressClickRef.current = false;
  }

  return (
    <article
      className={`person-card ${expanded ? 'is-expanded' : ''} ${highlighted ? 'is-highlighted' : ''}`}
      data-swipe-card-id={person.id}
    >
      <div className="swipe-summary-shell">
        <div aria-hidden={swipeOpen !== 'archive'} className="swipe-action swipe-action-archive">
          <button
            aria-label={`${person.archived ? 'Unarchive' : 'Archive'} ${person.name}`}
            onClick={() => {
              onSwipeOpen(null);
              void toggleArchive(person.id);
            }}
            tabIndex={swipeOpen === 'archive' ? 0 : -1}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" />
              <path d={person.archived ? 'm9 16 3-3 3 3' : 'm9 13 3 3 3-3'} />
            </svg>
            <span>{person.archived ? 'Unarchive' : 'Archive'}</span>
          </button>
        </div>
        <div aria-hidden={swipeOpen !== 'delete'} className="swipe-action swipe-action-delete">
          <button
            aria-label={`Delete ${person.name}`}
            onClick={() => {
              onSwipeOpen(null);
              onDeletePerson();
            }}
            tabIndex={swipeOpen === 'delete' ? 0 : -1}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
            </svg>
            <span>Delete</span>
          </button>
        </div>
        <button
          aria-expanded={expanded}
          className={`person-summary ${isDragging ? 'is-dragging' : ''}`}
          onClick={(event) => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              event.preventDefault();
              return;
            }
            if (swipeOpen) {
              onSwipeOpen(null);
              return;
            }
            setExpanded(expanded ? null : person.id);
          }}
          onPointerCancel={cancelPointerGesture}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerGesture}
          style={{ transform: `translate3d(${visibleOffset}px, 0, 0)` }}
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
      </div>

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
                <div className={`entry-row ${entry.comment ? 'has-comment' : ''}`} key={entry.id}>
                  <strong
                    className={`entry-kind ${entry.type === 'Gave' ? 'positive' : 'negative'}`}
                  >
                    {mode === 'work'
                      ? entry.category === 'salary'
                        ? 'Salary'
                        : entry.category === 'gift'
                          ? 'Other'
                          : entry.type
                      : entry.type}
                  </strong>
                  <strong className={`entry-amount ${effect < 0 ? 'negative' : 'positive'}`}>
                    {formatMoney(effect, person.currency)}
                  </strong>
                  {entry.comment && <p className="entry-comment">{entry.comment}</p>}
                  <small className="entry-date">{formatDate(entry.date)}</small>
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
