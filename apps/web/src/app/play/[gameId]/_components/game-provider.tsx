'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  Action,
  EngineError,
  GameEvent,
  GameState,
  MatchSetup,
  PlayerIndex,
  RngState,
} from '@optcg/engine';
import { apply, createInitialState, createRng } from '@optcg/engine';
import type { Bot } from '@optcg/ai';
import { EasyBot, MediumBot } from '@optcg/ai';
import { GameContext, type BotActionSummary } from '@/app/play/_shared/game-context';

export { useGame } from '@/app/play/_shared/game-context';
export type { BotActionSummary } from '@/app/play/_shared/game-context';

interface DispatchResult {
  error?: EngineError;
  events: GameEvent[];
}

const AUTO_PHASES = new Set<GameState['phase']>(['Refresh', 'Draw', 'Don']);
const BOT_DELAY_MS = 1200;

function summarizeAction(action: Action): string {
  switch (action.kind) {
    case 'Mulligan':
      return action.mulligan ? 'Mulliganed' : 'Kept hand';
    case 'PassPhase':
      return 'Passed phase';
    case 'EndTurn':
      return 'Ended turn';
    case 'PlayCharacter':
      return 'Played a character';
    case 'PlayEvent':
      return 'Played an event';
    case 'PlayStage':
      return 'Played a stage';
    case 'AttachDon':
      return action.target.kind === 'Leader'
        ? 'Attached DON to Leader'
        : 'Attached DON to character';
    case 'ActivateMain':
      return 'Activated effect';
    case 'DeclareAttack':
      return action.target.kind === 'Leader' ? 'Attacked Leader' : 'Attacked a character';
    case 'PlayCounter':
      return 'Played a counter';
    case 'DeclineCounter':
      return 'No counter';
    case 'UseBlocker':
      return 'Used a blocker';
    case 'DeclineBlocker':
      return 'No blocker';
    case 'ActivateTrigger':
      return action.activate ? 'Activated trigger' : 'Skipped trigger';
  }
}

function botForPlayerIndex(aiOpponent: 'easy' | 'medium' | null): { 0?: Bot; 1?: Bot } {
  if (!aiOpponent) return {};
  const bot = aiOpponent === 'easy' ? EasyBot : MediumBot;
  return { 1: bot };
}

function actorForPriority(state: GameState): PlayerIndex | null {
  const pw = state.priorityWindow;
  if (!pw) return null;
  if (pw.kind === 'Mulligan') return pw.player;
  if (pw.kind === 'CounterStep') return pw.defender.owner;
  if (pw.kind === 'BlockerStep') return pw.originalTarget.owner;
  if (pw.kind === 'TriggerStep') return pw.owner;
  return null;
}

export function GameProvider({
  setup,
  aiOpponent,
  children,
}: {
  setup: MatchSetup;
  aiOpponent?: 'easy' | 'medium' | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<GameState>(() => createInitialState(setup));
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [lastBotAction, setLastBotAction] = useState<BotActionSummary | null>(null);
  const rngRef = useRef<RngState>(createRng(setup.seed + 1));
  const bots = botForPlayerIndex(aiOpponent ?? null);
  const botPlayers: { 0?: true; 1?: true } = {};
  if (bots[0]) botPlayers[0] = true;
  if (bots[1]) botPlayers[1] = true;

  const currentPriorityActor = actorForPriority(state);
  let currentActor: PlayerIndex | null = null;
  if (currentPriorityActor !== null) {
    currentActor = currentPriorityActor;
  } else if (AUTO_PHASES.has(state.phase) || state.phase === 'Main') {
    currentActor = state.activePlayer;
  }
  const botThinking =
    state.winner === null &&
    state.phase !== 'GameOver' &&
    currentActor !== null &&
    Boolean(bots[currentActor]);

  function dispatch(action: Action): DispatchResult {
    const result = apply(state, action);
    if (!result.error) {
      setState(result.state);
      if (result.events.length > 0) {
        setEvents((prev) => [...prev, ...result.events]);
      }
    }
    return { error: result.error, events: result.events };
  }

  function dispatchBatch(actions: Action[]): DispatchResult {
    let current = state;
    const allEvents: GameEvent[] = [];
    let err: EngineError | undefined;
    for (const action of actions) {
      const result = apply(current, action);
      if (result.error) {
        err = result.error;
        break;
      }
      current = result.state;
      if (result.events.length > 0) {
        allEvents.push(...result.events);
      }
    }
    if (current !== state) {
      setState(current);
      if (allEvents.length > 0) {
        setEvents((prev) => [...prev, ...allEvents]);
      }
    }
    return { error: err, events: allEvents };
  }

  // Auto-advance Refresh/Draw/Don — only when the active player is NOT a bot
  // (bots handle those phases themselves via the bot runner effect below).
  useEffect(() => {
    if (state.winner !== null) return;
    if (state.phase === 'GameOver') return;
    if (state.priorityWindow !== null) return;
    if (!AUTO_PHASES.has(state.phase)) return;
    // If the active player is a bot, the bot runner effect takes over.
    if (bots[state.activePlayer]) return;

    const result = apply(state, { kind: 'PassPhase', player: state.activePlayer });
    if (!result.error) {
      setState(result.state);
      if (result.events.length > 0) {
        setEvents((prev) => [...prev, ...result.events]);
      }
    }
  }, [state, bots]);

  // Bot runner — dispatches a bot's action with a BOT_DELAY_MS delay.
  useEffect(() => {
    if (state.winner !== null) return;
    if (state.phase === 'GameOver') return;

    // Identify the actor: priority window defender/owner/mulligan player,
    // or the active player for phase transitions or Main.
    const priorityActor = actorForPriority(state);
    let actor: PlayerIndex | null = null;
    if (priorityActor !== null) {
      actor = priorityActor;
    } else if (AUTO_PHASES.has(state.phase) || state.phase === 'Main') {
      actor = state.activePlayer;
    }
    if (actor === null) return;
    const bot = bots[actor];
    if (!bot) return;

    const timer = setTimeout(() => {
      // Use engine's apply directly so we can thread the RNG.
      const decision = bot.pick(state, actor, rngRef.current);
      rngRef.current = decision.rng;
      const result = apply(state, decision.action);
      if (!result.error) {
        setState(result.state);
        setLastBotAction({
          kind: decision.action.kind,
          label: summarizeAction(decision.action),
          at: Date.now(),
        });
        if (result.events.length > 0) {
          setEvents((prev) => [...prev, ...result.events]);
        }
      } else {
        // Surface in console for debugging; do not mutate state.
        console.error(`[bot ${bot.id}] illegal action`, decision.action, result.error);
      }
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, bots]);

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        dispatchBatch,
        events,
        botPlayers,
        botThinking,
        lastBotAction,
        isOnline: false,
        myPlayerIndex: null,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
