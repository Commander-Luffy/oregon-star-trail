// Status bar — ship resources at a glance
// Minimal. The numbers tell the story.

import type { Ship, Voyage } from '../engine/types';
import { livingCrew } from '../engine/crew';

interface Props {
  ship: Ship;
  voyage: Voyage;
}

const DIM = '#666';
const WARN = '#c44';

export function StatusBar({ ship, voyage }: Props) {
  const alive = livingCrew(ship.crew);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #333',
      fontSize: 12,
      marginBottom: 8,
    }}>
      <span>Day {voyage.day}</span>
      <span style={{ color: ship.food < 5 ? WARN : DIM }}>Food:{ship.food}</span>
      <span style={{ color: ship.medicine === 0 ? WARN : DIM }}>Med:{ship.medicine}</span>
      <span style={{ color: ship.hull < 30 ? WARN : DIM }}>Hull:{ship.hull}%</span>
      <span style={{ color: alive < 5 ? WARN : DIM }}>Crew:{alive}/9</span>
      <span style={{ color: DIM }}>{voyage.distanceSailed}/{voyage.distanceTotal}lg</span>
    </div>
  );
}
