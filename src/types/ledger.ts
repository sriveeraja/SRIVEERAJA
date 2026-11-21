export type LanguageMode = 'auto' | 'kn-IN' | 'hi-IN' | 'hinglish' | 'en-IN';

export type DetectedLanguage = 'kn' | 'hi' | 'hinglish' | 'en';

export type TransactionType = 'CREDIT' | 'PAYMENT';

export type PttState =
  | 'Idle'
  | 'Listening'
  | 'Processing'
  | 'Needs Disambiguation'
  | 'Confirming'
  | 'Error';

export type ActiveTab = 'ledger' | 'customers' | 'reports' | 'activity' | 'settings';

export type IntentKind = 'TRANSACTION' | 'QUERY' | 'UNDO' | 'UNKNOWN';

export type QueryType =
  | 'CUSTOMER_BALANCE'
  | 'TODAY_CREDIT'
  | 'TODAY_PAYMENTS'
  | 'TOP_DEBTORS'
  | 'DAILY_SUMMARY'
  | 'TOTAL_OUTSTANDING';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  area: string;
  note: string;
  aliases: string[];
  createdAt: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: string; // ISO timestamp
  updatedAt?: string;
  sourceCommand?: string;
  detectedLanguage?: DetectedLanguage;
  confidence?: number;
}

export interface ParsedIntent {
  rawText: string;
  intentKind: IntentKind;
  queryType?: QueryType;
  usesActiveCustomer: boolean;
  customerName: string;
  amount: number;
  type: TransactionType | 'UNKNOWN';
  date: string;
  note: string;
  confidence: number;
  detectedLanguage: DetectedLanguage;
  isUndoCommand: boolean;
  unclearReason: string;
}

export interface DuplicateWarningInfo {
  existingTxId: string;
  minutesAgo: number;
  existingCreatedAt: string;
}

export interface AnomalyWarningInfo {
  reason: string;
  customerAvg: number;
  thresholdType: 'HIGH_ABSOLUTE' | 'SPIKE_VS_AVG';
}

export interface PendingTransactionDraft {
  customerId: string;
  customerName: string;
  customerArea: string;
  amount: number;
  type: TransactionType;
  date: string;
  note: string;
  confidence: number;
  detectedLanguage: DetectedLanguage;
  rawText: string;
  duplicateWarning?: DuplicateWarningInfo;
  anomalyWarning?: AnomalyWarningInfo;
}

export interface InsightResponse {
  id: string;
  title: string;
  answer: string;
  scriptSubtitle?: string;
  language: DetectedLanguage;
  highlights?: { label: string; value: string; tone?: 'neutral' | 'credit' | 'payment' }[];
  timestamp: string;
}

export interface AuditEvent {
  id: string;
  action:
    | 'SAVED'
    | 'EDITED'
    | 'UNDONE'
    | 'DELETED'
    | 'DISAMBIGUATED'
    | 'DUPLICATE_WARNED'
    | 'ANOMALY_WARNED'
    | 'QUERY_ANSWERED'
    | 'CUSTOMER_ADDED'
    | 'CUSTOMER_EDITED'
    | 'SHOP_SWITCHED'
    | 'BACKUP_EXPORTED'
    | 'BACKUP_RESTORED'
    | 'PIN_UPDATED';
  summary: string;
  timestamp: string;
  language?: DetectedLanguage;
}

export interface ShopProfile {
  id: string;
  name: string;
  subtitle: string;
  createdAt: string;
}

export interface ShopLedgerData {
  customers: Customer[];
  transactions: Transaction[];
  auditEvents: AuditEvent[];
}
