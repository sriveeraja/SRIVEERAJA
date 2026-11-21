import { useEffect, useState } from 'react';
import {
  ActiveTab,
  AnomalyWarningInfo,
  AuditEvent,
  Customer,
  DetectedLanguage,
  InsightResponse,
  LanguageMode,
  ParsedIntent,
  PendingTransactionDraft,
  PttState,
  ShopLedgerData,
  ShopProfile,
  Transaction,
  TransactionType,
} from './types/ledger';
import {
  buildCustomerBalanceAnswer,
  buildDailySummaryAnswer,
  formatINR,
  getConfirmationCopy,
  getDisambiguationCopy,
  getSavedCopy,
  getUndoCopy,
  resolveActiveLanguage,
  speakPrompt,
} from './utils/localization';
import { matchCustomers, resolveDisambiguationByVoice } from './utils/matching';
import {
  computeCustomerBalance,
  getTodayISO,
  loadLanguageMode,
  loadMultiShopState,
  loadTtsEnabled,
  resetAllDemoData,
  saveLanguageMode,
  saveMultiShopState,
  saveTtsEnabled,
} from './utils/seedData';
import { FullBackupPayload, hasPinLockEnabled } from './utils/cryptoSecurity';
import { downloadCustomerStatementPdf } from './utils/exportUtils';
import { TopBar } from './components/TopBar';
import { ShopSwitcherBar } from './components/ShopSwitcherBar';
import { VoiceCommandCenter } from './components/VoiceCommandCenter';
import { LedgerWorkspace } from './components/LedgerWorkspace';
import { CustomersDirectory } from './components/CustomersDirectory';
import { ReportsView } from './components/ReportsView';
import { ActivityLog } from './components/ActivityLog';
import { SettingsView } from './components/SettingsView';
import { CustomerProfileDrawer } from './components/CustomerProfileDrawer';
import { WhatsAppReminderModal } from './components/WhatsAppReminderModal';
import { PinLockScreen } from './components/PinLockScreen';
import {
  CustomerFormModal,
  DeleteCustomerModal,
  EditTransactionModal,
} from './components/TransactionModal';

const THEME_STORAGE_KEY = 'khatawas_theme_v1';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getInitialDarkTheme(): boolean {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch {
    return false;
  }
}

export default function App() {
  const [initialState] = useState(() => loadMultiShopState());
  const [shops, setShops] = useState<ShopProfile[]>(initialState.shops);
  const [activeShopId, setActiveShopId] = useState<string>(initialState.activeShopId);
  const [shopDataById, setShopDataById] = useState<Record<string, ShopLedgerData>>(
    initialState.shopDataById
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');
  const [isDark, setIsDark] = useState<boolean>(getInitialDarkTheme);
  const [languageMode, setLanguageMode] = useState<LanguageMode>(() => loadLanguageMode());
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => loadTtsEnabled());

  // Security PIN lock state
  const [pinEnabled, setPinEnabled] = useState<boolean>(() => hasPinLockEnabled());
  const [isLocked, setIsLocked] = useState<boolean>(() => hasPinLockEnabled());

  // Voice, Conversational Context & Smart Insights State
  const [pttState, setPttState] = useState<PttState>('Idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [insightResponse, setInsightResponse] = useState<InsightResponse | null>(null);
  const [pendingIntent, setPendingIntent] = useState<ParsedIntent | null>(null);
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<Customer[]>([]);
  const [disambiguationQueryName, setDisambiguationQueryName] = useState('');
  const [disambiguationDetectedLang, setDisambiguationDetectedLang] = useState<DetectedLanguage>('en');
  const [pendingDraft, setPendingDraft] = useState<PendingTransactionDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [unmatchedCustomerName, setUnmatchedCustomerName] = useState('');
  const [prefillCommand, setPrefillCommand] = useState('');

  // Filters, Drawers, Modals & Undo Banner
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('');
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [whatsAppCustomer, setWhatsAppCustomer] = useState<Customer | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [addCustomerPrefill, setAddCustomerPrefill] = useState('');
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [undoBanner, setUndoBanner] = useState<{ message: string; transaction: Transaction } | null>(null);
  const [statusNotice, setStatusNotice] = useState('');

  // Derived active shop slices
  const activeShop = shops.find((s) => s.id === activeShopId) || shops[0];
  const currentShopData: ShopLedgerData = shopDataById[activeShop.id] || {
    customers: [],
    transactions: [],
    auditEvents: [],
  };
  const customers = currentShopData.customers;
  const transactions = currentShopData.transactions;
  const auditEvents = currentShopData.auditEvents;

  const activeCustomer = activeCustomerId
    ? customers.find((c) => c.id === activeCustomerId) || null
    : null;

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    saveMultiShopState(shops, activeShopId, shopDataById);
  }, [shops, activeShopId, shopDataById]);

  const updateActiveShopData = (updater: (prev: ShopLedgerData) => ShopLedgerData) => {
    setShopDataById((prevMap) => {
      const current = prevMap[activeShop.id] || {
        customers: [],
        transactions: [],
        auditEvents: [],
      };
      return {
        ...prevMap,
        [activeShop.id]: updater(current),
      };
    });
  };

  const setCustomers = (updater: (prev: Customer[]) => Customer[]) => {
    updateActiveShopData((shopData) => ({
      ...shopData,
      customers: updater(shopData.customers),
    }));
  };

  const setTransactions = (updater: (prev: Transaction[]) => Transaction[]) => {
    updateActiveShopData((shopData) => ({
      ...shopData,
      transactions: updater(shopData.transactions),
    }));
  };

  const appendAudit = (
    action: AuditEvent['action'],
    summary: string,
    language?: DetectedLanguage,
    targetShopId?: string
  ) => {
    const shopId = targetShopId || activeShop.id;
    const newEvent: AuditEvent = {
      id: makeId('audit'),
      action,
      summary,
      timestamp: new Date().toISOString(),
      language,
    };
    setShopDataById((prevMap) => {
      const current = prevMap[shopId] || {
        customers: [],
        transactions: [],
        auditEvents: [],
      };
      return {
        ...prevMap,
        [shopId]: {
          ...current,
          auditEvents: [newEvent, ...current.auditEvents],
        },
      };
    });
  };

  const speakWithFeedback = (text: string, lang: DetectedLanguage) => {
    speakPrompt(text, lang, ttsEnabled, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const handleLanguageModeChange = (mode: LanguageMode) => {
    setLanguageMode(mode);
    saveLanguageMode(mode);
  };

  const handleToggleTts = () => {
    setTtsEnabled((prev) => {
      const next = !prev;
      saveTtsEnabled(next);
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  };

  const resetTransientInteractionState = () => {
    setActiveCustomerId(null);
    setInsightResponse(null);
    setPendingIntent(null);
    setDisambiguationCandidates([]);
    setPendingDraft(null);
    setErrorMessage('');
    setUnmatchedCustomerName('');
    setSelectedCustomerFilter('');
    setProfileCustomerId(null);
    setWhatsAppCustomer(null);
    setUndoBanner(null);
    setPttState('Idle');
  };

  const handleSwitchShop = (shopId: string) => {
    if (shopId === activeShopId) return;
    const targetShop = shops.find((s) => s.id === shopId);
    if (!targetShop) return;
    resetTransientInteractionState();
    setActiveShopId(shopId);
    appendAudit('SHOP_SWITCHED', `Switched active counter to ${targetShop.name}.`, undefined, shopId);
    setStatusNotice(`Switched to ${targetShop.name}.`);
  };

  const handleCreateShop = (name: string, subtitle: string) => {
    const newShop: ShopProfile = {
      id: makeId('shop'),
      name,
      subtitle,
      createdAt: new Date().toISOString(),
    };
    const initialEvent: AuditEvent = {
      id: makeId('audit'),
      action: 'SHOP_SWITCHED',
      summary: `Created and switched to new shop counter "${name}".`,
      timestamp: new Date().toISOString(),
    };
    setShops((prev) => [...prev, newShop]);
    setShopDataById((prev) => ({
      ...prev,
      [newShop.id]: {
        customers: [],
        transactions: [],
        auditEvents: [initialEvent],
      },
    }));
    resetTransientInteractionState();
    setActiveShopId(newShop.id);
    setStatusNotice(`Created shop "${name}".`);
  };

  const handlePinStateChanged = (enabled: boolean, summary: string) => {
    setPinEnabled(enabled);
    appendAudit('PIN_UPDATED', summary);
  };

  const handleBackupExported = () => {
    appendAudit('BACKUP_EXPORTED', `Exported AES-256-GCM encrypted backup across ${shops.length} shops.`);
    setStatusNotice('Encrypted backup file downloaded.');
  };

  const handleRestoreBackup = (payload: FullBackupPayload) => {
    resetTransientInteractionState();
    const restoredEvent: AuditEvent = {
      id: makeId('audit'),
      action: 'BACKUP_RESTORED',
      summary: `Restored encrypted backup (${payload.shops.length} shops).`,
      timestamp: new Date().toISOString(),
    };

    const targetId = payload.shopDataById[payload.activeShopId]
      ? payload.activeShopId
      : payload.shops[0].id;

    const updatedDataById: Record<string, ShopLedgerData> = { ...payload.shopDataById };
    const targetData = updatedDataById[targetId] || {
      customers: [],
      transactions: [],
      auditEvents: [],
    };
    updatedDataById[targetId] = {
      ...targetData,
      auditEvents: [restoredEvent, ...targetData.auditEvents],
    };

    setShops(payload.shops);
    setShopDataById(updatedDataById);
    setActiveShopId(targetId);
    setStatusNotice(`Backup restored successfully (${payload.shops.length} shop profiles).`);
  };

  const checkDuplicateWithin5Min = (
    customerId: string,
    amount: number,
    type: TransactionType
  ) => {
    const now = Date.now();
    const match = transactions.find((tx) => {
      if (tx.customerId !== customerId || tx.amount !== amount || tx.type !== type) {
        return false;
      }
      const elapsedMs = now - Date.parse(tx.createdAt);
      return elapsedMs >= 0 && elapsedMs <= 5 * 60 * 1000;
    });
    if (!match) return undefined;
    const minutesAgo = Math.max(0, Math.round((now - Date.parse(match.createdAt)) / 60000));
    return {
      existingTxId: match.id,
      minutesAgo,
      existingCreatedAt: match.createdAt,
    };
  };

  const checkAnomalyWarning = (
    customerId: string,
    amount: number,
    customerName: string
  ): AnomalyWarningInfo | undefined => {
    const custTxs = transactions.filter((t) => t.customerId === customerId);
    const avg =
      custTxs.length > 0
        ? Math.round(custTxs.reduce((s, t) => s + t.amount, 0) / custTxs.length)
        : 0;

    if (custTxs.length > 0 && amount > avg * 3 && amount > 10000) {
      return {
        thresholdType: 'SPIKE_VS_AVG',
        customerAvg: avg,
        reason: `₹${formatINR(amount)} exceeds ₹10,000 and is over 3× ${customerName}'s typical entry (avg ₹${formatINR(avg)}).`,
      };
    }
    if (custTxs.length > 0 && amount > avg * 3) {
      return {
        thresholdType: 'SPIKE_VS_AVG',
        customerAvg: avg,
        reason: `₹${formatINR(amount)} is more than 3× ${customerName}'s average entry (₹${formatINR(avg)}). Verify digits before saving.`,
      };
    }
    if (amount > 10000) {
      return {
        thresholdType: 'HIGH_ABSOLUTE',
        customerAvg: avg,
        reason: `₹${formatINR(amount)} exceeds ₹10,000 high-value safety threshold. Verify before saving.`,
      };
    }
    return undefined;
  };

  const computeDailySummaryData = () => {
    const today = getTodayISO();
    const todayCredits = transactions.filter((t) => t.date === today && t.type === 'CREDIT');
    const todayPaymentEntries = transactions.filter((t) => t.date === today && t.type === 'PAYMENT');
    const todayCredit = todayCredits.reduce((s, t) => s + t.amount, 0);
    const todayPayments = todayPaymentEntries.reduce((s, t) => s + t.amount, 0);

    const customerBalances = customers
      .map((c) => ({
        name: c.name,
        area: c.area,
        balance: computeCustomerBalance(c.id, transactions),
      }))
      .sort((a, b) => b.balance - a.balance);

    const totalOutstanding = customerBalances.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const topDebtors = customerBalances.filter((c) => c.balance > 0).slice(0, 3);

    return {
      todayCredit,
      todayCreditCount: todayCredits.length,
      todayPayments,
      todayPaymentsCount: todayPaymentEntries.length,
      totalOutstanding,
      topDebtors,
    };
  };

  const answerCustomerBalanceQuery = (customer: Customer, lang: DetectedLanguage) => {
    setActiveCustomerId(customer.id);
    const balance = computeCustomerBalance(customer.id, transactions);
    const copy = buildCustomerBalanceAnswer(customer.name, customer.area, balance, lang);

    const totalCredit = transactions
      .filter((t) => t.customerId === customer.id && t.type === 'CREDIT')
      .reduce((s, t) => s + t.amount, 0);
    const totalPaid = transactions
      .filter((t) => t.customerId === customer.id && t.type === 'PAYMENT')
      .reduce((s, t) => s + t.amount, 0);

    setInsightResponse({
      id: makeId('insight'),
      title: copy.title,
      answer: copy.answer,
      scriptSubtitle: copy.scriptSubtitle,
      language: lang,
      highlights: [
        {
          label: 'Net Balance',
          value: `₹${formatINR(Math.abs(balance))}`,
          tone: balance > 0 ? 'credit' : balance < 0 ? 'payment' : 'neutral',
        },
        { label: 'Total Credit', value: `₹${formatINR(totalCredit)}`, tone: 'credit' },
        { label: 'Total Paid', value: `₹${formatINR(totalPaid)}`, tone: 'payment' },
      ],
      timestamp: new Date().toISOString(),
    });
    setDisambiguationCandidates([]);
    setPendingIntent(null);
    setPendingDraft(null);
    setPttState('Idle');
    appendAudit(
      'QUERY_ANSWERED',
      `Answered balance query for ${customer.name} (${customer.area}): ₹${formatINR(balance)}.`,
      lang
    );
    speakWithFeedback(copy.ttsText, lang);
  };

  const handleTriggerDailySummary = (langOverride?: DetectedLanguage) => {
    const lang = langOverride || resolveActiveLanguage(languageMode, 'en');
    const summary = computeDailySummaryData();
    const copy = buildDailySummaryAnswer(summary, lang);
    const netChange = summary.todayCredit - summary.todayPayments;

    setInsightResponse({
      id: makeId('insight'),
      title: copy.title,
      answer: copy.answer,
      scriptSubtitle: copy.scriptSubtitle,
      language: lang,
      highlights: [
        { label: "Today's Credit", value: `₹${formatINR(summary.todayCredit)}`, tone: 'credit' },
        { label: "Today's Jama", value: `₹${formatINR(summary.todayPayments)}`, tone: 'payment' },
        {
          label: 'Net Today',
          value: `${netChange >= 0 ? '+' : '-'}₹${formatINR(Math.abs(netChange))}`,
          tone: netChange > 0 ? 'credit' : 'payment',
        },
      ],
      timestamp: new Date().toISOString(),
    });
    setPendingDraft(null);
    setDisambiguationCandidates([]);
    setPttState('Idle');
    appendAudit('QUERY_ANSWERED', 'Generated Daily Voice Summary.', lang);
    speakWithFeedback(copy.ttsText, lang);
  };

  const enterConfirmation = (customer: Customer, intent: ParsedIntent) => {
    setActiveCustomerId(customer.id);
    setInsightResponse(null);

    const duplicateWarning = checkDuplicateWithin5Min(
      customer.id,
      intent.amount,
      intent.type as TransactionType
    );
    const anomalyWarning = checkAnomalyWarning(customer.id, intent.amount, customer.name);
    const lang = resolveActiveLanguage(languageMode, intent.detectedLanguage);

    if (duplicateWarning) {
      appendAudit(
        'DUPLICATE_WARNED',
        `Flagged potential duplicate ₹${intent.amount} ${intent.type} for ${customer.name} (${customer.area}).`,
        lang
      );
    }
    if (anomalyWarning) {
      appendAudit(
        'ANOMALY_WARNED',
        `Flagged high-value anomaly ₹${intent.amount} for ${customer.name} (${customer.area}).`,
        lang
      );
    }

    const draft: PendingTransactionDraft = {
      customerId: customer.id,
      customerName: customer.name,
      customerArea: customer.area,
      amount: intent.amount,
      type: intent.type as TransactionType,
      date: intent.date || getTodayISO(),
      note: intent.note,
      confidence: intent.confidence,
      detectedLanguage: lang,
      rawText: intent.rawText,
      duplicateWarning,
      anomalyWarning,
    };

    setDisambiguationCandidates([]);
    setUnmatchedCustomerName('');
    setErrorMessage('');
    setPendingDraft(draft);
    setPttState('Confirming');

    const copy = getConfirmationCopy(
      `${customer.name} (${customer.area})`,
      draft.amount,
      draft.type,
      lang
    );
    speakWithFeedback(copy.ttsText, lang);
  };

  const handleSelectDisambiguation = (customer: Customer) => {
    if (!pendingIntent) return;
    const lang = resolveActiveLanguage(languageMode, pendingIntent.detectedLanguage);
    setActiveCustomerId(customer.id);
    appendAudit(
      'DISAMBIGUATED',
      `Resolved "${disambiguationQueryName}" to ${customer.name} (${customer.area}).`,
      lang
    );

    if (pendingIntent.intentKind === 'QUERY' && pendingIntent.queryType === 'CUSTOMER_BALANCE') {
      answerCustomerBalanceQuery(customer, lang);
      return;
    }

    if (pendingIntent.type !== 'UNKNOWN') {
      enterConfirmation(customer, pendingIntent);
    }
  };

  const handleUndoTransaction = (txToUndo: Transaction, langOverride?: DetectedLanguage) => {
    const cust = customers.find((c) => c.id === txToUndo.customerId);
    const label = cust ? `${cust.name} (${cust.area})` : 'Customer';
    const lang = resolveActiveLanguage(languageMode, langOverride || txToUndo.detectedLanguage);

    setTransactions((prev) => prev.filter((t) => t.id !== txToUndo.id));
    setUndoBanner(null);

    const copy = getUndoCopy(label, txToUndo.amount, lang);
    setStatusNotice(copy.message);
    appendAudit('UNDONE', `Undid ₹${txToUndo.amount} ${txToUndo.type} for ${label}.`, lang);
    speakWithFeedback(copy.ttsText, lang);
  };

  const handleQueryIntent = (parsed: ParsedIntent, activeLang: DetectedLanguage) => {
    const summary = computeDailySummaryData();
    const qType = parsed.queryType || 'DAILY_SUMMARY';

    if (qType === 'CUSTOMER_BALANCE') {
      if (parsed.usesActiveCustomer && activeCustomer) {
        answerCustomerBalanceQuery(activeCustomer, activeLang);
        return;
      }

      if (!parsed.customerName) {
        setErrorMessage('Please specify which customer balance you want to check.');
        setPttState('Error');
        return;
      }

      const matches = matchCustomers(parsed.customerName, customers);
      if (matches.length === 0) {
        setErrorMessage(`No customer named "${parsed.customerName}" was found.`);
        setPttState('Error');
        return;
      }
      if (matches.length > 1) {
        const activeMatch = activeCustomer
          ? matches.find((m) => m.customer.id === activeCustomer.id)
          : undefined;
        if (activeMatch) {
          answerCustomerBalanceQuery(activeMatch.customer, activeLang);
          return;
        }

        setPendingIntent(parsed);
        setDisambiguationCandidates(matches.map((m) => m.customer));
        setDisambiguationQueryName(parsed.customerName);
        setDisambiguationDetectedLang(parsed.detectedLanguage);
        setPttState('Needs Disambiguation');
        const copy = getDisambiguationCopy(parsed.customerName, activeLang);
        speakWithFeedback(copy.ttsText, activeLang);
        return;
      }

      answerCustomerBalanceQuery(matches[0].customer, activeLang);
      return;
    }

    if (qType === 'TODAY_CREDIT') {
      const amt = formatINR(summary.todayCredit);
      const text =
        activeLang === 'kn'
          ? `Ivattu ottu ₹${amt} udhaara (${summary.todayCreditCount} entries) aagide.`
          : activeLang === 'hi' || activeLang === 'hinglish'
            ? `Aaj total ₹${amt} udhaar (${summary.todayCreditCount} entries) diya gaya hai.`
            : `Today's total credit (udhaar) is ₹${amt} across ${summary.todayCreditCount} entries.`;
      setInsightResponse({
        id: makeId('insight'),
        title: "Today's Credit Total",
        answer: text,
        language: activeLang,
        highlights: [
          { label: "Today's Credit", value: `₹${amt}`, tone: 'credit' },
          { label: 'Entries', value: `${summary.todayCreditCount}` },
        ],
        timestamp: new Date().toISOString(),
      });
      setPttState('Idle');
      appendAudit('QUERY_ANSWERED', text, activeLang);
      speakWithFeedback(text, activeLang);
      return;
    }

    if (qType === 'TODAY_PAYMENTS') {
      const amt = formatINR(summary.todayPayments);
      const text =
        activeLang === 'kn'
          ? `Ivattu ottu ₹${amt} jama (${summary.todayPaymentsCount} receipts) bandide.`
          : activeLang === 'hi' || activeLang === 'hinglish'
            ? `Aaj total ₹${amt} jama (${summary.todayPaymentsCount} payments) mila hai.`
            : `Today's total payments (jama) received is ₹${amt} across ${summary.todayPaymentsCount} receipts.`;
      setInsightResponse({
        id: makeId('insight'),
        title: "Today's Payments Received",
        answer: text,
        language: activeLang,
        highlights: [
          { label: "Today's Jama", value: `₹${amt}`, tone: 'payment' },
          { label: 'Receipts', value: `${summary.todayPaymentsCount}` },
        ],
        timestamp: new Date().toISOString(),
      });
      setPttState('Idle');
      appendAudit('QUERY_ANSWERED', text, activeLang);
      speakWithFeedback(text, activeLang);
      return;
    }

    if (qType === 'TOP_DEBTORS') {
      const top = summary.topDebtors;
      if (top.length === 0) {
        const emptyMsg = 'All customer accounts are settled with ₹0 pending.';
        setInsightResponse({
          id: makeId('insight'),
          title: 'Top Pending Balances',
          answer: emptyMsg,
          language: activeLang,
          timestamp: new Date().toISOString(),
        });
        setPttState('Idle');
        speakWithFeedback(emptyMsg, activeLang);
        return;
      }

      const leader = top[0];
      const text =
        activeLang === 'kn'
          ? `${leader.name} (${leader.area}) ellariginta jasti ₹${formatINR(leader.balance)} kodbeku.`
          : activeLang === 'hi' || activeLang === 'hinglish'
            ? `Sabse zyada baaki ${leader.name} (${leader.area}) par ₹${formatINR(leader.balance)} hai.`
            : `${leader.name} (${leader.area}) owes the most at ₹${formatINR(leader.balance)}.`;

      setInsightResponse({
        id: makeId('insight'),
        title: 'Top Pending Balances',
        answer: text,
        language: activeLang,
        highlights: top.map((d) => ({
          label: `${d.name} (${d.area})`,
          value: `₹${formatINR(d.balance)}`,
          tone: 'credit',
        })),
        timestamp: new Date().toISOString(),
      });
      setPttState('Idle');
      appendAudit('QUERY_ANSWERED', text, activeLang);
      speakWithFeedback(text, activeLang);
      return;
    }

    if (qType === 'TOTAL_OUTSTANDING') {
      const out = formatINR(summary.totalOutstanding);
      const text =
        activeLang === 'kn'
          ? `Ottaare market nalli ₹${out} baaki barabeku.`
          : activeLang === 'hi' || activeLang === 'hinglish'
            ? `Total market udhaar ₹${out} baaki hai.`
            : `Total outstanding udhaar receivable across all customers is ₹${out}.`;
      setInsightResponse({
        id: makeId('insight'),
        title: 'Total Receivable',
        answer: text,
        language: activeLang,
        highlights: [{ label: 'Total Outstanding', value: `₹${out}`, tone: 'credit' }],
        timestamp: new Date().toISOString(),
      });
      setPttState('Idle');
      appendAudit('QUERY_ANSWERED', text, activeLang);
      speakWithFeedback(text, activeLang);
      return;
    }

    handleTriggerDailySummary(activeLang);
  };

  const handleSubmitCommand = async (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;
    setStatusNotice('');

    if (pttState === 'Needs Disambiguation' && disambiguationCandidates.length > 0 && pendingIntent) {
      const resolved = resolveDisambiguationByVoice(trimmed, disambiguationCandidates);
      if (resolved) {
        handleSelectDisambiguation(resolved);
        return;
      }
    }

    setPttState('Processing');
    setErrorMessage('');
    setUnmatchedCustomerName('');

    try {
      const response = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: trimmed,
          languageMode,
          todayDate: getTodayISO(),
          activeCustomer: activeCustomer
            ? {
                id: activeCustomer.id,
                name: activeCustomer.name,
                area: activeCustomer.area,
                note: activeCustomer.note,
              }
            : null,
          customers: customers.map((c) => ({
            name: c.name,
            area: c.area,
            aliases: c.aliases,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not parse command.');
      }

      const parsed = data as ParsedIntent;
      const activeLang = resolveActiveLanguage(languageMode, parsed.detectedLanguage);

      if (parsed.isUndoCommand || parsed.intentKind === 'UNDO') {
        const target = undoBanner?.transaction || transactions[0];
        if (!target) {
          setPttState('Error');
          setErrorMessage('No recent transaction available to undo.');
          return;
        }
        handleUndoTransaction(target, activeLang);
        setPttState('Idle');
        return;
      }

      if (parsed.intentKind === 'QUERY') {
        handleQueryIntent(parsed, activeLang);
        return;
      }

      if (parsed.usesActiveCustomer && activeCustomer) {
        if (parsed.type === 'UNKNOWN' || parsed.amount <= 0) {
          const reason =
            parsed.unclearReason ||
            `Could not detect a valid amount or transaction type for ${activeCustomer.name}.`;
          setErrorMessage(reason);
          setPttState('Error');
          speakWithFeedback(reason, activeLang);
          return;
        }
        setPendingIntent(parsed);
        enterConfirmation(activeCustomer, parsed);
        return;
      }

      if (parsed.type === 'UNKNOWN' || parsed.amount <= 0 || !parsed.customerName) {
        const reason =
          parsed.unclearReason ||
          'Could not clearly identify customer name, INR amount, and whether it is Credit (Udhaar) or Payment (Jama). Please try again.';
        setPendingIntent(null);
        setPendingDraft(null);
        setDisambiguationCandidates([]);
        setErrorMessage(reason);
        setPttState('Error');
        speakWithFeedback(reason, activeLang);
        return;
      }

      setPendingIntent(parsed);
      const matches = matchCustomers(parsed.customerName, customers);

      if (matches.length === 0) {
        setPendingDraft(null);
        setDisambiguationCandidates([]);
        setUnmatchedCustomerName(parsed.customerName);
        setErrorMessage(
          `No customer named "${parsed.customerName}" was found for ₹${parsed.amount} ${
            parsed.type === 'CREDIT' ? 'Credit' : 'Payment'
          }.`
        );
        setPttState('Error');
        return;
      }

      if (matches.length > 1) {
        const matchedCustomers = matches.map((m) => m.customer);
        setPendingDraft(null);
        setDisambiguationCandidates(matchedCustomers);
        setDisambiguationQueryName(parsed.customerName);
        setDisambiguationDetectedLang(parsed.detectedLanguage);
        setPttState('Needs Disambiguation');

        const copy = getDisambiguationCopy(parsed.customerName, activeLang);
        speakWithFeedback(copy.ttsText, activeLang);
        return;
      }

      enterConfirmation(matches[0].customer, parsed);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to parse command. Please try again.';
      setErrorMessage(msg);
      setPttState('Error');
    }
  };

  const handleConfirmDraft = (draft: PendingTransactionDraft) => {
    const newTx: Transaction = {
      id: makeId('tx'),
      customerId: draft.customerId,
      amount: draft.amount,
      type: draft.type,
      date: draft.date,
      note: draft.note,
      createdAt: new Date().toISOString(),
      sourceCommand: draft.rawText,
      detectedLanguage: draft.detectedLanguage,
      confidence: draft.confidence,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setActiveCustomerId(draft.customerId);

    const label = `${draft.customerName} (${draft.customerArea})`;
    const savedCopy = getSavedCopy(label, draft.amount, draft.type, draft.detectedLanguage);

    setUndoBanner({
      message: savedCopy.banner,
      transaction: newTx,
    });
    setStatusNotice('');
    setPendingDraft(null);
    setPendingIntent(null);
    setDisambiguationCandidates([]);
    setPttState('Idle');

    appendAudit(
      'SAVED',
      `Confirmed & saved ₹${draft.amount} ${draft.type} for ${label}.`,
      draft.detectedLanguage
    );
    speakWithFeedback(savedCopy.ttsText, draft.detectedLanguage);
  };

  const handleUpdatePendingDraft = (updated: PendingTransactionDraft) => {
    const duplicateWarning = checkDuplicateWithin5Min(
      updated.customerId,
      updated.amount,
      updated.type
    );
    const anomalyWarning = checkAnomalyWarning(
      updated.customerId,
      updated.amount,
      updated.customerName
    );
    setPendingDraft({
      ...updated,
      duplicateWarning,
      anomalyWarning,
    });
  };

  const handleCancelPending = () => {
    setPendingDraft(null);
    setPendingIntent(null);
    setDisambiguationCandidates([]);
    setErrorMessage('');
    setUnmatchedCustomerName('');
    setPttState('Idle');
  };

  const handleSaveEditedTransaction = (updated: {
    id: string;
    customerId: string;
    amount: number;
    type: TransactionType;
    date: string;
    note: string;
  }) => {
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === updated.id
          ? {
              ...tx,
              customerId: updated.customerId,
              amount: updated.amount,
              type: updated.type,
              date: updated.date,
              note: updated.note,
              updatedAt: new Date().toISOString(),
            }
          : tx
      )
    );
    const cust = customers.find((c) => c.id === updated.customerId);
    appendAudit(
      'EDITED',
      `Edited entry for ${cust ? `${cust.name} (${cust.area})` : 'customer'} to ₹${updated.amount} ${updated.type}.`
    );
    setEditingTransaction(null);
    setStatusNotice('Transaction updated.');
  };

  const handleDeleteTransaction = (tx: Transaction) => {
    const cust = customers.find((c) => c.id === tx.customerId);
    setTransactions((prev) => prev.filter((item) => item.id !== tx.id));
    if (undoBanner?.transaction.id === tx.id) {
      setUndoBanner(null);
    }
    appendAudit(
      'DELETED',
      `Removed ₹${tx.amount} ${tx.type} entry for ${cust ? `${cust.name} (${cust.area})` : 'customer'}.`
    );
    setStatusNotice('Transaction deleted.');
  };

  const handleSubmitCustomerForm = (data: {
    id?: string;
    name: string;
    phone: string;
    area: string;
    note: string;
    aliases: string[];
  }) => {
    if (data.id) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === data.id
            ? {
                ...c,
                name: data.name,
                phone: data.phone,
                area: data.area,
                note: data.note,
                aliases: data.aliases,
              }
            : c
        )
      );
      appendAudit('CUSTOMER_EDITED', `Updated customer profile ${data.name} (${data.area}).`);
      setStatusNotice(`Updated profile for ${data.name} (${data.area}).`);
      return;
    }

    const newCust: Customer = {
      id: makeId('cust'),
      name: data.name,
      phone: data.phone,
      area: data.area,
      note: data.note,
      aliases: data.aliases,
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => [newCust, ...prev]);
    appendAudit('CUSTOMER_ADDED', `Created customer ${newCust.name} (${newCust.area}).`);

    if (pttState === 'Error' && pendingIntent && pendingIntent.type !== 'UNKNOWN' && unmatchedCustomerName) {
      enterConfirmation(newCust, pendingIntent);
    }
  };

  const handleConfirmDeleteCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setTransactions((prev) => prev.filter((t) => t.customerId !== customerId));
    if (profileCustomerId === customerId) setProfileCustomerId(null);
    if (selectedCustomerFilter === customerId) setSelectedCustomerFilter('');
    if (activeCustomerId === customerId) setActiveCustomerId(null);
    appendAudit('DELETED', `Deleted settled customer account ${cust.name} (${cust.area}).`);
    setStatusNotice(`Deleted customer ${cust.name} (${cust.area}).`);
  };

  const handleSelectFallbackCustomer = (customer: Customer) => {
    if (pendingIntent && pendingIntent.type !== 'UNKNOWN') {
      enterConfirmation(customer, pendingIntent);
    }
  };

  const handleResetDemoData = () => {
    const reset = resetAllDemoData();
    setShops(reset.shops);
    setActiveShopId(reset.activeShopId);
    setShopDataById(reset.shopDataById);
    resetTransientInteractionState();
    setStatusNotice('Demo shops restored (Main Kirana Store & Wholesale Counter).');
  };

  const handleDownloadPdf = (customer: Customer) => {
    downloadCustomerStatementPdf(customer, transactions, activeShop.name);
    setStatusNotice(`Downloaded PDF statement for ${customer.name} (${customer.area}).`);
  };

  const profileCustomer = profileCustomerId
    ? customers.find((c) => c.id === profileCustomerId) || null
    : null;

  const deletingBalance = deletingCustomer
    ? computeCustomerBalance(deletingCustomer.id, transactions)
    : 0;
  const deletingTxCount = deletingCustomer
    ? transactions.filter((t) => t.customerId === deletingCustomer.id).length
    : 0;

  const whatsAppBalance = whatsAppCustomer
    ? computeCustomerBalance(whatsAppCustomer.id, transactions)
    : 0;

  if (isLocked) {
    return <PinLockScreen onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        pinEnabled={pinEnabled}
        onLockNow={() => setIsLocked(true)}
        onOpenAddCustomer={() => {
          setEditingCustomer(null);
          setAddCustomerPrefill('');
          setIsCustomerModalOpen(true);
        }}
      />

      <ShopSwitcherBar
        shops={shops}
        activeShopId={activeShop.id}
        onSwitchShop={handleSwitchShop}
        onOpenSettings={() => setActiveTab('settings')}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-8">
        {statusNotice && (
          <div className="mb-5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice('')}
              className="text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
                  Voice Udhaar Counter
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {activeShop.name} · Speak in Kannada, Hindi, Hinglish, or English
                </p>
              </div>

              <VoiceCommandCenter
                pttState={pttState}
                isSpeaking={isSpeaking}
                languageMode={languageMode}
                onLanguageModeChange={handleLanguageModeChange}
                ttsEnabled={ttsEnabled}
                onToggleTts={handleToggleTts}
                onSetPttState={setPttState}
                onSubmitCommand={handleSubmitCommand}
                disambiguationCandidates={disambiguationCandidates}
                disambiguationQueryName={disambiguationQueryName}
                disambiguationDetectedLang={disambiguationDetectedLang}
                onSelectDisambiguation={handleSelectDisambiguation}
                pendingDraft={pendingDraft}
                customers={customers}
                transactions={transactions}
                onConfirmDraft={handleConfirmDraft}
                onUpdatePendingDraft={handleUpdatePendingDraft}
                onCancelPending={handleCancelPending}
                errorMessage={errorMessage}
                unmatchedCustomerName={unmatchedCustomerName}
                onQuickCreateCustomer={(name) => {
                  setEditingCustomer(null);
                  setAddCustomerPrefill(name);
                  setIsCustomerModalOpen(true);
                }}
                onSelectFallbackCustomer={handleSelectFallbackCustomer}
                prefillCommand={prefillCommand}
                onClearPrefillCommand={() => setPrefillCommand('')}
                activeCustomer={activeCustomer}
                onClearActiveCustomer={() => setActiveCustomerId(null)}
                insightResponse={insightResponse}
                onDismissInsight={() => setInsightResponse(null)}
                onTriggerDailySummary={() => handleTriggerDailySummary()}
              />
            </div>

            <div className="lg:col-span-7">
              <LedgerWorkspace
                shopName={activeShop.name}
                customers={customers}
                transactions={transactions}
                selectedCustomerFilter={selectedCustomerFilter}
                onSelectCustomerFilter={setSelectedCustomerFilter}
                undoBanner={undoBanner}
                onUndoLast={() => undoBanner && handleUndoTransaction(undoBanner.transaction)}
                onDismissUndoBanner={() => setUndoBanner(null)}
                onEditTransaction={setEditingTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onOpenCustomerProfile={(c) => setProfileCustomerId(c.id)}
                onTriggerDailySummary={() => handleTriggerDailySummary()}
              />
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <CustomersDirectory
            customers={customers}
            transactions={transactions}
            onOpenCustomerProfile={(c) => setProfileCustomerId(c.id)}
            onEditCustomer={(c) => {
              setEditingCustomer(c);
              setAddCustomerPrefill('');
              setIsCustomerModalOpen(true);
            }}
            onRequestDeleteCustomer={(c) => setDeletingCustomer(c)}
            onDownloadPdf={handleDownloadPdf}
            onOpenWhatsApp={(c) => setWhatsAppCustomer(c)}
            onOpenAddCustomer={() => {
              setEditingCustomer(null);
              setAddCustomerPrefill('');
              setIsCustomerModalOpen(true);
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            shopName={activeShop.name}
            customers={customers}
            transactions={transactions}
            onDownloadPdf={handleDownloadPdf}
            onOpenWhatsApp={(c) => setWhatsAppCustomer(c)}
            onOpenCustomerProfile={(c) => setProfileCustomerId(c.id)}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityLog shopName={activeShop.name} events={auditEvents} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            shops={shops}
            activeShopId={activeShop.id}
            shopDataById={shopDataById}
            onSwitchShop={handleSwitchShop}
            onCreateShop={handleCreateShop}
            pinEnabled={pinEnabled}
            onPinStateChanged={handlePinStateChanged}
            onLockNow={() => setIsLocked(true)}
            onBackupExported={handleBackupExported}
            onRestoreBackup={handleRestoreBackup}
            onResetDemoData={handleResetDemoData}
          />
        )}
      </main>

      <CustomerProfileDrawer
        customer={profileCustomer}
        transactions={transactions}
        onClose={() => setProfileCustomerId(null)}
        onEditCustomer={(c) => {
          setEditingCustomer(c);
          setIsCustomerModalOpen(true);
        }}
        onRequestDeleteCustomer={(c) => setDeletingCustomer(c)}
        onEditTransaction={setEditingTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onDownloadPdf={handleDownloadPdf}
        onOpenWhatsApp={(c) => setWhatsAppCustomer(c)}
        onStartVoiceForCustomer={(c) => {
          setProfileCustomerId(null);
          setActiveCustomerId(c.id);
          setSelectedCustomerFilter(c.id);
          setActiveTab('ledger');
          setPrefillCommand(`${c.name} ${c.area} `);
        }}
      />

      <WhatsAppReminderModal
        customer={whatsAppCustomer}
        balance={whatsAppBalance}
        shopName={activeShop.name}
        defaultLang={resolveActiveLanguage(languageMode, 'kn')}
        onClose={() => setWhatsAppCustomer(null)}
      />

      <EditTransactionModal
        transaction={editingTransaction}
        customers={customers}
        onClose={() => setEditingTransaction(null)}
        onSave={handleSaveEditedTransaction}
      />

      <CustomerFormModal
        isOpen={isCustomerModalOpen}
        editingCustomer={editingCustomer}
        initialName={addCustomerPrefill}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setEditingCustomer(null);
        }}
        onSubmit={handleSubmitCustomerForm}
      />

      <DeleteCustomerModal
        customer={deletingCustomer}
        balance={deletingBalance}
        transactionCount={deletingTxCount}
        onClose={() => setDeletingCustomer(null)}
        onViewCustomerLedger={(customerId) => {
          setProfileCustomerId(null);
          setSelectedCustomerFilter(customerId);
          setActiveTab('ledger');
        }}
        onConfirmDelete={handleConfirmDeleteCustomer}
      />
    </div>
  );
}
