/**
 * PokéRole Combat HUD - Token Animations
 * Recall (red shrink toward trainer) and Send Out (white fade-in) effects.
 * Uses only token mesh tint and alpha — no PIXI.Graphics overlays.
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

  // Find trainer token on the scene
  const trainerToken = canvas.tokens?.placeables.find(t => t.actor?.id === trainer?.id);
  const targetX = trainerToken ? trainerToken.center.x : tokenObject.center.x;
  const targetY = trainerToken ? trainerToken.center.y : tokenObject.center.y;

  const startX = tokenObject.position.x;
  const startY = tokenObject.position.y;
  const startScale = tokenObject.mesh?.scale?.x ?? 1;
  const originalTint = tokenObject.mesh?.tint ?? 0xFFFFFF;

  // Calculate offset to move center toward trainer center
  const offsetX = (targetX - tokenObject.center.x);
  const offsetY = (targetY - tokenObject.center.y);

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      // Shrink the token
      const scale = startScale * (1 - ease * 0.85);
      if (tokenObject.mesh) {
        tokenObject.mesh.scale.set(scale, scale);

        // Red tint: lerp from original (white) to red
        const r = 0xFF;
        const g = Math.round(0xFF * (1 - ease));
        const b = Math.round(0xFF * (1 - ease));
        tokenObject.mesh.tint = (r << 16) | (g << 8) | b;
      }

      // Move toward trainer
      tokenObject.position.set(
        startX + offsetX * ease,
        startY + offsetY * ease
      );

      // Overall fade out
      tokenObject.alpha = 1 - ease * 0.9;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Cleanup: hide fully, restore tint
        tokenObject.alpha = 0;
        if (tokenObject.mesh) {
          tokenObject.mesh.tint = originalTint;
          tokenObject.mesh.scale.set(startScale, startScale);
        }
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

  const targetScale = tokenObject.mesh?.scale?.x ?? 1;
  const originalTint = tokenObject.mesh?.tint ?? 0xFFFFFF;

  // Start small and transparent
  if (tokenObject.mesh) {
    tokenObject.mesh.scale.set(0.1, 0.1);
    tokenObject.mesh.tint = 0xFFFFFF;
  }
  tokenObject.alpha = 0;

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      // Scale up from small to target (slight overshoot then settle)
      let scale;
      if (progress < 0.6) {
        // Scale up to 110%
        scale = targetScale * (ease / 0.6) * 1.1;
      } else {
        // Settle from 110% back to 100%
        const settleProgress = (progress - 0.6) / 0.4;
        scale = targetScale * (1.1 - 0.1 * settleProgress);
      }

      if (tokenObject.mesh) {
        tokenObject.mesh.scale.set(
          Math.max(scale, 0.05),
          Math.max(scale, 0.05)
        );

        // White tint fades to original: starts fully white, transitions to original tint
        if (progress < 0.4) {
          tokenObject.mesh.tint = 0xFFFFFF;
        } else {
          const tintProgress = (progress - 0.4) / 0.6;
          const origR = (originalTint >> 16) & 0xFF;
          const origG = (originalTint >> 8) & 0xFF;
          const origB = originalTint & 0xFF;
          const r = Math.round(0xFF + (origR - 0xFF) * tintProgress);
          const g = Math.round(0xFF + (origG - 0xFF) * tintProgress);
          const b = Math.round(0xFF + (origB - 0xFF) * tintProgress);
          tokenObject.mesh.tint = (r << 16) | (g << 8) | b;
        }
      }

      // Fade in quickly
      tokenObject.alpha = Math.min(progress * 2.5, 1);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Ensure final state is clean
        if (tokenObject.mesh) {
          tokenObject.mesh.scale.set(targetScale, targetScale);
          tokenObject.mesh.tint = originalTint;
        }
        tokenObject.alpha = 1;
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}
