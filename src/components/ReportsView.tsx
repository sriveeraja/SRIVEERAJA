import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, MessageCircle } from 'lucide-react';
import { Customer, Transaction } from '../types/ledger';
import { computeCustomerBalance } from '../utils/seedData';
import { formatINR } from '../utils/localization';
import { exportTransactionsCsv } from '../utils/exportUtils';

type ReportGranularity = 'daily' | 'weekly' | 'monthly';

interface ReportsViewProps {
  shopName: string;
  customers: Customer[];
  transactions: Transaction[];
  onDownloadPdf: (customer: Customer) => void;
  onOpenWhatsApp: (customer: Customer) => void;
  onOpenCustomerProfile: (customer: Customer) => void;
}

interface PeriodBucket {
  key: string;
  label: string;
  credit: number;
  payment: number;
  entryCount: number;
}

function getWeekStartISO(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

export function ReportsView({
  shopName,
  customers,
  transactions,
  onDownloadPdf,
  onOpenWhatsApp,
  onOpenCustomerProfile,
}: ReportsViewProps) {
  const [granularity, setGranularity] = useState<ReportGranularity>('daily');

  const buckets = useMemo(() => {
    const map = new Map<string, PeriodBucket>();

    for (const tx of transactions) {
      let key = tx.date;
      let label = tx.date;

      if (granularity === 'weekly') {
        key = getWeekStartISO(tx.date);
        label = `Week of ${key}`;
      } else if (granularity === 'monthly') {
        key = tx.date.slice(0, 7);
        const [yr, mo] = key.split('-').map(Number);
        label = new Date(Date.UTC(yr, mo - 1, 1)).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
      }

      const existing = map.get(key) || {
        key,
        label,
        credit: 0,
        payment: 0,
        entryCount: 0,
      };
      if (tx.type === 'CREDIT') {
        existing.credit += tx.amount;
      } else {
        existing.payment += tx.amount;
      }
      existing.entryCount += 1;
      map.set(key, existing);
    }

    const limit = granularity === 'daily' ? 14 : granularity === 'weekly' ? 8 : 6;
    return Array.from(map.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, limit);
  }, [transactions, granularity]);

  const totals = useMemo(() => {
    const credit = transactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((s, t) => s + t.amount, 0);
    const payment = transactions
      .filter((t) => t.type === 'PAYMENT')
      .reduce((s, t) => s + t.amount, 0);
    const collectionRate = credit > 0 ? Math.min(999, Math.round((payment / credit) * 100)) : 100;
    return {
      credit,
      payment,
      netOutstanding: credit - payment,
      collectionRate,
    };
  }, [transactions]);

  const maxBucketAmount = useMemo(() => {
    return buckets.reduce((max, b) => Math.max(max, b.credit, b.payment), 1);
  }, [buckets]);

  const customerSummaries = useMemo(() => {
    return customers
      .map((customer) => {
        const custTxs = transactions.filter((t) => t.customerId === customer.id);
        const credit = custTxs
          .filter((t) => t.type === 'CREDIT')
          .reduce((s, t) => s + t.amount, 0);
        const payment = custTxs
          .filter((t) => t.type === 'PAYMENT')
          .reduce((s, t) => s + t.amount, 0);
        const balance = computeCustomerBalance(customer.id, transactions);
        return {
          customer,
          credit,
          payment,
          balance,
          txCount: custTxs.length,
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [customers, transactions]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Business Reports & Statements
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {shopName} · Daily, weekly & monthly udhaar breakdown, CSV/PDF exports, and WhatsApp reminders
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportTransactionsCsv(transactions, customers, shopName, 'khatawas-full-ledger')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Full CSV</span>
        </button>
      </div>

      {/* Period Aggregates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cumulative Credit Given
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400 mt-1">
            ₹{formatINR(totals.credit)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Total Udhaara</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cumulative Payments
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            ₹{formatINR(totals.payment)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Total Jama</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Net Ledger Balance
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            ₹{formatINR(Math.abs(totals.netOutstanding))}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {totals.netOutstanding >= 0 ? 'Receivable' : 'Net Advance'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Recovery Ratio
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-400 mt-1">
            {totals.collectionRate}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Payments vs. Credit
          </div>
        </div>
      </div>

      {/* Daily / Weekly / Monthly Credit vs Payments Breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
              Credit vs. Payments Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare udhaar issued against jama collected across time periods
            </p>
          </div>

          <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ] as { id: ReportGranularity; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGranularity(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  granularity === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600 dark:bg-red-500 inline-block" />
            Credit (Udhaar)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500 inline-block" />
            Payment (Jama)
          </span>
        </div>

        {buckets.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No transactions recorded in this shop yet.
          </div>
        ) : (
          <div className="space-y-3">
            {buckets.map((bucket) => {
              const creditPct = Math.round((bucket.credit / maxBucketAmount) * 100);
              const paymentPct = Math.round((bucket.payment / maxBucketAmount) * 100);
              const net = bucket.credit - bucket.payment;

              return (
                <div
                  key={bucket.key}
                  className="py-2.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {bucket.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {bucket.entryCount} {bucket.entryCount === 1 ? 'entry' : 'entries'} · Net{' '}
                      {net >= 0 ? '+' : '-'}₹{formatINR(Math.abs(net))}
                    </div>
                  </div>

                  <div className="md:col-span-6 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 dark:bg-red-500 rounded-full transition-all"
                          style={{ width: `${bucket.credit > 0 ? Math.max(4, creditPct) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-red-700 dark:text-red-400 w-24 text-right">
                        +₹{formatINR(bucket.credit)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${bucket.payment > 0 ? Math.max(4, paymentPct) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 w-24 text-right">
                        -₹{formatINR(bucket.payment)}
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-3 text-left md:text-right">
                    <span
                      className={`text-xs font-semibold font-mono tabular-nums ${
                        net > 0
                          ? 'text-red-700 dark:text-red-400'
                          : net < 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {net > 0
                        ? `Net +₹${formatINR(net)} Udhaar`
                        : net < 0
                          ? `Net -₹${formatINR(Math.abs(net))} Paid`
                          : 'Balanced (₹0)'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Statements & Reminders Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
              Customer Statements & Payment Reminders
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Download individual PDF statements or send a Kannada/English/Hindi WhatsApp reminder
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {customerSummaries.length} accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4 text-right">Total Credit</th>
                <th className="py-2.5 px-4 text-right">Total Paid</th>
                <th className="py-2.5 px-4 text-right">Net Balance</th>
                <th className="py-2.5 px-4 text-right">Export & Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {customerSummaries.map(({ customer, credit, payment, balance, txCount }) => (
                <tr
                  key={customer.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onOpenCustomerProfile(customer)}
                      className="font-medium text-slate-900 dark:text-slate-100 hover:underline text-left"
                    >
                      {customer.name}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {customer.area} · {customer.phone} · {txCount} entries
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700 dark:text-red-400">
                    ₹{formatINR(credit)}
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    ₹{formatINR(payment)}
                  </td>

                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                      balance > 0
                        ? 'text-red-700 dark:text-red-400'
                        : balance < 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ₹{formatINR(Math.abs(balance))}
                    {balance < 0 ? ' Cr' : balance === 0 ? ' · Settled' : ''}
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(customer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
                        <span>PDF</span>
                        <Download className="w-3 h-3 opacity-60" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp(customer)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
