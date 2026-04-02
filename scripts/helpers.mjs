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
/*  Trainer Rank Labels                      */
/* ---------------------------------------- */

export const RANK_LABELS = {
  starter:   "POKEHUD.Rank.Starter",
  beginner:  "POKEHUD.Rank.Beginner",
  amateur:   "POKEHUD.Rank.Amateur",
  ace:       "POKEHUD.Rank.Ace",
  pro:       "POKEHUD.Rank.Pro",
  master:    "POKEHUD.Rank.Master",
  champion:  "POKEHUD.Rank.Champion"
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

  // Method 1: Find via document ownership → user's assigned character
  const owners = Object.entries(actor.ownership)
    .filter(([id, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && id !== "default")
    .map(([id]) => id);

  for (const userId of owners) {
    const user = game.users.get(userId);
    if (user?.character?.type === "trainer") return user.character;
  }

  // Method 2: Find a Trainer that has this Pokémon in their party (system.party)
  const pokemonId = actor.id;
  for (const a of game.actors) {
    if (a.type !== "trainer") continue;
    const partyIds = a.system?.party ?? [];
    if (Array.isArray(partyIds) && partyIds.includes(pokemonId)) return a;
  }

  return null;
}

/**
 * Get the Pokémon in the trainer's "Squadra" (Party) tab.
 * Reads from the trainer's system.party field, which is an array of actor IDs.
 * @param {Actor} trainer - The Trainer actor
 * @returns {Actor[]} Array of Pokémon actors in the party
 */
export function getTrainerParty(trainer) {
  if (!trainer || trainer.type !== "trainer") return [];

  const partyIds = trainer.system.party ?? [];
  if (!Array.isArray(partyIds) || partyIds.length === 0) return [];

  // Resolve actor IDs to actual actors, filtering out any that no longer exist
  return partyIds
    .map(id => game.actors.get(id))
    .filter(a => a && a.type === "pokemon");
}

/**
 * Check if the current user can act.
 * In combat: checks if the user controls the active combatant.
 * Out of combat: always returns true (free use).
 * @returns {boolean}
 */
export function isCurrentUserTurn() {
  // If no combat is active, the user can always act
  if (!game.combat) return true;

  const combatant = game.combat.combatant;
  if (!combatant) return false;
  if (game.user.isGM) return true;
  return combatant.actor?.isOwner ?? false;
}
