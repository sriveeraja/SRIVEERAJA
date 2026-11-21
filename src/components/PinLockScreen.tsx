import { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { verifyAppPin } from '../utils/cryptoSecurity';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleDigit = (digit: string) => {
    if (checking || pin.length >= 4) return;
    setError('');
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (checking) return;
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length !== 4) return;
    let cancelled = false;
    setChecking(true);
    verifyAppPin(pin)
      .then((valid) => {
        if (cancelled) return;
        if (valid) {
          onUnlock();
        } else {
          setError('Incorrect 4-digit PIN. Please try again.');
          setPin('');
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pin, onUnlock]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setPin('');
        setError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
            KHATAWAS Locked
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your 4-digit shop PIN to access the credit ledger
          </p>
        </div>

        {/* 4-dot PIN indicator */}
        <div className="flex items-center justify-center gap-4 py-1" aria-label="PIN progress">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                idx < pin.length
                  ? 'bg-indigo-700 dark:bg-indigo-400 border-indigo-700 dark:border-indigo-400'
                  : 'bg-transparent border-slate-300 dark:border-slate-600'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-medium text-red-700 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={checking}
              className="h-12 rounded-xl text-lg font-semibold font-mono tabular-nums bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 transition-colors"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setPin('');
              setError('');
            }}
            disabled={checking}
            className="h-12 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={checking}
            className="h-12 rounded-xl text-lg font-semibold font-mono tabular-nums bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={checking}
            aria-label="Backspace"
            className="h-12 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
