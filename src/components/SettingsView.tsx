import { ChangeEvent, FormEvent, useState } from 'react';
import {
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  Shield,
  Store,
  Upload,
} from 'lucide-react';
import { ShopLedgerData, ShopProfile } from '../types/ledger';
import {
  FullBackupPayload,
  clearAppPin,
  decryptLedgerBackup,
  encryptLedgerBackup,
  setAppPin,
  verifyAppPin,
} from '../utils/cryptoSecurity';
import { triggerBlobDownload } from '../utils/exportUtils';

interface SettingsViewProps {
  shops: ShopProfile[];
  activeShopId: string;
  shopDataById: Record<string, ShopLedgerData>;
  onSwitchShop: (shopId: string) => void;
  onCreateShop: (name: string, subtitle: string) => void;
  pinEnabled: boolean;
  onPinStateChanged: (enabled: boolean, summary: string) => void;
  onLockNow: () => void;
  onBackupExported: () => void;
  onRestoreBackup: (payload: FullBackupPayload) => void;
  onResetDemoData: () => void;
}

export function SettingsView({
  shops,
  activeShopId,
  shopDataById,
  onSwitchShop,
  onCreateShop,
  pinEnabled,
  onPinStateChanged,
  onLockNow,
  onBackupExported,
  onRestoreBackup,
  onResetDemoData,
}: SettingsViewProps) {
  // Multi-shop creation state
  const [newShopName, setNewShopName] = useState('');
  const [newShopSubtitle, setNewShopSubtitle] = useState('');
  const [shopMsg, setShopMsg] = useState('');

  // PIN lock state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Encrypted backup state
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [exportError, setExportError] = useState('');

  // Encrypted restore state
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreFileText, setRestoreFileText] = useState('');
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreError, setRestoreError] = useState('');

  // Two-step demo reset guard
  const [confirmReset, setConfirmReset] = useState(false);

  const handleAddShopSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newShopName.trim();
    if (!trimmed) return;
    onCreateShop(trimmed, newShopSubtitle.trim() || 'Retail Counter');
    setShopMsg(`Created and switched to "${trimmed}".`);
    setNewShopName('');
    setNewShopSubtitle('');
  };

  const handleSavePinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (pinEnabled) {
      const ok = await verifyAppPin(currentPin);
      if (!ok) {
        setPinError('Current 4-digit PIN is incorrect.');
        return;
      }
    }

    if (!/^\d{4}$/.test(newPin)) {
      setPinError('New PIN must be exactly 4 digits (0–9).');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('New PIN and confirmation do not match.');
      return;
    }

    await setAppPin(newPin);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinSuccess(pinEnabled ? '4-digit App PIN updated.' : '4-digit App Lock enabled.');
    onPinStateChanged(true, pinEnabled ? 'Updated 4-digit App Lock PIN.' : 'Enabled 4-digit App Lock PIN.');
  };

  const handleDisablePin = async () => {
    setPinError('');
    setPinSuccess('');
    const ok = await verifyAppPin(currentPin);
    if (!ok) {
      setPinError('Enter your current 4-digit PIN to disable App Lock.');
      return;
    }
    clearAppPin();
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinSuccess('App Lock disabled.');
    onPinStateChanged(false, 'Disabled 4-digit App Lock PIN.');
  };

  const handleExportEncryptedBackup = async (e: FormEvent) => {
    e.preventDefault();
    setExportError('');
    setExportStatus('');
    if (exportPassphrase.length < 4) {
      setExportError('Enter a passphrase of at least 4 characters to encrypt your backup.');
      return;
    }

    try {
      const envelope = await encryptLedgerBackup(
        {
          shops,
          activeShopId,
          shopDataById,
        },
        exportPassphrase
      );
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json',
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerBlobDownload(blob, `khatawas-backup-${dateStr}.json`);
      setExportPassphrase('');
      setExportStatus('AES-256-GCM encrypted backup downloaded.');
      onBackupExported();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to encrypt backup.');
    }
  };

  const handleBackupFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    setRestoreError('');
    setRestoreStatus('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRestoreFileText(text);
      setRestoreFileName(file.name);
    } catch {
      setRestoreError('Could not read the selected backup file.');
    }
  };

  const handleRestoreEncryptedBackup = async (e: FormEvent) => {
    e.preventDefault();
    setRestoreError('');
    setRestoreStatus('');

    if (!restoreFileText) {
      setRestoreError('Select an encrypted KHATAWAS .json backup file first.');
      return;
    }
    if (!restorePassphrase) {
      setRestoreError('Enter the passphrase used to encrypt this backup.');
      return;
    }

    try {
      const payload = await decryptLedgerBackup(restoreFileText, restorePassphrase);
      onRestoreBackup(payload);
      setRestorePassphrase('');
      setRestoreFileText('');
      setRestoreFileName('');
      setRestoreStatus(
        `Restored ${payload.shops.length} shop ${payload.shops.length === 1 ? 'profile' : 'profiles'} successfully.`
      );
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Backup restore failed.');
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
          Shop Profiles, Security & Backup
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Switch isolated counters, configure 4-digit PIN lock, or export/restore AES-GCM encrypted backups
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Multi-Shop Management */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
                Multi-Shop Switcher
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Each shop maintains completely isolated customers, ledger entries, and audit logs
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {shops.map((shop) => {
              const data = shopDataById[shop.id];
              const isActive = shop.id === activeShopId;
              return (
                <div
                  key={shop.id}
                  className={`px-4 py-3 flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {shop.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {shop.subtitle} · {data?.customers.length || 0} customers ·{' '}
                      {data?.transactions.length || 0} entries
                    </div>
                  </div>
                  {isActive ? (
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 shrink-0">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchShop(shop.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shrink-0"
                    >
                      Switch
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddShopSubmit} className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add New Shop Counter
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="Shop name (e.g. Milk Booth)"
                className="px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <input
                type="text"
                value={newShopSubtitle}
                onChange={(e) => setNewShopSubtitle(e.target.value)}
                placeholder="Area / Counter note"
                className="px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-emerald-700 dark:text-emerald-400">{shopMsg}</span>
              <button
                type="submit"
                disabled={!newShopName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Shop</span>
              </button>
            </div>
          </form>
        </div>

        {/* Optional 4-Digit App Lock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
                  4-Digit App Lock (PIN)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pinEnabled
                    ? 'Enabled · Ledger locks automatically when opening the app'
                    : 'Disabled · Set a 4-digit PIN to protect shop balances'}
                </p>
              </div>
            </div>

            {pinEnabled && (
              <button
                type="button"
                onClick={onLockNow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 rounded-lg shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Now</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSavePinSubmit} className="space-y-3">
            {pinEnabled && (
              <div>
                <label
                  htmlFor="pin-current"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Current 4-Digit PIN
                </label>
                <input
                  id="pin-current"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-sm font-mono tracking-widest bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pin-new"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  {pinEnabled ? 'New 4-Digit PIN' : 'Set 4-Digit PIN'}
                </label>
                <input
                  id="pin-new"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-sm font-mono tracking-widest bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label
                  htmlFor="pin-confirm"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Confirm PIN
                </label>
                <input
                  id="pin-confirm"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-sm font-mono tracking-widest bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            {pinError && (
              <p className="text-xs font-medium text-red-700 dark:text-red-400" role="alert">
                {pinError}
              </p>
            )}
            {pinSuccess && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{pinSuccess}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {pinEnabled && (
                <button
                  type="button"
                  onClick={handleDisablePin}
                  className="px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 hover:bg-red-100 rounded-lg"
                >
                  Disable PIN
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
              >
                {pinEnabled ? 'Update PIN' : 'Enable PIN Lock'}
              </button>
            </div>
          </form>
        </div>

        {/* Encrypted Backup Export */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
                Encrypted Backup Export
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download all shops, customers, transactions & audit logs encrypted with AES-256-GCM
              </p>
            </div>
          </div>

          <form onSubmit={handleExportEncryptedBackup} className="space-y-3">
            <div>
              <label
                htmlFor="backup-export-pass"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Backup Encryption Passphrase
              </label>
              <input
                id="backup-export-pass"
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                placeholder="Enter a secret passphrase (min 4 chars)"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {exportError && (
              <p className="text-xs font-medium text-red-700 dark:text-red-400" role="alert">
                {exportError}
              </p>
            )}
            {exportStatus && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{exportStatus}</span>
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Encrypted .json</span>
              </button>
            </div>
          </form>
        </div>

        {/* Encrypted Backup Restore + Demo Reset */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-display">
                  Restore Encrypted Backup
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Decrypt and restore an existing KHATAWAS .json backup file
                </p>
              </div>
            </div>

            <form onSubmit={handleRestoreEncryptedBackup} className="space-y-3">
              <div>
                <label
                  htmlFor="backup-file-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Select Backup File (.json)
                </label>
                <input
                  id="backup-file-input"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleBackupFileSelected}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 dark:file:border-slate-700 file:text-xs file:font-medium file:bg-slate-50 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-100"
                />
                {restoreFileName && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                    Loaded: {restoreFileName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="backup-restore-pass"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Backup Passphrase
                </label>
                <input
                  id="backup-restore-pass"
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="Enter passphrase used during export"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {restoreError && (
                <p className="text-xs font-medium text-red-700 dark:text-red-400" role="alert">
                  {restoreError}
                </p>
              )}
              {restoreStatus && (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{restoreStatus}</span>
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-indigo-700 hover:bg-slate-800 dark:hover:bg-indigo-800 rounded-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Decrypt & Restore</span>
                </button>
              </div>
            </form>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Reset Demo Data
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Restore Main Kirana Store & Wholesale Counter seed entries
              </div>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    onResetDemoData();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
