/**
 * PokéRole Combat HUD - Pokémon Panel
 * Handles party display and Pokémon switching with full token/combat management.
 */

import { TYPE_COLORS, getHpColorClass, getHpPercent, getTrainerParty, CONDITION_ICONS, getTrainerForActor } from "../helpers.mjs";

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
            icon: CONDITION_ICONS[key] ?? "\u2753"
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
   * Show a dialog asking which Pokémon to replace (for double/triple battles).
   * @param {Combatant[]} ownedCombatants - The trainer's Pokémon combatants in battle
   * @param {Actor} newPokemon - The Pokémon being sent out
   * @returns {Promise<string|null>} The actor ID of the Pokémon to replace, or null if cancelled
   */
  async #askWhichPokemonToReplace(ownedCombatants, newPokemon) {
    const options = ownedCombatants.map(c => {
      const actor = c.actor;
      const hp = actor.system.resources?.hp ?? { value: 0, max: 0 };
      return `<option value="${actor.id}">${actor.name} (HP: ${hp.value}/${hp.max})</option>`;
    }).join("");

    const content = `
      <p>${game.i18n.format("POKEHUD.Pokemon.ReplacePrompt", { name: newPokemon.name })}</p>
      <div class="form-group">
        <label>${game.i18n.localize("POKEHUD.Pokemon.ReplaceLabel")}</label>
        <select name="pokemonId">${options}</select>
      </div>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("POKEHUD.Pokemon.SwitchTitle"),
        content,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("POKEHUD.Pokemon.SwitchYes"),
            callback: (html) => {
              const selected = html.find('select[name="pokemonId"]').val();
              resolve(selected ?? null);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("POKEHUD.Pokemon.SwitchNo"),
            callback: () => resolve(null)
          }
        },
        default: "confirm",
        close: () => resolve(null)
      }).render(true);
    });
  }

  /**
   * Switch to a different Pokémon.
   * Removes the current Pokémon's token from the scene and combat,
   * places the new Pokémon's token, adds it to combat, and rolls initiative.
   * @param {string} actorId - The actor ID of the Pokémon to switch to
   */
  async switchPokemon(actorId) {
    const newPokemon = game.actors.get(actorId);
    if (!newPokemon) {
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.PokemonNotFound"));
      return;
    }

    if (newPokemon.system.conditions?.fainted) {
      ui.notifications.warn(game.i18n.format("POKEHUD.Warn.PokemonFainted", { name: newPokemon.name }));
      return;
    }

    const combat = game.combat;
    const scene = canvas.scene;
    const trainer = this.hud.trainer;

    // Find all Pokémon owned by this trainer that are in the turn order
    let pokemonToReplace = null;

    if (combat && trainer) {
      const party = getTrainerParty(trainer);
      const partyIds = new Set(party.map(p => p.id));

      const ownedCombatants = combat.combatants.filter(c =>
        c.actor?.type === "pokemon" && partyIds.has(c.actor.id)
      );

      if (ownedCombatants.length >= 2) {
        // Double/Triple battle: ask which Pokémon to replace
        const chosenId = await this.#askWhichPokemonToReplace(ownedCombatants, newPokemon);
        if (!chosenId) return; // User cancelled
        pokemonToReplace = game.actors.get(chosenId);
      } else if (ownedCombatants.length === 1) {
        pokemonToReplace = ownedCombatants[0].actor;
      }
    }

    // If no combat or no combatants found, fall back to activePokemon
    if (!pokemonToReplace) {
      pokemonToReplace = this.hud.activePokemon;
    }

    // Confirm the switch
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("POKEHUD.Pokemon.SwitchTitle") },
      content: `<p>${game.i18n.format("POKEHUD.Pokemon.SwitchConfirm", { name: newPokemon.name })}</p>`,
      yes: { label: game.i18n.localize("POKEHUD.Pokemon.SwitchYes") },
      no: { label: game.i18n.localize("POKEHUD.Pokemon.SwitchNo") }
    });

    if (!confirm) return;

    try {
      // 1. Find the Pokémon to replace's token and combatant
      let spawnPosition = { x: 0, y: 0 };

      if (pokemonToReplace && scene) {
        const currentToken = scene.tokens.find(t => t.actor?.id === pokemonToReplace.id);
        if (currentToken) {
          // Save position for the new token
          spawnPosition = { x: currentToken.x, y: currentToken.y };

          // Remove current Pokémon from combat
          if (combat) {
            const currentCombatant = combat.combatants.find(c => c.actor?.id === pokemonToReplace.id);
            if (currentCombatant) {
              await currentCombatant.delete();
            }
          }

          // Remove current Pokémon's token from the scene
          await currentToken.delete();
        }
      }

      // 2. Create the new Pokémon's token on the scene at the same position
      if (scene) {
        // Get prototype token data from the actor
        const tokenData = await newPokemon.getTokenDocument({
          x: spawnPosition.x,
          y: spawnPosition.y,
          actorLink: true
        });

        const createdTokens = await scene.createEmbeddedDocuments("Token", [tokenData.toObject()]);
        const newTokenDoc = createdTokens[0];

        // 3. Add the new Pokémon to the combat tracker
        if (combat && newTokenDoc) {
          const combatantData = [{
            tokenId: newTokenDoc.id,
            actorId: newPokemon.id,
            sceneId: scene.id
          }];

          await combat.createEmbeddedDocuments("Combatant", combatantData);

          // 4. Roll initiative for the new Pokémon
          if (typeof newPokemon.rollInitiative === "function") {
            await newPokemon.rollInitiative();
          } else {
            // Fallback: roll using the system formula
            const newCombatant = combat.combatants.find(c => c.actor?.id === newPokemon.id);
            if (newCombatant) {
              await combat.rollInitiative([newCombatant.id]);
            }
          }
        }
      }

      // 5. Post switch message to chat
      await ChatMessage.create({
        content: `<div class="poke-hud-chat switch-message">
          <img src="${newPokemon.img}" width="40" height="40" alt="${newPokemon.name}"/>
          <span>${game.i18n.format("POKEHUD.Pokemon.SwitchChat", {
            trainer: trainer?.name ?? "Trainer",
            name: newPokemon.name
          })}</span>
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor: trainer })
      });

      ui.notifications.info(game.i18n.format("POKEHUD.Pokemon.SwitchNotify", { name: newPokemon.name }));

      // 6. Refresh the HUD
      this.hud.refresh();

    } catch (err) {
      console.error("pok-role-combat-hud | Error switching Pokémon:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.SwitchFailed"));
    }
  }
}
