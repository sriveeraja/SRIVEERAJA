import {
  AuditEvent,
  Customer,
  LanguageMode,
  ShopLedgerData,
  ShopProfile,
  Transaction,
} from '../types/ledger';

const STORAGE_KEYS = {
  // Legacy single-shop keys (for seamless migration)
  legacyCustomers: 'khatawas_customers_v1',
  legacyTransactions: 'khatawas_transactions_v1',
  legacyAudit: 'khatawas_audit_v1',
  // Multi-shop v2 keys
  shops: 'khatawas_shops_v2',
  activeShopId: 'khatawas_active_shop_v2',
  shopDataById: 'khatawas_shop_data_v2',
  languageMode: 'khatawas_lang_v1',
  ttsEnabled: 'khatawas_tts_v1',
};

function getDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const INITIAL_SHOPS: ShopProfile[] = [
  {
    id: 'shop-main',
    name: 'Main Kirana Store',
    subtitle: 'Retail Counter · Bengaluru',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'shop-wholesale',
    name: 'Wholesale Counter',
    subtitle: 'Bulk Ration & Supply',
    createdAt: '2026-10-10T08:00:00.000Z',
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-ramesh-mg',
    name: 'Ramesh',
    phone: '+91 98450 11234',
    area: 'MG Road',
    note: 'Bakery & Tea Stall',
    aliases: ['Ramesh', 'Ramesha', 'Ramesh MG Road', 'Bakery Ramesh', 'MG Road Ramesh'],
    createdAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'cust-ramesh-jn',
    name: 'Ramesh',
    phone: '+91 98451 88765',
    area: 'Jayanagar 4th Block',
    note: 'Electrician',
    aliases: ['Ramesh', 'Ramesha', 'Ramesh Jayanagar', 'Electrician Ramesh', 'Jayanagar Ramesh'],
    createdAt: '2026-10-05T10:30:00.000Z',
  },
  {
    id: 'cust-suresh',
    name: 'Suresh',
    phone: '+91 99001 44512',
    area: 'Indiranagar',
    note: 'Tailor Shop',
    aliases: ['Suresh', 'Suresha', 'Tailor Suresh'],
    createdAt: '2026-10-10T11:15:00.000Z',
  },
  {
    id: 'cust-lakshmi',
    name: 'Lakshmi',
    phone: '+91 97412 33098',
    area: 'Koramangala',
    note: 'Apartment 3B Groceries',
    aliases: ['Lakshmi', 'Laxmi', 'Lakshmi Akka', 'Akka'],
    createdAt: '2026-10-12T16:20:00.000Z',
  },
  {
    id: 'cust-abdul',
    name: 'Abdul',
    phone: '+91 98860 77210',
    area: 'Shivajinagar',
    note: 'Auto Stand',
    aliases: ['Abdul', 'Abdullah', 'Abdul Bhai'],
    createdAt: '2026-10-15T14:00:00.000Z',
  },
];

export const WHOLESALE_CUSTOMERS: Customer[] = [
  {
    id: 'cust-ws-ganesh',
    name: 'Ganesh Hotel',
    phone: '+91 98455 20190',
    area: 'Majestic',
    note: 'Daily Milk & Rice Sacks',
    aliases: ['Ganesh', 'Ganesh Hotel', 'Sri Ganesh'],
    createdAt: '2026-10-10T09:00:00.000Z',
  },
  {
    id: 'cust-ws-annapurna',
    name: 'Annapurna Mess',
    phone: '+91 99800 55412',
    area: 'BTM Layout',
    note: 'Bulk Oil & Pulses',
    aliases: ['Annapurna', 'Mess', 'Annapurna Mess'],
    createdAt: '2026-10-11T09:30:00.000Z',
  },
  {
    id: 'cust-ws-raju',
    name: 'Raju Catering',
    phone: '+91 97400 88123',
    area: 'Malleshwaram',
    note: 'Event Provisions',
    aliases: ['Raju', 'Raju Catering'],
    createdAt: '2026-10-12T10:00:00.000Z',
  },
];

export function createInitialTransactions(): Transaction[] {
  const now = Date.now();
  return [
    {
      id: 'tx-seed-1',
      customerId: 'cust-ramesh-mg',
      amount: 1650,
      type: 'CREDIT',
      date: getDateOffset(2),
      note: 'Milk crates, sugar 5kg, tea powder',
      createdAt: new Date(now - 2 * 86400_000).toISOString(),
      sourceCommand: 'Ramesh MG Road 1650 milk and sugar udhaara',
      detectedLanguage: 'kn',
      confidence: 96,
    },
    {
      id: 'tx-seed-2',
      customerId: 'cust-ramesh-mg',
      amount: 400,
      type: 'PAYMENT',
      date: getDateOffset(1),
      note: 'Cash part payment',
      createdAt: new Date(now - 1 * 86400_000).toISOString(),
      sourceCommand: 'Ramesh MG Road gave 400 cash',
      detectedLanguage: 'en',
      confidence: 95,
    },
    {
      id: 'tx-seed-3',
      customerId: 'cust-ramesh-jn',
      amount: 940,
      type: 'CREDIT',
      date: getDateOffset(3),
      note: 'Rice 10kg, cooking oil, biscuits',
      createdAt: new Date(now - 3 * 86400_000).toISOString(),
      sourceCommand: 'Ramesh Jayanagar 940 udhaar',
      detectedLanguage: 'hinglish',
      confidence: 94,
    },
    {
      id: 'tx-seed-4',
      customerId: 'cust-ramesh-jn',
      amount: 300,
      type: 'PAYMENT',
      date: getDateOffset(1),
      note: 'UPI jama',
      createdAt: new Date(now - 20 * 3600_000).toISOString(),
      sourceCommand: 'Electrician Ramesh 300 jama',
      detectedLanguage: 'hinglish',
      confidence: 93,
    },
    {
      id: 'tx-seed-5',
      customerId: 'cust-suresh',
      amount: 2100,
      type: 'CREDIT',
      date: getDateOffset(2),
      note: 'Monthly ration & pulses',
      createdAt: new Date(now - 42 * 3600_000).toISOString(),
      sourceCommand: 'Suresh ge 2100 saala',
      detectedLanguage: 'kn',
      confidence: 97,
    },
    {
      id: 'tx-seed-6',
      customerId: 'cust-lakshmi',
      amount: 880,
      type: 'CREDIT',
      date: getDateOffset(1),
      note: 'Atta, dal, detergent',
      createdAt: new Date(now - 18 * 3600_000).toISOString(),
      sourceCommand: 'Lakshmi 880 credit',
      detectedLanguage: 'en',
      confidence: 98,
    },
    {
      id: 'tx-seed-7',
      customerId: 'cust-lakshmi',
      amount: 400,
      type: 'PAYMENT',
      date: getDateOffset(0),
      note: 'Morning payment',
      createdAt: new Date(now - 3 * 3600_000).toISOString(),
      sourceCommand: 'Lakshmi 400 rupaayi kottiddu',
      detectedLanguage: 'kn',
      confidence: 95,
    },
    {
      id: 'tx-seed-8',
      customerId: 'cust-abdul',
      amount: 1220,
      type: 'CREDIT',
      date: getDateOffset(1),
      note: 'Cold drinks, water bottles, snacks',
      createdAt: new Date(now - 14 * 3600_000).toISOString(),
      sourceCommand: 'Abdul bhai ko 1220 udhaar',
      detectedLanguage: 'hinglish',
      confidence: 94,
    },
    {
      id: 'tx-seed-9',
      customerId: 'cust-abdul',
      amount: 300,
      type: 'PAYMENT',
      date: getDateOffset(0),
      note: 'Evening cash',
      createdAt: new Date(now - 2 * 3600_000).toISOString(),
      sourceCommand: 'Abdul 300 jama kiya',
      detectedLanguage: 'hinglish',
      confidence: 96,
    },
  ];
}

export function createWholesaleTransactions(): Transaction[] {
  const now = Date.now();
  return [
    {
      id: 'tx-ws-1',
      customerId: 'cust-ws-ganesh',
      amount: 8400,
      type: 'CREDIT',
      date: getDateOffset(4),
      note: 'Sona Masoori 4 bags, cooking oil 2 tins',
      createdAt: new Date(now - 4 * 86400_000).toISOString(),
      sourceCommand: 'Ganesh Hotel 8400 udhaara',
      detectedLanguage: 'kn',
      confidence: 96,
    },
    {
      id: 'tx-ws-2',
      customerId: 'cust-ws-ganesh',
      amount: 3400,
      type: 'PAYMENT',
      date: getDateOffset(0),
      note: 'NEFT part settlement',
      createdAt: new Date(now - 4 * 3600_000).toISOString(),
      sourceCommand: 'Ganesh Hotel 3400 jama',
      detectedLanguage: 'en',
      confidence: 95,
    },
    {
      id: 'tx-ws-3',
      customerId: 'cust-ws-annapurna',
      amount: 5200,
      type: 'CREDIT',
      date: getDateOffset(1),
      note: 'Toor dal 25kg, sugar 50kg',
      createdAt: new Date(now - 22 * 3600_000).toISOString(),
      sourceCommand: 'Annapurna Mess 5200 credit',
      detectedLanguage: 'en',
      confidence: 97,
    },
    {
      id: 'tx-ws-4',
      customerId: 'cust-ws-raju',
      amount: 3600,
      type: 'CREDIT',
      date: getDateOffset(0),
      note: 'Spices & dry fruits bulk pack',
      createdAt: new Date(now - 3 * 3600_000).toISOString(),
      sourceCommand: 'Raju Catering 3600 udhaar',
      detectedLanguage: 'hinglish',
      confidence: 95,
    },
  ];
}

export function computeCustomerBalance(customerId: string, transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.customerId !== customerId) return sum;
    return tx.type === 'CREDIT' ? sum + tx.amount : sum - tx.amount;
  }, 0);
}

export function createDefaultMultiShopState(): {
  shops: ShopProfile[];
  activeShopId: string;
  shopDataById: Record<string, ShopLedgerData>;
} {
  return {
    shops: [...INITIAL_SHOPS],
    activeShopId: 'shop-main',
    shopDataById: {
      'shop-main': {
        customers: [...INITIAL_CUSTOMERS],
        transactions: createInitialTransactions(),
        auditEvents: [],
      },
      'shop-wholesale': {
        customers: [...WHOLESALE_CUSTOMERS],
        transactions: createWholesaleTransactions(),
        auditEvents: [],
      },
    },
  };
}

export function loadMultiShopState(): {
  shops: ShopProfile[];
  activeShopId: string;
  shopDataById: Record<string, ShopLedgerData>;
} {
  try {
    const rawShops = localStorage.getItem(STORAGE_KEYS.shops);
    const rawActive = localStorage.getItem(STORAGE_KEYS.activeShopId);
    const rawData = localStorage.getItem(STORAGE_KEYS.shopDataById);
    if (rawShops && rawData) {
      const shops = JSON.parse(rawShops) as ShopProfile[];
      const shopDataById = JSON.parse(rawData) as Record<string, ShopLedgerData>;
      if (Array.isArray(shops) && shops.length > 0 && shopDataById) {
        const activeShopId =
          rawActive && shopDataById[rawActive] ? rawActive : shops[0].id;
        return { shops, activeShopId, shopDataById };
      }
    }

    // Migrate v1 single-shop data into shop-main if present
    const legacyCustRaw = localStorage.getItem(STORAGE_KEYS.legacyCustomers);
    const legacyTxRaw = localStorage.getItem(STORAGE_KEYS.legacyTransactions);
    const legacyAuditRaw = localStorage.getItem(STORAGE_KEYS.legacyAudit);

    const defaults = createDefaultMultiShopState();
    if (legacyCustRaw || legacyTxRaw) {
      defaults.shopDataById['shop-main'] = {
        customers: legacyCustRaw ? (JSON.parse(legacyCustRaw) as Customer[]) : INITIAL_CUSTOMERS,
        transactions: legacyTxRaw ? (JSON.parse(legacyTxRaw) as Transaction[]) : createInitialTransactions(),
        auditEvents: legacyAuditRaw ? (JSON.parse(legacyAuditRaw) as AuditEvent[]) : [],
      };
    }
    saveMultiShopState(defaults.shops, defaults.activeShopId, defaults.shopDataById);
    return defaults;
  } catch {
    const defaults = createDefaultMultiShopState();
    saveMultiShopState(defaults.shops, defaults.activeShopId, defaults.shopDataById);
    return defaults;
  }
}

export function saveMultiShopState(
  shops: ShopProfile[],
  activeShopId: string,
  shopDataById: Record<string, ShopLedgerData>
): void {
  localStorage.setItem(STORAGE_KEYS.shops, JSON.stringify(shops));
  localStorage.setItem(STORAGE_KEYS.activeShopId, activeShopId);
  localStorage.setItem(STORAGE_KEYS.shopDataById, JSON.stringify(shopDataById));
}

export function loadLanguageMode(): LanguageMode {
  const saved = localStorage.getItem(STORAGE_KEYS.languageMode);
  if (
    saved === 'auto' ||
    saved === 'kn-IN' ||
    saved === 'hi-IN' ||
    saved === 'hinglish' ||
    saved === 'en-IN'
  ) {
    return saved;
  }
  return 'auto';
}

export function saveLanguageMode(mode: LanguageMode): void {
  localStorage.setItem(STORAGE_KEYS.languageMode, mode);
}

export function loadTtsEnabled(): boolean {
  const saved = localStorage.getItem(STORAGE_KEYS.ttsEnabled);
  return saved === null ? true : saved === 'true';
}

export function saveTtsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEYS.ttsEnabled, String(enabled));
}

export function resetAllDemoData(): {
  shops: ShopProfile[];
  activeShopId: string;
  shopDataById: Record<string, ShopLedgerData>;
} {
  const defaults = createDefaultMultiShopState();
  saveMultiShopState(defaults.shops, defaults.activeShopId, defaults.shopDataById);
  return defaults;
}

export interface QuickTestCommand {
  id: string;
  category: 'Kannada' | 'Hinglish / Hindi' | 'English & Safety' | 'Smart Insights';
  command: string;
  description: string;
  preferredMode?: LanguageMode;
}

export const QUICK_TEST_COMMANDS: QuickTestCommand[] = [
  {
    id: 'qt-kn-ramesh',
    category: 'Kannada',
    command: 'Ramesh ge 500 rupaayi udhaara',
    description: 'Duplicate Ramesh check + Kannada prompts',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-kn-mg-pay',
    category: 'Kannada',
    command: 'Ramesh MG Road 300 rupaayi kottiddu',
    description: 'Kannada payment (jama) with area match',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-kn-nooru',
    category: 'Kannada',
    command: 'Suresh ge eradu nooru rupaayi saala',
    description: 'Kannada number words (eradu nooru = ₹200)',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-kn-saavira',
    category: 'Kannada',
    command: 'Lakshmi ge ondu saavira jama',
    description: 'Kannada number words (ondu saavira = ₹1000)',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-hi-ramesh',
    category: 'Hinglish / Hindi',
    command: 'Ramesh ko 500 rupaye udhaar likho',
    description: 'Hinglish duplicate Ramesh disambiguation',
    preferredMode: 'hinglish',
  },
  {
    id: 'qt-hi-abdul',
    category: 'Hinglish / Hindi',
    command: 'Abdul bhai ne 400 jama kiya',
    description: 'Alias match + Hinglish payment',
    preferredMode: 'hinglish',
  },
  {
    id: 'qt-hi-words',
    category: 'Hinglish / Hindi',
    command: 'Suresh ne paanch sau rupaye diye',
    description: 'Hindi number words (paanch sau = ₹500)',
    preferredMode: 'hi-IN',
  },
  {
    id: 'qt-en-alias',
    category: 'English & Safety',
    command: 'Add 250 credit to Ramesha',
    description: 'Phonetic alias ("Ramesha") -> Ramesh disambiguation',
    preferredMode: 'en-IN',
  },
  {
    id: 'qt-en-undo',
    category: 'English & Safety',
    command: 'Undo last transaction',
    description: 'Voice undo test after saving an entry',
    preferredMode: 'auto',
  },
  {
    id: 'qt-p4-followup',
    category: 'Smart Insights',
    command: 'Innu 200 add maadu',
    description: 'Follow-up command using active customer context',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-p4-cust-bal',
    category: 'Smart Insights',
    command: 'Ramesh total eshtu kodbeku?',
    description: 'Customer balance query in Kannada',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-p4-hisab',
    category: 'Smart Insights',
    command: 'Indina hisab heli',
    description: 'Daily ledger summary query in Kannada',
    preferredMode: 'kn-IN',
  },
  {
    id: 'qt-p4-top',
    category: 'Smart Insights',
    command: 'Who owes the most?',
    description: 'Top pending customers query',
    preferredMode: 'en-IN',
  },
  {
    id: 'qt-p4-anomaly',
    category: 'Smart Insights',
    command: 'Ramesh MG Road 15000 udhaara',
    description: 'Triggers unusually high amount anomaly alert',
    preferredMode: 'kn-IN',
  },
];
