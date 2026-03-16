/**
 * PokéRole Combat HUD - Helper Utilities
 * Type colors, icons, and shared constants.
 */

export const MODULE_ID = "pok-role-combat-hud";

/* ---------------------------------------- */
/*  Pokémon Type Colors                      */
/* ---------------------------------------- */

export const TYPE_COLORS = {
  normal:   { bg: "#A8A878", text: "#FFFFFF" },
  fire:     { bg: "#F08030", text: "#FFFFFF" },
  water:    { bg: "#6890F0", text: "#FFFFFF" },
  grass:    { bg: "#78C850", text: "#FFFFFF" },
  electric: { bg: "#F8D030", text: "#333333" },
  ice:      { bg: "#98D8D8", text: "#333333" },
  fighting: { bg: "#C03028", text: "#FFFFFF" },
  poison:   { bg: "#A040A0", text: "#FFFFFF" },
  ground:   { bg: "#E0C068", text: "#333333" },
  flying:   { bg: "#A890F0", text: "#FFFFFF" },
  psychic:  { bg: "#F85888", text: "#FFFFFF" },
  bug:      { bg: "#A8B820", text: "#FFFFFF" },
  rock:     { bg: "#B8A038", text: "#FFFFFF" },
  ghost:    { bg: "#705898", text: "#FFFFFF" },
  dragon:   { bg: "#7038F8", text: "#FFFFFF" },
  dark:     { bg: "#705848", text: "#FFFFFF" },
  steel:    { bg: "#B8B8D0", text: "#333333" },
  fairy:    { bg: "#EE99AC", text: "#333333" }
};

/* ---------------------------------------- */
/*  Move Category Icons (SVG inline)         */
/* ---------------------------------------- */

export const CATEGORY_ICONS = {
  physical: `<svg viewBox="0 0 24 24" class="category-icon physical"><circle cx="12" cy="12" r="10" fill="#C03028" stroke="#fff" stroke-width="1.5"/><path d="M7 12 L12 7 L17 12 L12 17Z" fill="#F8D030" stroke="#fff" stroke-width="0.5"/></svg>`,
  special:  `<svg viewBox="0 0 24 24" class="category-icon special"><circle cx="12" cy="12" r="10" fill="#6890F0" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="#A890F0" stroke="#fff" stroke-width="0.5"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`,
  support:  `<svg viewBox="0 0 24 24" class="category-icon support"><circle cx="12" cy="12" r="10" fill="#78C850" stroke="#fff" stroke-width="1.5"/><path d="M12 6 L12 18 M6 12 L18 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`
};

/* ---------------------------------------- */
/*  HP Bar Helpers                           */
/* ---------------------------------------- */

/**
 * Get the CSS color class for an HP percentage.
 * @param {number} current - Current HP
 * @param {number} max - Maximum HP
 * @returns {string} CSS class name
 */
export function getHpColorClass(current, max) {
  if (max <= 0) return "hp-zero";
  const pct = (current / max) * 100;
  if (pct > 50) return "hp-green";
  if (pct > 25) return "hp-yellow";
  if (pct > 0) return "hp-red";
  return "hp-zero";
}

/**
 * Get HP percentage for bar width.
 * @param {number} current
 * @param {number} max
 * @returns {number} Percentage 0-100
 */
export function getHpPercent(current, max) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

/* ---------------------------------------- */
/*  Condition Labels                         */
/* ---------------------------------------- */

export const CONDITION_ICONS = {
  sleep:     "💤",
  burn:      "🔥",
  frozen:    "🧊",
  paralyzed: "⚡",
  poisoned:  "☠️",
  fainted:   "💀",
  confused:  "💫",
  flinch:    "😖",
  infatuated:"💕"
};

/* ---------------------------------------- */
/*  Gear Pocket Labels                       */
/* ---------------------------------------- */

export const POCKET_LABELS = {
  potions: "POKEHUD.Bag.Potions",
  small:   "POKEHUD.Bag.SmallItems",
  main:    "POKEHUD.Bag.MainPocket",
  held:    "POKEHUD.Bag.HeldItems",
  badge:   "POKEHUD.Bag.Badges"
};

/* ---------------------------------------- */
/*  Party Utilities                          */
/* ---------------------------------------- */

/**
 * Get the Trainer actor associated with a given actor.
 * If the actor is a Trainer, returns it directly.
 * If the actor is a Pokémon, finds the Trainer who owns it.
 * @param {Actor} actor
 * @returns {Actor|null}
 */
export function getTrainerForActor(actor) {
  if (!actor) return null;
  if (actor.type === "trainer") return actor;

  // For a Pokémon, find the Trainer with the same ownership
  const owners = Object.entries(actor.ownership)
    .filter(([id, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id !== "default")
    .map(([id]) => id);

  for (const userId of owners) {
    const user = game.users.get(userId);
    if (user?.character?.type === "trainer") return user.character;
  }
  return null;
}

/**
 * Get all Pokémon in a Trainer's party.
 * Looks at scene tokens owned by the same player, or actors in the world.
 * @param {Actor} trainer - The Trainer actor
 * @returns {Actor[]} Array of Pokémon actors
 */
export function getTrainerParty(trainer) {
  if (!trainer || trainer.type !== "trainer") return [];

  const owners = Object.entries(trainer.ownership)
    .filter(([id, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id !== "default")
    .map(([id]) => id);

  // First try scene tokens
  const sceneTokens = canvas.scene?.tokens ?? [];
  const partyFromScene = [];

  for (const tokenDoc of sceneTokens) {
    const actor = tokenDoc.actor;
    if (!actor || actor.type !== "pokemon") continue;

    const actorOwners = Object.entries(actor.ownership)
      .filter(([id, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id !== "default")
      .map(([id]) => id);

    if (actorOwners.some(o => owners.includes(o))) {
      partyFromScene.push(actor);
    }
  }

  if (partyFromScene.length > 0) return partyFromScene;

  // Fallback: look at world actors
  return game.actors.filter(a => {
    if (a.type !== "pokemon") return false;
    const actorOwners = Object.entries(a.ownership)
      .filter(([id, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id !== "default")
      .map(([id]) => id);
    return actorOwners.some(o => owners.includes(o));
  });
}

/**
 * Check if the current user controls the active combatant.
 * @returns {boolean}
 */
export function isCurrentUserTurn() {
  const combatant = game.combat?.combatant;
  if (!combatant) return false;
  if (game.user.isGM) return true;
  return combatant.actor?.isOwner ?? false;
}
