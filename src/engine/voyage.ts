// Voyage engine — day tick, resource drain, distance tracking
// The trail is the DM. The sea doesn't care. The Moon is the destination.

import type { GameState, Weather } from './types';
import { createCrew, getRoleBonus, getCrewMorale, livingCrew } from './crew';
import { rollEvent } from './events';

// Destination: the Moon. Distance in leagues.
const TOTAL_DISTANCE = 500;
const BASE_SPEED = 5; // leagues per day in fair weather

function xorshift(state: number): number {
  state ^= state << 13;
  state ^= state >> 17;
  state ^= state << 5;
  return state >>> 0;
}

export function createGame(seed?: number): GameState {
  const rng = seed ?? (Math.random() * 0xFFFFFFFF) >>> 0;
  return {
    ship: {
      food: 30,       // 30 days of food
      medicine: 5,
      gold: 10,
      hull: 100,
      crew: createCrew(),
    },
    voyage: {
      day: 1,
      distanceSailed: 0,
      distanceTotal: TOTAL_DISTANCE,
      currentIsland: null,
      weather: 'fair',
      speed: BASE_SPEED,
    },
    phase: 'sailing',
    currentEvent: null,
    log: ['Day 1. The Thousand Sunny sets sail. Destination: the Moon.'],
    rng,
  };
}

// Roll weather for the day
function rollWeather(state: GameState): Weather {
  state.rng = xorshift(state.rng);
  const roll = (state.rng % 100) / 100;
  if (roll < 0.1) return 'storm';
  if (roll < 0.2) return 'doldrums';
  if (roll < 0.35) return 'fog';
  if (roll < 0.65) return 'fair';
  return 'calm';
}

const WEATHER_SPEED: Record<Weather, number> = {
  calm: 1.2,
  fair: 1.0,
  storm: 0.3,
  fog: 0.6,
  doldrums: 0.1,
};

const WEATHER_TEXT: Record<Weather, string> = {
  calm: 'Calm seas.',
  fair: 'Fair wind.',
  storm: 'Storm rages!',
  fog: 'Thick fog.',
  doldrums: 'No wind. The sea is glass.',
};

// Advance one day
export function tickDay(state: GameState): GameState {
  if (state.phase === 'victory' || state.phase === 'defeat') return state;

  const s = { ...state };
  s.voyage = { ...s.voyage };
  s.ship = { ...s.ship };

  // Weather
  s.voyage.weather = rollWeather(s);

  // Speed calculation
  const naviBonus = getRoleBonus(s.ship.crew, 'navigator');
  const hullFactor = s.ship.hull / 100;
  const weatherFactor = WEATHER_SPEED[s.voyage.weather];
  const moraleFactor = 0.5 + (getCrewMorale(s.ship.crew) / 200); // 0.5-1.0
  s.voyage.speed = Math.max(1, Math.round(BASE_SPEED * weatherFactor * hullFactor * moraleFactor * (0.8 + naviBonus * 0.4)));

  // Sail
  s.voyage.distanceSailed += s.voyage.speed;
  s.voyage.day++;

  // Food consumption — 1 per day base, crew size matters
  const alive = livingCrew(s.ship.crew);
  const foodCost = Math.max(1, Math.ceil(alive / 3));
  s.ship.food = Math.max(0, s.ship.food - foodCost);

  // Starvation
  if (s.ship.food === 0) {
    s.log = [...s.log.slice(-8), 'No food! The crew is starving.'];
    s.ship.crew.forEach(c => {
      if (c.isAlive) {
        c.health = Math.max(0, c.health - 8);
        c.morale = Math.max(0, c.morale - 15);
        if (c.health === 0) {
          c.isAlive = false;
          s.log = [...s.log.slice(-8), `${c.name} has starved.`];
        }
      }
    });
  }

  // Natural morale drain — the sea wears you down
  s.ship.crew.forEach(c => {
    if (c.isAlive) c.morale = Math.max(0, c.morale - 2);
  });

  // Day log
  s.log = [...s.log.slice(-8),
    `Day ${s.voyage.day}. ${WEATHER_TEXT[s.voyage.weather]} ${s.voyage.speed} leagues sailed. (${s.voyage.distanceSailed}/${s.voyage.distanceTotal})`
  ];

  // Check victory
  if (s.voyage.distanceSailed >= s.voyage.distanceTotal) {
    s.phase = 'victory';
    s.log = [...s.log.slice(-8), 'You see it. The Moon. You made it.'];
    return s;
  }

  // Check defeat
  if (livingCrew(s.ship.crew) === 0) {
    s.phase = 'defeat';
    s.log = [...s.log.slice(-8), 'The crew is gone. The ship drifts empty.'];
    return s;
  }
  if (s.ship.hull <= 0) {
    s.phase = 'defeat';
    s.log = [...s.log.slice(-8), 'The ship sinks beneath the waves.'];
    return s;
  }

  // Roll for event
  const event = rollEvent(s);
  if (event) {
    s.phase = 'event';
    s.currentEvent = event;
  } else {
    s.phase = 'sailing';
    s.currentEvent = null;
  }

  return s;
}

// Apply an event choice
export function applyChoice(state: GameState, choiceIndex: number): GameState {
  if (!state.currentEvent || state.phase !== 'event') return state;
  const choice = state.currentEvent.choices[choiceIndex];
  if (!choice) return state;

  let s = choice.effect({ ...state, ship: { ...state.ship }, voyage: { ...state.voyage } });
  s.currentEvent = null;
  s.phase = 'sailing';

  // Re-check defeat after event
  if (livingCrew(s.ship.crew) === 0) {
    s.phase = 'defeat';
    s.log = [...s.log.slice(-8), 'The crew is gone.'];
  }
  if (s.ship.hull <= 0) {
    s.phase = 'defeat';
    s.log = [...s.log.slice(-8), 'The ship sinks.'];
  }

  return s;
}
