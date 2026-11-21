import { Customer } from '../types/ledger';

const STRIP_SUFFIX_WORDS = new Set([
  'ge',
  'ko',
  'ne',
  'ka',
  'ki',
  'ke',
  'se',
  'avaru',
  'avarige',
  'ji',
  'bhai',
  'anna',
  'akka',
  'saab',
  'sir',
  'account',
  'khata',
  'from',
  'to',
  'for',
]);

export function cleanToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes Indian Romanized phonetic spellings so variants like
 * "Ramesha" -> "ramesh", "Laxmi" -> "laksmi", "Suresha" -> "suresh",
 * "Abdullah" -> "abdula" match accurately.
 */
export function normalizePhonetic(raw: string): string {
  let s = cleanToken(raw);
  if (!s) return '';

  // Remove honorific / grammatical tokens if multiple words
  const words = s.split(' ').filter((w) => w && !STRIP_SUFFIX_WORDS.has(w));
  s = words.join(' ');

  // Normalize phonetic equivalents
  s = s
    .replace(/x/g, 'ks')
    .replace(/ksh/g, 'ks')
    .replace(/ph/g, 'f')
    .replace(/bh/g, 'b')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/gh/g, 'g')
    .replace(/kh/g, 'k')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/v/g, 'w')
    .replace(/z/g, 'j')
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/([a-z])\1+/g, '$1');

  // Strip trailing Kannada/South-Indian "-a" / "-u" vowel ending on consonant-ending names
  // e.g., "ramesa" -> "rames", "suresa" -> "sures"
  s = s
    .split(' ')
    .map((word) => {
      if (word.length >= 5 && /[bcdfgjklmnprstwy]$/.test(word.slice(0, -1)) && /[au]$/.test(word)) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(' ');

  return s.trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface CustomerMatchResult {
  customer: Customer;
  score: number;
  matchedBy: 'exact' | 'alias' | 'qualifier' | 'fuzzy';
}

/**
 * Matches spoken/typed customer string against customers, aliases, and area/notes.
 * Guarantees that if two customers share the spoken base name (e.g. "Ramesh" or "Ramesha")
 * without an explicit area/note qualifier, BOTH are returned so disambiguation triggers.
 */
export function matchCustomers(spokenName: string, customers: Customer[]): CustomerMatchResult[] {
  const cleanedQuery = cleanToken(spokenName);
  const phoneticQuery = normalizePhonetic(spokenName);
  if (!cleanedQuery && !phoneticQuery) return [];

  const queryWords = cleanedQuery.split(' ').filter((w) => w && !STRIP_SUFFIX_WORDS.has(w));
  const results: CustomerMatchResult[] = [];

  for (const customer of customers) {
    const cleanName = cleanToken(customer.name);
    const phoneticName = normalizePhonetic(customer.name);
    const cleanArea = cleanToken(customer.area);
    const cleanNote = cleanToken(customer.note);
    const qualifierTokens = `${cleanArea} ${cleanNote}`.split(' ').filter((w) => w.length >= 2);

    let bestScore = 0;
    let matchedBy: CustomerMatchResult['matchedBy'] = 'fuzzy';

    // 1. Check explicit specific alias (excluding aliases that equal just the base name)
    for (const alias of customer.aliases) {
      const cleanAlias = cleanToken(alias);
      const phoneticAlias = normalizePhonetic(alias);
      const isBaseOnly = cleanAlias === cleanName || phoneticAlias === phoneticName;

      if (cleanedQuery === cleanAlias || phoneticQuery === phoneticAlias) {
        const candidateScore = isBaseOnly ? 0.92 : 1.0;
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          matchedBy = isBaseOnly ? 'exact' : 'alias';
        }
      } else if (!isBaseOnly && cleanedQuery.length >= 4 && cleanAlias.includes(cleanedQuery)) {
        bestScore = Math.max(bestScore, 0.88);
        matchedBy = 'alias';
      } else if (phoneticQuery.length >= 3 && phoneticAlias.length >= 3) {
        const sim = similarity(phoneticQuery, phoneticAlias);
        if (sim >= 0.78) {
          const candidateScore = isBaseOnly ? sim * 0.9 : sim * 0.96;
          if (candidateScore > bestScore) {
            bestScore = candidateScore;
            matchedBy = 'fuzzy';
          }
        }
      }
    }

    // 2. Check base name match + qualifier bonus (area/note words in query)
    const baseSim = Math.max(
      cleanedQuery === cleanName ? 0.92 : 0,
      phoneticQuery === phoneticName ? 0.92 : 0,
      similarity(phoneticQuery, phoneticName) * 0.9,
      ...queryWords.map((w) => {
        const pw = normalizePhonetic(w);
        if (pw === phoneticName) return 0.92;
        return similarity(pw, phoneticName) >= 0.78 ? similarity(pw, phoneticName) * 0.9 : 0;
      })
    );

    if (baseSim >= 0.7) {
      const qualifierHit = queryWords.some((w) =>
        qualifierTokens.some((qt) => qt === w || (w.length >= 3 && qt.startsWith(w)))
      );
      if (qualifierHit) {
        bestScore = Math.max(bestScore, 1.0);
        matchedBy = 'qualifier';
      } else if (baseSim > bestScore) {
        bestScore = baseSim;
        matchedBy = baseSim >= 0.92 ? 'exact' : 'fuzzy';
      }
    }

    if (bestScore >= 0.7) {
      results.push({ customer, score: Number(bestScore.toFixed(3)), matchedBy });
    }
  }

  results.sort((a, b) => b.score - a.score);

  if (results.length <= 1) return results;

  // If the top match has a strictly higher qualifier/alias score (e.g. "Ramesh MG Road" = 1.0 vs 0.92),
  // resolve directly to that unique customer. Otherwise return all tied top matches for disambiguation.
  const topScore = results[0].score;
  const tied = results.filter((r) => topScore - r.score <= 0.05);
  return tied;
}

/**
 * Allows the shopkeeper to pick a disambiguation candidate using voice:
 * e.g., "MG Road", "Bakery", "First", "Ondane", "Pehla", "2", "8765".
 */
export function resolveDisambiguationByVoice(
  transcript: string,
  candidates: Customer[]
): Customer | null {
  const text = cleanToken(transcript);
  if (!text || candidates.length === 0) return null;

  const firstCues = ['1', 'one', 'first', 'ondane', 'ondu', 'modala', 'pehla', 'ek'];
  const secondCues = ['2', 'two', 'second', 'eradane', 'eradu', 'doosra', 'do'];
  const thirdCues = ['3', 'three', 'third', 'moorane', 'mooru', 'teesra', 'teen'];

  const tokens = text.split(' ');
  if (tokens.some((t) => firstCues.includes(t)) && candidates[0]) return candidates[0];
  if (tokens.some((t) => secondCues.includes(t)) && candidates[1]) return candidates[1];
  if (tokens.some((t) => thirdCues.includes(t)) && candidates[2]) return candidates[2];

  // Match by area, note, specific alias, or phone last 4 digits
  let bestCustomer: Customer | null = null;
  let bestHits = 0;

  for (const c of candidates) {
    const haystack = cleanToken(`${c.area} ${c.note} ${c.aliases.join(' ')} ${c.phone}`);
    const last4 = c.phone.replace(/\D/g, '').slice(-4);
    let hits = 0;

    if (last4 && text.includes(last4)) hits += 3;
    for (const token of tokens) {
      if (token.length >= 2 && token !== cleanToken(c.name) && haystack.includes(token)) {
        hits += 1;
      }
    }

    if (hits > bestHits) {
      bestHits = hits;
      bestCustomer = c;
    }
  }

  return bestHits > 0 ? bestCustomer : null;
}
