// Every mechanic has the same shape. To add one: create a file here, then list it below.
import Phaser from 'phaser';
import type { SceneData } from '../engine/content';
import { placeholder } from './placeholder';
import { followTrail } from './follow_trail';
import { letterHunt } from './letter_hunt';

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
  /** Audio line ids this mechanic needs that are not written in the scene file. */
  audio?: (data: SceneData) => string[];
  start: (ctx: MechanicContext) => void;
}

export const mechanics: Record<string, Mechanic> = {
  placeholder,
  follow_trail: followTrail,
  letter_hunt: letterHunt
  // alphabet_path, ... get added here as they are built
};

/** Used when a scene names a mechanic that is not built yet. */
export const fallback = placeholder;
