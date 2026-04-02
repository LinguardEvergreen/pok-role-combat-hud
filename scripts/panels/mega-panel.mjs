/**
 * PokéRole Combat HUD - Mega Evolution Panel
 * Handles Mega Evolution detection, transformation, and revert logic.
 *
 * Rules:
 * - Pokémon must have a compatible Mega Stone equipped as held item
 * - Trainer must spend 1 Will Point
 * - Only one Pokémon per Trainer per battle can Mega Evolve
 * - Mega form restores full HP, full Will, and heals all conditions
 * - Lasts for the whole battle/scene
 * - Persists through recall and fainting
 * - Buffs, debuffs, and vitamin effects remain
 * - Mega Stones cannot be stolen/switched/removed during battle
 */

const MEGA_STATE_FLAG_KEY = "megaEvolution";
const POKROLE_ID = "pok-role-system";

export class MegaPanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Check if the active Pokémon can Mega Evolve.
   * Returns mega evolution data if available, or null.
   * @param {Actor} pokemon - The Pokémon actor
   * @param {Actor} trainer - The Trainer actor
   * @returns {object|null} { evolutionEntry, heldItem, megaFormName } or null
   */
  getMegaData(pokemon, trainer) {
    if (!pokemon || pokemon.type !== "pokemon") {
      console.log("pok-role-combat-hud | Mega check: no pokemon or wrong type", pokemon?.type);
      return null;
    }
    if (!trainer || trainer.type !== "trainer") {
      console.log("pok-role-combat-hud | Mega check: no trainer found for", pokemon.name, "trainer:", trainer);
      return null;
    }

    // Already mega-evolved?
    if (this.#isMegaEvolved(pokemon)) {
      console.log("pok-role-combat-hud | Mega check: already mega-evolved");
      return null;
    }

    // Trainer already used mega evolution this combat?
    if (this.#hasTrainerMegaEvolvedThisCombat(trainer)) {
      console.log("pok-role-combat-hud | Mega check: trainer already mega-evolved this combat");
      return null;
    }

    // Find mega evolution entry
    const evolutions = Array.isArray(pokemon.system?.evolutions) ? pokemon.system.evolutions : [];
    console.log("pok-role-combat-hud | Mega check: evolutions for", pokemon.name, "=", JSON.stringify(evolutions));
    const megaEvo = evolutions.find(e => e.kind === "mega" && e.to && e.to.trim() !== "");
    if (!megaEvo) {
      console.log("pok-role-combat-hud | Mega check: no mega evolution entry found");
      return null;
    }

    // Check held item is a compatible Mega Stone
    const battleItemId = `${pokemon.system?.battleItem ?? ""}`.trim();
    console.log("pok-role-combat-hud | Mega check: battleItem ID =", battleItemId);

    const heldItem = typeof pokemon._getHeldItemDocument === "function"
      ? pokemon._getHeldItemDocument({ requireCompatible: true })
      : null;

    console.log("pok-role-combat-hud | Mega check: heldItem =", heldItem?.name, "isMegaStone =", heldItem?.system?.held?.isMegaStone);

    if (!heldItem) {
      // Try without compatibility requirement to see if the item exists but fails compatibility
      const heldItemNoCompat = typeof pokemon._getHeldItemDocument === "function"
        ? pokemon._getHeldItemDocument({ requireCompatible: false })
        : null;
      console.log("pok-role-combat-hud | Mega check: heldItem (no compat check) =", heldItemNoCompat?.name, "isMegaStone =", heldItemNoCompat?.system?.held?.isMegaStone);

      if (!heldItemNoCompat) {
        // Fallback: search for a mega stone in the Pokémon's embedded items
        const embeddedMegaStone = (pokemon.items?.contents ?? []).find(i =>
          i.type === "gear" && i.system?.held?.isMegaStone === true
        );
        console.log("pok-role-combat-hud | Mega check: embedded mega stone =", embeddedMegaStone?.name);
      }
    }

    if (!heldItem || !heldItem.system?.held?.isMegaStone) {
      console.log("pok-role-combat-hud | Mega check: no valid mega stone held");
      return null;
    }

    console.log("pok-role-combat-hud | Mega check: PASSED! Can mega evolve into", megaEvo.to);
    return {
      megaFormName: megaEvo.to.trim(),
      requiredItem: megaEvo.item ?? "",
      heldItemName: heldItem.name
    };
  }

  /**
   * Perform the Mega Evolution.
   * @param {Actor} pokemon - The Pokémon to mega evolve
   * @param {Actor} trainer - The Trainer actor
   */
  async megaEvolve(pokemon, trainer) {
    if (!pokemon || !trainer) return;

    const megaData = this.getMegaData(pokemon, trainer);
    if (!megaData) {
      ui.notifications.warn(game.i18n.localize("POKEHUD.Mega.CannotMega"));
      return;
    }

    // Confirm
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("POKEHUD.Mega.Title") },
      content: `<p>${game.i18n.format("POKEHUD.Mega.Confirm", { name: pokemon.name, mega: megaData.megaFormName })}</p>`,
      yes: { label: game.i18n.localize("POKEHUD.Mega.Yes") },
      no: { label: game.i18n.localize("POKEHUD.Mega.No") }
    });
    if (!confirm) return;

    try {
      // 1. Check trainer Will (costs 1 Will Point)
      const trainerWill = trainer.system.resources?.will?.value ?? 0;
      if (trainerWill < 1) {
        ui.notifications.warn(game.i18n.localize("POKEHUD.Mega.NotEnoughWill"));
        return;
      }

      // 2. Find Mega Form actor in compendium or world actors
      const megaFormActor = await this.#findMegaFormActor(megaData.megaFormName);
      if (!megaFormActor) {
        ui.notifications.error(game.i18n.format("POKEHUD.Mega.FormNotFound", { name: megaData.megaFormName }));
        return;
      }

      // 3. Save original state
      const originalMoves = (pokemon.items?.contents ?? [])
        .filter(item => item?.type === "move")
        .map(item => item.toObject());

      await pokemon.setFlag("pok-role-combat-hud", MEGA_STATE_FLAG_KEY, {
        combatId: game.combat?.id ?? "",
        originalAbility: `${pokemon.system?.ability ?? ""}`.trim(),
        originalTypes: foundry.utils.deepClone(pokemon.system?.types ?? {}),
        originalAttributes: foundry.utils.deepClone(pokemon.system?.attributes ?? {}),
        originalSkills: foundry.utils.deepClone(pokemon.system?.skills ?? {}),
        originalMoves,
        originalImg: pokemon.img,
        originalPrototypeTokenImg: pokemon.prototypeToken?.texture?.src ?? "",
        originalName: pokemon.name,
        originalSpecies: pokemon.system?.species ?? ""
      });

      // 4. Deduct 1 Will from trainer
      await trainer.update({
        "system.resources.will.value": Math.max(trainerWill - 1, 0)
      });

      // 5. Mark trainer as having mega-evolved this combat
      await trainer.setFlag("pok-role-combat-hud", "megaEvolvedCombatId", game.combat?.id ?? "none");

      // 6. Delete current moves and copy mega form's moves
      const currentMoveIds = (pokemon.items?.contents ?? [])
        .filter(item => item?.type === "move")
        .map(item => item.id)
        .filter(Boolean);

      if (currentMoveIds.length > 0) {
        await pokemon.deleteEmbeddedDocuments("Item", currentMoveIds);
      }

      const copiedMoves = (megaFormActor.items?.contents ?? [])
        .filter(item => item?.type === "move")
        .map(item => {
          const data = item.toObject();
          delete data._id;
          return data;
        });

      if (copiedMoves.length > 0) {
        await pokemon.createEmbeddedDocuments("Item", copiedMoves);
      }

      // 7. Update stats, types, ability, image, species
      const updateData = {
        "system.ability": `${megaFormActor.system?.ability ?? ""}`.trim(),
        "system.types.primary": megaFormActor.system?.types?.primary ?? pokemon.system?.types?.primary ?? "normal",
        "system.types.secondary": megaFormActor.system?.types?.secondary ?? pokemon.system?.types?.secondary ?? "none",
        "system.attributes": foundry.utils.deepClone(megaFormActor.system?.attributes ?? {}),
        "system.skills": foundry.utils.deepClone(megaFormActor.system?.skills ?? {}),
        "system.species": megaFormActor.system?.species ?? megaData.megaFormName,
        "img": megaFormActor.img
      };

      // 8. Restore full HP and Will
      const megaHpMax = megaFormActor.system?.resources?.hp?.max ?? pokemon.system?.resources?.hp?.max ?? 1;
      const megaWillMax = megaFormActor.system?.resources?.will?.max ?? pokemon.system?.resources?.will?.max ?? 1;
      updateData["system.resources.hp.value"] = megaHpMax;
      updateData["system.resources.hp.max"] = megaHpMax;
      updateData["system.resources.will.value"] = megaWillMax;
      updateData["system.resources.will.max"] = megaWillMax;

      await pokemon.update(updateData);

      // 9. Clear all conditions
      await this.#clearAllConditions(pokemon);

      // 10. Update token image on the scene
      await this.#updateTokenImage(pokemon, megaFormActor.img);

      // 11. Post chat message
      await ChatMessage.create({
        content: `<div class="poke-hud-chat mega-message">
          <img src="${megaFormActor.img}" width="48" height="48" alt="${megaData.megaFormName}"/>
          <span><strong>${pokemon.name}</strong> ${game.i18n.localize("POKEHUD.Mega.ChatMessage")}</span>
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor: trainer })
      });

      ui.notifications.info(game.i18n.format("POKEHUD.Mega.Success", { name: megaData.megaFormName }));
      this.hud.refresh();

    } catch (err) {
      console.error("pok-role-combat-hud | Error during Mega Evolution:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Mega.Failed"));
    }
  }

  /**
   * Revert all mega-evolved Pokémon for a given combat.
   * Called when combat ends.
   * @param {string} combatId - The combat ID that just ended
   */
  async revertAllMegaEvolutions(combatId) {
    if (!combatId) return;

    for (const actor of game.actors) {
      if (actor.type !== "pokemon") continue;
      const megaState = actor.getFlag?.("pok-role-combat-hud", MEGA_STATE_FLAG_KEY);
      if (!megaState || megaState.combatId !== combatId) continue;

      try {
        await this.#revertMegaEvolution(actor);
      } catch (err) {
        console.warn(`pok-role-combat-hud | Failed to revert mega evolution for ${actor.name}:`, err);
      }
    }

    // Clear trainer mega flags
    for (const actor of game.actors) {
      if (actor.type !== "trainer") continue;
      const megaCombatId = actor.getFlag?.("pok-role-combat-hud", "megaEvolvedCombatId");
      if (megaCombatId === combatId) {
        await actor.unsetFlag("pok-role-combat-hud", "megaEvolvedCombatId");
      }
    }
  }

  /**
   * Check if a Pokémon is currently mega-evolved.
   * @param {Actor} pokemon
   * @returns {boolean}
   */
  #isMegaEvolved(pokemon) {
    const megaState = pokemon?.getFlag?.("pok-role-combat-hud", MEGA_STATE_FLAG_KEY);
    return !!megaState;
  }

  /**
   * Check if this Pokémon is mega-evolved (public).
   * @param {Actor} pokemon
   * @returns {boolean}
   */
  isMegaEvolved(pokemon) {
    return this.#isMegaEvolved(pokemon);
  }

  /**
   * Check if the trainer has already mega-evolved a Pokémon this combat.
   * @param {Actor} trainer
   * @returns {boolean}
   */
  #hasTrainerMegaEvolvedThisCombat(trainer) {
    const megaCombatId = trainer?.getFlag?.("pok-role-combat-hud", "megaEvolvedCombatId");
    if (!megaCombatId) return false;
    return megaCombatId === (game.combat?.id ?? "none");
  }

  /**
   * Find the Mega Form actor by name in world actors or compendium.
   * @param {string} megaFormName - e.g. "Beedrill (Mega Form)"
   * @returns {Actor|null}
   */
  async #findMegaFormActor(megaFormName) {
    const normalizedName = megaFormName.trim().toLowerCase();

    // First: check world actors
    const worldActor = game.actors.find(a =>
      a.type === "pokemon" && a.name.trim().toLowerCase() === normalizedName
    );
    if (worldActor) return worldActor;

    // Second: check compendium
    const pack = game.packs.get("pok-role-system.pokemon-actors");
    if (!pack) return null;

    const index = await pack.getIndex();
    const entry = index.find(e => e.name.trim().toLowerCase() === normalizedName);
    if (!entry) return null;

    return await pack.getDocument(entry._id);
  }

  /**
   * Revert a single Pokémon's mega evolution.
   * @param {Actor} pokemon
   */
  async #revertMegaEvolution(pokemon) {
    const megaState = pokemon.getFlag?.("pok-role-combat-hud", MEGA_STATE_FLAG_KEY);
    if (!megaState) return;

    // Delete current moves
    const currentMoveIds = (pokemon.items?.contents ?? [])
      .filter(item => item?.type === "move")
      .map(item => item.id)
      .filter(Boolean);

    if (currentMoveIds.length > 0) {
      await pokemon.deleteEmbeddedDocuments("Item", currentMoveIds);
    }

    // Restore original moves
    const restoredMoves = (megaState.originalMoves ?? []).map(moveData => {
      const cloned = foundry.utils.deepClone(moveData);
      delete cloned._id;
      return cloned;
    });

    if (restoredMoves.length > 0) {
      await pokemon.createEmbeddedDocuments("Item", restoredMoves);
    }

    // Restore original stats
    await pokemon.update({
      "system.ability": megaState.originalAbility ?? "",
      "system.types.primary": megaState.originalTypes?.primary ?? "normal",
      "system.types.secondary": megaState.originalTypes?.secondary ?? "none",
      "system.attributes": megaState.originalAttributes ?? pokemon.system?.attributes ?? {},
      "system.skills": megaState.originalSkills ?? pokemon.system?.skills ?? {},
      "system.species": megaState.originalSpecies ?? "",
      "img": megaState.originalImg ?? pokemon.img
    });

    // Restore token image
    if (megaState.originalImg) {
      await this.#updateTokenImage(pokemon, megaState.originalImg);
    }

    // Clear the mega flag
    await pokemon.unsetFlag("pok-role-combat-hud", MEGA_STATE_FLAG_KEY);

    console.log(`pok-role-combat-hud | Reverted mega evolution for ${pokemon.name}`);
  }

  /**
   * Clear all conditions on a Pokémon.
   * @param {Actor} pokemon
   */
  async #clearAllConditions(pokemon) {
    const conditions = pokemon.system?.conditions ?? {};
    const updates = {};

    for (const [key, isActive] of Object.entries(conditions)) {
      if (isActive) {
        if (typeof pokemon.toggleQuickCondition === "function") {
          try {
            await pokemon.toggleQuickCondition(key, { active: false });
          } catch {
            updates[`system.conditions.${key}`] = false;
          }
        } else {
          updates[`system.conditions.${key}`] = false;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await pokemon.update(updates);
    }
  }

  /**
   * Update the token image on the current scene.
   * @param {Actor} pokemon
   * @param {string} newImg
   */
  async #updateTokenImage(pokemon, newImg) {
    if (!canvas.scene || !newImg) return;

    const token = canvas.scene.tokens.find(t => t.actor?.id === pokemon.id);
    if (token) {
      await token.update({ "texture.src": newImg });
    }
  }
}
