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
   * Use an item from the bag via the system's useGearItem method.
   * @param {string} itemId - The Item ID
   */
  async useItem(itemId) {
    const trainer = this.hud.trainer;
    if (!trainer) {
      ui.notifications.warn(game.i18n.localize("POKEHUD.Warn.NoTrainer"));
      return;
    }

    if (typeof trainer.useGearItem !== "function") {
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.SystemMethodNotFound"));
      return;
    }

    try {
      await trainer.useGearItem(itemId);
      this.hud.refresh();
    } catch (err) {
      console.error("pok-role-combat-hud | Error using item:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ItemUseFailed"));
    }
  }
}
