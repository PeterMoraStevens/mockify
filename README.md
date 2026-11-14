# mockify

An open-source, **self-hosted** mock interview platform. You send a link and both people get video, a shared editor, a whiteboard and a real code judge. Calls run directly between the two browsers. Your homelab hands out connection details and runs code.

It used to be hard to agree on where to hold a mock interview: one person wants FaceTime, another Discord, and you still need somewhere to write code. Mockify puts all of that in one place, on hardware you control.

```
 Browser A ◄──── direct WebRTC: A/V + editor ────► Browser B
     │   └ ─ ─ ►  Cloudflare TURN (fallback only)  ◄ ─ ─ ┘   │
     ▼                                                      ▼
 ═══════════════ Cloudflare tunnel (HTTPS + WebSocket) ═══════════════
     │                         │
 ┌───▼──────────── Homelab ────▼──────────────────────────────────┐
 │ Next.js app               PeerJS server         Piston          │
 │ UI, auth, TURN creds,     signaling only        LAN only,       │
 │ runs ─────────────────────────────────────────► never tunneled  │
 └─────────────────────────────────────────────────────────────────┘
```

## How a session works

- **Joining.** `/room/new` mints an unguessable room ID (about 103 bits) and redirects to it. The first person to open it takes PeerJS slot `a`. The second finds `a` taken, takes `b`, and calls `a`. There's no rooms database.
- **Connecting.** Before connecting, the browser asks `/api/turn` for ICE servers. The server mints 4-hour Cloudflare TURN credentials, so your API token never reaches a browser. WebRTC tries a direct path first and falls back to the relay. Both people see a **Direct** or **Relayed** badge with their ping.
- **Shared state.** The editor, problem, language, roles, timer, whiteboard and run results live in one Yjs document. It syncs over the WebRTC data channel and is saved to `localStorage`, so a refresh rejoins without losing or duplicating code. The server never sees the session.
- **Running code.** Run and Submit go to `/api/run`, which sends the code to your self-hosted Piston instance over the LAN and grades the output on the server. Hidden tests never reach the browser: their results come back as pass/fail and timing only.
- **Healing.** If either person refreshes or drops, `b` keeps redialling `a` and the session picks up where it left off.

## Features

- **Lobby device check:** camera preview, mic/camera pickers, a live mic level meter and a TURN readiness check.
- **Shared editor:** CodeMirror 6 with live cursors, in Python, JavaScript, TypeScript, Java, C, C++, C# (.NET), Go, Rust, Kotlin, Swift, Ruby, PHP, Scala, Dart and Bash.
- **Video:** mute, camera on/off and screen share. Tracks are swapped in place, with no renegotiation.
- **Roles:** interviewer and candidate, with a swap button.
- **Shared timer:** a countdown corrected for clock drift between the two machines.
- **Interviewer-only guide:** hints revealed one at a time, follow-ups, expected complexity and author notes.
- **Private notes:** kept in your own browser only.
- **Whiteboard:** Excalidraw synced per element, for system design.
- **Feedback form:** scores for problem solving, communication and code quality, plus notes, saved to the candidate's profile.
- **Matchmaking:** an "available now" queue that pairs you with whoever is free.
- **Problem uploads:** checked against a schema, and the required reference solution must pass every test on Piston before the problem is published.

## Running it

Requirements: Node 22.13+ (24 recommended) and a self-hosted [Piston](https://github.com/engineer-man/piston) instance you can reach, with runtimes installed for the languages you want (Mockify maps to these packages: `python node typescript java gcc dotnet go rust kotlin swift ruby php scala dart bash`; any that are missing show an install hint in the room).

### Local development

```bash
cd client
cp .env.example .env.local   # set PISTON_URL and PEER_PORT=9000
npm install
npm run dev:peer              # PeerJS signaling on :9000
npm run dev                   # app on :3000
```

`npm run dev` passes `--experimental-sqlite`, which Node versions before 22.13/23.4 need for the built-in `node:sqlite`. Newer versions ignore it.

### Homelab (Docker)

```bash
cp client/.env.example client/.env      # Piston URL, Cloudflare TURN key
docker compose up -d --build            # app :3000, peerjs :9000
TUNNEL_TOKEN=... docker compose --profile tunnel up -d --build
```

In the Cloudflare tunnel, route **one hostname** two ways:

| Path       | Service              |
|------------|----------------------|
| `/peerjs*` | `http://peerjs:9000` |
| everything else | `http://app:3000` |

`cloudflared/config.example.yml` shows the same thing for a locally managed tunnel. **Don't expose Piston.** Only the app talks to it.

### Configuration

All settings live in `client/.env.example`. The main ones:

| Variable | Purpose |
|---|---|
| `PISTON_URL` | Piston base URL on your LAN (e.g. `http://192.168.1.50:2000`) |
| `PISTON_API_KEY` | Sent as `Authorization`, if Piston sits behind an auth proxy |
| `PISTON_MAX_RUN_TIMEOUT_MS` | Per-test time limit cap. Must be ≤ your Piston's `PISTON_RUN_TIMEOUT` (default 3000) |
| `PISTON_CONCURRENCY` | Parallel `/execute` calls per run (Piston has no batch API, so each test is one call) |
| `PISTON_RUNTIMES` | Pin versions, e.g. `{"python":"python@3.12.0"}`. Otherwise the newest installed runtime is used |
| `CLOUDFLARE_TURN_KEY_ID` / `CLOUDFLARE_TURN_API_TOKEN` | TURN key from Cloudflare Calls. Without it, rooms use STUN only |
| `PEER_HOST` / `PEER_PORT` / `PEER_PATH` | Where browsers find PeerJS (defaults to the page's host, port 443/80, path `/peerjs`) |
| `ALLOW_SIGNUPS`, `SIGNUP_INVITE_CODE` | Close sign-ups, or make them invite-only |
| `ALLOW_PROBLEM_UPLOADS` | Turn the upload page off |
| `DATA_DIR` | SQLite database and uploaded problems |

## Accounts and data

Accounts use username and password: scrypt hashes, and server-side sessions in an httpOnly cookie. Everything is stored in `DATA_DIR/mockify.sqlite`. Every API route checks the session. Login and sign-up are rate-limited.

The database holds:

- users and sessions
- feedback
- a small `room_attendance` table, written when a user fetches TURN credentials for a room

Feedback is only accepted between two people who were both recorded in the same room within the last 24 hours. Nothing about the session itself (code, video, whiteboard) is ever stored on the server.

## Problem format

Problems are plain stdin/stdout, so they work in every Piston language with no extra harness. Each starter reads the input and calls `solve()`, which makes it feel like LeetCode. See `client/problems/*.json` for complete examples:

```jsonc
{
  "slug": "two-sum", "title": "Two Sum", "difficulty": "easy", "tags": ["array"],
  "license": "MIT", "source": { "name": "…", "url": "…" },
  "description": "Markdown, including the input/output format",
  "examples": [{ "input": "2 7 11 15\n9\n", "output": "0 1\n", "explanation": "…" }],  // ≥ 1, visible
  "tests":    [{ "input": "…", "output": "…" }],                                          // hidden
  "starters": { "python": "…", "cpp": "…" },                                             // ≥ 1 language
  "interviewer": { "hints": [], "followUps": [], "expectedComplexity": { "time": "O(n)", "space": "O(n)" } },
  "reference": { "language": "python", "code": "…" },                                     // required
  "limits": { "cpuTimeSec": 2, "memoryKb": 128000 }                                       // optional
}
```

Output is compared line by line, ignoring trailing whitespace. Uploads go through `/problems/new`. The reference solution runs against every test first, and the problem is only published if it passes all of them.

### Importing from Exercism

[Exercism's problem-specifications](https://github.com/exercism/problem-specifications) are MIT-licensed. Their tests are written as function calls. The importer converts each argument to a JSON line on stdin and the expected return value to JSON on stdout, then writes Python, JavaScript and TypeScript starters:

```bash
git clone https://github.com/exercism/problem-specifications
cd client && npm run import:exercism -- ../problem-specifications leap > leap.json
```

Before uploading, fill in a real `reference`, a difficulty and some hints.

## Known limitations and to-dos

- Roles live in the peer-to-peer session, so the server can't check who is interviewing. The candidate's UI never requests the interviewer view, but a determined candidate could call `/api/problems/<slug>?view=interviewer` themselves. Hidden tests and reference solutions are never exposed.
- Rooms hold exactly two people. Observers would need a mesh or an SFU.
- Excalidraw images aren't synced (the image tool is disabled).
- Matchmaking runs in memory in a single process, so a restart clears the queue. Bookable time slots aren't built yet.
- Seed-problem starters were compiled and run locally for Python, JavaScript, TypeScript, Java, C, C++, Go, Swift, Ruby and Bash. The C#, Rust, Kotlin, PHP, Scala and Dart starters were not (no local toolchain), so try each once on your Piston.
- TypeScript starters begin with `/// <reference lib="es2022" />` so `Map`/`Set` type-check if Piston's `tsc` uses its default ES5 target. Iterating a `Map`/`Set` with `for...of` may still need `Array.from(...)` under that target.
- Piston compiles once per test case (it has no batch API), so Submit on compiled languages is slower than on interpreted ones. Raise `PISTON_CONCURRENCY` (and Piston's `PISTON_MAX_CONCURRENT_JOBS`) if that's a problem.
