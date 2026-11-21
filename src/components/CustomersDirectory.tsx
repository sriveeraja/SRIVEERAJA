import { useState } from 'react';
import {
  Edit2,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { Customer, Transaction } from '../types/ledger';
import { computeCustomerBalance } from '../utils/seedData';
import { formatINR } from '../utils/localization';

interface CustomersDirectoryProps {
  customers: Customer[];
  transactions: Transaction[];
  onOpenCustomerProfile: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onRequestDeleteCustomer: (customer: Customer) => void;
  onOpenAddCustomer: () => void;
  onDownloadPdf: (customer: Customer) => void;
  onOpenWhatsApp: (customer: Customer) => void;
}

export function CustomersDirectory({
  customers,
  transactions,
  onOpenCustomerProfile,
  onEditCustomer,
  onRequestDeleteCustomer,
  onOpenAddCustomer,
  onDownloadPdf,
  onOpenWhatsApp,
}: CustomersDirectoryProps) {
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q) ||
      c.note.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.aliases.some((a) => a.toLowerCase().includes(q))
    );
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Customer Directory
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {customers.length} accounts · Click any customer to open their profile & timeline
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, area, alias..."
              className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <button
            type="button"
            onClick={onOpenAddCustomer}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
          <p className="text-base font-medium text-slate-900 dark:text-slate-100">
            No matching customers found
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Try clearing your search or create a new customer account.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((customer) => {
              const balance = computeCustomerBalance(customer.id, transactions);
              const txCount = transactions.filter((t) => t.customerId === customer.id).length;

              return (
                <div
                  key={customer.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenCustomerProfile(customer)}
                    className="text-left space-y-1.5 min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display hover:text-indigo-700 dark:hover:text-indigo-400">
                        {customer.name}
                      </h2>
                      <span className="text-xs text-slate-400 dark:text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {customer.area}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {customer.phone}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{customer.note}</span>
                      <span aria-hidden="true">·</span>
                      <span>Aliases: {customer.aliases.join(', ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{txCount} entries</span>
                    </div>
                  </button>

                  <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0">
                    <div className="text-left lg:text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Net Balance
                      </div>
                      <div
                        className={`text-lg font-semibold font-mono tabular-nums ${
                          balance > 0
                            ? 'text-red-700 dark:text-red-400'
                            : balance < 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        ₹{formatINR(Math.abs(balance))}
                        {balance < 0 ? ' Cr' : balance === 0 ? ' · Settled' : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp(customer)}
                        aria-label={`Send WhatsApp reminder to ${customer.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remind</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(customer)}
                        aria-label={`Download PDF statement for ${customer.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCustomerProfile(customer)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-950 rounded-lg"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditCustomer(customer)}
                        aria-label={`Edit ${customer.name}`}
                        className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestDeleteCustomer(customer)}
                        aria-label={`Delete ${customer.name}`}
                        className="p-2 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
