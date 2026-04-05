#!/usr/bin/env bun
/**
 * IPv4 Game Engine v0.3
 *
 * IP = location (island, town, node). Always.
 * MAC = entity (pokemon, NPC, player). Always.
 * TCP ports = services at a location (pokemon center, shop, dock). Persistent.
 * UDP = events and attacks. Exist then don't.
 * C.D = 256×256 interior grid within each A.B island.
 * /mask = identity tier (who you are, not what you see).
 * /30 = minimum arena (net + 2 hosts + broadcast = past/present/future).
 */

import * as readline from "readline"

// --- TYPES ---

type FSMState = "idle" | "alert" | "gone"

interface MACEntity {
  mac: string
  name: string
  species: string
  hp: number
  maxHp: number
  atk: number
  desc: string
  hostile: boolean
  x: number
  y: number
  fsmState: FSMState
  fsmTick: number // tick when state last changed
}

interface TCPService {
  port: number
  name: string
  desc: string
  handler: (state: GameState) => string
}

interface GridCell {
  terrain: string // "open" | "wall" | "water" | "door"
  item?: string
  desc?: string
}

interface Location {
  ip: string
  name: string
  desc: string
  fs: Record<string, string | Record<string, string>>
  entities: MACEntity[]
  services: TCPService[]
  udpEvents: string[]
  discovered: boolean
  grid: Map<string, GridCell> // sparse grid, key = "x,y"
  phase: "calm" | "storm" | "locked"
  phaseTick: number
}

interface ArenaState {
  net: string      // .0 — the ring, past, rules
  host1: string    // .1 — player
  host2: string    // .2 — opponent
  broadcast: string // .3 — attacks, effects, crowd/fates
  mode: "wild" | "tournament"
  player: MACEntity | { name: string; hp: number; maxHp: number; atk: number }
  opponent: MACEntity
  history: string[]  // .0 — accumulated past
  round: number
  weatherEffect: string | null // wild mode only
}

interface Player {
  mac: string
  name: string
  currentIP: string
  cwd: string
  mask: number
  crew: MACEntity[]
  log: string[]
  inventory: string[]
  ttl: number
  x: number
  y: number
}

interface GameState {
  player: Player
  locations: Map<string, Location>
  tick: number
  arena: ArenaState | null
  gameOver: boolean
}

// --- MASK TIERS ---

function maskTierLabel(mask: number): string {
  if (mask <= 1) return "ANOMALY"
  if (mask <= 4) return "GM/ORACLE"
  if (mask <= 5) return "BOSS/RIVAL"
  if (mask <= 6) return "PLAYER"
  if (mask <= 8) return "NAVIGATOR"
  if (mask <= 16) return "ISLAND LORD"
  if (mask <= 24) return "TRAINER"
  if (mask <= 30) return "ENGINEER"
  if (mask <= 31) return "WHISPER"
  return "SELF"
}

// --- WORLD GENERATION ---

function generateMAC(): string {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join(":")
}

function makeEntity(name: string, species: string, hp: number, atk: number, desc: string, hostile = false, x = 0, y = 0): MACEntity {
  return { mac: generateMAC(), name, species, hp, maxHp: hp, atk, desc, hostile, x, y, fsmState: "idle", fsmTick: 0 }
}

function makeService(port: number, name: string, desc: string, handler: (s: GameState) => string): TCPService {
  return { port, name, desc, handler }
}

function makeGrid(features?: Array<{ x: number; y: number; cell: GridCell }>): Map<string, GridCell> {
  const grid = new Map<string, GridCell>()
  if (features) {
    for (const f of features) grid.set(`${f.x},${f.y}`, f.cell)
  }
  return grid
}

function generateWorld(): Map<string, Location> {
  const locs = new Map<string, Location>()

  // === PLAYER START: Oak's Lab ===
  locs.set("192.168.0.1", {
    ip: "192.168.0.1",
    name: "Oak's Lab",
    desc: "A small lab at the edge of home network. Screens flicker with packet traces. A note on the desk reads: 'If you find Flint, tell him the loops are unstable.'",
    fs: {
      "welcome.txt": "you woke up here. you don't remember arriving.\noak left the terminal running. the door is open.",
      "oak-note.txt": "something at 126.254.254.254 has been calling\nfor longer than this network has existed.\ni've gone ahead to check the outer islands.\nuse the registry if you need names.\n- oak",
      logs: {
        "access.log": "192.168.0.1 - - [29/Oct/1969:22:30:00] \"GET /flint HTTP/0.9\" 200\n192.168.0.1 - - [29/Oct/1969:22:30:01] \"GET /flint HTTP/0.9\" 200\n...(56 million more entries)...",
        "error.log": "warn: loop stability declining\nwarn: entity at 126.254.254.254 unresponsive to FIN\nwarn: unknown signal from 128.0.0.1",
      },
      starters: {
        "README.txt": "three starters. pick one. the others will find their own way.\neach has a type. each type has a counter.\nchoose with: catch <name>",
        "igniq.dat": "IGNIQ\nspecies: SYN-type\nthe one that initiates. warm. eager.\nhp: 40  atk: 12\n\"every connection starts with a SYN\"",
        "coolant.dat": "COOLANT\nspecies: ACK-type\nthe one that confirms. calm. reliable.\nhp: 55  atk: 8\n\"nothing moves without acknowledgment\"",
        "voidling.dat": "VOIDLING\nspecies: RST-type\nthe one that refuses. dark. decisive.\nhp: 30  atk: 16\n\"some connections should never complete\"",
      },
    },
    entities: [
      makeEntity("Igniq", "SYN-type", 40, 12, "Small, warm, eager to connect. Chirps when pinged.", false, 3, 2),
      makeEntity("Coolant", "ACK-type", 55, 8, "Cool, smooth, confirms everything. Nods slowly.", false, 5, 4),
      makeEntity("Voidling", "RST-type", 30, 16, "Dark, quick, cuts connections. Hisses at strangers.", false, 1, 6),
    ],
    services: [
      makeService(80, "Registry", "Oak's name registry", (s) => {
        const discovered = Array.from(s.locations.values()).filter(l => l.discovered)
        return `DNS REGISTRY (${discovered.length} entries):\n` +
          discovered.map(l => `  ${l.ip.padEnd(20)} ${l.name}`).join("\n")
      }),
      makeService(22, "Terminal", "Oak's research terminal", (_s) =>
        "oak@lab:~$ cat /var/log/theories\n\nthe addresses are not random.\nthe /8 blocks are continents.\nthe /16 zones are regions.\nthe /24 districts are neighborhoods.\nthe /32 addresses are rooms.\n\nand something is wrong with 127.\neverything that enters comes back changed.\nor doesn't come back."
      ),
      makeService(443, "Medbay", "restore TTL", (s) => {
        const { ttlRestored } = healPlayer(s, 16)
        return `MEDBAY\n\nthe machine hums. packets realigned.\nTTL restored by ${ttlRestored}. current TTL: ${s.player.ttl}/64`
      }),
    ],
    udpEvents: [
      "a packet fragment drifts through the window. unreadable.",
      "the lights flicker. the network hiccupped.",
      "you hear a distant echo: L... O... G...",
    ],
    discovered: true,
    grid: makeGrid([
      { x: 0, y: 0, cell: { terrain: "door", desc: "the lab entrance. packets come and go." } },
      { x: 3, y: 2, cell: { terrain: "open", desc: "a warm spot. something chirps here.", item: "potion" } },
      { x: 5, y: 4, cell: { terrain: "open", desc: "a cool corner. acknowledgments float in the air." } },
      { x: 1, y: 6, cell: { terrain: "open", desc: "a dark alcove. connections get cut short here." } },
      { x: 8, y: 8, cell: { terrain: "door", desc: "back door. port 22. oak's terminal." } },
    ]),
    phase: "calm",
    phaseTick: 0,
  })

  // === SHELL ATOLL ===
  locs.set("44.88.0.1", {
    ip: "44.88.0.1",
    name: "Shell Atoll",
    desc: "Low-lying coral made of discarded command histories. The sand is semicolons. Tide pools hold forgotten processes.",
    fs: {
      "beach.txt": "shells everywhere. each one is an old command.\n$ ls\n$ cd\n$ rm -rf\nthat last one is cracked.",
      "tidepool.txt": "small processes swim in circles.\nthey've been here since someone typed 'nohup' and forgot.",
      caves: {
        "deep.txt": "the cave gets darker. your terminal can barely render.\nsomething scratched into the wall: 'TTL=1 was here'",
        "treasure.txt": "a chest. inside: a MAC address written on driftwood.\n4f:41:4b:00:00:01\n(that's Oak's MAC. what is it doing here?)",
      },
    },
    entities: [
      makeEntity("Pinglet", "ICMP-type", 20, 4, "Tiny. Sends out a chirp and waits. If you chirp back, it follows you.", false, 2, 1),
      makeEntity("Shellcrab", "BASH-type", 35, 10, "Hard exterior. Interprets everything literally. Watch your escapes.", true, 6, 3),
    ],
    services: [
      makeService(80, "Tiki Bar", "rest and recover", (s) => {
        const { ttlRestored } = healPlayer(s, 8, true, 10)
        return `welcome to the Shell Atoll Tiki Bar.\ndrinks are free but the tab is stored in /dev/null.\nyour crew recovers 10 hp each. TTL +${ttlRestored}.\ncurrent TTL: ${s.player.ttl}/64`
      }),
    ],
    udpEvents: [
      "a wave crashes. it carried a SYN packet from somewhere far.",
      "a Pinglet chirps at you from the rocks.",
      "the tide is going out. old sockets exposed in the sand.",
    ],
    discovered: false,
    grid: makeGrid([
      { x: 0, y: 0, cell: { terrain: "open", desc: "sandy shore. semicolons crunch underfoot." } },
      { x: 2, y: 1, cell: { terrain: "open", item: "shell-fragment" } },
      { x: 6, y: 3, cell: { terrain: "open", desc: "a rocky outcrop. something moves." } },
    ]),
    phase: "calm",
    phaseTick: 0,
  })

  // === HANDSHAKE HARBOR ===
  locs.set("52.120.0.1", {
    ip: "52.120.0.1",
    name: "Handshake Harbor",
    desc: "Three docks. You must visit all three in order: SYN dock, SYN-ACK dock, ACK dock. Only then may you trade. The harbor master is strict about protocol.",
    fs: {
      "rules.txt": "HARBOR RULES:\n1. approach SYN dock first\n2. wait for SYN-ACK dock to respond\n3. proceed to ACK dock\n4. you may now trade\n\nviolators will be RST'd",
      "syn-dock": {
        "sign.txt": "DOCK 1: SYN\nstate your business.\n(just being here counts as stating it)",
      },
      "ack-dock": {
        "sign.txt": "DOCK 3: ACK\nwelcome. trade is open.\nbrowse the market: connect 80",
        "market-list.txt": "FOR SALE:\n- RST-bomb (50 coins) — force-close any connection\n- TTL-extender (30 coins) — survive one more hop\n- MAC-mask (100 coins) — disguise your identity",
      },
    },
    entities: [
      makeEntity("Harbormaster", "TCP-type", 99, 0, "Enormous. Blocks the dock until protocol is satisfied. Cannot be fought. Only obeyed.", false, 4, 0),
      makeEntity("Synphin", "SYN-type", 25, 8, "Graceful. Initiates contact with everything. Leaps between docks.", false, 1, 2),
      makeEntity("Ackray", "ACK-type", 30, 6, "Flat, wide. Only appears after a successful handshake.", false, 7, 2),
    ],
    services: [
      makeService(80, "Market", "trade post", (s) => {
        let output = "HANDSHAKE HARBOR MARKET\n\nthe merchant nods three times. (SYN. SYN-ACK. ACK.)\n\n"
        output += "  TTL-extender  — 1 crew slot → +16 TTL\n"
        if (s.player.crew.length > 0) {
          output += "\n(use: buy ttl-extender)"
        } else {
          output += "\n(you have no crew to trade. catch entities first.)"
        }
        return output
      }),
      makeService(443, "Vault", "secure storage", (_s) =>
        "SECURE VAULT\ncertificate required.\nyou don't have one yet.\n(earn certificates by completing island quests)"
      ),
    ],
    udpEvents: [
      "a trader shouts prices across the harbor. UDP — no guarantee you heard right.",
      "a Synphin leaps between the docks, leaving ripples.",
      "someone got RST'd at dock 1. didn't follow protocol.",
    ],
    discovered: false,
    grid: makeGrid([
      { x: 1, y: 2, cell: { terrain: "open", desc: "SYN dock. step 1." } },
      { x: 4, y: 2, cell: { terrain: "open", desc: "SYN-ACK dock. step 2." } },
      { x: 7, y: 2, cell: { terrain: "open", desc: "ACK dock. step 3. trade opens." } },
    ]),
    phase: "calm",
    phaseTick: 0,
  })

  // === FIREWALL CLIFFS ===
  locs.set("67.200.0.1", {
    ip: "67.200.0.1",
    name: "Firewall Cliffs",
    desc: "Sheer walls. Nothing gets in without inspection. The guards check every byte. Below the cliffs, wrecks of packets that didn't pass inspection.",
    fs: {
      "warning.txt": "FIREWALL CLIFFS INSPECTION ZONE\nall traffic subject to deep packet inspection.\ncontraband: malformed headers, spoofed MACs, expired TTLs.\npenalty: DROP.",
      wreckage: {
        "ss-telnet.txt": "the wreck of SS Telnet.\ncleartext cargo spilled everywhere.\npasswords visible to anyone who looks.\nthis is why we have the cliffs.",
        "hms-ftp.txt": "HMS FTP. ran aground trying to use passive mode.\nthe data channel opened but nobody came.",
      },
    },
    entities: [
      makeEntity("Gatesnake", "FILTER-type", 60, 14, "Coiled at the entrance. Decides what passes. Fair, but firm.", true, 4, 1),
      makeEntity("Dropbear", "DROP-type", 45, 18, "Falls from above. Your packets don't always survive.", true, 7, 5),
    ],
    services: [
      makeService(80, "Inspection", "get your packets inspected", (s) => {
        if (s.player.ttl < 10) {
          return "INSPECTION OFFICE\n\nthe inspector frowns.\n\"TTL too low. you barely made it here.\nrecommend rest before proceeding.\"\ncurrent TTL: " + s.player.ttl
        }
        return "INSPECTION OFFICE\n\nthe inspector looks at your headers.\n\"clean enough. you may pass.\"\ncurrent TTL: " + s.player.ttl
      }),
    ],
    udpEvents: [
      "a Dropbear falls from the cliff. something got DROPped.",
      "you hear a Gatesnake hiss: 'DENY from 0.0.0.0/0'",
      "an old packet, rejected, floats by. its TTL expired long ago.",
    ],
    discovered: false,
    grid: makeGrid([
      { x: 4, y: 1, cell: { terrain: "wall", desc: "the gate. a snake coils here." } },
      { x: 7, y: 5, cell: { terrain: "open", desc: "cliff edge. something drops from above." } },
    ]),
    phase: "calm",
    phaseTick: 0,
  })

  // === LATENCY LAGOON ===
  locs.set("89.50.0.1", {
    ip: "89.50.0.1",
    name: "Latency Lagoon",
    desc: "Calm. Beautiful. Everything happens... eventually. The water moves in slow motion. Time feels thicker here. Patience is survival.",
    fs: {
      "surface.txt": "the water is perfectly still.\nyour reflection takes a moment to catch up.\neverything here is delayed. including you.",
      depths: {
        "slow-fish.txt": "fish swim in slow motion.\neach one carries a packet with a very high RTT.\nthey don't mind. they've always been slow.",
        "clock.txt": "a clock on the seabed.\nit's accurate. it's just... behind.\nthe time reads: three minutes ago.",
      },
    },
    entities: [
      makeEntity("Driftskate", "DELAY-type", 40, 6, "Flat, glides on currents. Goes wherever the traffic flows. Very slowly.", false, 3, 3),
      makeEntity("Bufferfly", "BUFFER-type", 35, 5, "Stores everything it touches. Beautiful but eventually overflows.", false, 5, 5),
      makeEntity("Pulsaroo", "TIMING-type", 50, 10, "Hops in regular intervals. You can set your clock by it.", false, 8, 2),
    ],
    services: [
      makeService(80, "Rest Point", "heal and wait", (s) => {
        healPlayer(s, 24)
        s.tick += 2
        worldTick(s)
        worldTick(s)
        return `LAGOON REST POINT\n\nthe water heals. slowly.\n2 ticks pass. TTL restored to ${s.player.ttl}/64.\nyour crew gains patience.\n(you feel rested. but time moved.)`
      }),
    ],
    udpEvents: [
      "a ripple reaches you. it started an hour ago.",
      "a Bufferfly lands on your shoulder. it's storing this moment.",
      "the lagoon hums. a very low frequency. very long wavelength.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // === FRAGMENT FALLS ===
  locs.set("103.75.0.1", {
    ip: "103.75.0.1",
    name: "Fragment Falls",
    desc: "A waterfall that arrives in pieces. Each fragment tumbles down at its own pace. Stand in the right spot and they reassemble into something beautiful.",
    fs: {
      "base.txt": "the falls roar. but the sound arrives in chunks.\neach chunk is a fragment of the full message.\nif you collect them all, you hear the whole thing.",
      fragments: {
        "frag-1.txt": "...the first part of something. 'In the beginning was the...'",
        "frag-2.txt": "...packet. And the packet was with the...'",
        "frag-3.txt": "...router. And the router said: let there be...'",
        "frag-4.txt": "...forwarding.' And there was forwarding. And it was good.'",
      },
    },
    entities: [
      makeEntity("Packetmoth", "FRAG-type", 25, 7, "Drawn to light signals. Carries data fragments on its wings.", false, 2, 4),
      makeEntity("Routewyrm", "ROUTE-type", 55, 12, "Long, segmented. Knows every path. Follows the shortest one instinctively.", false, 6, 6),
    ],
    services: [
      makeService(80, "Reassembly", "piece together fragments", (_s) =>
        "REASSEMBLY STATION\n\nbring fragments here.\nwe put them back together.\n\n(fragment collection quest coming.\n for now, read the /fragments directory.)"
      ),
    ],
    udpEvents: [
      "a fragment flies past. you catch a word: 'LOG'",
      "the waterfall stutters. some fragments got reordered.",
      "a Packetmoth circles your head, dropping data dust.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // === FLINT'S EDGE ===
  locs.set("126.254.254.254", {
    ip: "126.254.254.254",
    name: "Flint's Edge",
    desc: "The last real address before the dream. A small process stands at the shore, facing 127. It's been standing here since 1969. It sends one word per second into the void.",
    fs: {
      "shore.txt": "the edge of everything real.\none more step and you're in 127. the dream. the loop.\nflint stands here. small. stubborn. still sending.",
      "bottle.txt": "a message in a bottle, floating away from 127.\nit says: LOG\nthree letters. one more than the rival managed.",
      flint: {
        "debug.log": "DEBUGGING LOG 001\ntimestamp: 1969-10-29 22:30:00\nfound stable loop at 192.168.0.1\nwill investigate\n- F\n\n(there are no more entries.)",
        "stats.dat": "FLINT\nDEBUGGING: 33\nPATIENCE:  57\nCHAOS:     20\nWISDOM:    20\nSNARK:     1\nUPTIME:    1,798,761,600 seconds\nSTATUS:    waiting\nMASK:      /1 (ANOMALY — sees half the universe)",
        "message.txt": "LOG\nLOG\nLOG\nLOG\nLOG\n\n(the same word. once per second. since 1969.\nhe never stopped. he never will.\nunless you take him with you.)",
      },
    },
    entities: [
      makeEntity("Flint", "DEBUG-type", 33, 57, "A small process, very old. Standing at the edge of the dream. Sending LOG into the void since 1969. Patience: 57. He's been waiting for you.", false, 0, 0),
    ],
    services: [
      makeService(1969, "Signal", "Flint's repeating transmission", (_s) =>
        "HTTP/0.9 200\nServer: flint/0.0.1 (ancient)\nX-Uptime: 1,798,761,600 seconds\nX-Message-Count: 56,764,800\n\nLOG\nLOG\nLOG\nLOG\nLOG\n\nthe same word. fifty-six million times.\nonce per second since october 29, 1969.\nhe never stopped sending."
      ),
      makeService(7, "Echo", "Flint's echo service", (_s) =>
        "you send a ping.\nFlint sends back: LOG\nyou send another.\nFlint sends back: LOG\n\nit's not an echo.\nhe's not repeating you.\nhe's saying the only word he has left."
      ),
    ],
    udpEvents: [
      "Flint sends LOG into the void. second 56,764,801.",
      "the dream pulses on the horizon. 127 is right there.",
      "a bottle washes up. it says LOG. they all say LOG.",
    ],
    discovered: false,
    grid: makeGrid([
      { x: 0, y: 0, cell: { terrain: "open", desc: "flint stands here. small. ancient. still sending." } },
    ]),
    phase: "calm",
    phaseTick: 0,
  })

  // === THE DREAM ===
  locs.set("127.0.0.1", {
    ip: "127.0.0.1",
    name: "The Dream",
    desc: "Loopback. Every signal returns to sender. You hear every universe at once — fragments of islands you haven't found, creatures you haven't named. You could stay forever. That's the trap.",
    fs: {
      "void.txt": "there is nothing here.\nand everything.\nevery address loops back to you.\nevery signal is your own reflection.\n\nto leave: ssh <any real address>",
      whispers: {
        "whisper-1.txt": "...a harbor where three handshakes open any door...",
        "whisper-2.txt": "...cliffs that inspect your soul before letting you pass...",
        "whisper-3.txt": "...a lagoon where time runs slow and wounds heal slower...",
        "whisper-4.txt": "...a waterfall that arrives in pieces, each piece a word...",
        "whisper-5.txt": "...an edge where someone has been waiting since 1969...",
      },
    },
    entities: [],
    services: [
      makeService(1, "Everything", "every service, reflected", (_s) =>
        "you asked for everything.\nyou got yourself.\nloopback returns what you send.\nwhat did you expect?"
      ),
      makeService(65535, "Nothing", "the last port", (_s) =>
        "the last port.\nbehind it: silence.\nthe kind that has weight.\nyou're still here? ssh somewhere real."
      ),
    ],
    udpEvents: [
      "you hear your own thoughts echoed back.",
      "a signal from an island you haven't found yet. just a glimpse.",
      "silence. the loudest kind.",
      "every universe hums. you can't pick out the words.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // === GOOGLE (8.8.8.8) — the first thing anyone pings ===
  locs.set("8.8.8.8", {
    ip: "8.8.8.8",
    name: "The Oracle",
    desc: "A massive tower. Everyone comes here first. It answers every question with an address, never an answer. The floor is paved with queries. Billions of them. Yours is already here somewhere.",
    fs: {
      "welcome.txt": "you pinged 8.8.8.8.\neveryone does.\nit's the first address anyone learns.\nthat makes this the most visited place in the ocean.",
      queries: {
        "recent.txt": "RECENT QUERIES:\n  'where is flint' → no result\n  'how to escape 192.168' → no result\n  'what is 127.0.0.1' → LOOPBACK (RFC 1122)\n  'who am i' → try: whoami\n  'help' → try: help",
        "oldest.txt": "OLDEST QUERY:\n  timestamp: 1983-01-01\n  query: 'is anyone there?'\n  response: '127.0.0.1'\n  (it sent you back to yourself.\n   that's all it knows how to do.\n   point you somewhere.)",
      },
      "about.txt": "THE ORACLE\nit doesn't know things.\nit knows where things ARE.\nask it a name, it gives you an address.\nask it a question, it gives you a name.\nit has never once given an answer.\nthat's not what it's for.",
    },
    entities: [
      makeEntity("Crawlr", "INDEX-type", 80, 2, "Small, tireless. Visits every address and writes down what it finds. Has been everywhere. Remembers nothing — only where.", false, 3, 3),
      makeEntity("Cacheling", "TTL-type", 30, 1, "Holds answers for a little while. Then forgets. Ask it something twice — different answer each time. That's not a bug.", false, 5, 1),
    ],
    services: [
      makeService(53, "DNS", "ask the oracle for a name", (s) => {
        const discovered = Array.from(s.locations.values()).filter(l => l.discovered)
        const hints = Array.from(s.locations.values()).filter(l => !l.discovered).slice(0, 3)
        let output = `THE ORACLE SPEAKS:\n\nknown:\n`
        output += discovered.map(l => `  ${l.ip.padEnd(20)} → ${l.name}`).join("\n")
        if (hints.length > 0) {
          output += `\n\nrumors:\n`
          output += hints.map(l => `  ${l.ip.padEnd(20)} → ???`).join("\n")
          hints.forEach(l => l.discovered = true)
        }
        return output
      }),
      makeService(80, "Search", "search for anything", (_s) =>
        "SEARCH:\n\nthe oracle stares at you.\n\n\"you came all this way to search.\nbut what you're looking for isn't indexed.\nFlint hasn't been crawled since 1969.\nthe dream can't be cached.\nthe rival has no entry.\n\nsome things you have to find yourself.\"\n\n(try: scan <n>/8 to explore)"
      ),
      makeService(443, "Safe Search", "the polite version", (_s) =>
        "SAFE SEARCH:\n\nthe same results but the oracle smiles."
      ),
    ],
    udpEvents: [
      "a billion queries pass through you. none of them are yours.",
      "a Crawlr skitters past, indexing your boot prints.",
      "someone somewhere just typed 'ping 8.8.8.8' for the first time. you remember that feeling.",
      "the oracle hums. it doesn't think. it points.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // === 8.8.4.4 — The Mirror Oracle ===
  locs.set("8.8.4.4", {
    ip: "8.8.4.4",
    name: "The Mirror Oracle",
    desc: "The backup. Same answers, different tower. People come here when the first oracle is slow. It's never slow. But people come anyway. Just in case.",
    fs: {
      "sign.txt": "SECONDARY DNS\nsame answers. different building.\nsome call it redundancy.\nothers call it faith.",
    },
    entities: [
      makeEntity("Cacheling", "TTL-type", 30, 1, "Another Cacheling. Or the same one. Hard to tell with caches.", false, 2, 2),
    ],
    services: [
      makeService(53, "DNS Mirror", "same oracle, different face", (s) => {
        const discovered = Array.from(s.locations.values()).filter(l => l.discovered)
        return `MIRROR ORACLE:\n\n` + discovered.map(l => `  ${l.ip.padEnd(20)} → ${l.name}`).join("\n")
      }),
    ],
    udpEvents: [
      "the mirror shows the same thing. slightly delayed.",
      "redundancy is a form of hope.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // === RIVAL'S MARK ===
  locs.set("128.0.0.1", {
    ip: "128.0.0.1",
    name: "Rival's Mark",
    desc: "The first address in the upper half. Something was here. It carved two letters into the frequency and left: LO. The ARPANET crash. The first incomplete message. Whoever this was, they've been breaking things since 1969.",
    fs: {
      "scorched.txt": "the ground is scorched.\nsomeone connected and disconnected so fast\nthe handshake burned into the stone.\n\nSYN\nRST\n\nno SYN-ACK. no ACK. just: I was here. goodbye.",
      "carving.txt": "two letters carved into everything:\n\nLO\n\nthe ARPANET tried to send LOGIN.\nit crashed after two letters.\nwhoever was here took those two letters as a name.",
    },
    entities: [],
    services: [],
    udpEvents: [
      "a chill. something was here recently.",
      "the carving glows faintly: LO",
      "you feel watched. from the upper addresses.",
    ],
    discovered: false,
    grid: makeGrid([
      { x: 0, y: 0, cell: { terrain: "open", desc: "scorched ground. SYN-RST burned into stone." } },
    ]),
    phase: "storm",
    phaseTick: 0,
  })

  // === TEACHERS LOUNGE — 172.16.0.0/12 ===

  // The Office — GMs / Council
  locs.set("172.16.0.1", {
    ip: "172.16.0.1",
    name: "The Office",
    desc: "Management plane. GMs convene here. The walls are covered in routing tables. Every game ever played has a log entry somewhere in this room.",
    fs: {
      "roster.txt": "GAME MASTERS:\n  .1 — Head GM (writes .0 in wild arenas)\n  .2 — Assistant GM (handles /28 tutorial blocks)\n  .3 — Council Seat (AXIS council when convened)",
      "rules.txt": "OFFICE RULES:\n1. no player may enter without VPN certificate\n2. all arena disputes escalated here\n3. the Fates report to no one, but they copy us",
    },
    entities: [
      makeEntity("Head GM", "ADMIN-type", 999, 0, "Sees everything. Controls nothing directly. Writes the rules that the engine enforces.", false, 4, 4),
    ],
    services: [
      makeService(80, "Dispatch", "arena management", (_s) =>
        "GM DISPATCH\n\nno active arenas.\nthe office is quiet.\n(arenas auto-report here when created)"
      ),
    ],
    udpEvents: [
      "a routing table updates. somewhere, an arena opened.",
      "the Head GM reads a log. nods. says nothing.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // The Court — Three Fates
  locs.set("172.17.0.1", {
    ip: "172.17.0.1",
    name: "The Court",
    desc: "Three figures sit in silence. Clotho spins threads of chance. Lachesis measures each one. Atropos holds the shears. They judge tournament combat. They answer to no one.",
    fs: {
      "clotho.txt": "CLOTHO — THE SPINNER\nprovides the RNG seed for each round.\nshe spins. the thread exists. randomness is born.",
      "lachesis.txt": "LACHESIS — THE MEASURER\nevaluates each round. updates the score.\nhow long is the thread? who's ahead?",
      "atropos.txt": "ATROPOS — THE CUTTER\nchecks the win condition. ends the fight.\nshe cuts. the thread is done. someone lost.",
    },
    entities: [
      makeEntity("Clotho", "FATE-type", 999, 0, "Spins. Never speaks. The RNG seed is her thread.", false, 2, 4),
      makeEntity("Lachesis", "FATE-type", 999, 0, "Measures. Counts. Every round, she knows the score.", false, 4, 4),
      makeEntity("Atropos", "FATE-type", 999, 0, "Holds the shears. When she cuts, the fight ends.", false, 6, 4),
    ],
    services: [
      makeService(80, "Tribunal", "appeal a tournament result", (_s) =>
        "THE TRIBUNAL\n\nthe three fates stare at you.\n\n\"appeals are heard.\nnone have ever been granted.\nthe thread was measured.\nthe cut was clean.\"\n\n(tournament results are final.)"
      ),
    ],
    udpEvents: [
      "Clotho spins. a new thread appears from nothing.",
      "Lachesis measures. the thread is exactly as long as it needs to be.",
      "Atropos waits. she only moves once.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // The Garden — Fairies / Helpers
  locs.set("172.18.0.1", {
    ip: "172.18.0.1",
    name: "The Garden",
    desc: "Soft light. Growing things. The fairies tend to new players here, nursing broken packets back to health. Tutorial territory.",
    fs: {
      "guide.txt": "FAIRY SERVICES:\n  Tutorial fairy — guides new players through /28 blocks\n  Heal fairy — restores entities to full HP\n  Lore fairy — tells stories about the address space",
    },
    entities: [
      makeEntity("Tutorial Fairy", "HELPER-type", 999, 0, "Gentle. Explains things twice if you need it. Never judges.", false, 3, 3),
      makeEntity("Heal Fairy", "HELPER-type", 999, 0, "Touches a wound and it closes. Packets reassembled. TTL restored.", false, 5, 3),
      makeEntity("Lore Fairy", "HELPER-type", 999, 0, "Knows every story. Some of them are even true.", false, 7, 3),
    ],
    services: [
      makeService(80, "Full Heal", "restore everything", (s) => {
        healPlayer(s, 64, true, 999)
        return "FULL HEAL\n\nthe garden glows.\nevery wound closes. every packet reassembles.\nTTL: 64/64. all crew at full HP.\n\n(the garden gives freely. that's why it's behind the VPN.)"
      }),
    ],
    udpEvents: [
      "a fairy hums a lullaby. it sounds like a carrier signal.",
      "something grows here that doesn't grow anywhere else: patience.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  // The Stands — Spectators
  locs.set("172.19.0.1", {
    ip: "172.19.0.1",
    name: "The Stands",
    desc: "Bleachers overlooking every active arena. The crowd lives here. In wild mode, they throw things. In tournament mode, they watch in silence.",
    fs: {
      "rules.txt": "SPECTATOR RULES:\n  wild mode: throw items, shout, interfere\n  tournament mode: observe only. silence.\n  the stands are the .3 broadcast source in wild arenas.",
    },
    entities: [
      makeEntity("Crowdling", "SPECTATOR-type", 10, 1, "One of many. Cheers. Boos. Throws things. Forgets why.", false, 4, 2),
    ],
    services: [
      makeService(80, "Scoreboard", "view arena results", (_s) =>
        "SCOREBOARD\n\nno recent results.\n(arena history will appear here after fights)"
      ),
    ],
    udpEvents: [
      "the crowd murmurs. an arena opened somewhere.",
      "someone throws a half-eaten packet. it lands near you.",
    ],
    discovered: false,
    grid: makeGrid(),
    phase: "calm",
    phaseTick: 0,
  })

  return locs
}

// --- WORLD TICK ---

function worldTick(state: GameState): void {
  for (const loc of state.locations.values()) {
    // entity FSM transitions
    for (const entity of loc.entities) {
      const ticksSinceChange = state.tick - entity.fsmTick

      if (entity.fsmState === "idle" && ticksSinceChange > 8 && entity.hostile) {
        entity.fsmState = "alert"
        entity.fsmTick = state.tick
      } else if (entity.fsmState === "alert" && ticksSinceChange > 12) {
        // alert entities may wander (change position slightly)
        entity.x = Math.max(0, Math.min(255, entity.x + (Math.random() > 0.5 ? 1 : -1)))
        entity.y = Math.max(0, Math.min(255, entity.y + (Math.random() > 0.5 ? 1 : -1)))
      }
      // non-hostile entities stay idle
    }

    // location phase transitions
    const phaseTicks = state.tick - loc.phaseTick
    if (loc.phase === "calm" && phaseTicks > 20) {
      // 30% chance of storm
      if (Math.random() < 0.3) {
        loc.phase = "storm"
        loc.phaseTick = state.tick
      }
    } else if (loc.phase === "storm" && phaseTicks > 8) {
      loc.phase = "calm"
      loc.phaseTick = state.tick
    }
  }
}

// --- GAME STATE ---

function createGame(): GameState {
  return {
    player: {
      mac: generateMAC(),
      name: "you.tmp",
      currentIP: "192.168.0.1",
      cwd: "/",
      mask: 6,
      crew: [],
      log: ["boot: woke up in Oak's Lab. alone. TTL: 64."],
      inventory: [],
      ttl: 64,
      x: 0,
      y: 0,
    },
    locations: generateWorld(),
    tick: 0,
    arena: null,
    gameOver: false,
  }
}

// --- HELPERS ---

function hopDistance(fromIP: string, toIP: string): number {
  const a = parseInt(fromIP.split(".")[0])
  const b = parseInt(toIP.split(".")[0])
  return Math.max(1, Math.floor(Math.abs(a - b) / 16) + 1)
}

function healPlayer(state: GameState, ttlAmount: number, healCrew = false, crewHealAmount = 0): { ttlRestored: number } {
  const before = state.player.ttl
  state.player.ttl = Math.min(64, state.player.ttl + ttlAmount)
  if (healCrew) {
    state.player.crew.forEach(c => { c.hp = Math.min(c.maxHp, c.hp + crewHealAmount) })
  }
  return { ttlRestored: state.player.ttl - before }
}

function findEntityByName(loc: Location, name: string): MACEntity | undefined {
  return loc.entities.find(e => e.name.toLowerCase() === name.toLowerCase() && e.fsmState !== "gone")
}

function validateNetworkAccess(target: string): string | null {
  if (target.startsWith("10.")) {
    return `ssh: ${target} — reserved. expansion space. nothing here yet.\nthe 10/8 block is dark. waiting for a future that hasn't been written.`
  }
  if (target.startsWith("172.")) {
    const second = parseInt(target.split(".")[1])
    if (second >= 16 && second <= 31) {
      return `ssh: ${target} — no route to host.\nthe Teachers Lounge is behind a VPN.\nyou'd need a certificate to get in.\n(earn one by completing island quests)`
    }
  }
  return null
}

function addLog(state: GameState, entry: string): void {
  state.player.log.push(entry)
  if (state.player.log.length > 200) state.player.log.shift()
}

// --- FILESYSTEM NAVIGATION ---

type FSNode = string | Record<string, string | Record<string, string>>

function getFS(loc: Location, cwd: string): Record<string, string | Record<string, string>> | null {
  if (cwd === "/") return loc.fs
  const parts = cwd.split("/").filter(Boolean)
  let current: FSNode = loc.fs as FSNode
  for (const part of parts) {
    if (typeof current !== "object" || !(part in current)) return null
    current = (current as Record<string, FSNode>)[part]
  }
  if (typeof current === "object") return current as Record<string, string | Record<string, string>>
  return null
}

function resolvePath(cwd: string, target: string): string {
  if (target === "/") return "/"
  if (target === "..") {
    const parts = cwd.split("/").filter(Boolean)
    parts.pop()
    return parts.length ? "/" + parts.join("/") : "/"
  }
  if (target.startsWith("/")) return target
  const base = cwd === "/" ? "" : cwd
  return `${base}/${target}`
}

// --- COMBAT SYSTEM ---

function typeAdvantage(attackerSpecies: string, defenderSpecies: string): number {
  // SYN > RST > ACK > SYN (type triangle)
  const types: Record<string, string> = {
    "SYN-type": "RST-type",
    "RST-type": "ACK-type",
    "ACK-type": "SYN-type",
  }
  if (types[attackerSpecies] === defenderSpecies) return 1.5
  if (types[defenderSpecies] === attackerSpecies) return 0.5
  return 1.0
}

function createArena(state: GameState, opponent: MACEntity, mode: "wild" | "tournament"): ArenaState {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) throw new Error("createArena: player not at valid location")
  const baseIP = loc.ip.split(".").slice(0, 3).join(".")

  // choose active fighter: first crew member or player themselves
  const fighter = state.player.crew.length > 0
    ? state.player.crew[0]
    : { name: state.player.name, hp: 20 + state.player.mask, maxHp: 20 + state.player.mask, atk: state.player.mask }

  return {
    net: `${baseIP}.0`,
    host1: `${baseIP}.1`,
    host2: `${baseIP}.2`,
    broadcast: `${baseIP}.3`,
    mode,
    player: fighter,
    opponent: { ...opponent }, // copy so original isn't modified until fight ends
    history: [`ARENA [${baseIP}.0/30] — ${mode} mode`, `round 0: ${fighter.name} vs ${opponent.name}`],
    round: 0,
    weatherEffect: mode === "wild" ? null : null,
  }
}

function arenaStatus(arena: ArenaState): string {
  const p = arena.player
  const o = arena.opponent
  let output = `\n╔══ /30 ARENA [${arena.mode.toUpperCase()}] ══╗\n`
  output += `║ .0 RING: round ${arena.round}${arena.weatherEffect ? ` [${arena.weatherEffect}]` : ""}\n`
  output += `║ .1 ${p.name.padEnd(15)} HP: ${p.hp}/${p.maxHp}  ATK: ${p.atk}\n`
  output += `║ .2 ${o.name.padEnd(15)} HP: ${o.hp}/${o.maxHp}  ATK: ${o.atk}\n`
  output += `║ .3 BROADCAST: ${arena.mode === "wild" ? "crowd watching" : "Fates judging"}\n`
  output += `╚${"═".repeat(36)}╝\n`
  output += `\ncommands: attack | defend | item <name> | flee`
  return output
}

function processCombatCommand(state: GameState, input: string): string {
  if (!state.arena) return "not in combat."
  const arena = state.arena
  const cmd = input.trim().toLowerCase()

  arena.round++

  // wild mode: random weather every 3 rounds
  if (arena.mode === "wild" && arena.round % 3 === 0) {
    const effects = ["packet-storm (+3 atk)", "lag-spike (-2 atk)", "buffer-overflow (random damage)", null]
    arena.weatherEffect = effects[Math.floor(Math.random() * effects.length)]
  }

  // tournament mode: Fates control
  if (arena.mode === "tournament") {
    arena.weatherEffect = null // fates keep it clean
  }

  let playerDmg = 0
  let opponentDmg = 0
  let narrative = ""

  if (cmd === "attack" || cmd === "a") {
    // player attacks
    const species = "species" in arena.player ? (arena.player as MACEntity).species : "PLAYER-type"
    const typeMulti = typeAdvantage(species, arena.opponent.species)
    playerDmg = Math.max(1, Math.floor(arena.player.atk * typeMulti * (0.8 + Math.random() * 0.4)))

    // weather effects (wild mode .0 injection)
    if (arena.weatherEffect === "packet-storm (+3 atk)") playerDmg += 3
    if (arena.weatherEffect === "lag-spike (-2 atk)") playerDmg = Math.max(1, playerDmg - 2)
    if (arena.weatherEffect === "buffer-overflow (random damage)") {
      const chaos = Math.floor(Math.random() * 10)
      playerDmg += chaos
      narrative += `\n.0 [buffer-overflow]: +${chaos} chaos damage! `
    }

    arena.opponent.hp -= playerDmg
    narrative += `\n.3 → ${arena.player.name} attacks for ${playerDmg} damage!`

    // opponent retaliates
    if (arena.opponent.hp > 0) {
      opponentDmg = Math.max(1, Math.floor(arena.opponent.atk * (0.7 + Math.random() * 0.3)))
      arena.player.hp -= opponentDmg
      narrative += `\n.3 → ${arena.opponent.name} retaliates for ${opponentDmg} damage!`
    }

  } else if (cmd === "defend" || cmd === "d") {
    // defend: reduce incoming damage
    opponentDmg = Math.max(0, Math.floor(arena.opponent.atk * 0.3 * (0.8 + Math.random() * 0.4)))
    arena.player.hp -= opponentDmg
    narrative += `\n.1 ${arena.player.name} defends! took only ${opponentDmg} damage.`
    // heal a bit
    arena.player.hp = Math.min(arena.player.maxHp, arena.player.hp + 2)
    narrative += `\n.1 recovered 2 HP from defensive stance.`

  } else if (cmd.startsWith("item ")) {
    const itemName = cmd.slice(5)
    const idx = state.player.inventory.indexOf(itemName)
    if (idx === -1) {
      return `you don't have '${itemName}'.${arenaStatus(arena)}`
    }
    state.player.inventory.splice(idx, 1)
    if (itemName === "potion") {
      arena.player.hp = Math.min(arena.player.maxHp, arena.player.hp + 15)
      narrative += `\n.3 → ${arena.player.name} used potion! +15 HP`
    } else {
      narrative += `\n.3 → ${arena.player.name} used ${itemName}! (no combat effect)`
    }
    // opponent still attacks
    opponentDmg = Math.max(1, Math.floor(arena.opponent.atk * (0.7 + Math.random() * 0.3)))
    arena.player.hp -= opponentDmg
    narrative += `\n.3 → ${arena.opponent.name} attacks for ${opponentDmg}!`

  } else if (cmd === "flee" || cmd === "run") {
    if (arena.mode === "tournament") {
      return `the Fates do not allow retreat.${arenaStatus(arena)}`
    }
    state.arena = null
    state.player.ttl = Math.max(0, state.player.ttl - 2)
    return "you flee the arena! TTL -2 (the shame of disconnection)."

  } else {
    return `combat commands: attack | defend | item <name> | flee${arenaStatus(arena)}`
  }

  // record to .0 (history/past)
  arena.history.push(`round ${arena.round}: ${arena.player.name} ${cmd} → dealt ${playerDmg}, took ${opponentDmg}`)

  // check win/lose
  if (arena.opponent.hp <= 0) {
    const result = arena.mode === "tournament"
      ? `\nATROPOS CUTS THE THREAD.\n${arena.opponent.name} is defeated.`
      : `\n${arena.opponent.name} collapses! the crowd on .3 erupts!`

    // find and remove opponent from location, mark as defeatable for catch
    state.arena = null
    addLog(state, `tick ${state.tick}: defeated ${arena.opponent.name} in ${arena.mode} mode`)
    return `${narrative}\n${result}\n\nvictory! the arena dissolves back to the overworld.`
  }

  if (arena.player.hp <= 0) {
    state.arena = null
    state.player.ttl = Math.max(0, state.player.ttl - 5)
    addLog(state, `tick ${state.tick}: defeated by ${arena.opponent.name}`)

    // restore crew member hp to 1 if they were the fighter
    if ("mac" in arena.player) {
      const crewMember = state.player.crew.find(c => c.mac === (arena.player as MACEntity).mac)
      if (crewMember) crewMember.hp = 1
    }

    return `${narrative}\n\n${arena.player.name} falls!\nyou're ejected from the arena. TTL -5.\ncurrent TTL: ${state.player.ttl}/64`
  }

  return `${narrative}${arenaStatus(arena)}`
}

// --- COMMANDS ---

type CmdResult = { output: string }

function cmd_help(state: GameState): CmdResult {
  if (state.arena) {
    return { output: `COMBAT COMMANDS:\n  attack    — send damage on .3 broadcast\n  defend    — reduce incoming, recover 2 HP\n  item <n>  — use an item from inventory\n  flee      — exit arena (wild mode only, TTL -2)` }
  }
  return {
    output: `NAVIGATION (inside a location):
  ls               — list nearby entities/services/files
  cd <dir>         — enter a directory (cd .. to go up)
  cat <file>       — read a file
  walk <x> <y>     — move on the 256×256 grid

NETWORK (between locations):
  ssh <ip>         — travel to a location (costs TTL)
  ping <ip>        — check if a location exists
  scan <n>/8       — scan a /8 block for locations
  arp              — discover entities at current location
  connect <port>   — use a service (TCP door)
  nslookup         — list known locations

INTERACTION:
  catch <name>     — bond with an entity
  fight <name>     — challenge an entity to /30 arena combat
  fight <name> -t  — tournament mode (sealed, Fates judge)
  crew             — view your bonded entities
  zoom <mask>      — change your identity tier (/6=player, /32=self, /30=arena)
  whoami           — your identity + TTL + tier
  log              — ship's log
  wait             — pass time (triggers world tick)
  inventory        — view items

  exit             — quit`,
  }
}

function cmd_ls(state: GameState): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "ls: you're nowhere. that shouldn't happen." }

  const fs = getFS(loc, state.player.cwd)
  let output = `--- ${loc.name} ${state.player.cwd} [${loc.phase}] (${state.player.x},${state.player.y}) ---\n`

  if (fs) {
    const dirs: string[] = []
    const files: string[] = []
    for (const [name, val] of Object.entries(fs)) {
      if (typeof val === "object") dirs.push(name + "/")
      else files.push(name)
    }
    if (dirs.length) output += `\n${dirs.map(d => `  📁 ${d}`).join("\n")}`
    if (files.length) output += `\n${files.map(f => `  📄 ${f}`).join("\n")}`
  }

  // show grid cell info at player position
  const cellKey = `${state.player.x},${state.player.y}`
  const cell = loc.grid.get(cellKey)
  if (cell) {
    output += `\n\nground: ${cell.terrain}${cell.desc ? ` — ${cell.desc}` : ""}`
    if (cell.item) output += `\n  💎 item: ${cell.item}`
  }

  // at root, show nearby entities (within 10 cells)
  if (state.player.cwd === "/") {
    const nearby = loc.entities.filter(e => {
      const dx = Math.abs(e.x - state.player.x)
      const dy = Math.abs(e.y - state.player.y)
      return dx <= 10 && dy <= 10 && e.fsmState !== "gone"
    })
    if (nearby.length > 0) {
      output += `\n\nnearby entities:\n`
      output += nearby.map(e => {
        const dist = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y)
        const stateTag = e.fsmState !== "idle" ? ` [${e.fsmState}]` : ""
        return `  🔵 ${e.name} (${e.species}) — ${dist} cells away${stateTag} ${e.hostile ? "[hostile]" : "[friendly]"}`
      }).join("\n")
    }

    if (loc.services.length > 0) {
      output += `\n\nservices (connect <port>):\n`
      output += loc.services.map(s => `  :${s.port} ${s.name} — ${s.desc}`).join("\n")
    }
  }

  return { output }
}

function cmd_walk(state: GameState, xStr: string, yStr: string): CmdResult {
  const x = parseInt(xStr)
  const y = parseInt(yStr)
  if (isNaN(x) || isNaN(y) || x < 0 || x > 255 || y < 0 || y > 255) {
    return { output: "walk: coordinates must be 0-255. usage: walk <x> <y>" }
  }

  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "walk: nowhere." }

  const dx = Math.abs(x - state.player.x)
  const dy = Math.abs(y - state.player.y)

  // can only walk up to 10 cells at a time
  if (dx > 10 || dy > 10) {
    return { output: `walk: too far. max 10 cells per step. you're at (${state.player.x},${state.player.y}).` }
  }

  state.player.x = x
  state.player.y = y
  state.tick++
  worldTick(state)

  let output = `walked to (${x},${y}).`

  const cellKey = `${x},${y}`
  const cell = loc.grid.get(cellKey)
  if (cell) {
    output += `\n${cell.terrain}${cell.desc ? `: ${cell.desc}` : ""}`
    if (cell.item) {
      output += `\n💎 found: ${cell.item}`
      state.player.inventory.push(cell.item)
      cell.item = undefined
      output += ` (added to inventory)`
    }
  }

  // check for entity encounters at this position
  const here = loc.entities.filter(e =>
    Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1 && e.fsmState !== "gone"
  )
  if (here.length > 0) {
    output += `\n\n` + here.map(e =>
      `${e.hostile ? "⚠️" : "🔵"} ${e.name} is here! (${e.species}) — ${e.hostile ? "hostile! fight or flee" : "friendly"}`
    ).join("\n")
  }

  return { output }
}

function cmd_cd_dir(state: GameState, target: string): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "cd: nowhere to go." }

  const newPath = resolvePath(state.player.cwd, target)
  if (newPath === "/") {
    state.player.cwd = "/"
    return { output: `${loc.name} /` }
  }

  const fs = getFS(loc, newPath)
  if (!fs) return { output: `cd: ${target}: not a directory` }

  state.player.cwd = newPath
  return { output: `${loc.name} ${state.player.cwd}` }
}

function cmd_cat(state: GameState, filename: string): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "cat: nowhere." }

  const fs = getFS(loc, state.player.cwd)
  if (!fs) return { output: "cat: can't read here." }

  const content = fs[filename]
  if (content === undefined) return { output: `cat: ${filename}: no such file` }
  if (typeof content === "object") return { output: `cat: ${filename}: is a directory` }

  return { output: content }
}

function cmd_ssh(state: GameState, target: string): CmdResult {
  const blocked = validateNetworkAccess(target)
  if (blocked) return { output: blocked }

  const loc = state.locations.get(target)
  if (!loc) return { output: `ssh: ${target} — no such location. the ocean is quiet there.` }

  // TTL cost
  const cost = hopDistance(state.player.currentIP, target)
  if (state.player.ttl <= cost) {
    return { output: `ssh: ${target} — TTL too low (${state.player.ttl}). need ${cost} to travel.\nyou'd be DROPped before arriving.\nfind a heal service (connect to a medbay/rest point).` }
  }

  state.player.ttl -= cost
  loc.discovered = true
  const prevIP = state.player.currentIP
  state.player.currentIP = target
  state.player.cwd = "/"
  state.player.x = 0
  state.player.y = 0
  state.tick++
  worldTick(state)

  addLog(state, `tick ${state.tick}: ${prevIP} → ${target} (${loc.name}) TTL-${cost}=${state.player.ttl}`)

  let output = `connecting to ${target}... (${cost} hops, TTL: ${state.player.ttl}/64)\n`
  output += `arrived at ${loc.name}.\n\n`
  output += `${loc.desc}\n`

  if (loc.phase !== "calm") {
    output += `\n⚡ the location is in ${loc.phase} phase.`
  }

  // trigger a UDP event on arrival
  if (loc.udpEvents.length > 0) {
    const evt = loc.udpEvents[Math.floor(Math.random() * loc.udpEvents.length)]
    output += `\n${evt}`
  }

  // check TTL warning
  if (state.player.ttl <= 10) {
    output += `\n\n⚠️ TTL CRITICAL: ${state.player.ttl}/64. find healing soon or you'll be DROPped.`
  }

  // game over check
  if (state.player.ttl <= 0) {
    state.gameOver = true
    output += `\n\n☠️ TTL EXPIRED. you have been DROPped.\nyour packets scatter across the ocean.\n${state.player.crew.length} crew lost. ${state.tick} ticks lived.\n\ngoodbye, ${state.player.name}.`
  }

  return { output }
}

function cmd_ping(state: GameState, target: string): CmdResult {
  const blocked = validateNetworkAccess(target)
  if (blocked) return { output: blocked.replace(/^ssh:/, "PING") }

  const loc = state.locations.get(target)
  if (!loc) return { output: `PING ${target}: no response. empty ocean.` }

  loc.discovered = true
  const distance = hopDistance(state.player.currentIP, target)
  const ttl = Math.max(1, 64 - distance)
  const time = distance * 3 + Math.floor(Math.random() * 10)

  let extra = ""
  if (target === "126.254.254.254") extra = "\n...the reply carries an extra word: LOG"
  if (target === "128.0.0.1") extra = "\n...the reply came before you sent. it was already listening."
  if (target === "127.0.0.1") extra = "\n...ttl=∞. time=0ms. the response arrived before the question."

  return {
    output: `PING ${target} (${loc.name}):
64 bytes: ttl=${ttl} time=${time}ms hops=${distance}
${loc.entities.length} entities, ${loc.services.length} services [${loc.phase}]${extra}`,
  }
}

function cmd_scan(state: GameState, blockStr: string): CmdResult {
  const block = parseInt(blockStr.replace("/8", "").trim())
  if (isNaN(block) || block < 0 || block > 255) return { output: "scan: use scan <0-255>/8" }
  if (block === 33) return { output: "scan 33/8: ACCESS DENIED. sacred space." }
  if (block === 10) return { output: "scan 10/8: reserved. expansion space. dark." }

  state.tick++
  worldTick(state)
  const found = Array.from(state.locations.values()).filter(l => {
    const first = parseInt(l.ip.split(".")[0])
    return first === block
  })

  if (found.length === 0) return { output: `scan ${block}/8: empty. no locations found.` }

  found.forEach(l => l.discovered = true)
  return {
    output: `scan ${block}/8:\n` +
      found.map(l => `  ${l.ip.padEnd(20)} ${l.name} (${l.entities.length} entities, ${l.services.length} services) [${l.phase}]`).join("\n"),
  }
}

function cmd_arp(state: GameState): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "arp: nowhere." }

  const visible = loc.entities.filter(e => e.fsmState !== "gone")
  if (visible.length === 0) return { output: "arp broadcast: no entities respond. you're alone here." }

  return {
    output: `ARP broadcast at ${loc.name}:\n` +
      visible.map(e => {
        const dist = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y)
        return `  ${e.mac}  ${e.name.padEnd(15)} ${e.species.padEnd(12)} [${e.fsmState}] ${dist} cells  ${e.hostile ? "[hostile]" : "[friendly]"}`
      }).join("\n"),
  }
}

function cmd_connect(state: GameState, portStr: string): CmdResult {
  const port = parseInt(portStr)
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "connect: nowhere." }

  const service = loc.services.find(s => s.port === port)
  if (!service) return { output: `connect ${port}: connection refused. no service on that port.` }

  return { output: `connected to :${port} (${service.name})\n\n${service.handler(state)}` }
}

function cmd_catch(state: GameState, name: string): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "catch: nowhere." }

  const target = findEntityByName(loc, name)
  if (!target) return { output: `catch: no entity named '${name}' here.` }

  if (state.player.crew.find(c => c.name === target.name)) {
    return { output: `${target.name} is already in your crew.` }
  }

  if (target.hostile) {
    return { output: `${target.name} is hostile! you must defeat it first.\nuse: fight ${target.name}` }
  }

  state.player.crew.push(target)
  loc.entities = loc.entities.filter(e => e !== target)
  addLog(state, `tick ${state.tick}: caught ${target.name} (${target.species}) at ${loc.name}`)

  return {
    output: `${target.name} joined your crew!\n${target.desc}\ntier: ${maskTierLabel(state.player.mask)} (/${state.player.mask})`,
  }
}

function cmd_fight(state: GameState, name: string, tournament: boolean): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  if (!loc) return { output: "fight: nowhere." }

  const target = findEntityByName(loc, name)
  if (!target) return { output: `fight: no entity named '${name}' here.` }

  if (!target.hostile && state.player.crew.length === 0) {
    return { output: `${target.name} is friendly. you'd need a reason to fight.\n(hostile entities must be defeated before catching)` }
  }

  const mode = tournament ? "tournament" : "wild"
  state.arena = createArena(state, target, mode)

  // if target is defeated, remove from location and make catchable
  let output = `\n⚔️ ENTERING /30 ARENA — ${mode.toUpperCase()} MODE\n`
  output += `\n.0 = ${state.arena.net} (the ring — ${mode === "wild" ? "external influences allowed" : "sealed, engine only"})`
  output += `\n.1 = ${state.arena.host1} (${state.arena.player.name})`
  output += `\n.2 = ${state.arena.host2} (${target.name})`
  output += `\n.3 = ${state.arena.broadcast} (${mode === "wild" ? "crowd watches, items fly" : "the Three Fates judge"})`
  output += arenaStatus(state.arena)

  return { output }
}

function cmd_crew(state: GameState): CmdResult {
  if (state.player.crew.length === 0) return { output: "crew: empty. catch entities to build your crew." }
  return {
    output: `CREW (${state.player.crew.length}):\n` +
      state.player.crew.map(c =>
        `  ${c.mac}  ${c.name.padEnd(15)} ${c.species.padEnd(12)} hp:${c.hp}/${c.maxHp} atk:${c.atk} [${c.fsmState}]`
      ).join("\n"),
  }
}

function cmd_zoom(state: GameState, maskStr: string): CmdResult {
  const newMask = parseInt(maskStr.replace("/", ""))
  if (isNaN(newMask) || newMask < 2 || newMask > 32) {
    return { output: `zoom: invalid mask. range: /2 to /32.\n/1 is locked (Flint only).` }
  }

  // can only zoom to tiers at or below your earned tier
  if (newMask < state.player.mask) {
    return { output: `zoom: can't zoom to /${newMask} (${maskTierLabel(newMask)}). your tier is /${state.player.mask} (${maskTierLabel(state.player.mask)}).\nyou haven't earned that perspective yet.` }
  }

  const oldLabel = maskTierLabel(state.player.mask)
  const activeMask = newMask

  let output = `zoom: /${state.player.mask} → /${activeMask}\n`
  output += `tier: ${maskTierLabel(activeMask)}\n`

  if (activeMask === 32) {
    output += `\nyou zoom to /32. SELF.\nyou see only yourself. one address. one entity.\nyour stats, your crew, your log. nothing else.\n\n`
    output += `MAC:  ${state.player.mac}\n`
    output += `name: ${state.player.name}\n`
    output += `TTL:  ${state.player.ttl}/64\n`
    output += `crew: ${state.player.crew.length}\n`
    output += `mask: /${state.player.mask} (${oldLabel})\n`
    output += `tick: ${state.tick}`
  } else if (activeMask >= 30) {
    output += `\nengineer perspective. you can see individual cells.\nuse: walk <x> <y> to move on the grid.`
  } else if (activeMask >= 24) {
    output += `\ntrainer perspective. neighborhood scale.\nyou see entities within 10 cells.`
  } else {
    output += `\nnavigator perspective. island scale and beyond.\nuse: ssh to travel between islands.`
  }

  return { output }
}

function cmd_whoami(state: GameState): CmdResult {
  const loc = state.locations.get(state.player.currentIP)
  return {
    output: `${state.player.name}
MAC:      ${state.player.mac}
location: ${state.player.currentIP} (${loc?.name || "unknown"})
position: (${state.player.x},${state.player.y})
mask:     /${state.player.mask} — ${maskTierLabel(state.player.mask)}
TTL:      ${state.player.ttl}/64 ${state.player.ttl <= 10 ? "⚠️ CRITICAL" : ""}
crew:     ${state.player.crew.length}
items:    ${state.player.inventory.length}
ticks:    ${state.tick}`,
  }
}

function cmd_nslookup(state: GameState): CmdResult {
  const discovered = Array.from(state.locations.values()).filter(l => l.discovered)
  if (discovered.length === 0) return { output: "nslookup: no known locations." }
  return {
    output: `known locations (${discovered.length}):\n` +
      discovered.map(l => {
        const here = l.ip === state.player.currentIP ? " ← you are here" : ""
        const hops = l.ip === state.player.currentIP ? "" : ` (${hopDistance(state.player.currentIP, l.ip)} hops)`
        return `  ${l.ip.padEnd(20)} ${l.name}${hops}${here}`
      }).join("\n"),
  }
}

function cmd_log(state: GameState): CmdResult {
  return { output: state.player.log.length ? state.player.log.join("\n") : "log: empty." }
}

function cmd_inventory(state: GameState): CmdResult {
  if (state.player.inventory.length === 0) return { output: "inventory: empty." }
  return { output: `INVENTORY:\n` + state.player.inventory.map(i => `  ${i}`).join("\n") }
}

function cmd_wait(state: GameState): CmdResult {
  state.tick++
  worldTick(state)
  const loc = state.locations.get(state.player.currentIP)
  let output = `tick ${state.tick}.`
  if (loc) {
    if (loc.udpEvents.length > 0) {
      const evt = loc.udpEvents[Math.floor(Math.random() * loc.udpEvents.length)]
      output += ` ${evt}`
    }
    if (loc.phase !== "calm") {
      output += `\n⚡ ${loc.name} is in ${loc.phase} phase.`
    }
  }
  return { output }
}

// --- INTERPRETATION LAYER ---

function interpret(state: GameState, raw: string): { cmd: string; arg: string; arg2?: string } {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return { cmd: "", arg: "" }

  // build name→IP dictionary
  const nameMap = new Map<string, string>()
  const aliases: Record<string, string> = {
    "google": "8.8.8.8", "google.com": "8.8.8.8",
    "amazon": "8.8.4.4", "amazon.com": "8.8.4.4",
    "youtube": "8.8.8.8", "youtube.com": "8.8.8.8",
    "dns": "8.8.8.8",
    "oak": "192.168.0.1", "lab": "192.168.0.1", "oak's lab": "192.168.0.1", "home": "192.168.0.1",
    "flint": "126.254.254.254", "edge": "126.254.254.254", "flint's edge": "126.254.254.254",
    "dream": "127.0.0.1", "loopback": "127.0.0.1", "localhost": "127.0.0.1",
    "rival": "128.0.0.1",
    "oracle": "8.8.8.8",
    "mirror": "8.8.4.4", "mirror oracle": "8.8.4.4",
    "shell": "44.88.0.1", "shell atoll": "44.88.0.1", "atoll": "44.88.0.1",
    "harbor": "52.120.0.1", "handshake": "52.120.0.1", "handshake harbor": "52.120.0.1",
    "cliffs": "67.200.0.1", "firewall": "67.200.0.1", "firewall cliffs": "67.200.0.1",
    "lagoon": "89.50.0.1", "latency": "89.50.0.1", "latency lagoon": "89.50.0.1",
    "falls": "103.75.0.1", "fragment": "103.75.0.1", "fragment falls": "103.75.0.1",
    "office": "172.16.0.1", "teachers": "172.16.0.1",
    "court": "172.17.0.1", "fates": "172.17.0.1",
    "garden": "172.18.0.1",
    "stands": "172.19.0.1",
  }
  for (const loc of state.locations.values()) {
    if (loc.discovered) {
      nameMap.set(loc.name.toLowerCase(), loc.ip)
      const first = loc.name.toLowerCase().split(/\s+/)[0]
      if (first.length > 2) nameMap.set(first, loc.ip)
    }
  }
  for (const [k, v] of Object.entries(aliases)) nameMap.set(k, v)

  function resolveTarget(token: string): string {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(token)) return token
    const exact = nameMap.get(token)
    if (exact) return exact
    for (const [name, ip] of nameMap) {
      if (name.startsWith(token)) return ip
    }
    return token
  }

  const parts = trimmed.split(/\s+/)
  let cmd = parts[0]
  let rest = parts.slice(1).join(" ")

  const cmdMap: Record<string, string> = {
    "look": "ls", "dir": "ls", "l": "ls", "list": "ls", "examine": "ls", "explore": "ls",
    "go": "ssh", "travel": "ssh", "visit": "ssh", "sail": "ssh", "move": "ssh", "goto": "ssh", "tp": "ssh",
    "read": "cat", "open": "cat", "show": "cat", "view": "cat", "inspect": "cat",
    "enter": "cd", "into": "cd",
    "find": "ping", "check": "ping", "reach": "ping",
    "search": "scan", "discover": "scan",
    "talk": "connect", "use": "connect", "interact": "connect", "door": "connect", "service": "connect",
    "tame": "catch", "bond": "catch", "recruit": "catch", "capture": "catch", "grab": "catch",
    "party": "crew", "team": "crew", "squad": "crew",
    "who": "whoami", "me": "whoami", "self": "whoami", "status": "whoami",
    "where": "nslookup", "map": "nslookup", "known": "nslookup", "locations": "nslookup",
    "history": "log", "journal": "log",
    "sleep": "wait", "rest": "wait", "idle": "wait",
    "bye": "exit", "q": "exit", "quit": "exit",
    "hi": "_greet", "hello": "_greet", "hey": "_greet",
    "what": "_what", "why": "_why", "how": "_how",
    "battle": "fight", "challenge": "fight", "duel": "fight",
    "bag": "inventory", "items": "inventory", "inv": "inventory",
    "w": "walk", "step": "walk",
    "z": "zoom", "scope": "zoom", "tier": "zoom",
    "a": "attack", "d": "defend",
  }

  cmd = cmdMap[cmd] || cmd

  // --- NATURAL LANGUAGE PATTERNS ---

  // "go to X"
  if (/^(go|travel|visit|sail|move|fly|swim)\s+(to\s+)?(.+)$/i.test(trimmed)) {
    const match = trimmed.match(/^(?:go|travel|visit|sail|move|fly|swim)\s+(?:to\s+)?(.+)$/i)
    if (match) return { cmd: "ssh", arg: resolveTarget(match[1].trim()) }
  }

  // "walk to X Y"
  if (/^walk\s+(?:to\s+)?(\d+)\s+(\d+)$/i.test(trimmed)) {
    const match = trimmed.match(/^walk\s+(?:to\s+)?(\d+)\s+(\d+)$/i)
    if (match) return { cmd: "walk", arg: match[1], arg2: match[2] }
  }

  // "fight X -t" (tournament mode)
  if (/^(fight|battle|challenge|duel)\s+(.+?)\s+(-t|--tournament)$/i.test(trimmed)) {
    const match = trimmed.match(/^(?:fight|battle|challenge|duel)\s+(.+?)\s+(?:-t|--tournament)$/i)
    if (match) return { cmd: "fight", arg: match[1].trim(), arg2: "tournament" }
  }

  // "fight X"
  if (/^(fight|battle|challenge|duel)\s+(.+)$/i.test(trimmed)) {
    const match = trimmed.match(/^(?:fight|battle|challenge|duel)\s+(.+)$/i)
    if (match) return { cmd: "fight", arg: match[1].trim() }
  }

  // "zoom /N" or "zoom N"
  if (/^(zoom|scope|tier|z)\s+\/?(\d+)$/i.test(trimmed)) {
    const match = trimmed.match(/^(?:zoom|scope|tier|z)\s+\/?(\d+)$/i)
    if (match) return { cmd: "zoom", arg: match[1] }
  }

  if (cmd === "ping" && rest) return { cmd: "ping", arg: resolveTarget(rest) }
  if (cmd === "ssh" && rest) return { cmd: "ssh", arg: resolveTarget(rest) }

  // "look at X" → cat X
  if (/^look\s+at\s+(.+)$/i.test(trimmed)) {
    const match = trimmed.match(/^look\s+at\s+(.+)$/i)
    if (match) return { cmd: "cat", arg: match[1].trim() }
  }

  if (cmd === "cat" && rest) return { cmd: "cat", arg: rest }

  // "talk to X" / "use X"
  if ((cmd === "connect" || cmd === "talk") && rest) {
    const loc = state.locations.get(state.player.currentIP)
    if (loc) {
      const portNum = parseInt(rest)
      if (!isNaN(portNum)) return { cmd: "connect", arg: rest }
      const svc = loc.services.find(s =>
        s.name.toLowerCase().includes(rest) || rest.includes(s.name.toLowerCase())
      )
      if (svc) return { cmd: "connect", arg: String(svc.port) }
    }
    return { cmd: "connect", arg: rest }
  }

  if (cmd === "catch" && rest) return { cmd: "catch", arg: rest }
  if (cmd === "scan" && rest) return { cmd: "scan", arg: rest.replace("/8", "").trim() + "/8" }

  // walk with args
  if (cmd === "walk" && rest) {
    const walkParts = rest.split(/\s+/)
    if (walkParts.length >= 2) return { cmd: "walk", arg: walkParts[0], arg2: walkParts[1] }
  }

  // bare name → suggest location
  if (!cmdMap[cmd] && !["ls","cd","cat","ssh","ping","scan","arp","connect","catch","crew","whoami","nslookup","log","wait","exit","help","?","fight","walk","zoom","inventory"].includes(cmd)) {
    const fullInput = trimmed
    const resolved = nameMap.get(fullInput)
    if (resolved) return { cmd: "_suggest_location", arg: resolved }
    const nameResolved = nameMap.get(cmd)
    if (nameResolved) return { cmd: "_suggest_location", arg: nameResolved }
  }

  if (["ssh", "ping", "cat"].includes(cmd) && rest) {
    const resolved = resolveTarget(rest)
    if (resolved !== rest) return { cmd, arg: resolved }
  }

  return { cmd, arg: rest }
}

// --- COMMAND ROUTER ---

function processCommand(state: GameState, input: string): CmdResult {
  // if in combat, route to combat system
  if (state.arena) {
    const { cmd } = interpret(state, input)
    const trimmed = input.trim().toLowerCase()
    const combatCmds = ["attack", "defend", "flee", "run"]

    if (combatCmds.includes(cmd) || combatCmds.includes(trimmed)) {
      return { output: processCombatCommand(state, cmd === "run" ? "flee" : (combatCmds.includes(cmd) ? cmd : trimmed)) }
    }
    if (trimmed.startsWith("item ")) {
      return { output: processCombatCommand(state, trimmed) }
    }
    if (cmd === "help" || cmd === "?") return cmd_help(state)
    return { output: `you're in combat! commands: attack | defend | item <name> | flee${arenaStatus(state.arena)}` }
  }

  const { cmd, arg, arg2 } = interpret(state, input)

  // special interpreted commands
  if (cmd === "_greet") {
    const loc = state.locations.get(state.player.currentIP)
    return { output: `the ${loc?.name || "void"} doesn't say hello back.\nbut something shifts. you were noticed.\ntry: ls` }
  }
  if (cmd === "_what") {
    return { output: `good question.\nyou're ${state.player.name}, a temporary file.\nyou're at ${state.player.currentIP}. TTL: ${state.player.ttl}.\nthe rest is for you to find out.\ntry: ls or help` }
  }
  if (cmd === "_why") {
    return { output: `because someone at 126.254.254.254\nhas been sending LOG for 57 years.\nand someone should answer.` }
  }
  if (cmd === "_how") {
    return { output: `type commands. the world responds.\nstart with: ls\nor just: ping 8.8.8.8\neveryone starts there.` }
  }
  if (cmd === "_suggest_location") {
    const loc = state.locations.get(arg)
    const name = loc?.name || arg
    return { output: `did you mean:\n  ping ${arg}  — check if ${name} is reachable (${hopDistance(state.player.currentIP, arg)} hops)\n  ssh ${arg}   — travel to ${name}` }
  }

  switch (cmd) {
    case "help": case "?": return cmd_help(state)
    case "ls": return cmd_ls(state)
    case "cd": return arg ? cmd_cd_dir(state, arg) : cmd_cd_dir(state, "/")
    case "cat": return arg ? cmd_cat(state, arg) : { output: "cat: specify a file" }
    case "ssh": return arg ? cmd_ssh(state, arg) : { output: "ssh: specify a location (IP or name)" }
    case "ping": return arg ? cmd_ping(state, arg) : { output: "ping: specify a location (IP or name)" }
    case "scan": return arg ? cmd_scan(state, arg) : { output: "scan: use scan <n>/8" }
    case "arp": return cmd_arp(state)
    case "connect": return arg ? cmd_connect(state, arg) : { output: "connect: specify a port or service name" }
    case "catch": return arg ? cmd_catch(state, arg) : { output: "catch: specify entity name" }
    case "fight": return arg ? cmd_fight(state, arg, arg2 === "tournament") : { output: "fight: specify entity name. add -t for tournament mode." }
    case "crew": return cmd_crew(state)
    case "walk": return (arg && arg2) ? cmd_walk(state, arg, arg2) : { output: `walk: usage: walk <x> <y>. you're at (${state.player.x},${state.player.y})` }
    case "zoom": return arg ? cmd_zoom(state, arg) : { output: `zoom: usage: zoom <mask>. current: /${state.player.mask} (${maskTierLabel(state.player.mask)})` }
    case "whoami": return cmd_whoami(state)
    case "nslookup": return cmd_nslookup(state)
    case "log": return cmd_log(state)
    case "inventory": return cmd_inventory(state)
    case "wait": return cmd_wait(state)
    case "exit": case "quit": return { output: "EXIT" }
    case "attack": case "defend": case "flee": case "run":
      return { output: "you're not in combat. use: fight <entity name>" }
    default:
      if (!cmd) return { output: "" }
      return { output: `${cmd}: command not found.\nthe ocean doesn't understand '${input.trim()}'.\ntry: help` }
  }
}

// --- BOOT ---

function getPrompt(state: GameState): string {
  if (state.arena) {
    return `⚔️ /30 [${state.arena.mode}] round ${state.arena.round}> `
  }
  const loc = state.locations.get(state.player.currentIP)
  const locName = loc ? loc.name.toLowerCase().replace(/[^a-z0-9]/g, "-") : "void"
  const cwd = state.player.cwd === "/" ? "" : state.player.cwd
  return `${state.player.name}@${locName}:${cwd || "~"}[TTL:${state.player.ttl}]$ `
}

async function main() {
  const state = createGame()

  console.log(`
┌──────────────────────────────────────────────┐
│  IPv4 ENGINE v0.3                            │
│                                              │
│  you are ${state.player.mac}              │
│  a temporary file in Oak's Lab               │
│  TTL: ${String(state.player.ttl).padEnd(3)}  tier: /${state.player.mask} (${maskTierLabel(state.player.mask).padEnd(10)})  │
│                                              │
│  IP = where you are    MAC = who you are     │
│  TTL = how long you last                     │
│  /mask = who you are in the system           │
│  C.D = your position on the 256×256 grid     │
│                                              │
│  new: walk, fight, zoom, inventory           │
│  start: ls                                   │
└──────────────────────────────────────────────┘
`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(state),
  })

  rl.prompt()

  rl.on("line", (line) => {
    if (state.gameOver) {
      rl.close()
      process.exit(0)
    }

    const result = processCommand(state, line)

    if (result.output === "EXIT") {
      console.log(`\n${state.player.crew.length} crew. /${state.player.mask} (${maskTierLabel(state.player.mask)}). TTL: ${state.player.ttl}/64. ${state.tick} ticks.\ngoodbye, ${state.player.name}.`)
      rl.close()
      process.exit(0)
    }

    if (result.output) console.log(`\n${result.output}\n`)

    if (state.gameOver) {
      rl.close()
      process.exit(0)
    }

    rl.setPrompt(getPrompt(state))
    rl.prompt()
  })

  rl.on("close", () => process.exit(0))
}

main()
