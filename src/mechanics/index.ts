// Every mechanic has the same shape. To add one: create a file here, then list it below.
import Phaser from 'phaser';
import type { SceneData } from '../engine/content';
import { placeholder } from './placeholder';
import { followTrail } from './follow_trail';
import { letterHunt } from './letter_hunt';
import { matchGame } from './match_game';
import { trailRun } from './trail_run';
import { storyOnly } from './story_only';
import { numberLogs } from './number_logs';

export interface MechanicContext {
  scene: Phaser.Scene;
  data: SceneData;
  params: Record<string, any>;
  /** Resolves when the narrator has finished and she is allowed to tap. */
  ready: Promise<void>;
  /** Call when she has finished the scene's activity. The engine plays the success line and moves on. */
  complete: () => void;
}

export interface Mechanic {
  /** Picture ids (from public/assets/sprites) this mechanic wants loaded for the scene. */
  assets?: (data: SceneData) => string[];
  /** Anything else to load (e.g. a big map). The loader's path is already set to 'assets'. */
  preload?: (scene: Phaser.Scene, data: SceneData) => void;
  /** Audio line ids this mechanic needs that are not written in the scene file. */
  audio?: (data: SceneData) => string[];
  start: (ctx: MechanicContext) => void;
}

export const mechanics: Record<string, Mechanic> = {
  placeholder,
  follow_trail: followTrail,
  letter_hunt: letterHunt,
  match_game: matchGame,
  trail_run: trailRun,
  story_only: storyOnly,
  number_logs: numberLogs
  // alphabet_path, ... get added here as they are built
};

/** Used when a scene names a mechanic that is not built yet. */
export const fallback = placeholder;
