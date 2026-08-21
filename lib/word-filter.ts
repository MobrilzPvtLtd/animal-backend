/**
 * Server-side Word & Profanity Filter Service
 * Used to moderate user-submitted content such as reviews, comments, and place descriptions.
 */

const restrictedWords: Set<string> = new Set([
  'fuck',
  'fucking',
  'fucker',
  'shit',
  'shitting',
  'bullshit',
  'asshole',
  'ass',
  'bitch',
  'bitches',
  'bastard',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'slut',
  'whore',
  'motherfucker',
  'piss',
  'prick',
  'twat',
  'wanker',
  'dicks',
  'cocks',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'chink',
  'spic',
  'kyke',
  'dyke',
  'crap',
  'damn',
  'douche',
  'idiot',
  'moron',
  'stupid',
  'dumb',
  'jerk',
  'scum',
  'trash',
  'loser',
  'freak',
  'psycho',
  'hate',
  'kill',
  'die',
]);

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  normalized = normalized
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/3/g, 'e')
    .replace(/8/g, 'b');

  return normalized;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getInappropriateWords(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const lowerOriginal = text.toLowerCase();
  const normalized = normalizeText(text);
  const foundWords = new Set<String>();

  for (const word of Array.from(restrictedWords)) {
    const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    if (pattern.test(lowerOriginal) || pattern.test(normalized)) {
      foundWords.add(word);
    }
  }

  return Array.from(foundWords) as string[];
}

export function containsInappropriateWords(text: string): boolean {
  return getInappropriateWords(text).length > 0;
}

export function censor(text: string): string {
  if (!text || text.trim().length === 0) return text;
  let censoredText = text;

  for (const word of Array.from(restrictedWords)) {
    const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    censoredText = censoredText.replace(pattern, (match) => '*'.repeat(match.length));
  }

  return censoredText;
}
