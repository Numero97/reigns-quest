// Letter rules shared by every letter mechanic (see "Letter selection" in SPEC.md).
import { config } from './content';
import { save, persist } from './save';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const letterName = (l: string) => `letter_${l.toLowerCase()}_name`;
export const letterSound = (l: string) => `letter_${l.toLowerCase()}_sound`;
export const isKnown = (l: string) => (config.difficulty.letters_known as string[]).includes(l);

/** Pick n different letters from the pool. Letters she has missed before come up a bit more often. */
export function pickLetters(pool: string[], n: number): string[] {
  const left = [...pool];
  const out: string[] = [];
  while (out.length < n && left.length) {
    const weights = left.map(l => 1 + 2 * (save.letterStats[l]?.wrong ?? 0));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < left.length - 1 && (r -= weights[i]) > 0) i++;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

export function recordLetter(letter: string, right: boolean) {
  const s = (save.letterStats[letter] ??= { right: 0, wrong: 0 });
  if (right) s.right++; else s.wrong++;
  persist();
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
