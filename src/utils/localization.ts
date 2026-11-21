import { DetectedLanguage, LanguageMode, TransactionType } from '../types/ledger';

export const LANGUAGE_OPTIONS: {
  id: LanguageMode;
  label: string;
  nativeLabel: string;
  speechLang: string;
}[] = [
  { id: 'auto', label: 'Auto (Mixed)', nativeLabel: 'Auto', speechLang: 'en-IN' },
  { id: 'kn-IN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', speechLang: 'kn-IN' },
  { id: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी', speechLang: 'hi-IN' },
  { id: 'hinglish', label: 'Hinglish', nativeLabel: 'Hinglish', speechLang: 'en-IN' },
  { id: 'en-IN', label: 'English', nativeLabel: 'English', speechLang: 'en-IN' },
];

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function resolveActiveLanguage(
  mode: LanguageMode,
  detected?: DetectedLanguage
): DetectedLanguage {
  if (mode === 'kn-IN') return 'kn';
  if (mode === 'hi-IN') return 'hi';
  if (mode === 'hinglish') return 'hinglish';
  if (mode === 'en-IN') return 'en';
  return detected ?? 'en';
}

export function getLanguageLabel(lang: DetectedLanguage): string {
  switch (lang) {
    case 'kn':
      return 'Kannada';
    case 'hi':
      return 'Hindi';
    case 'hinglish':
      return 'Hinglish';
    default:
      return 'English';
  }
}

export function getDisambiguationCopy(
  spokenName: string,
  lang: DetectedLanguage
): { headline: string; scriptSubtitle?: string; ttsText: string; hint: string } {
  switch (lang) {
    case 'kn':
      return {
        headline: `Yava ${spokenName} bagge helthiddira?`,
        scriptSubtitle: `ಯಾವ ${spokenName} ಬಗ್ಗೆ ಹೇಳ್ತಿದ್ದೀರಾ?`,
        ttsText: `ಯಾವ ${spokenName} ಬಗ್ಗೆ ಹೇಳ್ತಿದ್ದೀರಾ? ದಯವಿಟ್ಟು ಆಯ್ಕೆ ಮಾಡಿ.`,
        hint: 'Tap a customer below or press mic and say area name (e.g., "MG Road" or "Jayanagar").',
      };
    case 'hi':
    case 'hinglish':
      return {
        headline: `Aap kis ${spokenName} ke baare mein baat kar rahe hain?`,
        scriptSubtitle: lang === 'hi' ? `आप किस ${spokenName} के बारे में बात कर रहे हैं?` : undefined,
        ttsText: `Aap kis ${spokenName} ke baare mein baat kar rahe hain?`,
        hint: 'Tap a customer below or press mic and say area or shop note.',
      };
    default:
      return {
        headline: `Which ${spokenName} are you talking about?`,
        ttsText: `Which ${spokenName} are you talking about? Please select one.`,
        hint: 'Tap a customer below or say their area/note to continue.',
      };
  }
}

export function getConfirmationCopy(
  customerLabel: string,
  amount: number,
  type: TransactionType,
  lang: DetectedLanguage
): { headline: string; scriptSubtitle?: string; ttsText: string } {
  const formatted = formatINR(amount);
  switch (lang) {
    case 'kn': {
      const actionKn = type === 'CREDIT' ? 'credit' : 'jama';
      const actionKnScript = type === 'CREDIT' ? 'ಕ್ರೆಡಿಟ್' : 'ಜಮಾ';
      return {
        headline: `${customerLabel} account ge ₹${formatted} ${actionKn} add maadla?`,
        scriptSubtitle: `${customerLabel} ಖಾತೆಗೆ ₹${formatted} ${actionKnScript} ಸೇರಿಸಲಾ?`,
        ttsText: `${customerLabel} ಖಾತೆಗೆ ${formatted} ರೂಪಾಯಿ ${actionKnScript} ಸೇರಿಸಲಾ?`,
      };
    }
    case 'hi':
    case 'hinglish': {
      const actionHi = type === 'CREDIT' ? 'Udhaar (Credit)' : 'Jama (Payment)';
      return {
        headline: `${customerLabel} ke khate mein ₹${formatted} ${actionHi} add karein?`,
        scriptSubtitle:
          lang === 'hi'
            ? `${customerLabel} के खाते में ₹${formatted} ${
                type === 'CREDIT' ? 'उधार' : 'जमा'
              } जोड़ें?`
            : undefined,
        ttsText: `${customerLabel} ke khate mein ${formatted} rupaye ${
          type === 'CREDIT' ? 'udhaar' : 'jama'
        } add karein?`,
      };
    }
    default: {
      const actionEn = type === 'CREDIT' ? 'Credit (Udhaar)' : 'Payment (Jama)';
      return {
        headline: `Add ₹${formatted} ${actionEn} to ${customerLabel}?`,
        ttsText: `Add ${formatted} rupees ${
          type === 'CREDIT' ? 'credit' : 'payment'
        } to ${customerLabel}?`,
      };
    }
  }
}

export function getSavedCopy(
  customerLabel: string,
  amount: number,
  type: TransactionType,
  lang: DetectedLanguage
): { banner: string; ttsText: string } {
  const formatted = formatINR(amount);
  switch (lang) {
    case 'kn':
      return {
        banner: `${customerLabel} account ge ₹${formatted} ${
          type === 'CREDIT' ? 'udhaara' : 'jama'
        } save aagide.`,
        ttsText: `${customerLabel} ಖಾತೆಗೆ ${formatted} ರೂಪಾಯಿ ಸೇವ್ ಆಗಿದೆ.`,
      };
    case 'hi':
    case 'hinglish':
      return {
        banner: `${customerLabel} ke liye ₹${formatted} ${
          type === 'CREDIT' ? 'udhaar' : 'jama'
        } save ho gaya.`,
        ttsText: `${customerLabel} ke liye ${formatted} rupaye save ho gaya.`,
      };
    default:
      return {
        banner: `Saved ₹${formatted} ${
          type === 'CREDIT' ? 'Credit (Udhaar)' : 'Payment (Jama)'
        } for ${customerLabel}.`,
        ttsText: `Saved ${formatted} rupees for ${customerLabel}.`,
      };
  }
}

export function getUndoCopy(
  customerLabel: string,
  amount: number,
  lang: DetectedLanguage
): { message: string; ttsText: string } {
  const formatted = formatINR(amount);
  switch (lang) {
    case 'kn':
      return {
        message: `${customerLabel} ₹${formatted} entry hinde tagolagide (Undone).`,
        ttsText: `ಕೊನೆಯ ಎಂಟ್ರಿ ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ.`,
      };
    case 'hi':
    case 'hinglish':
      return {
        message: `${customerLabel} ki ₹${formatted} entry wapas le li gayi (Undone).`,
        ttsText: `Aakhri entry wapas le li gayi hai.`,
      };
    default:
      return {
        message: `Undid ₹${formatted} transaction for ${customerLabel}.`,
        ttsText: `Last transaction undone.`,
      };
  }
}

export function speakPrompt(
  text: string,
  lang: DetectedLanguage,
  enabled: boolean,
  callbacks?: { onStart?: () => void; onEnd?: () => void }
): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.lang = targetLang;
    utterance.rate = 0.98;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.split('-')[0])) ||
      voices.find((v) => v.lang.toLowerCase().includes('in'));

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      callbacks?.onStart?.();
    };
    utterance.onend = () => {
      callbacks?.onEnd?.();
    };
    utterance.onerror = () => {
      callbacks?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    callbacks?.onEnd?.();
  }
}

export interface DailySummaryMetrics {
  todayCredit: number;
  todayCreditCount: number;
  todayPayments: number;
  todayPaymentsCount: number;
  totalOutstanding: number;
  topDebtors: { name: string; area: string; balance: number }[];
}

export function buildCustomerBalanceAnswer(
  name: string,
  area: string,
  balance: number,
  lang: DetectedLanguage
): { title: string; answer: string; scriptSubtitle?: string; ttsText: string } {
  const absFormatted = formatINR(Math.abs(balance));
  const label = `${name} (${area})`;

  if (lang === 'kn') {
    if (balance === 0) {
      return {
        title: `${label} Balance`,
        answer: `${label} balance ₹0 ide. Yavude baaki illa.`,
        scriptSubtitle: `${label} ಬಾಕಿ ₹0 ಇದೆ.`,
        ttsText: `${label} ಬಾಕಿ ಸೊನ್ನೆ ರೂಪಾಯಿ ಇದೆ.`,
      };
    }
    return {
      title: `${label} Balance`,
      answer:
        balance > 0
          ? `${label} total ₹${absFormatted} kodbeku.`
          : `${label} ₹${absFormatted} advance jama maadiddare.`,
      scriptSubtitle:
        balance > 0
          ? `${label} ಒಟ್ಟು ₹${absFormatted} ಕೊಡಬೇಕು.`
          : `${label} ₹${absFormatted} ಮುಂಗಡ ಜಮಾ ಮಾಡಿದ್ದಾರೆ.`,
      ttsText:
        balance > 0
          ? `${label} ಒಟ್ಟು ${absFormatted} ರೂಪಾಯಿ ಕೊಡಬೇಕು.`
          : `${label} ${absFormatted} ರೂಪಾಯಿ ಮುಂಗಡ ಜಮಾ ಮಾಡಿದ್ದಾರೆ.`,
    };
  }

  if (lang === 'hi' || lang === 'hinglish') {
    return {
      title: `${label} Balance`,
      answer:
        balance > 0
          ? `${label} ka total ₹${absFormatted} baaki hai.`
          : balance < 0
            ? `${label} ka ₹${absFormatted} advance jama hai.`
            : `${label} ka hisab clear hai (₹0).`,
      ttsText:
        balance > 0
          ? `${label} ka total ${absFormatted} rupaye baaki hai.`
          : `${label} ka hisab clear hai.`,
    };
  }

  return {
    title: `${label} Balance`,
    answer:
      balance > 0
        ? `${label} owes ₹${absFormatted} in total.`
        : balance < 0
          ? `${label} has ₹${absFormatted} advance credit.`
          : `${label} has a settled ₹0 balance.`,
    ttsText:
      balance > 0
        ? `${label} owes ${absFormatted} rupees in total.`
        : `${label} has a zero balance.`,
  };
}

export function buildDailySummaryAnswer(
  metrics: DailySummaryMetrics,
  lang: DetectedLanguage
): { title: string; answer: string; scriptSubtitle?: string; ttsText: string } {
  const cr = formatINR(metrics.todayCredit);
  const py = formatINR(metrics.todayPayments);
  const net = metrics.todayCredit - metrics.todayPayments;
  const netAbs = formatINR(Math.abs(net));
  const out = formatINR(metrics.totalOutstanding);
  const top = metrics.topDebtors[0];
  const topStr = top ? `${top.name} (${top.area}) ₹${formatINR(top.balance)}` : 'none';

  if (lang === 'kn') {
    return {
      title: 'Indina Hisab · Daily Summary',
      answer: `Ivattu ₹${cr} udhaara mattu ₹${py} jama bandide. Net change ${
        net >= 0 ? '+' : '-'
      }₹${netAbs}. Ottaare baaki ₹${out}. Top pending: ${topStr}.`,
      scriptSubtitle: `ಇಂದು ₹${cr} ಉದಾರ, ₹${py} ಜಮಾ. ಒಟ್ಟು ಬಾಕಿ ₹${out}.`,
      ttsText: `ಇಂದಿನ ಲೆಕ್ಕ: ಒಟ್ಟು ${cr} ರೂಪಾಯಿ ಉದಾರ ಮತ್ತು ${py} ರೂಪಾಯಿ ಜಮಾ ಬಂದಿದೆ. ಒಟ್ಟು ಬಾಕಿ ${out} ರೂಪಾಯಿ. ${
        top ? `ಅತಿ ಹೆಚ್ಚು ಬಾಕಿ ${top.name} ${top.area} ${formatINR(top.balance)} ರೂಪಾಯಿ.` : ''
      }`,
    };
  }

  if (lang === 'hi' || lang === 'hinglish') {
    return {
      title: 'Aaj Ka Hisab · Daily Summary',
      answer: `Aaj ₹${cr} udhaar diya aur ₹${py} jama aaya. Net change ${
        net >= 0 ? '+' : '-'
      }₹${netAbs}. Total market baaki ₹${out}. Sabse zyada baaki: ${topStr}.`,
      ttsText: `Aaj ka hisab: ${cr} rupaye udhaar aur ${py} rupaye jama aaya. Total baaki ${out} rupaye hai.`,
    };
  }

  return {
    title: 'Daily Voice Summary',
    answer: `Today: ₹${cr} credit given across ${metrics.todayCreditCount} entries, ₹${py} collected across ${metrics.todayPaymentsCount} payments. Net change: ${
      net >= 0 ? '+' : '-'
    }₹${netAbs}. Total receivable: ₹${out}. Top pending: ${topStr}.`,
    ttsText: `Today's summary: ${cr} rupees credit given, ${py} rupees collected. Total receivable is ${out} rupees. ${
      top ? `Highest pending is ${top.name} in ${top.area} at ${formatINR(top.balance)} rupees.` : ''
    }`,
  };
}

