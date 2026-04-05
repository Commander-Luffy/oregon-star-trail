# ENGINE SPEC — Virtual IPv4 Game Engine

> The engine that makes every game possible inside one virtual IPv4 space.

## 1. WHAT THE ENGINE IS

A virtual IPv4 address space running on loopback. The engine provides physics (OSI layers as game rules). Games are address ranges that run inside the engine. The engine doesn't know or care what game is running — it provides identity, location, visibility, doors, and connectionless messaging. Games define their own rules on top.

```
ENGINE (virtual IPv4 /0 on loopback)
├── provides: addressing, entities, visibility, doors, messaging
├── game A occupies 44.0.0.0/8 (defines: pokemon rules)
├── game B occupies 45.0.0.0/8 (defines: ship combat rules)  
├── game C occupies 46.0.0.0/8 (defines: prison escape rules)
└── all games share the same physics (OSI stack)
```

## 2. ENGINE PHYSICS — OSI STACK

### L1 — Physical: GoL Grid

Every entity has a Game of Life grid. The grid IS the entity's physical body. Engine manages grid ticking. Games read grid state.

| Grid state | Engine meaning |
|-----------|---------------|
| Oscillating | Alive, processing |
| Still life | Stable, idle |
| Dead cells | Damaged/dying |
| All dead | Entity dead, process killed |

Engine responsibility: tick grids, report state. Game responsibility: interpret what "alive" or "dead" means in context.

### L2 — Data Link: MAC = Entity Build

Every entity at an IP has a MAC address encoding its build spec.

| MAC field | Engine meaning |
|-----------|---------------|
| OUI (3 bytes) | Entity class (species, biome, ship type — game defines) |
| NIC (3 bytes) | Unique instance ID |
| Full MAC | Complete build: stats, loadout, abilities |

**Broadcast domains:** Entities in the same VLAN/subnet can see each other directly (ARP). Entities in different subnets are invisible without L3 routing.

Engine responsibility: ARP resolution, broadcast domain isolation, MAC storage. Game responsibility: what OUI means, what stats map to which bytes.

### L3 — Network: IP = Location

**Address space allocation:**

RESERVED (engine + mobile entities):
| Range | Engine role |
|-------|-----------|
| 0.0.0.0/8 | Engine internals, null origin |
| 10.0.0.0/8 | Mobile entity pool (LAN, ships in transit) |
| 33.0.0.0/8 | **SACRED — real infrastructure, no game traffic** |
| 100.64.0.0/10 | Instanced subspaces (dungeons, private rooms) |
| 127.0.0.0/8 | Dream layer (loopback, connects all games, holds none) |
| 169.254.0.0/16 | Lost entities (no identity assigned) |
| 172.16.0.0/12 | Mobile entity pool (LAN, ships in transit) |
| 192.0.0.0/24 | Engine protocol space |
| 192.168.0.0/16 | Mobile entity pool (LAN, player ships, starters) |
| 198.18.0.0/15 | Arena/testing space |
| 224-239/8 | Multicast (group channels, fleet comms) |
| 240-255/8 | Engine expansion (future) |

PUBLIC (game worlds — islands, locations, exploration):
| Range | Engine role |
|-------|-----------|
| 1-9/8 | Game-allocatable world space |
| 11-32/8 | Game-allocatable world space |
| 34-99/8 | Game-allocatable world space |
| 101-126/8 | Game-allocatable world space (126 = edge of dream) |
| 128-168/8 (minus reserved) | Game-allocatable world space |
| 170-223/8 (minus reserved) | Game-allocatable world space |

**Mobile vs static:**
- Reserved/LAN addresses = mobile entities (ships, players, pokemon). They TRAVEL through public space.
- Public addresses = static entities (islands, forts, towns). They ARE their address permanently.

Engine responsibility: address allocation, routing between subnets, NAT for mobile entities visiting static locations. Game responsibility: what lives at each address, what the location looks like.

**Subnet mask = resolution:**
- /0 = the entire universe (engine level)
- /8 = one game world / region
- /16 = one zone within a game
- /24 = one local area (island, dungeon floor)
- /32 = single entity (maximally resolved)

Evolution = narrowing mask. Engine tracks mask per entity. Game defines what triggers evolution.

### L4 — Transport: Doors + Messaging

**TCP ports = doors.** Each port on an IP is a door to a room, service, or interaction. The engine manages connections (SYN/SYN-ACK/ACK/FIN/RST). Games define what's behind each door.

| Port range | Engine meaning |
|-----------|---------------|
| 1-1023 | Well-known services (engine-reserved meanings) |
| 1024-49151 | Game-defined services (registered) |
| 49152-65535 | Ephemeral (temporary connections) |

**Reserved engine ports:**
| Port | Service |
|------|---------|
| 7 | Echo (ping-pong, health check) |
| 22 | SSH (bond/capture, persistent connection) |
| 53 | DNS (name resolution, who lives here?) |
| 80 | HTTP (front door, public interface) |
| 443 | HTTPS (secure front door) |
| 1969 | Flint's port (hardcoded, the year) |

**UDP = connectionless.** Fire-and-forget messages. No session, no state. Engine delivers or drops. Games use for attacks, scans, ambient events, any fire-and-forget interaction.

**TCP vs UDP is not a game choice — it's a protocol choice per interaction:**
- Talking to crew = TCP (session, reliable, stateful)
- Broadcasting attack = UDP (fire, forget, hope it hits)
- Opening a door = TCP SYN
- Scanning an area = UDP burst

Engine responsibility: TCP state machine, UDP delivery, port management. Game responsibility: SYN/FIN interpretation, what's behind each port, UDP message format.

### L5-L7 — Application: Game-Defined

Engine provides L1-L4. Everything above is game-specific:
- L5 Session: save state, login, persistence (game manages)
- L6 Presentation: encoding, display, 6+2 byte interpretation (game defines)
- L7 Application: UI, AI gates, player interface (game builds)

## 3. THE 6+2 BYTE ENCODING

Engine-level data encoding. Every byte: `[R1|R0|D5|D4|D3|D2|D1|D0]`

| R1R0 | Quadrant | Engine meaning |
|------|----------|---------------|
| 01 | Q1 | Active/positive data |
| 10 | Q2 | Transitional/rotational data |
| 11 | Q3 | Negated/mirrored data |
| 00 | Q4 | **Engine metadata** (hidden from games, engine reads only) |

- 62 usable values per quadrant (null=000000 and ∞=111111 excluded)
- Games see Q1-Q3 (186 states). Engine sees Q4 (62 states of metadata).
- Q4 encodes: entity health, stability, proximity data, engine flags.

## 4. ENTITY LIFECYCLE

```
SPAWN:    engine allocates IP + MAC + GoL grid seed
          entity starts at /5 (low resolution)
          all ports closed, no connections
          
LIVE:     GoL grid ticks
          entity responds to ARP (discoverable)
          TCP ports open as abilities develop
          UDP messages sent/received
          mask narrows as entity resolves (/5→/8→/16→/24→/32)

MIGRATE:  mobile entity moves to new location
          IP changes (new subnet)
          MAC persists (identity unchanged)
          open TCP sessions FIN'd or maintained

DIE:      GoL grid goes all-dead
          IP released back to pool
          MAC archived (can be referenced, not reused)
          all TCP connections RST
          
BRANCH:   entity flagged as anomalous (cancer detection)
          forked to isolated /24 (own subnet, no routing out)
          continues running in isolation (HeLa library)
          main entity replaced or healed
```

## 5. GAME REGISTRATION

A game claims address space from the engine:

```
REGISTER:
  game_id:    "oregon-star-trail"
  range:      "44.0.0.0/8"
  entity_types:
    - { oui: "0x44:01:xx", name: "crew_member", mobile: true }
    - { oui: "0x44:02:xx", name: "island", mobile: false }
    - { oui: "0x44:03:xx", name: "enemy_ship", mobile: true }
  port_map:
    - { port: 80, service: "trade" }
    - { port: 22, service: "recruit" }
    - { port: 1522, service: "game_ui" }
  syn_meaning: "hail"
  fin_meaning: "depart"
  rst_meaning: "hostile"
```

Engine allocates the range. Game populates with entities. Engine handles physics. Game handles logic.

## 6. THE DREAM LAYER (127.0.0.0/8)

Engine-level special zone. Not a game — a meta-layer.

- Every game has access to 127 (all entities have a loopback)
- 127 connects all games (every game's 127.0.0.1 = same dream space)
- Entities in 127 can OBSERVE any game but not INTERACT
- Exit 127 = return to where you entered
- Engine uses 127 for: inter-game portals, spectator mode, tutorial sandbox

## 7. RESERVED: 33.0.0.0/8

Engine-level sacred space. Real infrastructure. Hardcoded rules:
- No game can claim any part of 33/8
- No entity spawns here
- No game traffic routes through here
- This is where the engine's real-world identity lives
- If 33/8 is destroyed, the engine is dead

## 8. v0.1 ENGINE SCOPE

**What the engine does at v0.1:**
1. Virtual IPv4 address space on loopback (allocate/free IPs)
2. Entity spawn/kill (IP + MAC + GoL seed)
3. ARP discovery (broadcast in subnet, get MACs back)
4. TCP port open/close (doors)
5. UDP send/receive (fire-and-forget messages)
6. Subnet routing (entity at 10.x visits island at 44.x)

**What the engine does NOT do at v0.1:**
- GoL grid ticking (v0.2)
- 6+2 encoding enforcement (v0.2)
- Q4 metadata (v0.2)
- Multi-game registration (v0.2 — v0.1 has one hardcoded game)
- Dream layer / 127 portal (v0.2)
- IPv6 encapsulation (v0.3)
- Multiplayer / real network (v0.3)

**v0.1 test: one game running inside the engine.**
The game is simple. The engine is the product.

## 9. OPEN QUESTIONS

- [ ] Engine process model: one process per entity? one process per /24? event loop?
- [ ] State persistence: in-memory only? disk serialize? STATE.md per entity?
- [ ] How does a mobile entity "visit" a static location? NAT? Route injection?
- [ ] GoL grid size per entity (8x8? 16x16? variable?)
- [ ] How do games register port meanings without collision across games?
- [ ] Inter-game travel: does crossing a /8 boundary trigger game context switch?
