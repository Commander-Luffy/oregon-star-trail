// Oregon Star-Trail — sail to the Moon
// Keyboard only. Space = next day. Number keys = event choices. Tab = crew. R = restart.

import { useState, useEffect, useCallback } from 'react';
import type { GameState } from './engine/types';
import { createGame, tickDay, applyChoice } from './engine/voyage';
import { StatusBar } from './ui/StatusBar';
import { LogView } from './ui/LogView';
import { EventView } from './ui/EventView';
import { CrewView } from './ui/CrewView';

export function App() {
  const [state, setState] = useState<GameState>(() => createGame());
  const [showCrew, setShowCrew] = useState(false);

  const handleNextDay = useCallback(() => {
    setState(s => {
      if (s.phase === 'event') return s; // must resolve event first
      if (s.phase === 'victory' || s.phase === 'defeat') return s;
      return tickDay(s);
    });
  }, []);

  const handleChoice = useCallback((index: number) => {
    setState(s => applyChoice(s, index));
  }, []);

  const handleRestart = useCallback(() => {
    setState(createGame());
    setShowCrew(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        handleNextDay();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowCrew(s => !s);
      }
      if (e.key.toLowerCase() === 'r' && (state.phase === 'victory' || state.phase === 'defeat')) {
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextDay, handleRestart, state.phase]);

  return (
    <div>
      <div style={{
        textAlign: 'center',
        padding: '12px 0 4px',
        fontSize: 14,
        color: '#888',
        letterSpacing: 2,
      }}>
        OREGON STAR-TRAIL
      </div>

      <StatusBar ship={state.ship} voyage={state.voyage} />
      <LogView log={state.log} />

      {state.phase === 'event' && state.currentEvent && (
        <EventView event={state.currentEvent} onChoice={handleChoice} />
      )}

      {state.phase === 'sailing' && (
        <div style={{ color: '#555', fontSize: 11, padding: '8px 0' }}>
          [Space] next day  [Tab] crew
        </div>
      )}

      {state.phase === 'victory' && (
        <div style={{
          textAlign: 'center',
          padding: 20,
          color: '#8a8',
          fontSize: 16,
        }}>
          The Moon. You made it.
          <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
            Day {state.voyage.day}. [R] to sail again.
          </div>
        </div>
      )}

      {state.phase === 'defeat' && (
        <div style={{
          textAlign: 'center',
          padding: 20,
          color: '#c44',
          fontSize: 16,
        }}>
          The voyage ends.
          <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
            Day {state.voyage.day}. [R] to try again.
          </div>
        </div>
      )}

      {showCrew && <CrewView crew={state.ship.crew} />}
    </div>
  );
}
