/**
 * PokéRole Combat HUD - Token Animations
 * Recall (red shrink toward trainer) and Send Out (white fade-in) effects.
 * Uses token mesh tint and container scale — no PIXI.Graphics overlays.
 */

/**
 * Animate a Pokémon being recalled: red tint, shrink, and fly toward the trainer token.
 * @param {TokenDocument} tokenDoc - The token document of the Pokémon being recalled
 * @param {Actor} trainer - The trainer actor (to find their token)
 * @param {object} [options]
 * @param {number} [options.duration=800] - Animation duration in ms
 * @returns {Promise<void>}
 */
export async function animateRecall(tokenDoc, trainer, options = {}) {
  const duration = options.duration ?? 800;
  const tokenObject = tokenDoc?.object;
  if (!tokenObject) return;

  const trainerToken = canvas.tokens?.placeables.find(t => t.actor?.id === trainer?.id);
  const targetX = trainerToken ? trainerToken.center.x : tokenObject.center.x;
  const targetY = trainerToken ? trainerToken.center.y : tokenObject.center.y;

  const startX = tokenObject.position.x;
  const startY = tokenObject.position.y;
  const offsetX = targetX - tokenObject.center.x;
  const offsetY = targetY - tokenObject.center.y;

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Shrink using container scale (relative, starts at 1.0)
      const scaleFactor = 1 - ease * 0.85;
      tokenObject.scale.set(scaleFactor, scaleFactor);

      // Move toward trainer
      tokenObject.position.set(
        startX + offsetX * ease,
        startY + offsetY * ease
      );

      // Red tint on the mesh
      if (tokenObject.mesh) {
        const g = Math.round(0xFF * (1 - ease));
        const b = Math.round(0xFF * (1 - ease));
        tokenObject.mesh.tint = (0xFF << 16) | (g << 8) | b;
      }

      // Fade out
      tokenObject.alpha = 1 - ease * 0.9;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        tokenObject.alpha = 0;
        tokenObject.scale.set(1, 1);
        if (tokenObject.mesh) tokenObject.mesh.tint = 0xFFFFFF;
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

/**
 * Animate a Pokémon being sent out: white tint that fades, token scales up from small.
 * @param {TokenDocument} tokenDoc - The token document of the new Pokémon
 * @param {object} [options]
 * @param {number} [options.duration=600] - Animation duration in ms
 * @returns {Promise<void>}
 */
export async function animateSendOut(tokenDoc, options = {}) {
  const duration = options.duration ?? 600;
  const tokenObject = tokenDoc?.object;
  if (!tokenObject) return;

  // Wait a frame for the token to be fully rendered
  await new Promise(r => requestAnimationFrame(r));

  // Start small and transparent using container scale
  tokenObject.scale.set(0.1, 0.1);
  tokenObject.alpha = 0;
  if (tokenObject.mesh) tokenObject.mesh.tint = 0xFFFFFF;

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Scale up with slight overshoot then settle
      let scaleFactor;
      if (progress < 0.6) {
        scaleFactor = (ease / 0.6) * 1.08;
      } else {
        const settle = (progress - 0.6) / 0.4;
        scaleFactor = 1.08 - 0.08 * settle;
      }
      tokenObject.scale.set(Math.max(scaleFactor, 0.05), Math.max(scaleFactor, 0.05));

      // Fade in
      tokenObject.alpha = Math.min(progress * 2.5, 1);

      // White tint fades to normal
      if (tokenObject.mesh) {
        if (progress < 0.3) {
          tokenObject.mesh.tint = 0xFFFFFF;
        } else {
          const tintProgress = (progress - 0.3) / 0.7;
          const g = Math.round(0xFF);
          const r = Math.round(0xFF);
          const b = Math.round(0xFF);
          // Tint stays white (0xFFFFFF = no tint) — already correct
          tokenObject.mesh.tint = 0xFFFFFF;
        }
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        tokenObject.scale.set(1, 1);
        tokenObject.alpha = 1;
        if (tokenObject.mesh) tokenObject.mesh.tint = 0xFFFFFF;
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}
