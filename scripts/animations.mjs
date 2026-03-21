/**
 * PokéRole Combat HUD - Token Animations
 * Uses temporary PIXI sprites on the canvas to avoid Foundry's render overrides.
 */

/**
 * Create a temporary sprite from a token's texture at its position.
 * @param {Token} tokenObject - The token PlaceableObject
 * @returns {PIXI.Sprite|null}
 */
function createTokenSprite(tokenObject) {
  if (!tokenObject?.mesh?.texture) return null;

  const sprite = new PIXI.Sprite(tokenObject.mesh.texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.x = tokenObject.center.x;
  sprite.y = tokenObject.center.y;
  sprite.width = tokenObject.w;
  sprite.height = tokenObject.h;
  sprite.alpha = 1;

  canvas.stage.addChild(sprite);
  return sprite;
}

/**
 * Animate a Pokémon being recalled: red tint, shrink, fly toward trainer.
 * Creates a temporary sprite, hides the real token, animates the sprite.
 * @param {TokenDocument} tokenDoc - The token document of the Pokémon being recalled
 * @param {Actor} trainer - The trainer actor
 * @param {object} [options]
 * @param {number} [options.duration=800] - Animation duration in ms
 * @returns {Promise<void>}
 */
export async function animateRecall(tokenDoc, trainer, options = {}) {
  const duration = options.duration ?? 800;
  const tokenObject = tokenDoc?.object;
  if (!tokenObject) return;

  // Find trainer token position
  const trainerToken = canvas.tokens?.placeables.find(t => t.actor?.id === trainer?.id);
  const targetX = trainerToken ? trainerToken.center.x : tokenObject.center.x;
  const targetY = trainerToken ? trainerToken.center.y : tokenObject.center.y;

  const startX = tokenObject.center.x;
  const startY = tokenObject.center.y;
  const startW = tokenObject.w;
  const startH = tokenObject.h;

  // Create temporary sprite and hide the real token
  const sprite = createTokenSprite(tokenObject);
  if (!sprite) return;

  tokenObject.alpha = 0;
  tokenObject.visible = false;

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Shrink
      const scale = 1 - ease * 0.85;
      sprite.width = startW * scale;
      sprite.height = startH * scale;

      // Move toward trainer
      sprite.x = startX + (targetX - startX) * ease;
      sprite.y = startY + (targetY - startY) * ease;

      // Red tint
      const g = Math.round(0xFF * (1 - ease));
      const b = Math.round(0xFF * (1 - ease));
      sprite.tint = (0xFF << 16) | (g << 8) | b;

      // Fade out
      sprite.alpha = 1 - ease * 0.9;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        canvas.stage.removeChild(sprite);
        sprite.destroy();
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

/**
 * Animate a Pokémon being sent out: white fade-in, scale up.
 * Creates a temporary sprite, hides the real token during animation,
 * then shows the real token at the end.
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
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 50));
      tokenObject = tokenDoc?.object;
      if (tokenObject) break;
    }
  }
  if (!tokenObject) return;

  // Wait for the mesh texture to be loaded
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  const targetW = tokenObject.w;
  const targetH = tokenObject.h;
  const centerX = tokenObject.center.x;
  const centerY = tokenObject.center.y;

  // Create temporary sprite and hide the real token
  const sprite = createTokenSprite(tokenObject);
  if (!sprite) return;

  tokenObject.alpha = 0;
  tokenObject.visible = false;

  // Start sprite small and white
  sprite.width = targetW * 0.1;
  sprite.height = targetH * 0.1;
  sprite.alpha = 0;
  sprite.tint = 0xFFFFFF;

  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Scale up from 10% to 100%
      const scale = 0.1 + ease * 0.9;
      sprite.width = targetW * scale;
      sprite.height = targetH * scale;

      // Keep centered
      sprite.x = centerX;
      sprite.y = centerY;

      // Fade in
      sprite.alpha = Math.min(ease * 1.5, 1);

      // White tint fades: stays white first 30%, then fades to normal
      if (progress > 0.3) {
        const tintProgress = (progress - 0.3) / 0.7;
        const c = Math.round(0xFF * (1 - tintProgress * 0.15));
        // Just reduce tint intensity slightly then back to white (no tint = 0xFFFFFF)
        sprite.tint = 0xFFFFFF;
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Show the real token, remove sprite
        tokenObject.visible = true;
        tokenObject.alpha = 1;
        canvas.stage.removeChild(sprite);
        sprite.destroy();
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}
