import { Edit2, FileText, MapPin, MessageCircle, Mic, Phone, Trash2, X } from 'lucide-react';
import { Customer, Transaction } from '../types/ledger';
import { computeCustomerBalance } from '../utils/seedData';
import { formatINR, getLanguageLabel } from '../utils/localization';

interface CustomerProfileDrawerProps {
  customer: Customer | null;
  transactions: Transaction[];
  onClose: () => void;
  onEditCustomer: (customer: Customer) => void;
  onRequestDeleteCustomer: (customer: Customer) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onStartVoiceForCustomer: (customer: Customer) => void;
  onDownloadPdf: (customer: Customer) => void;
  onOpenWhatsApp: (customer: Customer) => void;
}

export function CustomerProfileDrawer({
  customer,
  transactions,
  onClose,
  onEditCustomer,
  onRequestDeleteCustomer,
  onEditTransaction,
  onDeleteTransaction,
  onStartVoiceForCustomer,
  onDownloadPdf,
  onOpenWhatsApp,
}: CustomerProfileDrawerProps) {
  if (!customer) return null;

  const customerTxs = transactions
    .filter((t) => t.customerId === customer.id)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });

  const totalCredit = customerTxs
    .filter((t) => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPayment = customerTxs
    .filter((t) => t.type === 'PAYMENT')
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = computeCustomerBalance(customer.id, transactions);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-drawer-title"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2
              id="profile-drawer-title"
              className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display truncate"
            >
              {customer.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {customer.area}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Phone className="w-3.5 h-3.5" />
                {customer.phone}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer profile"
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Summary & Actions */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Net Balance
              </div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  netBalance > 0
                    ? 'text-red-700 dark:text-red-400'
                    : netBalance < 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                ₹{formatINR(Math.abs(netBalance))}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {netBalance > 0 ? 'Receivable' : netBalance < 0 ? 'Advance' : 'Settled'}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Credit
              </div>
              <div className="text-base font-bold font-mono tabular-nums text-red-700 dark:text-red-400 mt-0.5">
                ₹{formatINR(totalCredit)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Udhaara</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Paid
              </div>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                ₹{formatINR(totalPayment)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Jama</div>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">Shop Note:</span>{' '}
              {customer.note}
            </div>
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">Voice Aliases:</span>{' '}
              {customer.aliases.join(', ')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onStartVoiceForCustomer(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Entry</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenWhatsApp(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-lg"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => onDownloadPdf(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => onEditCustomer(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => onRequestDeleteCustomer(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 dark:hover:bg-red-950/70 rounded-lg ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Individual Transaction Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-display">
              Transaction Timeline
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {customerTxs.length} entries
            </span>
          </div>

          {customerTxs.length === 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No transactions recorded yet for {customer.name}.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {customerTxs.map((tx) => {
                const isCredit = tx.type === 'CREDIT';
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={`font-semibold ${
                            isCredit
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isCredit ? 'Credit · Udhaar' : 'Payment · Jama'}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {tx.date}
                        </span>
                        {tx.detectedLanguage && (
                          <>
                            <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {getLanguageLabel(tx.detectedLanguage)}
                            </span>
                          </>
                        )}
                      </div>
                      {tx.note && (
                        <p className="text-xs text-slate-800 dark:text-slate-200">{tx.note}</p>
                      )}
                      {tx.sourceCommand && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          “{tx.sourceCommand}”
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`text-sm font-semibold font-mono tabular-nums ${
                          isCredit
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'}₹{formatINR(tx.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          aria-label="Edit transaction"
                          className="p-1 text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx)}
                          aria-label="Delete transaction"
                          className="p-1 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
