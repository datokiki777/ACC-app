import type { PersonTotals } from '../../domain/balances';
import type { GiftSummary } from '../../domain/salary';
import type { SalaryCalculationResult } from '../../types/domain';
import type { PersistedPerson } from '../../types/persistence';
import { formatDate, formatMoney } from '../../utils/format';

function moneyTone(value: number) {
  return value > 0 ? 'money-positive' : value < 0 ? 'money-negative' : 'money-neutral';
}

function moneyScale(value: number, currency: PersistedPerson['currency']) {
  const length = formatMoney(value, currency, false).length;
  return length >= 8 ? 'money-amount-xl' : length >= 7 ? 'money-amount-lg' : '';
}

interface FlowTotalsRowProps {
  className: string;
  currency: PersistedPerson['currency'];
  gave: number;
  net: number;
  received: number;
}

function FlowTotalsRow({ className, currency, gave, net, received }: FlowTotalsRowProps) {
  return (
    <div className={className}>
      <span>
        <small>Gave</small>
        <strong className={moneyTone(gave)}>{formatMoney(gave, currency, false)}</strong>
      </span>
      <span>
        <small>Received</small>
        <strong className={moneyTone(-received)}>{formatMoney(received, currency, false)}</strong>
      </span>
      <span className="money-summary-pair">
        <small>Net</small>
        <strong
          className={`money-value-pill money-net-pill ${moneyTone(net)} ${moneyScale(net, currency)}`}
        >
          {formatMoney(net, currency, false)}
        </strong>
      </span>
    </div>
  );
}

interface PayrollSummaryCardProps {
  currency: PersistedPerson['currency'];
  onSyncPayDate: () => void;
  salary: SalaryCalculationResult;
  totals: PersonTotals;
}

export function PayrollSummaryCard({
  currency,
  onSyncPayDate,
  salary,
  totals,
}: PayrollSummaryCardProps) {
  return (
    <section className="payroll-panel work-summary-panel">
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
      <button className="text-button" onClick={onSyncPayDate} type="button">
        ↻ Sync Pay Date
      </button>
      <FlowTotalsRow
        className="payroll-totals-row"
        currency={currency}
        gave={totals.gave}
        net={totals.balance}
        received={totals.received}
      />
    </section>
  );
}

interface OtherSummaryCardProps {
  summary: GiftSummary;
}

export function OtherSummaryCard({ summary }: OtherSummaryCardProps) {
  return (
    <section className="other-summary-panel work-summary-panel">
      <div className="other-panel-heading">
        <span>
          <strong>Other</strong>
          <small>Other balance</small>
        </span>
        <strong
          className={`money-value-pill ${moneyTone(summary.net)} ${moneyScale(summary.net, summary.currency)}`}
        >
          {formatMoney(summary.net, summary.currency, false)}
        </strong>
      </div>
      <FlowTotalsRow
        className="other-totals-row"
        currency={summary.currency}
        gave={summary.gave}
        net={summary.net}
        received={summary.received}
      />
    </section>
  );
}
