// Straw Hat crew — the party members
// Each role affects ship performance when that crew member is healthy

import type { CrewMember } from './types';

export function createCrew(): CrewMember[] {
  return [
    { name: 'Luffy',   role: 'captain',    health: 100, morale: 100, isAlive: true },
    { name: 'Zoro',    role: 'fighter',     health: 100, morale: 90,  isAlive: true },
    { name: 'Nami',    role: 'navigator',   health: 100, morale: 85,  isAlive: true },
    { name: 'Usopp',   role: 'lookout',     health: 100, morale: 70,  isAlive: true },
    { name: 'Sanji',   role: 'cook',        health: 100, morale: 90,  isAlive: true },
    { name: 'Chopper', role: 'doctor',      health: 100, morale: 95,  isAlive: true },
    { name: 'Robin',   role: 'scholar',     health: 100, morale: 80,  isAlive: true },
    { name: 'Franky',  role: 'shipwright',  health: 100, morale: 85,  isAlive: true },
    { name: 'Brook',   role: 'musician',    health: 100, morale: 100, isAlive: true },
  ];
}

// Role bonuses when crew member is alive and healthy (health > 30)
export function getRoleBonus(crew: CrewMember[], role: string): number {
  const member = crew.find(c => c.role === role && c.isAlive && c.health > 30);
  if (!member) return 0;
  return member.health / 100; // 0-1 scaling
}

// Average morale of living crew
export function getCrewMorale(crew: CrewMember[]): number {
  const living = crew.filter(c => c.isAlive);
  if (living.length === 0) return 0;
  return living.reduce((sum, c) => sum + c.morale, 0) / living.length;
}

// Count living crew
export function livingCrew(crew: CrewMember[]): number {
  return crew.filter(c => c.isAlive).length;
}
