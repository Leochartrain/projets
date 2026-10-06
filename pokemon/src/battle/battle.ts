import { chance, type Rng } from '../core/random.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { MOVES, type MoveDef, type MoveId, type StageStat } from '../data/moves.ts';
import { SPECIES, STAT_NAMES } from '../data/species.ts';
import { damage, hits, rollCatch, rollCritical, rollDamageRandom, rollEscape, expYield, stageMultiplier } from './formulas.ts';
import { gainExp, isFainted, maxHp, nameOf, statsOf, type Pokemon, type Status } from './pokemon.ts';

export type Side = 'player' | 'wild';

export type Outcome = 'win' | 'lose' | 'run' | 'caught' | 'fled';

/** Ce que l'écran de combat doit montrer, dans l'ordre. */
export type BattleEvent =
  | { type: 'text'; text: string }
  /** La barre de PV de `side` glisse jusqu'à `hp`. */
  | { type: 'hp'; side: Side; hp: number }
  /** Animation d'attaque (élan du lanceur). */
  | { type: 'attack'; side: Side; move: MoveId }
  /** La cible clignote sous le coup. */
  | { type: 'hit'; side: Side }
  | { type: 'stat'; side: Side; up: boolean }
  | { type: 'status'; side: Side; status: Status }
  | { type: 'faint'; side: Side }
  /** Le joueur rappelle son Pokémon puis envoie celui-ci (indice dans l'équipe). */
  | { type: 'withdraw' }
  | { type: 'send'; index: number }
  | { type: 'ball'; shakes: number; caught: boolean }
  /** La barre d'expérience du Pokémon `index` se remplit ; `level` est son niveau après. */
  | { type: 'exp'; index: number; level: number }
  | { type: 'levelUp'; index: number; level: number }
  /** Le Pokémon `index` veut apprendre `move` mais connaît déjà 4 attaques : l'écran demande quoi oublier. */
  | { type: 'learnPrompt'; index: number; move: MoveId }
  /** Le Pokémon du joueur est K.O. : il faut en choisir un autre. */
  | { type: 'needSwitch' }
  | { type: 'end'; outcome: Outcome };

export type PlayerAction =
  | { kind: 'move'; slot: number }
  | { kind: 'item'; item: ItemId; target: number }
  | { kind: 'switch'; index: number }
  | { kind: 'run' };

interface Combatant {
  stages: Record<StageStat, number>;
  flinched: boolean;
  /** Patience : tours restants à encaisser et dégâts accumulés. */
  bide: { turns: number; stored: number } | null;
  /** Roulade : coups déjà portés dans la série en cours. */
  rollout: number;
  /** Chargeur : la prochaine attaque Électrik a une puissance doublée. */
  charged: boolean;
  /** Dégâts subis ce tour (pour Patience). */
  damageTaken: number;
}

/** Noms des statistiques avec leur article, pour les messages (« L'Attaque », « La Défense »…). */
const STAGE_NAMES: Record<StageStat, string> = {
  atk: `L'${STAT_NAMES.atk}`,
  def: `La ${STAT_NAMES.def}`,
  spa: `L'${STAT_NAMES.spa}`,
  spd: `La ${STAT_NAMES.spd}`,
  spe: `La ${STAT_NAMES.spe}`,
  acc: 'La Précision',
  eva: "L'Esquive",
};

/** Lutte : quand plus aucune attaque n'a de PP. Sans type, avec un contrecoup. */
const STRUGGLE: MoveDef = {
  id: 'tackle', name: 'Lutte', type: 'normal', category: 'physical', power: 50, accuracy: null, pp: 1, priority: 0,
  effects: [], description: '',
};

const freshCombatant = (): Combatant => ({
  stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
  flinched: false,
  bide: null,
  rollout: 0,
  charged: false,
  damageTaken: 0,
});

/**
 * Un combat contre un Pokémon sauvage, avec les règles de Diamant et Perle.
 * Chaque action du joueur joue un tour complet et renvoie les événements à afficher.
 */
export class Battle {
  active: number;
  outcome: Outcome | null = null;
  private readonly sides: Record<Side, Combatant> = { player: freshCombatant(), wild: freshCombatant() };
  private runAttempts = 0;
  /** Pokémon de l'équipe qui ont affronté le sauvage (ils se partagent l'expérience). */
  private readonly participants = new Set<number>();
  /** Tourniquet actif : les attaques Feu font moitié moins de dégâts. */
  private waterSport = false;
  private events: BattleEvent[] = [];

  readonly party: Pokemon[];
  readonly wild: Pokemon;
  private readonly rng: Rng;

  constructor(party: Pokemon[], wild: Pokemon, rng: Rng = Math.random) {
    this.party = party;
    this.wild = wild;
    this.rng = rng;
    this.active = party.findIndex((pokemon) => !isFainted(pokemon));
    this.participants.add(this.active);
  }

  get player(): Pokemon {
    return this.party[this.active];
  }

  /** Attaque imposée (Roulade, Patience en cours) : pas de menu, le tour se joue tout seul. */
  get locked(): boolean {
    const side = this.sides.player;
    return side.rollout > 0 || side.bide !== null;
  }

  start(): BattleEvent[] {
    this.events = [];
    this.text(`Un ${nameOf(this.wild)} sauvage apparaît !`);
    this.push({ type: 'send', index: this.active });
    this.text(`Go ! ${nameOf(this.player)} !`);
    return this.flush();
  }

  /** Joue un tour : l'action du joueur, celle du sauvage, puis les effets de fin de tour. */
  turn(action: PlayerAction): BattleEvent[] {
    this.events = [];
    if (this.outcome) return [];
    this.sides.player.damageTaken = this.sides.wild.damageTaken = 0;
    this.sides.player.flinched = this.sides.wild.flinched = false;

    // Changer de Pokémon, utiliser un objet ou fuir passent avant les attaques.
    if (action.kind === 'run') {
      if (this.tryRun()) return this.flush();
    } else if (action.kind === 'switch') {
      this.switchTo(action.index, true);
    } else if (action.kind === 'item') {
      this.useItem(action.item, action.target);
      if (this.outcome) return this.flush();
    }

    const wildMove = this.chooseWildMove();
    const playerMove = action.kind === 'move' ? this.playerMove(action.slot) : null;

    if (playerMove) {
      const playerFirst = this.goesFirst(playerMove, wildMove);
      const order: [Side, MoveDef, number | null][] = playerFirst
        ? [['player', playerMove, action.kind === 'move' ? action.slot : null], ['wild', wildMove.move, wildMove.slot]]
        : [['wild', wildMove.move, wildMove.slot], ['player', playerMove, action.kind === 'move' ? action.slot : null]];
      for (const [side, move, slot] of order) {
        if (this.outcome || this.someoneFainted()) break;
        this.useMove(side, move, slot);
      }
    } else if (!this.outcome && !this.someoneFainted()) {
      this.useMove('wild', wildMove.move, wildMove.slot);
    }

    if (!this.outcome) this.endOfTurn();
    this.checkFaints();
    return this.flush();
  }

  /** Le joueur continue une attaque imposée (Roulade, Patience). */
  continueLocked(): BattleEvent[] {
    const slot = this.player.moves.findIndex((m) => m.id === (this.sides.player.bide ? 'bide' : 'rollout'));
    return this.turn({ kind: 'move', slot: Math.max(slot, 0) });
  }

  /** Après un K.O., le joueur envoie un autre Pokémon (sans perdre de tour). */
  sendReplacement(index: number): BattleEvent[] {
    this.events = [];
    this.switchTo(index, false);
    return this.flush();
  }

  /** Pokémon qui peuvent remplacer l'actif. */
  canSwitchTo(index: number): boolean {
    return index !== this.active && index < this.party.length && !isFainted(this.party[index]);
  }

  // --- Actions ---

  private tryRun(): boolean {
    this.runAttempts++;
    const playerSpeed = this.effectiveSpeed('player');
    const wildSpeed = this.effectiveSpeed('wild');
    if (rollEscape(this.rng, playerSpeed, wildSpeed, this.runAttempts)) {
      this.text('Vous prenez la fuite !');
      this.end('run');
      return true;
    }
    this.text('Impossible de fuir !');
    return false;
  }

  private switchTo(index: number, voluntary: boolean): void {
    if (voluntary) {
      this.text(`${nameOf(this.player)}, reviens !`);
      this.push({ type: 'withdraw' });
    }
    this.active = index;
    this.sides.player = freshCombatant();
    this.participants.add(index);
    this.push({ type: 'send', index });
    this.text(`Go ! ${nameOf(this.player)} !`);
  }

  private useItem(item: ItemId, target: number): void {
    const def = ITEMS[item];
    if (def.kind === 'ball') {
      this.throwBall(def.ballBonus ?? 1);
      return;
    }
    const pokemon = this.party[target];
    this.text(`Vous utilisez ${def.name} !`);
    if (def.kind === 'heal') {
      const before = pokemon.hp;
      pokemon.hp = Math.min(maxHp(pokemon), pokemon.hp + (def.heal ?? 0));
      if (target === this.active) this.push({ type: 'hp', side: 'player', hp: pokemon.hp });
      this.text(`${nameOf(pokemon)} récupère ${pokemon.hp - before} PV !`);
    } else if (def.kind === 'cure') {
      pokemon.status = null;
      if (target === this.active) this.push({ type: 'status', side: 'player', status: null });
      this.text(def.cures === 'poison' ? `${nameOf(pokemon)} n'est plus empoisonné !` : `${nameOf(pokemon)} n'est plus paralysé !`);
    }
  }

  private throwBall(ballBonus: number): void {
    this.text('Vous lancez une Poké Ball !');
    const { shakes, caught } = rollCatch(this.rng, {
      maxHp: maxHp(this.wild),
      hp: this.wild.hp,
      catchRate: SPECIES[this.wild.species].catchRate,
      ballBonus,
      status: this.wild.status,
    });
    this.push({ type: 'ball', shakes, caught });
    if (caught) {
      this.text(`Et hop ! ${nameOf(this.wild)} est attrapé !`);
      this.end('caught');
      return;
    }
    this.text(['Oh non ! Le Pokémon s\'est libéré !', 'Raaah ! Ça y était presque !', 'Aaaah ! Presque !', 'Mince ! Il y était presque !'][shakes]);
  }

  // --- Attaques ---

  private playerMove(slot: number): MoveDef {
    const side = this.sides.player;
    if (side.bide) return MOVES.bide;
    if (side.rollout > 0) return MOVES.rollout;
    const usable = this.player.moves.some((m) => m.pp > 0);
    if (!usable) return STRUGGLE;
    return MOVES[this.player.moves[slot].id];
  }

  private chooseWildMove(): { move: MoveDef; slot: number | null } {
    const side = this.sides.wild;
    if (side.bide) return { move: MOVES.bide, slot: null };
    if (side.rollout > 0) return { move: MOVES.rollout, slot: null };
    const usable = this.wild.moves.map((m, slot) => ({ m, slot })).filter(({ m }) => m.pp > 0);
    if (usable.length === 0) return { move: STRUGGLE, slot: null };
    const pick = usable[Math.floor(this.rng() * usable.length)];
    return { move: MOVES[pick.m.id], slot: pick.slot };
  }

  private goesFirst(playerMove: MoveDef, wildMove: { move: MoveDef }): boolean {
    if (playerMove.priority !== wildMove.move.priority) return playerMove.priority > wildMove.move.priority;
    const playerSpeed = this.effectiveSpeed('player');
    const wildSpeed = this.effectiveSpeed('wild');
    if (playerSpeed !== wildSpeed) return playerSpeed > wildSpeed;
    return this.rng() < 0.5;
  }

  private effectiveSpeed(side: Side): number {
    const pokemon = this.pokemonOf(side);
    let speed = Math.floor(statsOf(pokemon).spe * stageMultiplier(this.sides[side].stages.spe));
    if (pokemon.status === 'paralysis') speed = Math.floor(speed / 4);
    return speed;
  }

  private useMove(side: Side, move: MoveDef, slot: number | null): void {
    const user = this.pokemonOf(side);
    const targetSide: Side = side === 'player' ? 'wild' : 'player';
    const target = this.pokemonOf(targetSide);
    const state = this.sides[side];
    const name = this.label(side);

    if (state.flinched) {
      this.text(`${name} a peur ! Il ne peut pas attaquer !`);
      state.rollout = 0;
      return;
    }
    if (user.status === 'paralysis' && chance(this.rng, 25)) {
      this.text(`${name} est paralysé ! Il ne peut pas attaquer !`);
      state.rollout = 0;
      state.bide = null;
      return;
    }

    // Les PP ne baissent qu'au premier tour des attaques sur plusieurs tours.
    const continuing = (move.id === 'bide' && state.bide !== null) || (move.id === 'rollout' && state.rollout > 0);
    if (slot !== null && !continuing && move !== STRUGGLE) user.moves[slot].pp = Math.max(0, user.moves[slot].pp - 1);

    if (move.effects.some((e) => e.kind === 'bide')) {
      this.bide(side);
      return;
    }

    if (move === STRUGGLE) this.text(`${name} n'a plus d'attaques !`);
    this.text(`${name} utilise ${move.name} !`);
    this.push({ type: 'attack', side, move: move.id });

    if (move.effects.some((e) => e.kind === 'teleport')) {
      if (side === 'wild') {
        this.text(`${name} s'enfuit !`);
        this.end('fled');
      } else {
        this.text('Mais cela échoue !');
      }
      return;
    }

    const evasion = this.sides[targetSide].stages.eva;
    const targetsFoe = move.category !== 'status' || move.effects.some((e) => (e.kind === 'stages' && e.target === 'foe') || e.kind === 'status');
    if (targetsFoe && !hits(this.rng, move, state.stages.acc, evasion)) {
      this.text(move.category === 'status' ? `Mais cela échoue !` : `${this.label(targetSide)} évite l'attaque !`);
      state.rollout = 0;
      return;
    }

    if (move.category === 'status') {
      this.applyEffects(side, move, true);
      return;
    }

    // Puissance : Roulade double à chaque coup, Chargeur double l'attaque Électrik suivante.
    let power = move.power ?? 0;
    if (move.id === 'rollout') {
      power *= 2 ** state.rollout;
      state.rollout = state.rollout >= 4 ? 0 : state.rollout + 1;
    }
    if (state.charged && move.type === 'electric') {
      power *= 2;
      state.charged = false;
    }
    if (this.waterSport && move.type === 'fire') power = Math.floor(power / 2);

    const critical = rollCritical(this.rng);
    const physical = move.category === 'physical';
    const attackStage = state.stages[physical ? 'atk' : 'spa'];
    const defenseStage = this.sides[targetSide].stages[physical ? 'def' : 'spd'];
    // Un coup critique ignore les baisses d'attaque du lanceur et les hausses de défense de la cible.
    const attack = Math.floor(statsOf(user)[physical ? 'atk' : 'spa'] * stageMultiplier(critical ? Math.max(0, attackStage) : attackStage));
    const defense = Math.floor(statsOf(target)[physical ? 'def' : 'spd'] * stageMultiplier(critical ? Math.min(0, defenseStage) : defenseStage));
    const struggle = move === STRUGGLE;
    const result = damage({
      level: user.level,
      power,
      attack,
      defense,
      moveType: move.type,
      attackerTypes: struggle ? [] : SPECIES[user.species].types,
      defenderTypes: struggle ? [] : SPECIES[target.species].types,
      critical,
      random: rollDamageRandom(this.rng),
    });

    if (result.effectiveness === 0) {
      this.text(`Ça n'affecte pas ${this.label(targetSide)}…`);
      state.rollout = 0;
      return;
    }
    const dealt = this.dealDamage(targetSide, result.damage);
    if (critical) this.text('Coup critique !');
    if (result.effectiveness > 1) this.text("C'est super efficace !");
    else if (result.effectiveness < 1) this.text("Ce n'est pas très efficace…");

    for (const effect of move.effects) {
      if (effect.kind === 'drain' && !isFainted(user)) {
        const heal = Math.max(1, Math.floor(dealt * effect.ratio));
        user.hp = Math.min(maxHp(user), user.hp + heal);
        this.push({ type: 'hp', side, hp: user.hp });
        this.text(`L'énergie ${of(this.label(targetSide))} est drainée !`);
      }
    }
    if (struggle && !isFainted(user)) {
      this.dealDamage(side, Math.max(1, Math.floor(maxHp(user) / 4)));
      this.text(`${name} se blesse en contrecoup !`);
    }
    if (!isFainted(target)) this.applyEffects(side, move, false);
    if (isFainted(target)) state.rollout = 0;
  }

  /** Effets d'une attaque : à coup sûr pour une attaque de statut, avec leur probabilité pour une attaque qui frappe. */
  private applyEffects(side: Side, move: MoveDef, statusMove: boolean): void {
    const targetSide: Side = side === 'player' ? 'wild' : 'player';
    let anything = false;
    for (const effect of move.effects) {
      switch (effect.kind) {
        case 'stages': {
          if (effect.chance !== undefined && !chance(this.rng, effect.chance)) break;
          const who = effect.target === 'self' ? side : targetSide;
          for (const [stat, amount] of Object.entries(effect.changes) as [StageStat, number][]) this.changeStage(who, stat, amount);
          anything = true;
          break;
        }
        case 'status': {
          if (!chance(this.rng, effect.chance)) break;
          anything = this.inflict(targetSide, effect.status, statusMove) || anything;
          break;
        }
        case 'flinch':
          // N'apeure que si la cible n'a pas encore joué ce tour.
          if (chance(this.rng, effect.chance)) this.sides[targetSide].flinched = true;
          break;
        case 'charge':
          this.sides[side].charged = true;
          this.text(`${this.label(side)} se charge en électricité !`);
          anything = true;
          break;
        case 'waterSport':
          this.waterSport = true;
          this.text('Les attaques Feu sont affaiblies !');
          anything = true;
          break;
        default:
          break;
      }
    }
    if (statusMove && !anything) this.text('Mais cela échoue !');
  }

  private changeStage(side: Side, stat: StageStat, amount: number): void {
    const stages = this.sides[side].stages;
    const before = stages[stat];
    stages[stat] = Math.max(-6, Math.min(6, before + amount));
    const owner = `${STAGE_NAMES[stat]} ${of(this.label(side))}`;
    if (stages[stat] === before) {
      this.text(`${owner} ne peut plus ${amount > 0 ? 'augmenter' : 'baisser'} !`);
      return;
    }
    this.push({ type: 'stat', side, up: amount > 0 });
    const strength = Math.abs(amount) >= 2 ? ' beaucoup' : '';
    this.text(`${owner}${amount > 0 ? ` augmente${strength}` : ` baisse${strength}`} !`);
  }

  /** Empoisonne ou paralyse ; renvoie faux si c'est impossible (déjà un statut, immunité de type). */
  private inflict(side: Side, status: 'poison' | 'paralysis', announceFailure: boolean): boolean {
    const pokemon = this.pokemonOf(side);
    const types = SPECIES[pokemon.species].types;
    const immune = status === 'poison' ? types.includes('poison') || types.includes('steel') : false;
    if (pokemon.status || immune) {
      if (announceFailure && pokemon.status === status) this.text(`${this.label(side)} est déjà ${status === 'poison' ? 'empoisonné' : 'paralysé'} !`);
      return false;
    }
    pokemon.status = status;
    this.push({ type: 'status', side, status });
    this.text(status === 'poison' ? `${this.label(side)} est empoisonné !` : `${this.label(side)} est paralysé ! Il aura du mal à attaquer !`);
    return true;
  }

  /** Patience : 2 tours à encaisser, puis renvoie le double des dégâts subis. */
  private bide(side: Side): void {
    const state = this.sides[side];
    const name = this.label(side);
    if (!state.bide) {
      state.bide = { turns: 2, stored: 0 };
      this.text(`${name} utilise Patience !`);
      this.text(`${name} prend son mal en patience !`);
      return;
    }
    state.bide.turns--;
    if (state.bide.turns > 0) {
      this.text(`${name} prend son mal en patience !`);
      return;
    }
    const stored = state.bide.stored;
    state.bide = null;
    this.text(`${name} libère son énergie !`);
    const targetSide: Side = side === 'player' ? 'wild' : 'player';
    if (stored === 0) {
      this.text('Mais cela échoue !');
      return;
    }
    this.push({ type: 'attack', side, move: 'bide' });
    this.dealDamage(targetSide, stored * 2);
  }

  private dealDamage(side: Side, amount: number): number {
    const pokemon = this.pokemonOf(side);
    const dealt = Math.min(amount, pokemon.hp);
    pokemon.hp -= dealt;
    const state = this.sides[side];
    state.damageTaken += dealt;
    if (state.bide) state.bide.stored += dealt;
    this.push({ type: 'hit', side });
    this.push({ type: 'hp', side, hp: pokemon.hp });
    return dealt;
  }

  // --- Fin de tour ---

  private endOfTurn(): void {
    for (const side of ['player', 'wild'] as const) {
      const pokemon = this.pokemonOf(side);
      if (pokemon.status !== 'poison' || isFainted(pokemon)) continue;
      this.text(`${this.label(side)} souffre du poison !`);
      this.dealDamage(side, Math.max(1, Math.floor(maxHp(pokemon) / 8)));
    }
  }

  private someoneFainted(): boolean {
    return isFainted(this.player) || isFainted(this.wild);
  }

  /** K.O. : expérience si le sauvage tombe, changement forcé ou défaite si c'est le nôtre. */
  private checkFaints(): void {
    if (this.outcome) return;
    if (isFainted(this.wild)) {
      this.push({ type: 'faint', side: 'wild' });
      this.text(`${this.label('wild')} est K.O. !`);
      this.awardExp();
    }
    if (isFainted(this.player)) {
      this.sides.player.rollout = 0;
      this.sides.player.bide = null;
      this.push({ type: 'faint', side: 'player' });
      this.text(`${nameOf(this.player)} est K.O. !`);
      this.participants.delete(this.active);
      if (this.outcome) return;
      if (this.party.some((pokemon) => !isFainted(pokemon))) {
        this.push({ type: 'needSwitch' });
      } else {
        this.text("Vous n'avez plus de Pokémon en état de se battre !");
        this.text('Vous êtes pris de panique et perdez connaissance…');
        this.end('lose');
      }
    }
    if (isFainted(this.wild) && !this.outcome) this.end('win');
  }

  private awardExp(): void {
    const alive = [...this.participants].filter((index) => !isFainted(this.party[index]));
    const amount = expYield(this.wild.species, this.wild.level, alive.length);
    for (const index of alive) {
      const pokemon = this.party[index];
      this.text(`${nameOf(pokemon)} gagne ${amount} points d'expérience !`);
      const levels = gainExp(pokemon, amount);
      this.push({ type: 'exp', index, level: pokemon.level });
      for (const { level, newMoves } of levels) {
        this.text(`${nameOf(pokemon)} monte au niveau ${level} !`);
        this.push({ type: 'levelUp', index, level });
        for (const move of newMoves) {
          if (pokemon.moves.length < 4) {
            pokemon.moves.push({ id: move, pp: MOVES[move].pp });
            this.text(`${nameOf(pokemon)} apprend ${MOVES[move].name} !`);
          } else {
            this.push({ type: 'learnPrompt', index, move });
          }
        }
      }
    }
  }

  // --- Outils ---

  private pokemonOf(side: Side): Pokemon {
    return side === 'player' ? this.player : this.wild;
  }

  /** Nom tel qu'il apparaît dans les messages : « Étourmi sauvage » pour l'adversaire. */
  private label(side: Side): string {
    return side === 'player' ? nameOf(this.player) : `${nameOf(this.wild)} sauvage`;
  }

  private end(outcome: Outcome): void {
    this.outcome = outcome;
    this.push({ type: 'end', outcome });
  }

  private text(text: string): void {
    this.events.push({ type: 'text', text });
  }

  private push(event: BattleEvent): void {
    this.events.push(event);
  }

  private flush(): BattleEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

/** « de Keunotor », « d'Étourmi » : élision devant une voyelle. */
function of(name: string): string {
  return /^[AEIOUYÉÈÊÂÎÔaeiouyéèêâîô]/.test(name) ? `d'${name}` : `de ${name}`;
}
