import { useMemo, useState } from 'react';
import {
  Edit2,
  FileSpreadsheet,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { Customer, Transaction, TransactionType } from '../types/ledger';
import { computeCustomerBalance, getTodayISO } from '../utils/seedData';
import { formatINR, getLanguageLabel } from '../utils/localization';
import { exportTransactionsCsv } from '../utils/exportUtils';

interface UndoBannerState {
  message: string;
  transaction: Transaction;
}

interface LedgerWorkspaceProps {
  shopName: string;
  customers: Customer[];
  transactions: Transaction[];
  selectedCustomerFilter: string;
  onSelectCustomerFilter: (customerId: string) => void;
  undoBanner: UndoBannerState | null;
  onUndoLast: () => void;
  onDismissUndoBanner: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onOpenCustomerProfile: (customer: Customer) => void;
  onTriggerDailySummary: () => void;
}

export function LedgerWorkspace({
  shopName,
  customers,
  transactions,
  selectedCustomerFilter,
  onSelectCustomerFilter,
  undoBanner,
  onUndoLast,
  onDismissUndoBanner,
  onEditTransaction,
  onDeleteTransaction,
  onOpenCustomerProfile,
  onTriggerDailySummary,
}: LedgerWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const today = getTodayISO();

  const metrics = useMemo(() => {
    const balances = customers.map((c) => computeCustomerBalance(c.id, transactions));
    const totalOutstanding = balances.reduce((sum, b) => sum + Math.max(0, b), 0);
    const openAccountsCount = balances.filter((b) => b > 0).length;

    const todayCredits = transactions.filter((t) => t.date === today && t.type === 'CREDIT');
    const todayPayments = transactions.filter((t) => t.date === today && t.type === 'PAYMENT');

    const creditToday = todayCredits.reduce((sum, t) => sum + t.amount, 0);
    const collectedToday = todayPayments.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalOutstanding,
      openAccountsCount,
      creditToday,
      creditTodayCount: todayCredits.length,
      collectedToday,
      collectedTodayCount: todayPayments.length,
      customerCount: customers.length,
    };
  }, [customers, transactions, today]);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.id, c);
    return map;
  }, [customers]);

  const hasActiveFilters = Boolean(
    selectedCustomerFilter ||
      searchQuery.trim() ||
      typeFilter !== 'ALL' ||
      dateFrom ||
      dateTo ||
      minAmount ||
      maxAmount
  );

  const clearAllFilters = () => {
    onSelectCustomerFilter('');
    setSearchQuery('');
    setTypeFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setMinAmount('');
    setMaxAmount('');
  };

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minAmt = minAmount !== '' ? Number(minAmount) : null;
    const maxAmt = maxAmount !== '' ? Number(maxAmount) : null;

    return [...transactions]
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt.localeCompare(a.createdAt);
      })
      .filter((tx) => {
        if (selectedCustomerFilter && tx.customerId !== selectedCustomerFilter) return false;
        if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;
        if (minAmt !== null && Number.isFinite(minAmt) && tx.amount < minAmt) return false;
        if (maxAmt !== null && Number.isFinite(maxAmt) && tx.amount > maxAmt) return false;

        if (!q) return true;
        const cust = customerMap.get(tx.customerId);
        return (
          tx.note.toLowerCase().includes(q) ||
          (tx.sourceCommand || '').toLowerCase().includes(q) ||
          (cust?.name || '').toLowerCase().includes(q) ||
          (cust?.area || '').toLowerCase().includes(q) ||
          (cust?.note || '').toLowerCase().includes(q) ||
          String(tx.amount).includes(q)
        );
      });
  }, [
    transactions,
    selectedCustomerFilter,
    typeFilter,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    searchQuery,
    customerMap,
  ]);

  const activeFilterCustomer = selectedCustomerFilter
    ? customerMap.get(selectedCustomerFilter)
    : undefined;

  return (
    <div className="space-y-5">
      {/* Persistent Undo Banner */}
      {undoBanner && (
        <div
          className="bg-slate-900 dark:bg-indigo-950 border border-slate-800 dark:border-indigo-800 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          role="status"
        >
          <p className="text-sm font-medium">{undoBanner.message}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onUndoLast}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Last Transaction</span>
            </button>
            <button
              type="button"
              onClick={onDismissUndoBanner}
              aria-label="Dismiss saved notification"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Outstanding
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            ₹{formatINR(metrics.totalOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {metrics.openAccountsCount} open accounts
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Today’s Credit (Udhaara)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400 mt-1">
            ₹{formatINR(metrics.creditToday)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {metrics.creditTodayCount} {metrics.creditTodayCount === 1 ? 'entry' : 'entries'} today
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Today’s Payments (Jama)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            ₹{formatINR(metrics.collectedToday)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {metrics.collectedTodayCount}{' '}
            {metrics.collectedTodayCount === 1 ? 'receipt' : 'receipts'} today
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Customers
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {metrics.customerCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {transactions.length} ledger entries
          </div>
        </div>
      </div>

      {/* Ledger History Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Primary Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
                {activeFilterCustomer
                  ? `${activeFilterCustomer.name} (${activeFilterCustomer.area}) Ledger`
                  : 'Khata Transactions'}
              </h2>
              <span className="text-xs text-slate-400 dark:text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {filteredTransactions.length} entries
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline ml-1"
                >
                  Reset filters
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, note, ₹..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg w-full sm:w-44 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <select
                aria-label="Filter by customer"
                value={selectedCustomerFilter}
                onChange={(e) => onSelectCustomerFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.area})
                  </option>
                ))}
              </select>

              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['ALL', 'CREDIT', 'PAYMENT'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTypeFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      typeFilter === tab
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab === 'ALL' ? 'All' : tab === 'CREDIT' ? 'Credit' : 'Payment'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onTriggerDailySummary}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Daily Voice Summary</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportTransactionsCsv(
                    filteredTransactions,
                    customers,
                    shopName,
                    hasActiveFilters ? 'khatawas-filtered' : 'khatawas-ledger'
                  )
                }
                disabled={filteredTransactions.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                aria-expanded={showAdvancedFilters}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  showAdvancedFilters || dateFrom || dateTo || minAmount || maxAmount
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Advanced Date Range & Min/Max Amount Filter Row */}
          {showAdvancedFilters && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label
                  htmlFor="filter-date-from"
                  className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  From Date
                </label>
                <input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label
                  htmlFor="filter-date-to"
                  className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  To Date
                </label>
                <input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label
                  htmlFor="filter-min-amt"
                  className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Min Amount (₹)
                </label>
                <input
                  id="filter-min-amt"
                  type="number"
                  min={0}
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label
                  htmlFor="filter-max-amt"
                  className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Max Amount (₹)
                </label>
                <input
                  id="filter-max-amt"
                  type="number"
                  min={0}
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="Any"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Ledger Table */}
        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No transactions match these filters
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Speak a command using Push-to-Talk or reset your active filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 px-3.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Type & Note</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredTransactions.map((tx) => {
                  const cust = customerMap.get(tx.customerId);
                  const isCredit = tx.type === 'CREDIT';
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap align-top">
                        <div>{tx.date}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-top">
                        {cust ? (
                          <button
                            type="button"
                            onClick={() => onOpenCustomerProfile(cust)}
                            className="text-left hover:underline font-medium text-slate-900 dark:text-slate-100"
                          >
                            {cust.name}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            Unknown
                          </span>
                        )}
                        {cust && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {cust.area} · {cust.note}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold ${
                              isCredit
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isCredit ? 'Credit · Udhaar' : 'Payment · Jama'}
                          </span>
                          {tx.detectedLanguage && (
                            <>
                              <span className="text-xs text-slate-300 dark:text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {getLanguageLabel(tx.detectedLanguage)}
                              </span>
                            </>
                          )}
                          {tx.updatedAt && (
                            <>
                              <span className="text-xs text-slate-300 dark:text-slate-600" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                Edited
                              </span>
                            </>
                          )}
                        </div>
                        {tx.note && (
                          <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                            {tx.note}
                          </div>
                        )}
                        {tx.sourceCommand && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-xs">
                            “{tx.sourceCommand}”
                          </div>
                        )}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap align-top ${
                          isCredit
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'}₹{formatINR(tx.amount)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            aria-label={`Edit transaction for ${cust?.name || 'customer'}`}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx)}
                            aria-label={`Delete transaction for ${cust?.name || 'customer'}`}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
