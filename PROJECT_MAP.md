# Oregon Star-Trail — Project Map

**Read THIS first. Only read source files when you need to EDIT them.**

Build: `bun install && bun run dev`. Vite+React+TS.

## What

THE convergence game. Oregon Trail meets Werewolf gods (PAI council). Nobody has root.
One Piece primary narrative, open lore. Strategy + survival + story. Resource loop. Day tick.

## Structure

```
src/
├── App.tsx              — root component
├── main.tsx             — entry point
├── engine/
│   ├── crew.ts          — crew management
│   ├── events.ts        — event system
│   ├── types.ts         — type definitions
│   └── voyage.ts        — voyage/travel logic
└── ui/
    ├── CrewView.tsx      — crew display
    ├── EventView.tsx     — event display
    ├── LogView.tsx       — log display
    └── StatusBar.tsx     — status bar HUD
```

## Cross-References

- Music/Sound: soundtrack (always-on daemon provides ambient music)
- Physics/Theory: council mechanics map to AXIOM structure
