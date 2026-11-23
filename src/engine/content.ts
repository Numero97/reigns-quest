// Reads everything the author edits: config.json, scenes/*.json, audio_script*.csv.
// All of it is bundled into the game, so it works offline.
import configJson from '../../content/config.json';

export interface SceneData {
  id: string;
  background?: string;
  intro_audio?: string;
  mechanic: string;
  params?: Record<string, any>;
  objects?: { sprite: string; x: number; y: number; height?: number; anchor?: string; depth?: number }[];
  success_audio?: string;
  next?: string | null;
  [key: string]: any;
}

export const config = configJson as any;

const sceneFiles = import.meta.glob('../../content/scenes/*.json', { eager: true, import: 'default' }) as Record<string, SceneData>;
export const scenes: Record<string, SceneData> = {};
for (const data of Object.values(sceneFiles)) scenes[data.id] = data;

export const sceneOrder: string[] = (config.scene_order as string[]).filter(id => scenes[id]);

// audio_script*.csv -> { id: text }, used to show captions for lines not yet recorded
const csvFiles = import.meta.glob('../../content/audio_script*.csv', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
export const lineText: Record<string, string> = {};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}
for (const csv of Object.values(csvFiles)) {
  for (const r of parseCsv(csv).slice(1)) if (r[0] && r[2]) lineText[r[0]] = r[2];
}

/** Every audio id mentioned anywhere in a scene (any key containing "audio"). */
export function collectAudioIds(value: any, out = new Set<string>(), key = ''): Set<string> {
  if (typeof value === 'string') { if (/audio/i.test(key)) out.add(value); }
  else if (Array.isArray(value)) value.forEach(v => collectAudioIds(v, out, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collectAudioIds(v, out, k);
  return out;
}
