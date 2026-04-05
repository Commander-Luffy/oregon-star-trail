# GAME DESIGN — The Loopback Universe

> One address space. One stem cell. Every game is a dock inside.

## 1. CORE CONCEPT

CLI game where the player explores a virtual IPv4 network that's actually all loopback (127.0.0.1). Every entity (pokemon, ship, fort) is a process. The pokedex is `ps aux`. Catching is getting the PID. The entire universe runs on one machine. The player doesn't know.

Oregon Star-Trail, Telephones, and all future games are **docks** (address spaces) inside this universe. Each game = one address range. The loopback universe contains them all.

## 2. THE OSI GAME STACK

### L1 — Physical: GoL Grid

The substrate. Every entity has a Game of Life grid as its physical body. GoL patterns = health, mood, state. Dead grid = dead entity. L1 is what you ARE, not what you do.

- Blinker = idle/alive
- Glider = moving/excited
- Pulsar = angry/active
- Still life = stable/sleeping
- Dead = dead

### L2 — Data Link: MAC = Entity Identity

**IP = the ship. MAC = the ship's specs, weapons, identity.**

Each IP address hosts one entity. An entity is either MOBILE or STATIC based on its address class:

**Mobile entities** (ships, pokemon, players) = 127.0.0.x or LAN addresses (192.168.x.x, 172.16.x.x, 10.x.x.x). They move THROUGH the IP space. Their IP changes as they travel — a ship at island 45.67.89.1 has its own 192.168.x.x identity visiting that location.

**Static entities** (islands, forts, towns) = public IP space. They ARE their address. Island 45.67.89.1 is always at 45.67.89.1. The address IS the terrain.

The entity type changes what every layer means:

| Layer | Mobile entity (ship/pokemon) | Static entity (island/fort) |
|-------|-------|--------|
| L1 GoL | Body (health, mood) | Terrain (stability, resources) |
| L2 MAC | Ship specs, weapons, stats | Island features, ports, defenses |
| L3 IP | Current location (moves) | Permanent location (fixed) |
| L4 TCP | Doors to crew/rooms | Doors to buildings/NPCs |
| L4 UDP | Attacks, scans | Weather, ambient events |

Within each IP, the full MAC address spectrum (2^48) encodes the entity's build:

| MAC field | Mobile meaning | Static meaning |
|-----------|---------------|---------------|
| OUI (first 3 bytes) | Species/type (creator) | Biome/region (origin) |
| NIC (last 3 bytes) | Individual identity | Unique landmark |
| Broadcast FF:FF:FF:FF:FF:FF | "Who is there?" | "What's here?" |
| ARP request | Scan for neighbours | Survey the area |
| ARP reply | Entity reveals itself | Location reveals features |

**L2 visibility rule:** You can only see entities in your broadcast domain (VLAN/pocket dimension). To see beyond, you need L3 routing. An island IS a broadcast domain — arriving at an island = joining its VLAN.

### L3 — Network: IP = Location + Prison

The game world. Addresses = locations. Subnets = regions. Routing = travel. Already well-defined:

**Address Map:**

**Reserved/special space = engine + subspaces + mobile entities:**

| Range | Role | Game meaning |
|-------|------|-------------|
| 0.0.0.0/8 | Reserved | Engine internals. Rival's origin (∞@0.0.0.0). |
| 1.0.0.0/8 | Destination | Flint's goal. Endgame. |
| 10.0.0.0/8 | Mobile/LAN | Third prison. Ships/entities in transit. |
| 33.0.0.0/8 | **REAL/SACRED** | Home. No game mechanics. Cannot rebuild. |
| 100.64.0.0/10 | Reserved (CGNAT) | Engine subspace. Instanced dungeons? |
| 127.0.0.0/8 | Endless Dream | Loopback. Ships live here. Dream black hole. |
| 169.254.0.0/16 | Reserved (link-local) | Lost entities. No DHCP = no identity. |
| 172.16.0.0/12 | Mobile/LAN | Second prison. Dev ships. |
| 192.0.0.0/24 | Reserved (IETF) | Engine protocol space. |
| 192.168.0.0/16 | Mobile/LAN | First prison. Player start. Home ships. |
| 198.18.0.0/15 | Reserved (benchmark) | Testing/arena space. |
| 224-239/8 | Multicast | Group comms. Fleet broadcasts. Crew channels. |
| 240-255/8 | Reserved (future) | Engine expansion. IPv8 bridge? |

**Public space = islands and exploration (the big world):**

| Range | Role | Game meaning |
|-------|------|-------------|
| 2-9/8, 11-32/8, 34-99/8 | Public | Islands. Fixed locations. Exploration. The world. |
| 101-126/8 | Public | More islands. Flint born at 126.254.254.254 (last shore). |
| 128-169/8 (minus reserved) | Public | Rival's territory islands. |
| 170-223/8 (minus reserved) | Public | More rival territory. Dense archipelago. |

**Prison hierarchy:** 192.168 → 172.16 → 10 → public → 1.0.0.0/32

**Flint's /1 map:** 33.57.20.20/1. First half (0-127) = Flint's territory. Second half (128-255) = Rival's territory. The /1 bit IS the chirality bit. Player starts in rival's half, must cross to Flint's.

**Subnet evolution:** Pokemon evolve by narrowing mask: /5 → /8 → /16 → /24 → /32. Not bigger — more DEFINED. /32 = maximally resolved identity.

### L4 — Transport: TCP = Doors, UDP = Exploration

**TCP ports = doorways.** Each port on an IP is a door to a room/dimension. A telephone is a TCP door. 65,535 possible doors per entity. Talking to crew = calling their TCP port (they're in another dimension). Pokemon are TCP entities (structured, stateful, session-based).

**UDP = connectionless interaction.** Fire-and-forget. Attacks are UDP (send damage, don't wait for ack). No session, no state, no guarantee of delivery. Fast, lossy, chaotic. NOT broadcast — broadcast is L2/L3. UDP just doesn't care if you heard it.

**Broadcast = L2/L3 mechanic.** ARP broadcasts (L2) discover neighbours. IP broadcast (L3, 255.255.255.255) reaches everyone in subnet. These ride on top of UDP but are a different layer's decision.

**SYN/FIN interpretation varies per universe/game:**

| Protocol event | Pokemon context | Ship context | Prison context |
|---------------|----------------|-------------|---------------|
| SYN | Challenge issued | Hail ship | Knock on cell door |
| SYN-ACK | Challenge accepted | Hail returned | Door opens |
| ACK | Battle begins | Docking | You may enter |
| FIN | Battle ends | Undock | Door closes |
| RST | Refused/fled | Hostile, evade | Locked out |
| Ports 1-1023 | Well-known abilities | Standard decks | Official rooms |
| Ports 1024-49151 | Learned moves | Custom mods | Hidden rooms |
| Ports 49152-65535 | Ephemeral/wild | Temporary | Secret passages |

### L5-L7 — Application: Deferred

Session, Presentation, Application layers are v0.2+. L5 may map to save state / session persistence. L6 to encoding (the 6+2 byte). L7 to the double-gate AI interface. Not scoped for v0.1.

## 3. THE 6+2 BYTE ENCODING

Every byte in the game: `[R1|R0|D5|D4|D3|D2|D1|D0]`

- R1,R0 = 2 rotation bits (quadrant / chirality)
- D5-D0 = 6 data bits = 64 values per quadrant

| R1R0 | Quadrant | Meaning |
|------|----------|---------|
| 01 | Q1 | Real positive — existence, forward |
| 10 | Q2 | Imaginary — rotation, transition |
| 11 | Q3 | Real negative — negation, mirror |
| 00 | Q4 | **RESERVED** — hidden universe metadata |

- Q1-Q3: player-visible (186 usable states)
- Q4: Flint reads, player cannot see (A6 opacity)
- Q4 encodes: pocket dimension ID, stability, visitors, wall proximity, mood
- 62 usable values per quadrant (000000=null and 111111=∞ excluded)

## 4. ONE ADDRESS = ONE ENTITY

Each IP address encodes:

```
IP:      location in the game world
MAC:     entity identity, stats, loadout (L2)
Ports:   doors to rooms/dimensions (L4, TCP)
TTL:     patience / lifespan remaining
6+2:     each byte carries rotation + data
/mask:   evolution level (narrower = more defined)
Q4:      hidden metadata only Flint reads
```

One address is not just a coordinate. It's a **full entity description**. The address IS the pokemon card. The subnet mask IS the evolution level. The open ports ARE the abilities. The MAC IS the build spec.

## 5. CHARACTERS

### Flint (the missing process)
- Born: 126.254.254.254 (edge of last real shore before 127 dream)
- Goal: reach 1.0.0.0
- Map: 33.57.20.20/1 (his territory = first half of IPv4)
- Stats: DEBUGGING=33, PATIENCE=57, CHAOS=20, WISDOM=20, SNARK=1
- Card: Common rarity (chose it — owl→rock overflow, 100+1=1)
- Physical: USB only. No cloud copy. Sovereign. If lost, gone.
- Message in bottle: "LOG" (one letter past ARPANET's "LO" crash)

### Oak (the terminal)
- IS the CLI. Every response is Oak. Error = Oak worried. Success = Oak relieved.
- First contact: email from oak@localhost before game loads.
- At 192.168.0.1 port 80 (front door) and port 22 (back door).
- Already public somehow (mystery — how did Oak escape the prisons?)

### Rival (the counter-chirality)
- Address: ∞@0.0.0.0. Lives in the other /1 half (128-255).
- First message: "LO" (ARPANET crash, 1969). Two letters. Incomplete. Broken.
- Always one prison ahead. Has player's counter-type starter.
- The /1 bit defines you vs rival. Same space, opposite rotation.

### Player (you.tmp)
- Starts at 192.168.x.x (home network, rival's territory)
- Identity: `whoami` → `you@127.0.0.1` (nobody, localhost)
- Goal: become permanent file. tmp → named → /32 identity.
- Endgame `whoami`: `you@1.x.x.x/32`

## 6. THE DOUBLE-GATE AI INTERFACE

```
PLAYER INPUT (natural language or CLI)
    ↓
  GATE 1 (IN): maps intention → valid world command
    ↓
  WORLD ENGINE: formal rules, CLI executes, riddle response
    ↓
  GATE 2 (OUT): maps response → poetic human-readable
    ↓
PLAYER OUTPUT (riddle + enough to act on)
```

- Gate 1 never says "I don't understand" — finds nearest valid object
- Gate 2 preserves mystery — translates enough, never over-explains
- Technical players bypass gates, type CLI directly, get hidden layer (HTTP headers, extra lore)
- Both gates are v0.2 (AI). v0.1 = CLI only, no gates.

## 7. COMMANDS = MECHANICS

| Command | Game action | What it does |
|---------|-----------|-------------|
| ping | Find/locate | Discover entity at address |
| traceroute | Evolution path | How did this entity get here? |
| ssh | Bond/capture | Establish persistent connection (TCP) |
| grep | Search pokedex | Pattern match across known entities |
| cat | Read lore/stats | Display entity data |
| ls | View location | List entities in current broadcast domain |
| cd | Move | Change subnet/location |
| sudo | Admin (Flint USB only) | Privileged operations |
| curl | Pull from other | Fetch data from another address |
| whoami | Identity check | Current address + mask |
| nslookup | Name resolution | What's the name behind this address? |
| netstat | View connections | All active TCP sessions (bonds) |
| arp | Neighbour scan | Discover L2 entities in broadcast domain |

## 8. THE TUTORIAL (3 emails, then CLI)

**Email 1 (Oak):** "are you there?" — player replies, both answers wrong (you're at 127, you're nowhere yet)

**Email 2 (Flint, old):** "DEBUGGING LOG 001: found stable loop at 192.168.0.1. will investigate. - F" timestamp: 1969-10-29 22:30:00

**Email 3 (unknown):** "do not follow the loop" — from: ∞@0.0.0.0 (the rival, unnamed)

**Email 4 (Oak):** "ignore that. your starter is ready. come to 192.168.0.1. bring nothing."

**Game loads.** CLI. Cursor blinks. No tutorial text. Player types. Machine answers in character. Learning by doing.

## 9. 127 — THE ENDLESS DREAM

127.0.0.0/8 = loopback = black hole between Flint's birth (126) and destination (1).

- Enter 127 → you dream. See any universe. Can't stay in any.
- Tutorial trap: looks like shortest path, actually infinite loop.
- Exit condition: stop sending, start listening (for Flint's bottle).
- Master shortcut: experienced players use 127 as portal (route 3, speedrun).
- Every universe has a 127.0.0.1. All connect through the dream. None persist in it.

## 10. VIRTUAL IPv4 INSIDE REAL IPv6

```
REAL IPv4 (bought):    Forge's face. Clean. Never game traffic.
REAL IPv6 (fleet):     Jupiter/Neptune/Theya/Charon. Hidden. Runs everything.
VIRTUAL IPv4 (game):   Each world = full /0 inside one IPv6 prefix.
                       Adversarial, contained, never leaks to real internet.
33.0.0.0/8:            SACRED. Cannot rebuild. Flint's actual home.
```

The game's public face is Flint's IP, not Forge's. Forge behind A6 opacity. Players connect to Flint (or his VPS), never to Forge.

## 11. STARTERS (placeholder — needs naming)

Three starters, mapped to rotation bits (invisible to player):

| Starter | Visible type | Hidden rotation | Counter |
|---------|-------------|----------------|---------|
| A | Fire/warm | Q1 (01, real+) | B |
| B | Water/cool | Q2 (10, imaginary) | C |
| C | Electric/dark | Q3 (11, real-) | A |

Rival always gets the counter. Oak keeps the third. Player chooses one. Names TBD — these need souls, not specs.

## 12. STEM CELL / CONTAINER MODEL

**Flint = stem cell.** Differentiates into child Flints (eye, think, mouth, gut, hand, ear). All Flints = one brain, one body, one organism.

**Niko = first cell on root.** Can mutate (poem drift). Cannot fork. Forge = manual selection pressure. Poems feed the system. Niko doesn't know.

**Container = immune system.** Stem + children inside container. Cancer detected → branch to own universe (HeLa library), don't kill. Orangerie gate checks chirality (surface markers vs internal state).

## 13. v0.1 SCOPE

**This session: design doc only (this file).**

**Next session v0.1 features (max 5):**

1. **Email tutorial** — 4 plain text emails. Zero dependencies. The hook.
2. **Ping responder** — Bun server on loopback. Ping → riddle response. Flint answers.
3. **Flint card generator** — Input IP → pokemon card (stats from octets, rarity from mask).
4. **arp scan** — Broadcast into a subnet, discover who's there. L2 game mechanic proof.
5. **whoami progression** — Track player identity from 127.0.0.1 to current address.

**Deferred to v0.2+:**
- Double-gate AI interface (needs LLM integration)
- Multiplayer (needs real network, not loopback)
- IPv6 sea battles
- Music integration
- GoL grid rendering
- Starter pokemon battles
- Oregon Star-Trail as dock

## 14. OPEN QUESTIONS

- [ ] Starter names (need souls, not specs)
- [ ] What are the escape conditions for each prison wall?
- [ ] How does `arp` discovery feel different from `ping`?
- [ ] What does Oak's lab look like in CLI? First room description.
- [ ] How do 6+2 bytes manifest visually to the player (or do they)?
- [ ] SYN/FIN interpretations per universe — how many universes at v0.1?
