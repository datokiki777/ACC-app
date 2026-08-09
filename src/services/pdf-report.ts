import { personOpenBalance, personTotals } from '../domain/balances';
import { calculateSalary } from '../domain/salary';
import type { AppMode, Currency, Person } from '../types/domain';

type ReportData = { personal: readonly Person[]; work: readonly Person[] };

export interface PrintablePdfReport {
  title: string;
  filename: string;
  html: string;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value: number, currency: Currency): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function reportDate(value: string): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : escapeHtml(value);
}

function safeFilename(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function entryRows(person: Person): string {
  if (!person.entries.length) return '<p class="empty">No entries yet.</p>';
  return `<table>
    <thead><tr><th>Date</th><th>Type</th><th>Note</th><th class="number">Amount</th></tr></thead>
    <tbody>${person.entries
      .map(
        (entry) => `<tr>
          <td>${reportDate(entry.date)}</td>
          <td>${escapeHtml(entry.category === 'salary' ? 'Salary' : entry.category === 'gift' ? 'Other' : entry.type)}</td>
          <td>${escapeHtml(entry.comment || '—')}</td>
          <td class="number ${entry.type === 'Gave' ? 'positive' : 'negative'}">${escapeHtml(money(entry.amount, person.currency))}</td>
        </tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

function personSection(person: Person, mode: AppMode, referenceDate: Date): string {
  const totals = personTotals(person);
  const openBalance = personOpenBalance(person, mode);
  const salary = mode === 'work' ? calculateSalary(person, referenceDate) : null;
  return `<section class="person">
    <div class="person-head">
      <div><h2>${escapeHtml(person.name)}</h2><p>${mode === 'work' ? 'Work team' : 'Personal'} · ${person.archived ? 'Archived' : 'Active'} · ${person.entries.length} ${person.entries.length === 1 ? 'entry' : 'entries'}</p></div>
      <strong class="balance ${openBalance >= 0 ? 'positive' : 'negative'}">${escapeHtml(money(openBalance, person.currency))}</strong>
    </div>
    <div class="metrics">
      <div><span>Gave</span><strong>${escapeHtml(money(totals.gave, person.currency))}</strong></div>
      <div><span>Received</span><strong>${escapeHtml(money(totals.received, person.currency))}</strong></div>
      <div><span>Net</span><strong>${escapeHtml(money(totals.balance, person.currency))}</strong></div>
      ${
        salary?.enabled
          ? `<div><span>Salary paid</span><strong>${escapeHtml(money(salary.paid, salary.currency))}</strong></div>
             <div><span>Upcoming</span><strong>${escapeHtml(money(salary.upcoming, salary.currency))}</strong></div>
             <div><span>Next pay</span><strong>${reportDate(salary.nextPayDate)}</strong></div>`
          : ''
      }
    </div>
    ${entryRows(person)}
  </section>`;
}

function documentHtml(title: string, subtitle: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#142238;background:#fff;font:12px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    header{display:flex;align-items:flex-end;justify-content:space-between;padding:0 0 14px;border-bottom:3px solid #ffc107;margin-bottom:16px}h1{margin:0;font-size:25px;color:#0b1c32}header p,.person-head p{margin:3px 0 0;color:#64748b}.brand{color:#d99e00;font-weight:800;letter-spacing:.08em}
    .person{break-inside:avoid;margin:0 0 16px;padding:14px;border:1px solid #cbd5e1;border-radius:14px}.person-head{display:flex;gap:16px;align-items:center;justify-content:space-between}.person h2{margin:0;font-size:18px}.balance{padding:7px 12px;border-radius:999px;background:#edf8f3;white-space:nowrap}.positive{color:#168a55}.negative{color:#d63f50}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.metrics div{padding:8px 10px;border-radius:9px;background:#f1f5f9}.metrics span{display:block;color:#64748b;font-size:10px}.metrics strong{display:block;margin-top:2px}
    table{width:100%;border-collapse:collapse}th,td{padding:7px 6px;border-top:1px solid #e2e8f0;text-align:left;vertical-align:top}th{color:#64748b;font-size:10px;text-transform:uppercase}.number{text-align:right;white-space:nowrap}.empty{color:#64748b;margin:10px 0 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.summary div{padding:10px;border-radius:10px;background:#eef3f8}.summary span{display:block;color:#64748b;font-size:10px}.summary strong{font-size:16px}
    footer{margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px}@media(max-width:600px){.metrics,.summary{grid-template-columns:repeat(2,1fr)}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><header><div><div class="brand">ACC</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><strong>${escapeHtml(new Date().toLocaleDateString())}</strong></header>${body}<footer>Generated by ACC · This report is a readable export; JSON remains the restorable backup format.</footer></body></html>`;
}

export function buildPersonPdfReport(
  person: Person,
  mode: AppMode,
  referenceDate = new Date(),
): PrintablePdfReport {
  const kind = mode === 'work' ? 'Team' : 'Person';
  return {
    title: `${person.name} · ACC report`,
    filename: `acc-${mode}-${safeFilename(person.name) || person.id}-${referenceDate.toISOString().slice(0, 10)}.pdf`,
    html: documentHtml(`${kind} report`, person.name, personSection(person, mode, referenceDate)),
  };
}

export function buildAllPdfReport(
  data: ReportData,
  referenceDate = new Date(),
): PrintablePdfReport {
  const all = [...data.personal, ...data.work];
  const entryCount = all.reduce((sum, person) => sum + person.entries.length, 0);
  const summary = `<div class="summary">
    <div><span>Personal</span><strong>${data.personal.length}</strong></div>
    <div><span>Work teams</span><strong>${data.work.length}</strong></div>
    <div><span>Entries</span><strong>${entryCount}</strong></div>
    <div><span>Archived</span><strong>${all.filter((person) => person.archived).length}</strong></div>
  </div>`;
  const sections = [
    ...data.personal.map((person) => personSection(person, 'personal', referenceDate)),
    ...data.work.map((person) => personSection(person, 'work', referenceDate)),
  ].join('');
  return {
    title: 'ACC complete report',
    filename: `acc-complete-report-${referenceDate.toISOString().slice(0, 10)}.pdf`,
    html: documentHtml('Complete report', 'Personal and Work data', `${summary}${sections}`),
  };
}

export function openPdfPrintDialog(report: PrintablePdfReport): void {
  const frame = document.createElement('iframe');
  frame.title = `${report.title} print preview`;
  frame.style.position = 'fixed';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.inset = '0 auto auto 0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.append(frame);
  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error('PDF printing is not supported by this browser.');
  }
  printDocument.open();
  printDocument.write(report.html);
  printDocument.close();
  printDocument.title = report.filename;
  const cleanup = () => frame.remove();
  printWindow.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
  window.setTimeout(cleanup, 60_000);
}
