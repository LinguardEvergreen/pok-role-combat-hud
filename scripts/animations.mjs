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

  // Find trainer token on the scene
  const trainerToken = canvas.tokens?.placeables.find(t => t.actor?.id === trainer?.id);
  const targetX = trainerToken ? trainerToken.center.x : tokenObject.center.x;
  const targetY = trainerToken ? trainerToken.center.y : tokenObject.center.y;

  const startX = tokenObject.position.x;
  const startY = tokenObject.position.y;
  const startScale = tokenObject.mesh?.scale?.x ?? 1;

  // Calculate offset to move center toward trainer center
  const offsetX = (targetX - tokenObject.center.x);
  const offsetY = (targetY - tokenObject.center.y);

  // Create red tint overlay
  const redOverlay = new PIXI.Graphics();
  redOverlay.beginFill(0xFF0000, 0.0);
  redOverlay.drawRect(0, 0, tokenObject.w, tokenObject.h);
  redOverlay.endFill();
  tokenObject.addChild(redOverlay);

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
      }

      // Move toward trainer
      tokenObject.position.set(
        startX + offsetX * ease,
        startY + offsetY * ease
      );

      // Red tint intensifies
      redOverlay.clear();
      redOverlay.beginFill(0xFF0000, ease * 0.6);
      redOverlay.drawRect(
        -tokenObject.w * 0.5,
        -tokenObject.h * 0.5,
        tokenObject.w * 2,
        tokenObject.h * 2
      );
      redOverlay.endFill();

      // Overall fade out
      tokenObject.alpha = 1 - ease * 0.8;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Cleanup
        tokenObject.alpha = 0;
        tokenObject.removeChild(redOverlay);
        redOverlay.destroy();
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

/**
 * Animate a Pokémon being sent out: white flash that fades, token scales up from small.
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

  // Start small and transparent
  if (tokenObject.mesh) {
    tokenObject.mesh.scale.set(0.1, 0.1);
  }
  tokenObject.alpha = 0;

  // Create white flash overlay
  const whiteOverlay = new PIXI.Graphics();
  whiteOverlay.beginFill(0xFFFFFF, 1.0);
  whiteOverlay.drawRect(
    -tokenObject.w * 0.25,
    -tokenObject.h * 0.25,
    tokenObject.w * 1.5,
    tokenObject.h * 1.5
  );
  whiteOverlay.endFill();
  tokenObject.addChild(whiteOverlay);

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out back (slight overshoot for a "pop" feel)
      const easeScale = 1 - Math.pow(1 - progress, 3);
      const overshoot = progress < 0.7
        ? easeScale * 1.15
        : 1 + (1 - easeScale) * 0.15;

      // Scale up with slight overshoot
      const scale = targetScale * Math.min(overshoot, 1.1) * (progress < 0.7 ? easeScale / 0.7 : 1);
      const finalScale = progress >= 0.7
        ? targetScale * (1 + (1 - (progress - 0.7) / 0.3) * 0.1)
        : targetScale * (easeScale * 1.1 / 0.815);

      if (tokenObject.mesh) {
        tokenObject.mesh.scale.set(
          Math.max(finalScale, 0.1),
          Math.max(finalScale, 0.1)
        );
      }

      // Fade in the token
      tokenObject.alpha = Math.min(progress * 2, 1);

      // White flash fades out
      const flashAlpha = Math.max(1 - progress * 2.5, 0);
      whiteOverlay.clear();
      whiteOverlay.beginFill(0xFFFFFF, flashAlpha);
      whiteOverlay.drawRect(
        -tokenObject.w * 0.25,
        -tokenObject.h * 0.25,
        tokenObject.w * 1.5,
        tokenObject.h * 1.5
      );
      whiteOverlay.endFill();

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Ensure final state is clean
        if (tokenObject.mesh) {
          tokenObject.mesh.scale.set(targetScale, targetScale);
        }
        tokenObject.alpha = 1;
        tokenObject.removeChild(whiteOverlay);
        whiteOverlay.destroy();
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}
