// Events — the things that happen on the trail
// Each event has choices. Choices have consequences. The sea doesn't care.

import type { GameEvent, GameState } from './types';
import { getRoleBonus } from './crew';

// Damage a random living crew member
function hurtRandom(state: GameState, amount: number, reason: string): GameState {
  const living = state.ship.crew.filter(c => c.isAlive);
  if (living.length === 0) return state;
  const target = living[Math.floor(seededRandom(state) * living.length)];
  target.health = Math.max(0, target.health - amount);
  if (target.health === 0) {
    target.isAlive = false;
    return addLog(state, `${target.name} has died. ${reason}`);
  }
  return addLog(state, `${target.name} is hurt. ${reason} (-${amount} health)`);
}

// Heal a random living crew member
function healRandom(state: GameState, amount: number): GameState {
  const injured = state.ship.crew.filter(c => c.isAlive && c.health < 100);
  if (injured.length === 0) return state;
  const target = injured[Math.floor(seededRandom(state) * injured.length)];
  target.health = Math.min(100, target.health + amount);
  return addLog(state, `${target.name} recovers. (+${amount} health)`);
}

function addLog(state: GameState, msg: string): GameState {
  state.log = [...state.log.slice(-8), msg];
  return state;
}

// Simple seeded random (consumes from state.rng)
function seededRandom(state: GameState): number {
  state.rng ^= state.rng << 13;
  state.rng ^= state.rng >> 17;
  state.rng ^= state.rng << 5;
  state.rng = state.rng >>> 0;
  return (state.rng % 1000) / 1000;
}

// -- Event Pool --

const STORM_EVENT: GameEvent = {
  id: 'storm',
  text: 'A storm approaches. Dark clouds on the horizon. The sea rises.',
  choices: [
    {
      label: 'Sail through',
      key: '1',
      description: 'Risk hull damage but save time',
      effect: (s) => {
        const naviBonus = getRoleBonus(s.ship.crew, 'navigator');
        const damage = Math.floor(20 - naviBonus * 15);
        s.ship.hull = Math.max(0, s.ship.hull - damage);
        s = addLog(s, `Storm hits! Hull takes ${damage} damage.`);
        if (seededRandom(s) > 0.6) s = hurtRandom(s, 15, 'Thrown by a wave.');
        s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.max(0, c.morale - 10); });
        return s;
      },
    },
    {
      label: 'Wait it out',
      key: '2',
      description: 'Lose 2 days, use extra food, but safe',
      effect: (s) => {
        s.voyage.day += 2;
        s.ship.food = Math.max(0, s.ship.food - 2);
        s = addLog(s, 'You anchor and wait. 2 days lost.');
        return s;
      },
    },
  ],
};

const ISLAND_EVENT: GameEvent = {
  id: 'island',
  text: 'An island appears. Smoke rises from the shore. Could be friendly.',
  choices: [
    {
      label: 'Dock and explore',
      key: '1',
      description: 'Risk encounter, but might find supplies',
      effect: (s) => {
        const roll = seededRandom(s);
        if (roll < 0.5) {
          const food = 3 + Math.floor(seededRandom(s) * 5);
          s.ship.food += food;
          s = addLog(s, `Friendly island! Found ${food} days of food.`);
          s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.min(100, c.morale + 10); });
        } else if (roll < 0.8) {
          s.ship.medicine += 2;
          s = addLog(s, 'Found medicinal herbs. (+2 medicine)');
        } else {
          s = hurtRandom(s, 20, 'Ambush on the island!');
          s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.max(0, c.morale - 15); });
        }
        s.voyage.day += 1;
        return s;
      },
    },
    {
      label: 'Sail past',
      key: '2',
      description: 'No risk, no reward',
      effect: (s) => {
        s = addLog(s, 'You sail past the island.');
        return s;
      },
    },
  ],
};

const SICKNESS_EVENT: GameEvent = {
  id: 'sickness',
  text: 'Someone in the crew looks pale. Fever spreading.',
  choices: [
    {
      label: 'Use medicine',
      key: '1',
      description: 'Spend 1 medicine to treat them',
      effect: (s) => {
        if (s.ship.medicine > 0) {
          s.ship.medicine--;
          const docBonus = getRoleBonus(s.ship.crew, 'doctor');
          const heal = 20 + Math.floor(docBonus * 30);
          s = healRandom(s, heal);
          s = addLog(s, `Chopper treats the sick. (+${heal} health)`);
        } else {
          s = addLog(s, 'No medicine! The fever spreads.');
          s = hurtRandom(s, 25, 'Untreated fever.');
          if (seededRandom(s) > 0.5) s = hurtRandom(s, 15, 'Fever spreads to another.');
        }
        return s;
      },
    },
    {
      label: 'Let them rest',
      key: '2',
      description: 'Save medicine, hope for the best',
      effect: (s) => {
        if (seededRandom(s) > 0.4) {
          s = addLog(s, 'They fight through it.');
        } else {
          s = hurtRandom(s, 30, 'The fever worsens.');
        }
        return s;
      },
    },
  ],
};

const CALM_SEAS_EVENT: GameEvent = {
  id: 'calm',
  text: 'Clear skies. Calm water. The wind is with you.',
  choices: [
    {
      label: 'Push ahead',
      key: '1',
      description: 'Extra distance today',
      effect: (s) => {
        s.voyage.distanceSailed += 8;
        s = addLog(s, 'Good sailing! Covered extra distance.');
        s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.min(100, c.morale + 5); });
        return s;
      },
    },
    {
      label: 'Rest and fish',
      key: '2',
      description: 'Recover morale and catch food',
      effect: (s) => {
        const cookBonus = getRoleBonus(s.ship.crew, 'cook');
        const food = 2 + Math.floor(cookBonus * 3);
        s.ship.food += food;
        s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.min(100, c.morale + 15); });
        s = addLog(s, `Sanji cooks a feast. (+${food} food, morale up)`);
        return s;
      },
    },
  ],
};

const HULL_DAMAGE_EVENT: GameEvent = {
  id: 'hull-damage',
  text: 'A reef! The hull scrapes against hidden rocks.',
  choices: [
    {
      label: 'Repair now',
      key: '1',
      description: 'Spend a day, Franky fixes it',
      effect: (s) => {
        const shipwrightBonus = getRoleBonus(s.ship.crew, 'shipwright');
        const repair = 15 + Math.floor(shipwrightBonus * 20);
        s.ship.hull = Math.min(100, s.ship.hull + repair);
        s.voyage.day += 1;
        s.ship.food = Math.max(0, s.ship.food - 1);
        s = addLog(s, `Franky repairs the hull. (+${repair} hull, 1 day lost)`);
        return s;
      },
    },
    {
      label: 'Keep sailing',
      key: '2',
      description: 'Risk further damage',
      effect: (s) => {
        s.ship.hull = Math.max(0, s.ship.hull - 15);
        s = addLog(s, 'Hull takes more damage from the reef. (-15 hull)');
        if (s.ship.hull <= 0) {
          s = addLog(s, 'The ship is sinking!');
        }
        return s;
      },
    },
  ],
};

const MORALE_EVENT: GameEvent = {
  id: 'morale',
  text: 'The crew is restless. Days blur together. Someone mutters about turning back.',
  choices: [
    {
      label: 'Brook plays music',
      key: '1',
      description: 'Musician lifts spirits',
      effect: (s) => {
        const musicBonus = getRoleBonus(s.ship.crew, 'musician');
        const boost = 10 + Math.floor(musicBonus * 15);
        s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.min(100, c.morale + boost); });
        s = addLog(s, `Brook plays. The crew smiles. (+${boost} morale)`);
        return s;
      },
    },
    {
      label: 'Captain speech',
      key: '2',
      description: 'Luffy rallies the crew — risky if captain is weak',
      effect: (s) => {
        const captainBonus = getRoleBonus(s.ship.crew, 'captain');
        if (captainBonus > 0.5) {
          s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.min(100, c.morale + 25); });
          s = addLog(s, '"I\'m gonna be King of the Pirates!" Morale soars.');
        } else {
          s.ship.crew.forEach(c => { if (c.isAlive) c.morale = Math.max(0, c.morale - 5); });
          s = addLog(s, 'Luffy tries but he\'s too weak. Crew worries more.');
        }
        return s;
      },
    },
  ],
};

const EVENT_POOL: GameEvent[] = [
  STORM_EVENT,
  ISLAND_EVENT,
  SICKNESS_EVENT,
  CALM_SEAS_EVENT,
  HULL_DAMAGE_EVENT,
  MORALE_EVENT,
];

// Pick a random event based on current state
export function rollEvent(state: GameState): GameEvent | null {
  // 40% chance of event per day
  if (seededRandom(state) > 0.4) return null;

  // Weight by situation
  const roll = seededRandom(state);
  if (state.ship.hull < 40 && roll < 0.3) return HULL_DAMAGE_EVENT;
  if (state.ship.food < 5 && roll < 0.4) return ISLAND_EVENT;

  return EVENT_POOL[Math.floor(seededRandom(state) * EVENT_POOL.length)];
}
