// Crew roster — shows health and morale of each crew member
// Tab to toggle visibility

import type { CrewMember } from '../engine/types';

interface Props {
  crew: CrewMember[];
}

const HEALTH_COLOR = (h: number) => h > 60 ? '#8a8' : h > 30 ? '#aa8' : '#c44';

export function CrewView({ crew }: Props) {
  return (
    <div style={{
      fontSize: 11,
      padding: '4px 0',
      borderTop: '1px solid #333',
      marginTop: 8,
    }}>
      {crew.map(c => (
        <div key={c.name} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '1px 0',
          color: c.isAlive ? '#999' : '#444',
          textDecoration: c.isAlive ? 'none' : 'line-through',
        }}>
          <span>{c.name} ({c.role})</span>
          {c.isAlive ? (
            <span>
              <span style={{ color: HEALTH_COLOR(c.health) }}>HP:{c.health}</span>
              {' '}
              <span style={{ color: '#668' }}>MR:{c.morale}</span>
            </span>
          ) : (
            <span style={{ color: '#444' }}>dead</span>
          )}
        </div>
      ))}
    </div>
  );
}
