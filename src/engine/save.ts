// Progress, settings and (later) letter stats and coloring pictures. Stored on the iPad only.
const KEY = 'reigns-quest-save-v1';

export interface SaveData {
  completed: string[];
  lastScene: string | null;
  muted: boolean;
  debug: boolean;
  letterStats: Record<string, { right: number; wrong: number }>;
  pictures: Record<string, string>;
}
const fresh = (): SaveData => ({ completed: [], lastScene: null, muted: false, debug: false, letterStats: {}, pictures: {} });

export const save: SaveData = (() => {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); }
})();

export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode: ignore */ } }

export function resetProgress() {
  const { muted, debug } = save;
  Object.assign(save, fresh(), { muted, debug });
  persist();
}
