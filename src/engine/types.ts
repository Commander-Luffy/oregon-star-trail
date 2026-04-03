// Oregon Star-Trail types
// The trail is the DM. Resources drain. Events happen. Nobody has root.

export interface CrewMember {
  name: string;
  role: string;        // captain, navigator, cook, doctor, etc.
  health: number;      // 0-100, 0 = dead
  morale: number;      // 0-100
  isAlive: boolean;
}

export interface Ship {
  food: number;        // days of food remaining
  medicine: number;    // medical supplies (units)
  gold: number;        // currency for trading at islands
  hull: number;        // ship integrity 0-100
  crew: CrewMember[];
}

export interface Voyage {
  day: number;
  distanceSailed: number;    // leagues covered
  distanceTotal: number;     // leagues to destination
  currentIsland: string | null;
  weather: Weather;
  speed: number;             // leagues per day (affected by weather, hull, crew)
}

export type Weather = 'calm' | 'fair' | 'storm' | 'fog' | 'doldrums';

export interface GameEvent {
  id: string;
  text: string;
  choices: EventChoice[];
}

export interface EventChoice {
  label: string;
  key: string;         // keyboard shortcut (1, 2, 3, etc.)
  effect: (state: GameState) => GameState;
  description: string; // shown in dim text
}

export type Phase =
  | 'sailing'          // day ticks, resources drain
  | 'event'            // something happened, player chooses
  | 'island'           // docked at island, can trade/rest
  | 'victory'          // reached destination
  | 'defeat';          // everyone dead or ship sunk

export interface GameState {
  ship: Ship;
  voyage: Voyage;
  phase: Phase;
  currentEvent: GameEvent | null;
  log: string[];       // recent messages
  rng: number;         // seeded RNG state
}
