import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Customer, Transaction, TransactionType } from '../types/ledger';
import { formatINR } from '../utils/localization';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  customers: Customer[];
  onClose: () => void;
  onSave: (updated: {
    id: string;
    customerId: string;
    amount: number;
    type: TransactionType;
    date: string;
    note: string;
  }) => void;
}

export function EditTransactionModal({
  transaction,
  customers,
  onClose,
  onSave,
}: EditTransactionModalProps) {
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('CREDIT');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (transaction) {
      setCustomerId(transaction.customerId);
      setAmount(String(transaction.amount));
      setType(transaction.type);
      setDate(transaction.date);
      setNote(transaction.note);
      setError('');
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid positive INR amount.');
      return;
    }
    if (!date) {
      setError('Please choose a valid date.');
      return;
    }
    onSave({
      id: transaction.id,
      customerId,
      amount: Math.round(numericAmount),
      type,
      date,
      note: note.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-tx-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="edit-tx-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
            Edit Transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit modal"
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="edit-tx-customer" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Customer
            </label>
            <select
              id="edit-tx-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.area} ({c.note})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-tx-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Amount (₹)
              </label>
              <input
                id="edit-tx-amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label htmlFor="edit-tx-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Date
              </label>
              <input
                id="edit-tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Transaction Type</span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setType('CREDIT')}
                className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  type === 'CREDIT'
                    ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Credit · Udhaar
              </button>
              <button
                type="button"
                onClick={() => setType('PAYMENT')}
                className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  type === 'PAYMENT'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Payment · Jama
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="edit-tx-note" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Note / Items
            </label>
            <input
              id="edit-tx-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rice 5kg, milk, cash"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CustomerFormModalProps {
  isOpen: boolean;
  editingCustomer?: Customer | null;
  initialName?: string;
  onClose: () => void;
  onSubmit: (data: {
    id?: string;
    name: string;
    phone: string;
    area: string;
    note: string;
    aliases: string[];
  }) => void;
}

export function CustomerFormModal({
  isOpen,
  editingCustomer = null,
  initialName = '',
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingCustomer) {
        setName(editingCustomer.name);
        setPhone(editingCustomer.phone);
        setArea(editingCustomer.area);
        setNote(editingCustomer.note);
        setAliasesText(editingCustomer.aliases.join(', '));
      } else {
        setName(initialName);
        setPhone('');
        setArea('');
        setNote('');
        setAliasesText(initialName);
      }
      setError('');
    }
  }, [isOpen, editingCustomer, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    const aliases = aliasesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!aliases.some((a) => a.toLowerCase() === name.trim().toLowerCase())) {
      aliases.unshift(name.trim());
    }
    onSubmit({
      id: editingCustomer?.id,
      name: name.trim(),
      phone: phone.trim() || '+91 98000 00000',
      area: area.trim() || 'Local Area',
      note: note.trim() || 'Regular Customer',
      aliases,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cust-form-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="cust-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
            {editingCustomer ? 'Edit Customer Profile' : 'Add Customer'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer modal"
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="cust-form-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Customer Name
            </label>
            <input
              id="cust-form-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mahesh"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cust-form-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                id="cust-form-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98450 ..."
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label htmlFor="cust-form-area" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Area / Landmark
              </label>
              <input
                id="cust-form-area"
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. MG Road"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cust-form-note" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Shop / Identifier Note
            </label>
            <input
              id="cust-form-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Tea Stall, Hardware Shop"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label htmlFor="cust-form-aliases" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Voice Aliases (comma separated)
            </label>
            <input
              id="cust-form-aliases"
              type="text"
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
              placeholder="e.g. Mahesh, Mahesha, Mahesh Anna"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
            >
              {editingCustomer ? 'Save Profile' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteCustomerModalProps {
  customer: Customer | null;
  balance: number;
  transactionCount: number;
  onClose: () => void;
  onViewCustomerLedger: (customerId: string) => void;
  onConfirmDelete: (customerId: string) => void;
}

export function DeleteCustomerModal({
  customer,
  balance,
  transactionCount,
  onClose,
  onViewCustomerLedger,
  onConfirmDelete,
}: DeleteCustomerModalProps) {
  if (!customer) return null;

  const hasNonZeroBalance = balance !== 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-cust-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md shadow-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 id="delete-cust-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
              {hasNonZeroBalance
                ? 'Cannot Delete Unsettled Account'
                : `Delete ${customer.name} (${customer.area})?`}
            </h2>
            {hasNonZeroBalance ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {customer.name} ({customer.area})
                </span>{' '}
                still has an unsettled balance of{' '}
                <span className="font-mono font-semibold tabular-nums text-red-700 dark:text-red-400">
                  ₹{formatINR(Math.abs(balance))}
                </span>{' '}
                ({balance > 0 ? 'Receivable' : 'Advance'}). Settle or clear this balance to ₹0 before deleting the customer account.
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                This will permanently remove{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {customer.name} ({customer.area})
                </span>{' '}
                and their {transactionCount} settled ledger{' '}
                {transactionCount === 1 ? 'entry' : 'entries'} from local storage.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          {hasNonZeroBalance ? (
            <button
              type="button"
              onClick={() => {
                onViewCustomerLedger(customer.id);
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
            >
              View & Settle Ledger
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onConfirmDelete(customer.id);
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
            >
              Delete Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
