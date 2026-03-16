/**
 * PokéRole Combat HUD - Bag Panel
 * Handles in-battle item usage.
 */

import { POCKET_LABELS } from "../helpers.mjs";

export class BagPanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Get battle-usable items from the Trainer's inventory.
   * @param {Actor} trainer - The Trainer actor
   * @returns {object[]} Array of item data grouped by pocket
   */
  getBagItems(trainer) {
    if (!trainer) return [];

    const gearItems = trainer.items.filter(i =>
      i.type === "gear" && i.system.canUseInBattle
    );

    // Group by pocket
    const pockets = {};
    for (const item of gearItems) {
      const pocket = item.system.pocket ?? "main";
      if (!pockets[pocket]) {
        pockets[pocket] = {
          key: pocket,
          label: game.i18n.localize(POCKET_LABELS[pocket] ?? POCKET_LABELS.main),
          items: []
        };
      }

      pockets[pocket].items.push({
        id: item.id,
        name: item.name,
        img: item.img,
        quantity: item.system.quantity ?? 1,
        consumable: item.system.consumable ?? false,
        category: item.system.category ?? "other",
        description: this.#getItemSummary(item),
        isEmpty: (item.system.quantity ?? 1) <= 0
      });
    }

    // Sort items within each pocket by name
    for (const pocket of Object.values(pockets)) {
      pocket.items.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Return as array, ordered by pocket priority
    const pocketOrder = ["potions", "small", "main", "held", "badge"];
    return pocketOrder
      .filter(p => pockets[p])
      .map(p => pockets[p]);
  }

  /**
   * Get a short summary of what an item does.
   * @param {Item} item
   * @returns {string}
   */
  #getItemSummary(item) {
    const parts = [];
    const sys = item.system;

    // Healing info
    if (sys.heal) {
      if (sys.heal.fullHp) {
        parts.push(game.i18n.localize("POKEHUD.Bag.FullHeal"));
      } else if (sys.heal.hp > 0) {
        parts.push(game.i18n.format("POKEHUD.Bag.HealHP", { hp: sys.heal.hp }));
      }
      if (sys.heal.restoreAwareness) {
        parts.push(game.i18n.localize("POKEHUD.Bag.RestoreAwareness"));
      }
    }

    // Status cure info
    if (sys.status) {
      if (sys.status.all) {
        parts.push(game.i18n.localize("POKEHUD.Bag.CureAll"));
      } else {
        const cures = [];
        for (const [cond, cured] of Object.entries(sys.status)) {
          if (cured && cond !== "all") {
            cures.push(cond);
          }
        }
        if (cures.length > 0) {
          parts.push(game.i18n.format("POKEHUD.Bag.CureStatus", { status: cures.join(", ") }));
        }
      }
    }

    if (parts.length === 0 && sys.description) {
      // Truncate description to 60 chars
      const desc = sys.description.replace(/<[^>]*>/g, "").trim();
      return desc.length > 60 ? desc.substring(0, 57) + "..." : desc;
    }

    return parts.join(" | ");
  }

  /**
   * Use an item from the bag.
   * @param {string} itemId - The Item ID
   */
  async useItem(itemId) {
    const trainer = this.hud.trainer;
    if (!trainer) {
      ui.notifications.warn(game.i18n.localize("POKEHUD.Warn.NoTrainer"));
      return;
    }

    const item = trainer.items.get(itemId);
    if (!item) {
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ItemNotFound"));
      return;
    }

    // Check quantity
    const quantity = item.system.quantity ?? 1;
    if (quantity <= 0) {
      ui.notifications.warn(game.i18n.format("POKEHUD.Warn.NoItemsLeft", { name: item.name }));
      return;
    }

    // Confirm usage
    const targetPokemon = this.hud.activePokemon;
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("POKEHUD.Bag.UseTitle") },
      content: `<p>${game.i18n.format("POKEHUD.Bag.UseConfirm", {
        item: item.name,
        target: targetPokemon?.name ?? "?"
      })}</p>`,
      yes: { label: game.i18n.localize("POKEHUD.Bag.UseYes") },
      no: { label: game.i18n.localize("POKEHUD.Bag.UseNo") }
    });

    if (!confirm) return;

    // Apply item effects
    try {
      await this.#applyItemEffects(item, targetPokemon, trainer);

      // Decrement quantity if consumable
      if (item.system.consumable) {
        await item.update({ "system.quantity": quantity - 1 });
      }

      // Post usage to chat
      await ChatMessage.create({
        content: `<div class="poke-hud-chat item-message">
          <img src="${item.img}" width="32" height="32" alt="${item.name}"/>
          <span>${game.i18n.format("POKEHUD.Bag.UseChat", {
            trainer: trainer.name,
            item: item.name,
            target: targetPokemon?.name ?? ""
          })}</span>
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor: trainer })
      });

      // Refresh the HUD
      this.hud.refresh();

    } catch (err) {
      console.error("pok-role-combat-hud | Error using item:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ItemUseFailed"));
    }
  }

  /**
   * Apply an item's effects to the target Pokémon.
   * @param {Item} item
   * @param {Actor} target
   * @param {Actor} trainer
   */
  async #applyItemEffects(item, target, trainer) {
    if (!target) return;

    const sys = item.system;
    const updates = {};

    // HP Healing
    if (sys.heal) {
      const hp = target.system.resources.hp;
      if (sys.heal.fullHp) {
        updates["system.resources.hp.value"] = hp.max;
      } else if (sys.heal.hp > 0) {
        updates["system.resources.hp.value"] = Math.min(hp.max, hp.value + sys.heal.hp);
      }
    }

    // Status cures
    if (sys.status) {
      if (sys.status.all) {
        updates["system.conditions.sleep"] = false;
        updates["system.conditions.burn"] = false;
        updates["system.conditions.frozen"] = false;
        updates["system.conditions.paralyzed"] = false;
        updates["system.conditions.poisoned"] = false;
      } else {
        for (const [cond, cured] of Object.entries(sys.status)) {
          if (cured && cond !== "all") {
            updates[`system.conditions.${cond}`] = false;
          }
        }
      }
    }

    // Revive (clear fainted)
    if (sys.category === "revive") {
      updates["system.conditions.fainted"] = false;
      if (sys.heal?.hp > 0) {
        const hp = target.system.resources.hp;
        updates["system.resources.hp.value"] = Math.min(hp.max, sys.heal.hp);
      }
    }

    if (Object.keys(updates).length > 0) {
      await target.update(updates);
    }
  }
}
