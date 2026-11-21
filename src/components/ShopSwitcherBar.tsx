import { Store } from 'lucide-react';
import { ShopProfile } from '../types/ledger';

interface ShopSwitcherBarProps {
  shops: ShopProfile[];
  activeShopId: string;
  onSwitchShop: (shopId: string) => void;
  onOpenSettings: () => void;
}

export function ShopSwitcherBar({
  shops,
  activeShopId,
  onSwitchShop,
  onOpenSettings,
}: ShopSwitcherBarProps) {
  const activeShop = shops.find((s) => s.id === activeShopId) || shops[0];

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Store className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Active Counter:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {shops.map((shop) => {
              const isActive = shop.id === activeShopId;
              return (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => onSwitchShop(shop.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {shop.name}
                </button>
              );
            })}
          </div>
        </div>

        {activeShop && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">{activeShop.subtitle}</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-indigo-700 dark:text-indigo-400 hover:underline font-medium whitespace-nowrap"
            >
              Manage Shops & Security
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
