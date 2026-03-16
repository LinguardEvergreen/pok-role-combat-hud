/**
 * PokéRole Combat HUD - Run Panel
 * Handles fleeing from combat.
 */

export class RunPanel {
  constructor(hud) {
    this.hud = hud;
  }

  /**
   * Attempt to run from combat.
   */
  async onRun() {
    const combat = game.combat;
    if (!combat) return;

    const actor = this.hud.activeActor;
    if (!actor) return;

    // Check if this is a trainer battle (cannot flee from trainer battles by default)
    const hasTrainerOpponent = combat.combatants.some(c => {
      if (c.actor?.id === actor.id) return false;
      return c.actor?.type === "trainer";
    });

    if (hasTrainerOpponent) {
      ui.notifications.warn(game.i18n.localize("POKEHUD.Run.CannotFleeTrainer"));
      return;
    }

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

    // Show roll in chat
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
      // Remove the combatant from combat
      const combatant = combat.combatants.find(c => c.actor?.id === actor.id);
      if (combatant) {
        await combatant.delete();
      }

      ui.notifications.info(game.i18n.localize("POKEHUD.Run.GotAway"));

      // If no player combatants remain, end combat
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
