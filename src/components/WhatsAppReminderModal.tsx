import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { Customer, DetectedLanguage } from '../types/ledger';
import { formatINR } from '../utils/localization';
import { buildWhatsAppReminderMessage, buildWhatsAppShareUrl } from '../utils/exportUtils';

interface WhatsAppReminderModalProps {
  customer: Customer | null;
  balance: number;
  shopName: string;
  defaultLang: DetectedLanguage;
  onClose: () => void;
}

export function WhatsAppReminderModal({
  customer,
  balance,
  shopName,
  defaultLang,
  onClose,
}: WhatsAppReminderModalProps) {
  const [lang, setLang] = useState<DetectedLanguage>(defaultLang);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setLang(defaultLang);
    setMessage(buildWhatsAppReminderMessage(customer, balance, shopName, defaultLang));
    setCopied(false);
  }, [customer, balance, shopName, defaultLang]);

  if (!customer) return null;

  const handleLanguageChange = (nextLang: DetectedLanguage) => {
    setLang(nextLang);
    setMessage(buildWhatsAppReminderMessage(customer, balance, shopName, nextLang));
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const waUrl = buildWhatsAppShareUrl(customer.phone, message);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2
              id="wa-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display"
            >
              WhatsApp Payment Reminder
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reminder dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {customer.name} ({customer.area})
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {customer.phone}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Net Balance</div>
              <div
                className={`font-bold font-mono tabular-nums ${
                  balance > 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                ₹{formatINR(Math.abs(balance))}
                {balance <= 0 ? ' · Clear' : ''}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Message Language
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'kn', label: 'Kannada' },
                  { id: 'en', label: 'English' },
                  { id: 'hinglish', label: 'Hindi / Hinglish' },
                ] as { id: DetectedLanguage; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleLanguageChange(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    lang === opt.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="wa-reminder-text"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Preview & Edit Message
            </label>
            <textarea
              id="wa-reminder-text"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
