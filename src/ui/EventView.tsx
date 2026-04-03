// Event view — shows event text and choices
// Keyboard only: press 1, 2, etc. to choose

import { useEffect } from 'react';
import type { GameEvent } from '../engine/types';

interface Props {
  event: GameEvent;
  onChoice: (index: number) => void;
}

export function EventView({ event, onChoice }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= event.choices.length) {
        onChoice(num - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onChoice]);

  return (
    <div style={{
      border: '1px solid #555',
      padding: 12,
      margin: '8px 0',
      background: '#111',
    }}>
      <div style={{ marginBottom: 8, lineHeight: 1.5 }}>{event.text}</div>
      {event.choices.map((c, i) => (
        <div key={c.key} style={{ padding: '4px 0' }}>
          <span style={{ color: '#8a8' }}>[{i + 1}]</span>{' '}
          <span>{c.label}</span>
          <span style={{ color: '#555', fontSize: 11 }}> — {c.description}</span>
        </div>
      ))}
    </div>
  );
}
