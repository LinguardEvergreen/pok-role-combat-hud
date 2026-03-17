/**
 * PokéRole Combat HUD - Run Panel
 * Handles fleeing from combat using the system's trainerRunAwayFromBattle() method.
 */

export class RunPanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Attempt to run from combat.
   * Delegates to the system's trainerRunAwayFromBattle() method which performs
   * an opposed roll: (Dexterity + Athletic)d6 vs foe's same pool.
   */
  async onRun() {
    const combat = game.combat;
    if (!combat) return;

    const actor = this.hud.activeActor;
    if (!actor) return;

    try {
      if (typeof actor.trainerRunAwayFromBattle === "function") {
        // Use the system's built-in method
        const result = await actor.trainerRunAwayFromBattle();

        if (result?.escaped) {
          ui.notifications.info(game.i18n.localize("POKEHUD.Run.GotAway"));
        } else if (result !== null && result !== undefined) {
          ui.notifications.warn(game.i18n.localize("POKEHUD.Run.FailedToEscape"));
        }
        // result === null means the action was cancelled or not possible

      } else {
        // Fallback for non-trainer actors or if the method doesn't exist
        await this.#fallbackRun(actor, combat);
      }
    } catch (err) {
      console.error("pok-role-combat-hud | Error in Run:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ActionFailed"));
    }
  }

  /**
   * Fallback run logic for when the system method is not available.
   * Simple 1d6 roll, success on 4+.
   * @param {Actor} actor
   * @param {Combat} combat
   */
  async #fallbackRun(actor, combat) {
    // Confirm run
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("POKEHUD.Run.Title") },
      content: `<p>${game.i18n.localize("POKEHUD.Run.Confirm")}</p>`,
      yes: { label: game.i18n.localize("POKEHUD.Run.Yes") },
      no: { label: game.i18n.localize("POKEHUD.Run.No") }
    });

    if (!confirm) return;

    // Roll to flee: 1d6, success on 4+
    const roll = await new Roll("1d6cs>=4").evaluate();
    const success = roll.total >= 1;
    const dieResult = roll.dice[0]?.results[0]?.result ?? 0;

    const messageContent = `
      <div class="poke-hud-chat run-message ${success ? 'success' : 'failure'}">
        <h3>${game.i18n.localize("POKEHUD.Run.Title")}</h3>
        <div class="run-roll">
          <span class="die-result">${dieResult}</span>
          <span class="run-result ${success ? 'success' : 'failure'}">
            ${success
              ? game.i18n.localize("POKEHUD.Run.Success")
              : game.i18n.localize("POKEHUD.Run.Failure")}
          </span>
        </div>
      </div>
    `;

    await ChatMessage.create({
      content: messageContent,
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      type: CONST.CHAT_MESSAGE_TYPES.ROLL
    });

    if (success) {
      const combatant = combat.combatants.find(c => c.actor?.id === actor.id);
      if (combatant) {
        await combatant.delete();
      }

      ui.notifications.info(game.i18n.localize("POKEHUD.Run.GotAway"));

      const playerCombatants = combat.combatants.filter(c => !c.isNPC);
      if (playerCombatants.length === 0) {
        await combat.delete();
      }

      this.hud.hideHUD();
    } else {
      ui.notifications.warn(game.i18n.localize("POKEHUD.Run.FailedToEscape"));
    }
  }
}
