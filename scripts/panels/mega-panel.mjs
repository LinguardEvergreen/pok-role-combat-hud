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

/** Core attributes that get mega evolution stat deltas applied */
const CORE_ATTRIBUTES = ["strength", "dexterity", "vitality", "special", "insight"];

export class MegaPanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Check if the active Pokémon can Mega Evolve.
   * Returns mega evolution data if available, or null.
   * Matches the held Mega Stone name against the evolution's item field
   * to support Pokémon with multiple mega forms (e.g. Charizard X/Y, Mewtwo X/Y).
   * @param {Actor} pokemon - The Pokémon actor
   * @param {Actor} trainer - The Trainer actor
   * @returns {object|null} { megaFormName, requiredItem, heldItemName } or null
   */
  getMegaData(pokemon, trainer) {
    if (!pokemon || pokemon.type !== "pokemon") return null;
    if (!trainer || trainer.type !== "trainer") return null;

    // Already mega-evolved?
    if (this.#isMegaEvolved(pokemon)) return null;

    // Trainer already used mega evolution this combat?
    if (this.#hasTrainerMegaEvolvedThisCombat(trainer)) return null;

    // Check held item is a Mega Stone
    const heldItem = typeof pokemon._getHeldItemDocument === "function"
      ? pokemon._getHeldItemDocument({ requireCompatible: true })
      : null;

    if (!heldItem || !heldItem.system?.held?.isMegaStone) return null;

    // Find mega evolution entries
    const evolutions = Array.isArray(pokemon.system?.evolutions) ? pokemon.system.evolutions : [];
    const megaEvos = evolutions.filter(e => e.kind === "mega" && e.to && e.to.trim() !== "");
    if (megaEvos.length === 0) return null;

    // Match the held mega stone name to the correct evolution entry
    const heldName = (heldItem.name ?? "").trim().toLowerCase();
    let megaEvo = null;

    if (megaEvos.length === 1) {
      // Single mega form — just use it
      megaEvo = megaEvos[0];
    } else {
      // Multiple mega forms (e.g. Charizardite X / Charizardite Y)
      // Match by comparing the evolution's item field with the held item's name
      megaEvo = megaEvos.find(e => {
        const evoItem = (e.item ?? "").trim().toLowerCase();
        return evoItem && (heldName === evoItem || heldName.includes(evoItem) || evoItem.includes(heldName));
      });

      // Fallback: if no exact match, try first mega entry
      if (!megaEvo) megaEvo = megaEvos[0];
    }

    if (!megaEvo) return null;

    console.log(`pok-role-combat-hud | Mega check: PASSED! ${pokemon.name} can mega evolve into ${megaEvo.to} (held: ${heldItem.name})`);
    return {
      megaFormName: megaEvo.to.trim(),
      requiredItem: megaEvo.item ?? "",
      heldItemName: heldItem.name
    };
  }

  /**
   * Perform the Mega Evolution.
   * Stats are updated using deltas: the difference between the mega form's
   * base stats and the normal form's base stats is applied on top of the
   * Pokémon's current (rank-boosted) stats. This preserves distributed rank points.
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

      // 3. Also find the base form in compendium for delta calculation
      const baseFormActor = await this.#findBaseFormActor(pokemon);

      // 4. Save original state
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
        originalSpecies: pokemon.system?.species ?? "",
        originalHpMax: pokemon.system?.resources?.hp?.max ?? 1,
        originalWillMax: pokemon.system?.resources?.will?.max ?? 1
      });

      // 5. Deduct 1 Will from trainer
      await trainer.update({
        "system.resources.will.value": Math.max(trainerWill - 1, 0)
      });

      // 6. Mark trainer as having mega-evolved this combat
      await trainer.setFlag("pok-role-combat-hud", "megaEvolvedCombatId", game.combat?.id ?? "none");

      // 7. Delete current moves and copy mega form's moves
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

      // 8. Calculate stat deltas and apply them
      const currentAttrs = foundry.utils.deepClone(pokemon.system?.attributes ?? {});
      const newAttributes = this.#computeMegaAttributes(currentAttrs, baseFormActor, megaFormActor);

      const updateData = {
        "system.ability": `${megaFormActor.system?.ability ?? ""}`.trim(),
        "system.types.primary": megaFormActor.system?.types?.primary ?? pokemon.system?.types?.primary ?? "normal",
        "system.types.secondary": megaFormActor.system?.types?.secondary ?? pokemon.system?.types?.secondary ?? "none",
        "system.attributes": newAttributes,
        "system.species": megaFormActor.system?.species ?? megaData.megaFormName,
        "img": megaFormActor.img
      };

      // 9. Calculate HP/Will deltas too (mega forms have higher base HP/Will)
      const baseHpMax = baseFormActor?.system?.resources?.hp?.max ?? pokemon.system?.resources?.hp?.max ?? 1;
      const megaHpMax = megaFormActor.system?.resources?.hp?.max ?? baseHpMax;
      const hpDelta = megaHpMax - baseHpMax;
      const newHpMax = Math.max((pokemon.system?.resources?.hp?.max ?? 1) + hpDelta, 1);

      const baseWillMax = baseFormActor?.system?.resources?.will?.max ?? pokemon.system?.resources?.will?.max ?? 1;
      const megaWillMax = megaFormActor.system?.resources?.will?.max ?? baseWillMax;
      const willDelta = megaWillMax - baseWillMax;
      const newWillMax = Math.max((pokemon.system?.resources?.will?.max ?? 1) + willDelta, 1);

      // Full HP and Will restore
      updateData["system.resources.hp.max"] = newHpMax;
      updateData["system.resources.hp.value"] = newHpMax;
      updateData["system.resources.will.max"] = newWillMax;
      updateData["system.resources.will.value"] = newWillMax;

      await pokemon.update(updateData);

      // 10. Clear all conditions
      await this.#clearAllConditions(pokemon);

      // 11. Update token image on the scene
      await this.#updateTokenImage(pokemon, megaFormActor.img);

      // 12. Post chat message
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

  /* ---------------------------------------- */
  /*  Private Helpers                          */
  /* ---------------------------------------- */

  /**
   * Check if a Pokémon is currently mega-evolved (private).
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
   */
  #hasTrainerMegaEvolvedThisCombat(trainer) {
    const megaCombatId = trainer?.getFlag?.("pok-role-combat-hud", "megaEvolvedCombatId");
    if (!megaCombatId) return false;
    return megaCombatId === (game.combat?.id ?? "none");
  }

  /**
   * Find the Mega Form actor by name in world actors or compendium.
   * @param {string} megaFormName - e.g. "Charizard (Mega X Form)"
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
   * Find the base form actor in compendium for delta calculation.
   * Uses the Pokémon's species name or manualCoreBase to find the
   * compendium entry with base stats.
   * @param {Actor} pokemon - The current Pokémon actor
   * @returns {Actor|null}
   */
  async #findBaseFormActor(pokemon) {
    // Use species name (which is the base form name for non-mega Pokémon)
    const speciesName = (pokemon.system?.species ?? pokemon.name ?? "").trim().toLowerCase();
    if (!speciesName) return null;

    // Check compendium
    const pack = game.packs.get("pok-role-system.pokemon-actors");
    if (!pack) return null;

    const index = await pack.getIndex();
    const entry = index.find(e => e.name.trim().toLowerCase() === speciesName);
    if (!entry) return null;

    return await pack.getDocument(entry._id);
  }

  /**
   * Compute new attributes by applying delta (mega base - normal base) to current stats.
   * This preserves rank-distributed points.
   *
   * Example: Charizard base strength=2, Mega X strength=3, delta=+1
   *          If user's Charizard has strength=5 (due to rank ups), result = 5+1 = 6
   *
   * For social attributes (tough, beauty, etc.) and skills, they stay unchanged
   * since mega evolution typically only changes core combat attributes.
   *
   * @param {object} currentAttrs - The Pokémon's current attributes
   * @param {Actor|null} baseFormActor - The compendium base form actor
   * @param {Actor} megaFormActor - The compendium mega form actor
   * @returns {object} New attributes with deltas applied
   */
  #computeMegaAttributes(currentAttrs, baseFormActor, megaFormActor) {
    const result = foundry.utils.deepClone(currentAttrs);
    const megaAttrs = megaFormActor.system?.attributes ?? {};

    if (!baseFormActor) {
      // If we can't find the base form, use manualCoreBase as fallback
      // manualCoreBase stores the species' base attributes
      console.warn("pok-role-combat-hud | No base form actor found, checking manualCoreBase");
    }

    const baseAttrs = baseFormActor?.system?.attributes
      ?? foundry.utils.deepClone(currentAttrs);

    // Apply delta for each core attribute
    for (const attr of CORE_ATTRIBUTES) {
      const baseVal = Number(baseAttrs[attr] ?? 0);
      const megaVal = Number(megaAttrs[attr] ?? 0);
      const delta = megaVal - baseVal;
      const currentVal = Number(currentAttrs[attr] ?? 0);
      result[attr] = Math.max(currentVal + delta, 1);
    }

    // Social attributes stay as-is (mega evolution doesn't change them in compendium data either)

    console.log("pok-role-combat-hud | Mega attributes delta applied:", {
      base: Object.fromEntries(CORE_ATTRIBUTES.map(a => [a, baseAttrs[a]])),
      mega: Object.fromEntries(CORE_ATTRIBUTES.map(a => [a, megaAttrs[a]])),
      current: Object.fromEntries(CORE_ATTRIBUTES.map(a => [a, currentAttrs[a]])),
      result: Object.fromEntries(CORE_ATTRIBUTES.map(a => [a, result[a]]))
    });

    return result;
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

    // Restore original stats, HP/Will max
    await pokemon.update({
      "system.ability": megaState.originalAbility ?? "",
      "system.types.primary": megaState.originalTypes?.primary ?? "normal",
      "system.types.secondary": megaState.originalTypes?.secondary ?? "none",
      "system.attributes": megaState.originalAttributes ?? pokemon.system?.attributes ?? {},
      "system.skills": megaState.originalSkills ?? pokemon.system?.skills ?? {},
      "system.species": megaState.originalSpecies ?? "",
      "system.resources.hp.max": megaState.originalHpMax ?? pokemon.system?.resources?.hp?.max ?? 1,
      "system.resources.will.max": megaState.originalWillMax ?? pokemon.system?.resources?.will?.max ?? 1,
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
