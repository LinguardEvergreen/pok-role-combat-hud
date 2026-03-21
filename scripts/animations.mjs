/**
 * PokéRole Combat HUD - Token Animations
 * Recall (red shrink toward trainer) and Send Out (white fade-in) effects.
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
      // Token may have been destroyed mid-animation
      if (tokenObject.destroyed) { resolve(); return; }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Shrink
      const scaleFactor = 1 - ease * 0.85;
      tokenObject.scale.set(scaleFactor, scaleFactor);

      // Move toward trainer
      tokenObject.position.set(
        startX + offsetX * ease,
        startY + offsetY * ease
      );

      // Red tint
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
 * Animate a Pokémon being sent out: starts invisible, white fade-in.
 * Call this AFTER the token has been placed on the scene.
 * @param {TokenDocument} tokenDoc - The token document of the new Pokémon
 * @param {object} [options]
 * @param {number} [options.duration=600] - Animation duration in ms
 * @returns {Promise<void>}
 */
export async function animateSendOut(tokenDoc, options = {}) {
  const duration = options.duration ?? 600;

  // Wait for the token object to be available on canvas
  let tokenObject = tokenDoc?.object;
  if (!tokenObject) {
    // Token might not be rendered yet, wait a few frames
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 50));
      tokenObject = tokenDoc?.object;
      if (tokenObject) break;
    }
  }
  if (!tokenObject) return;

  // Hide immediately so there's no flash of the fully visible token
  tokenObject.alpha = 0;
  tokenObject.scale.set(0.15, 0.15);

  // Wait one more frame to ensure render
  await new Promise(r => requestAnimationFrame(r));

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      if (tokenObject.destroyed) { resolve(); return; }

      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Scale up: 0.15 → 1.0
      const scaleFactor = 0.15 + ease * 0.85;
      tokenObject.scale.set(scaleFactor, scaleFactor);

      // Fade in
      tokenObject.alpha = ease;

      // White tint that fades: bright white at start, normal at end
      if (tokenObject.mesh) {
        // Keep white tint for first 40%, then let it fade
        if (progress > 0.4) {
          tokenObject.mesh.tint = 0xFFFFFF; // white = no tint change, natural color returns as alpha rises
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
