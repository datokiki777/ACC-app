import { useMemo, useState } from 'react';

import { BottomSheet } from '../../components/BottomSheet';
import { useAppNavigation } from '../../app/useAppNavigation';
import {
  calculatePayrollOverview,
  calculateStatistics,
  type StatisticsScope,
} from '../../domain/statistics';
import { useAppStore } from '../../store/hooks';
import { formatDate, formatMoney } from '../../utils/format';

export function StatisticsSheet() {
  const mode = useAppStore((state) => state.mode);
  const people = useAppStore((state) => state.peopleByMode[state.mode]);
  const { requestClose } = useAppNavigation();
  const [scope, setScope] = useState<StatisticsScope>('active');
  const referenceDate = useMemo(() => new Date(), []);
  const scopedPeople = people.filter(
    (person) => scope === 'all' || Boolean(person.archived) === (scope === 'archived'),
  );
  const stats = calculateStatistics(people, mode, scope, referenceDate);
  const payroll = mode === 'work' ? calculatePayrollOverview(scopedPeople, referenceDate) : null;
  const maxMonthly = Math.max(1, ...stats.monthly.flatMap((month) => [month.gave, month.received]));

  return (
    <BottomSheet onClose={requestClose} title="Statistics" wide>
      <div className="scope-switch">
        {(['active', 'archived', 'all'] as const).map((value) => (
          <button
            className={scope === value ? 'is-selected' : ''}
            key={value}
            onClick={() => setScope(value)}
            type="button"
          >
            {value[0]?.toUpperCase()}
            {value.slice(1)}
          </button>
        ))}
      </div>
      <div className="stats-overview">
        <div>
          <small>{mode === 'work' ? 'Teams' : 'People'}</small>
          <strong>{stats.peopleCount}</strong>
        </div>
        <div>
          <small>Balance</small>
          <strong>
            {Object.entries(stats.balancesByCurrency).map(([currency, amount]) => (
              <span key={currency}>
                {formatMoney(amount, currency as 'EUR' | 'USD' | 'GEL' | 'CAD')}
              </span>
            ))}
          </strong>
        </div>
      </div>

      {payroll && (
        <section className="stats-section">
          <h3>Payroll</h3>
          <div className="payroll-totals">
            {Object.entries(payroll.totalsByCurrency).map(([currency, total]) => (
              <div key={currency}>
                {total.due > 0 && (
                  <span className="money-pill overdue">
                    Overdue{' '}
                    {formatMoney(total.due, currency as 'EUR' | 'USD' | 'GEL' | 'CAD', false)}
                  </span>
                )}
                <span className="money-pill upcoming">
                  Upcoming{' '}
                  {formatMoney(total.upcoming, currency as 'EUR' | 'USD' | 'GEL' | 'CAD', false)}
                </span>
              </div>
            ))}
          </div>
          {payroll.payDates.map((group) => (
            <div className="pay-date-row" key={group.date}>
              <strong>{formatDate(group.date)}</strong>
              <span>{group.rows.map((row) => row.name).join(', ')}</span>
            </div>
          ))}
        </section>
      )}

      <section className="stats-section">
        <h3>Last 6 Months</h3>
        <div className="month-chart">
          {stats.monthly.map((month) => (
            <div className="month-column" key={month.key}>
              <div className="bars">
                <span
                  className="gave-bar"
                  style={{ height: `${Math.round((month.gave / maxMonthly) * 100)}%` }}
                />
                <span
                  className="received-bar"
                  style={{ height: `${Math.round((month.received / maxMonthly) * 100)}%` }}
                />
              </div>
              <small>{month.label}</small>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span>● Gave</span>
          <span>● Received</span>
        </div>
      </section>

      <section className="stats-section">
        <h3>Quick Insights</h3>
        <div className="insight-grid">
          <div>
            <strong>{stats.entryCount}</strong>
            <small>Entries</small>
          </div>
          <div>
            <strong>
              {formatMoney(stats.averageEntry, stats.topBalances[0]?.currency ?? 'EUR', false)}
            </strong>
            <small>Average</small>
          </div>
          <div>
            <strong>{stats.mostActiveName ?? '—'}</strong>
            <small>Most active</small>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <h3>Top Balances</h3>
        {stats.topBalances.map((item) => (
          <div className="top-balance-row" key={item.id}>
            <span>{item.name}</span>
            <strong>{formatMoney(item.balance, item.currency)}</strong>
          </div>
        ))}
        {!stats.topBalances.length && <p className="mini-empty">No open balances</p>}
      </section>
    </BottomSheet>
  );
}
