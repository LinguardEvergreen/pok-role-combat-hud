/**
 * PokéRole Combat HUD - Main HUD Application
 * Renders the Pokémon-style combat overlay with Battle/Pokémon/Bag/Run buttons.
 */

import { MODULE_ID, TYPE_COLORS, getHpColorClass, getHpPercent, getTrainerForActor, getTrainerParty, isCurrentUserTurn, CONDITION_ICONS } from "./helpers.mjs";
import { BattlePanel } from "./panels/battle-panel.mjs";
import { PokemonPanel } from "./panels/pokemon-panel.mjs";
import { BagPanel } from "./panels/bag-panel.mjs";
import { RunPanel } from "./panels/run-panel.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CombatHUD extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Currently open panel: "battle" | "pokemon" | "bag" | null */
  #activePanel = null;

  /** Sub-panel handlers */
  #battlePanel = new BattlePanel(this);
  #pokemonPanel = new PokemonPanel(this);
  #bagPanel = new BagPanel(this);
  #runPanel = new RunPanel(this);

  /* ---------------------------------------- */
  /*  Application Configuration               */
  /* ---------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: "poke-combat-hud",
    classes: ["poke-combat-hud"],
    tag: "section",
    position: {
      width: "auto",
      height: "auto"
    },
    window: {
      frame: false,
      positioned: false
    }
  };

  static PARTS = {
    hud: {
      template: `modules/${MODULE_ID}/templates/combat-hud.hbs`
    }
  };

  /* ---------------------------------------- */
  /*  Getters                                  */
  /* ---------------------------------------- */

  get activePanel() {
    return this.#activePanel;
  }

  /**
   * Get the active combatant's actor.
   * @returns {Actor|null}
   */
  get activeActor() {
    return game.combat?.combatant?.actor ?? null;
  }

  /**
   * Get the active Pokémon (either the combatant itself if it's a Pokémon,
   * or the first Pokémon in the trainer's party).
   * @returns {Actor|null}
   */
  get activePokemon() {
    const actor = this.activeActor;
    if (!actor) return null;
    if (actor.type === "pokemon") return actor;
    // If it's a trainer, try to find their active Pokémon in combat
    const party = getTrainerParty(actor);
    const inCombat = party.find(p =>
      game.combat?.combatants.some(c => c.actor?.id === p.id)
    );
    return inCombat ?? party[0] ?? null;
  }

  /**
   * Get the Trainer actor.
   * @returns {Actor|null}
   */
  get trainer() {
    return getTrainerForActor(this.activeActor);
  }

  /* ---------------------------------------- */
  /*  Data Preparation                         */
  /* ---------------------------------------- */

  async _prepareContext(options) {
    const pokemon = this.activePokemon;
    const trainer = this.trainer;
    const isMyTurn = isCurrentUserTurn();

    // Pokémon data
    let pokemonData = null;
    if (pokemon) {
      const hp = pokemon.system.resources?.hp ?? { value: 0, max: 0 };
      const will = pokemon.system.resources?.will ?? { value: 0, max: 0 };
      const types = pokemon.system.types ?? {};
      const conditions = pokemon.system.conditions ?? {};

      // Active conditions
      const activeConditions = [];
      for (const [key, active] of Object.entries(conditions)) {
        if (active) {
          activeConditions.push({
            key,
            icon: CONDITION_ICONS[key] ?? "❓",
            label: game.i18n.localize(`POKEHUD.Condition.${key.charAt(0).toUpperCase() + key.slice(1)}`)
          });
        }
      }

      pokemonData = {
        name: pokemon.name,
        img: pokemon.img,
        species: pokemon.system.species ?? "",
        hp,
        will,
        hpPercent: getHpPercent(hp.value, hp.max),
        willPercent: getHpPercent(will.value, will.max),
        hpColor: getHpColorClass(hp.value, hp.max),
        primaryType: types.primary ?? "normal",
        secondaryType: types.secondary !== "none" ? types.secondary : null,
        primaryTypeColor: TYPE_COLORS[types.primary]?.bg ?? TYPE_COLORS.normal.bg,
        secondaryTypeColor: types.secondary && types.secondary !== "none" ? TYPE_COLORS[types.secondary]?.bg : null,
        conditions: activeConditions,
        isFainted: conditions.fainted ?? false
      };
    }

    // Moves for Battle panel
    const moves = pokemon ? this.#battlePanel.getMoves(pokemon) : [];

    // Party for Pokémon panel
    const party = trainer ? this.#pokemonPanel.getParty(trainer, pokemon) : [];

    // Bag items for Bag panel
    const bag = trainer ? this.#bagPanel.getBagItems(trainer) : [];

    // HUD settings
    const position = game.settings.get(MODULE_ID, "hudPosition");
    const scale = game.settings.get(MODULE_ID, "hudScale");

    return {
      pokemon: pokemonData,
      moves,
      party,
      bag,
      activePanel: this.#activePanel,
      isMyTurn,
      position,
      scale,
      MODULE_ID
    };
  }

  /* ---------------------------------------- */
  /*  Rendering                                */
  /* ---------------------------------------- */

  _onRender(context, options) {
    const html = this.element;
    if (!html) return;

    // Apply position class
    const position = game.settings.get(MODULE_ID, "hudPosition");
    html.classList.remove("bottom-right", "bottom-left", "bottom-center");
    html.classList.add(position);

    // Apply scale
    const scale = game.settings.get(MODULE_ID, "hudScale");
    html.style.setProperty("--hud-scale", scale);

    // Bind button click events
    this.#bindEvents(html);
  }

  /* ---------------------------------------- */
  /*  Event Binding                            */
  /* ---------------------------------------- */

  #bindEvents(html) {
    // Main menu buttons
    html.querySelector('[data-action="battle"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#togglePanel("battle");
    });

    html.querySelector('[data-action="pokemon"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#togglePanel("pokemon");
    });

    html.querySelector('[data-action="bag"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#togglePanel("bag");
    });

    html.querySelector('[data-action="run"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#runPanel.onRun();
    });

    // Battle panel - move buttons
    html.querySelectorAll('[data-action="use-move"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const moveId = btn.dataset.moveId;
        this.#battlePanel.useMove(moveId);
      });
    });

    // Pokémon panel - switch buttons
    html.querySelectorAll('[data-action="switch-pokemon"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const actorId = btn.dataset.actorId;
        this.#pokemonPanel.switchPokemon(actorId);
      });
    });

    // Bag panel - use item buttons
    html.querySelectorAll('[data-action="use-item"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const itemId = btn.dataset.itemId;
        this.#bagPanel.useItem(itemId);
      });
    });

    // Close panel button
    html.querySelector('[data-action="close-panel"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#closePanel();
    });
  }

  /* ---------------------------------------- */
  /*  Panel Management                         */
  /* ---------------------------------------- */

  #togglePanel(panelName) {
    if (this.#activePanel === panelName) {
      this.#closePanel();
    } else {
      this.#activePanel = panelName;
      this.render();
    }
  }

  #closePanel() {
    this.#activePanel = null;
    this.render();
  }

  /* ---------------------------------------- */
  /*  Public API                               */
  /* ---------------------------------------- */

  /**
   * Show the HUD by rendering it into the UI.
   */
  async showHUD() {
    if (!game.settings.get(MODULE_ID, "enableHud")) return;
    this.#activePanel = null;
    await this.render({ force: true });

    // Append to the Foundry UI layer
    const uiTop = document.getElementById("ui-bottom") ?? document.body;
    if (this.element && !uiTop.contains(this.element)) {
      uiTop.appendChild(this.element);
    }
  }

  /**
   * Hide the HUD.
   */
  hideHUD() {
    this.#activePanel = null;
    this.close();
  }

  /**
   * Toggle HUD visibility.
   */
  toggle() {
    if (this.rendered) {
      this.hideHUD();
    } else if (game.combat) {
      this.showHUD();
    }
  }

  /**
   * Refresh the HUD content (re-render in place).
   */
  refresh() {
    if (this.rendered) {
      this.render();
    }
  }
}
