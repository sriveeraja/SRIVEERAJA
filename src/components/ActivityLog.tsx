import { useMemo, useState } from 'react';
import { Lock, Search, ShieldCheck } from 'lucide-react';
import { AuditEvent } from '../types/ledger';
import { getLanguageLabel } from '../utils/localization';

interface ActivityLogProps {
  shopName: string;
  events: AuditEvent[];
}

export function ActivityLog({ shopName, events }: ActivityLogProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | AuditEvent['action']>('ALL');

  const actionLabels: Record<AuditEvent['action'], string> = {
    SAVED: 'Saved Entry',
    EDITED: 'Edited Entry',
    UNDONE: 'Undone',
    DELETED: 'Deleted Entry',
    DISAMBIGUATED: 'Name Disambiguated',
    DUPLICATE_WARNED: 'Duplicate Warning',
    ANOMALY_WARNED: 'High Amount Alert',
    QUERY_ANSWERED: 'Ledger Query',
    CUSTOMER_ADDED: 'Customer Added',
    CUSTOMER_EDITED: 'Customer Edited',
    SHOP_SWITCHED: 'Shop Switched',
    BACKUP_EXPORTED: 'Backup Exported',
    BACKUP_RESTORED: 'Backup Restored',
    PIN_UPDATED: 'PIN Security Updated',
  };

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (actionFilter !== 'ALL' && ev.action !== actionFilter) return false;
      if (!q) return true;
      return (
        ev.summary.toLowerCase().includes(q) ||
        actionLabels[ev.action].toLowerCase().includes(q)
      );
    });
  }, [events, search, actionFilter]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Immutable Audit Log
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {shopName} · Append-only record of every creation, confirmation, edit, undo, customer update, and security action
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-lg shrink-0">
          <Lock className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
          <span>Append-Only · {events.length} Events</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit summary..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <select
          aria-label="Filter by audit event type"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as 'ALL' | AuditEvent['action'])}
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="ALL">All Event Types</option>
          {(Object.keys(actionLabels) as AuditEvent['action'][]).map((key) => (
            <option key={key} value={key}>
              {actionLabels[key]}
            </option>
          ))}
        </select>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
          <p className="text-base font-medium text-slate-900 dark:text-slate-100">
            {events.length === 0 ? 'No audit events recorded yet' : 'No matching audit events'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Voice disambiguations, confirmations, edits, undos, customer changes, and security updates appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {ev.summary}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {actionLabels[ev.action]}
                  </span>
                  {ev.language && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{getLanguageLabel(ev.language)}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    {ev.id}
                  </span>
                </div>
              </div>
              <time className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                {new Date(ev.timestamp).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
