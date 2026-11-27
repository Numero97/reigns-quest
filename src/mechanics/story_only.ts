import type { Mechanic } from './index';

/** A scene that is only talking: nothing to tap. When the dialog is over it waits a moment, then moves on.
 *  Setting in the scene file: "params": { "end_pause": 1500 }  (in thousandths of a second) */
export const storyOnly: Mechanic = {
  start({ scene, params, ready, complete }) {
    void ready.then(() => scene.time.delayedCall(params.end_pause ?? 1500, complete));
  }
};
