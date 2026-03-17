/**
 * PokéRole Combat HUD - Battle Panel
 * Handles move selection and execution.
 */

import { TYPE_COLORS, CATEGORY_ICONS } from "../helpers.mjs";

export class BattlePanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Get the moves for a Pokémon actor, formatted for the template.
   * @param {Actor} pokemon - The Pokémon actor
   * @returns {object[]} Array of move data objects
   */
  getMoves(pokemon) {
    if (!pokemon) return [];

    const moves = pokemon.items.filter(i => i.type === "move" && i.system.isUsable !== false);
    const will = pokemon.system.resources?.will ?? { value: 0, max: 0 };

    return moves.map(move => {
      const moveType = move.system.type ?? "normal";
      const colors = TYPE_COLORS[moveType] ?? TYPE_COLORS.normal;
      const category = move.system.category ?? "physical";
      const willCost = move.system.willCost ?? 0;
      const canAfford = will.value >= willCost;
      const isUsable = move.system.isUsable !== false;

      return {
        id: move.id,
        name: move.name,
        img: move.img,
        type: moveType,
        typeLabel: moveType.charAt(0).toUpperCase() + moveType.slice(1),
        category,
        categoryIcon: CATEGORY_ICONS[category] ?? CATEGORY_ICONS.physical,
        power: move.system.power ?? 0,
        willCost,
        priority: move.system.priority ?? 0,
        accuracy: this.#getAccuracyLabel(move, pokemon),
        bgColor: colors.bg,
        textColor: colors.text,
        canAfford,
        isUsable: isUsable && canAfford,
        actionTag: move.system.actionTag ?? "1A",
        description: move.system.description ?? ""
      };
    }).sort((a, b) => {
      // Sort: usable first, then by name
      if (a.isUsable !== b.isUsable) return b.isUsable - a.isUsable;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Compute accuracy label for a move.
   * @param {Item} move
   * @param {Actor} pokemon
   * @returns {string}
   */
  #getAccuracyLabel(move, pokemon) {
    const attr = move.system.accuracyAttribute;
    const skill = move.system.accuracySkill;
    let pool = 0;

    if (attr && pokemon.system.attributes?.[attr] !== undefined) {
      pool += pokemon.system.attributes[attr];
    }
    if (skill && pokemon.system.skills?.[skill] !== undefined) {
      pool += pokemon.system.skills[skill];
    }

    const modifier = move.system.accuracyDiceModifier ?? 0;
    pool += modifier;

    const reduced = move.system.reducedAccuracy ?? 0;

    let label = `${pool}d6`;
    if (reduced > 0) label += ` (-${reduced})`;
    return label;
  }

  /**
   * Execute a move by its ID.
   * @param {string} moveId - The Item ID of the move
   */
  async useMove(moveId) {
    const pokemon = this.hud.activePokemon;
    if (!pokemon) {
      ui.notifications.warn(game.i18n.localize("POKEHUD.Warn.NoPokemon"));
      return;
    }

    const move = pokemon.items.get(moveId);
    if (!move) {
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.MoveNotFound"));
      return;
    }

    // Check Will cost
    const will = pokemon.system.resources?.will ?? { value: 0 };
    const willCost = move.system.willCost ?? 0;
    if (will.value < willCost) {
      ui.notifications.warn(game.i18n.format("POKEHUD.Warn.NotEnoughWill", {
        move: move.name,
        cost: willCost,
        current: will.value
      }));
      return;
    }

    // Call the system's rollMove method
    try {
      if (typeof pokemon.rollMove === "function") {
        await pokemon.rollMove(moveId);
      } else {
        // Fallback: open the move sheet or post to chat
        move.sheet?.render(true);
      }
    } catch (err) {
      console.error(`pok-role-combat-hud | Error executing move:`, err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.MoveFailed"));
    }
  }
}
