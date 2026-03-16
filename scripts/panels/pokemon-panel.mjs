/**
 * PokéRole Combat HUD - Pokémon Panel
 * Handles party display and Pokémon switching.
 */

import { TYPE_COLORS, getHpColorClass, getHpPercent, getTrainerParty, CONDITION_ICONS } from "../helpers.mjs";

export class PokemonPanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Get the Trainer's Pokémon party, formatted for the template.
   * @param {Actor} trainer - The Trainer actor
   * @param {Actor|null} activePokemon - The currently active Pokémon
   * @returns {object[]} Array of party Pokémon data
   */
  getParty(trainer, activePokemon) {
    const party = getTrainerParty(trainer);

    return party.map(pokemon => {
      const hp = pokemon.system.resources?.hp ?? { value: 0, max: 0 };
      const will = pokemon.system.resources?.will ?? { value: 0, max: 0 };
      const types = pokemon.system.types ?? {};
      const conditions = pokemon.system.conditions ?? {};
      const isFainted = conditions.fainted ?? false;
      const isActive = activePokemon && pokemon.id === activePokemon.id;

      // Active conditions list
      const activeConditions = [];
      for (const [key, active] of Object.entries(conditions)) {
        if (active) {
          activeConditions.push({
            key,
            icon: CONDITION_ICONS[key] ?? "❓"
          });
        }
      }

      return {
        id: pokemon.id,
        name: pokemon.name,
        img: pokemon.img,
        species: pokemon.system.species ?? "",
        hp,
        will,
        hpPercent: getHpPercent(hp.value, hp.max),
        hpColor: getHpColorClass(hp.value, hp.max),
        primaryType: types.primary ?? "normal",
        primaryTypeColor: TYPE_COLORS[types.primary]?.bg ?? TYPE_COLORS.normal.bg,
        secondaryType: types.secondary !== "none" ? types.secondary : null,
        secondaryTypeColor: types.secondary && types.secondary !== "none"
          ? TYPE_COLORS[types.secondary]?.bg : null,
        conditions: activeConditions,
        isFainted,
        isActive,
        canSwitch: !isFainted && !isActive
      };
    });
  }

  /**
   * Switch to a different Pokémon.
   * @param {string} actorId - The actor ID of the Pokémon to switch to
   */
  async switchPokemon(actorId) {
    const pokemon = game.actors.get(actorId);
    if (!pokemon) {
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.PokemonNotFound"));
      return;
    }

    if (pokemon.system.conditions?.fainted) {
      ui.notifications.warn(game.i18n.format("POKEHUD.Warn.PokemonFainted", { name: pokemon.name }));
      return;
    }

    // Confirm the switch
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("POKEHUD.Pokemon.SwitchTitle") },
      content: `<p>${game.i18n.format("POKEHUD.Pokemon.SwitchConfirm", { name: pokemon.name })}</p>`,
      yes: { label: game.i18n.localize("POKEHUD.Pokemon.SwitchYes") },
      no: { label: game.i18n.localize("POKEHUD.Pokemon.SwitchNo") }
    });

    if (!confirm) return;

    // Post switch message to chat
    await ChatMessage.create({
      content: `<div class="poke-hud-chat switch-message">
        <img src="${pokemon.img}" width="40" height="40" alt="${pokemon.name}"/>
        <span>${game.i18n.format("POKEHUD.Pokemon.SwitchChat", {
          trainer: this.hud.trainer?.name ?? "Trainer",
          name: pokemon.name
        })}</span>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor: this.hud.trainer })
    });

    // If the Pokémon has a token on the scene, we could manipulate combat here
    // For now, notify the GM to handle the switch manually
    ui.notifications.info(game.i18n.format("POKEHUD.Pokemon.SwitchNotify", { name: pokemon.name }));

    // Refresh the HUD
    this.hud.refresh();
  }
}
