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

- **Creating.** **New room** opens `/room/new`, where you pick the interview type (coding or system design), the room length (30 minutes to 2 hours) and any friends to invite. Nothing is created until you press **Create room**, which calls `POST /api/rooms`; the room gets an unguessable ID (about 103 bits).
- **Joining.** A room seats two people for its whole life: the first two accounts to join get the seats, and anyone else sees "This room is full". The first browser takes PeerJS slot `a`; the second finds `a` taken, takes `b`, and calls `a`.
- **Room time.** Rooms stay open for 60 minutes. Either person can extend by 15 or 30 minutes, up to 3 hours in total. Each person can have at most 3 open rooms they created, so rooms can't pile up. When time runs out (or someone presses **End interview**) the room closes.
- **Connecting.** Before connecting, the browser asks `/api/turn` for ICE servers. The server mints 4-hour Cloudflare TURN credentials, so your API token never reaches a browser. WebRTC tries a direct path first and falls back to the relay. The header shows a signal-strength icon; the latency number only appears when the link is poor.
- **Shared state.** The editor, problem, language, roles, timer, whiteboard, run results and shared notes live in one Yjs document. It syncs over the WebRTC data channel and is cached in `localStorage`. Both browsers also save it to the server every 20 seconds (merged, so the order doesn't matter), which lets you rejoin from any browser while the room is open and powers the interview summary afterwards. Live mouse pointers go over the same channel but aren't stored.
- **Running code.** Run and Submit go to `/api/run`, which sends the code to your self-hosted Piston instance over the LAN and grades the output on the server. Hidden tests never reach the browser: their results come back as pass/fail and timing only.
- **Healing.** If either person refreshes or drops, `b` keeps redialling `a` and the session picks up where it left off. Leaving releases the camera and mic; rejoining (from **Rooms**) asks again, and remembers whether your mic and camera were on.
- **Wrapping up.** **End interview** closes the room for both people and asks each to rate the other: the interviewer rates problem solving, communication and code quality; the candidate rates clarity, helpfulness and professionalism. Each interview then has a summary page with the final code, whiteboard, notes and both reviews.

## Features

- **Lobby device check:** camera preview, mic/camera pickers, a live mic level meter, and an **Invite a friend** button so you can bring someone in before you join.
- **Shared editor:** CodeMirror 6 with live cursors (name flags fade after a few seconds) and live mouse pointers across the whole room. Pointers are anchored to content, not screen position: hover a word in the problem and the other person's pointer sits on that same word, even with a different window size, layout or scroll position (and it hides if that part is scrolled out of view). Languages: in Python, JavaScript, TypeScript, Java, C, C++, C# (.NET), Go, Rust, Kotlin, Swift, Ruby, PHP, Scala, Dart and Bash.
- **Video:** mute, camera on/off and screen share. Tracks are swapped in place, with no renegotiation.
- **Roles:** interviewer and candidate, with a swap button.
- **Shared timer:** a countdown with a visible length picker, corrected for clock drift between the two machines.
- **Interviewer-only guide:** hints revealed one at a time, follow-ups, expected complexity and author notes.
- **Notes:** private by default and saved to your account. Tick "share" and the other person can read them live and on the summary.
- **Whiteboard:** Excalidraw synced per element.
- **System design mode:** pick System design when creating a room (or open `/room/new?mode=design`) for a whiteboard-only layout with no editor or tests. Either person can switch between Coding and System design from the room header at any time; the switch is shared.
- **Two-way feedback:** both people rate each other when the interview ends (or later, from the summary, for up to a week).
- **Rooms page:** rejoin or **close** open rooms (closing ends the room for both people; its summary stays), see invites, and browse past interviews.
- **Friends and invites:** add people by username and invite them into a room.
- **Notifications:** a bell in the navbar lists room invites (Join / dismiss) and friend requests (accept / decline). It refreshes every few seconds while the tab is visible, pops a toast for anything new, and keeps the Friends page live.
- **Profile:** edit your display name and username (sign in with the new one), and change your password (signs out your other devices). Review cards on the profile are clickable and open that interview's summary.
- **Problem pages:** each problem in the list opens `/problems/<slug>` with the statement, examples, and hints, follow-ups and expected complexity hidden until you click to reveal them. Signed-in users also get a practice editor there to Run against the examples and Submit against the hidden tests (code is kept in the browser per problem and language). Guests see the statement only; the editor isn't rendered and `/api/run` returns 401.
- **Problem builder:** a form for title, statement, function signature, examples, hidden tests, reference solution and interviewer guide. Parameters and the return value can be `int`, `long` (64-bit), `bool` or `string`, or arrays built step by step: each dropdown is a data type or "array of…", and choosing "array of…" adds another dropdown for what the array holds (up to four levels for parameters, e.g. a list of graphs as edge lists `int[][][]`; two for the return value). It writes the starter code for all 16 languages (C stops at 2-D arrays, Bash at 1-D), can fill in expected outputs by running your reference, and saves drafts as you type. Your problems and drafts are listed under **Your problems**, where you can edit or delete them. Raw JSON upload is still available.
- **57 built-in problems:** classic interview questions (arrays, strings, DP, stacks, binary search, grids, graphs, intervals, backtracking…) with hidden tests checked against brute-force solutions. Examples are shown readably in the room, e.g. `intervals = [[1,3],[2,6]]`.
- **Custom 404 page** for unknown links and interviews you can't see.

## Running it

Requirements: Node 22.13+ (24 recommended) and a self-hosted [Piston](https://github.com/engineer-man/piston) instance you can reach, with runtimes installed for the languages you want (Mockify maps to these packages: `python node typescript java gcc dotnet go rust kotlin swift ruby php scala dart bash`; any that are missing show an install hint in the room).

> **Piston setting you must change:** start Piston with `PISTON_OUTPUT_MAX_SIZE=65536`. Its default keeps only 1,024 characters of output, so any test with a longer answer (14 of the built-in problems, e.g. Group Anagrams, Game of Life, Rotate Image) fails with "Output Limit Exceeded" even when the code is correct.

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
| `ALLOW_PROBLEM_UPLOADS` | Turn problem publishing (builder and JSON upload) off |
| `DATA_DIR` | SQLite database and uploaded problems |

## Accounts and data

Accounts use username and password: scrypt hashes, and server-side sessions in an httpOnly cookie. Everything is stored in `DATA_DIR/mockify.sqlite`. Every API route checks the session. Login and sign-up are rate-limited.

The database holds:

- users and sessions
- rooms: deadline, the saved shared document (code, whiteboard, shared notes), and who sat in them
- each person's notes per room, and whether they're shared
- reviews (both directions), friendships, room invites
- who published which problem, and problem drafts

Video and audio never touch the server, and nothing is recorded. Reviews are only accepted from one person in a room about the other, for up to a week after it ends. The schema is migrated automatically on startup (tracked with SQLite's `user_version`); the old one-way `feedback` table is folded into `reviews`.

## Problem format

Problems are plain stdin/stdout, so they work in every Piston language with no extra harness. Each starter reads the input and calls `solve()`, which makes it feel like LeetCode. The builder at `/problems/new` produces this format for you (one input line per parameter):

| Type | One stdin line | Example |
| --- | --- | --- |
| `int`, `long`, `bool` | the value | `42`, `true` |
| `string` | the whole line (spaces allowed) | `hello world` |
| 1-D array | elements separated by spaces | `[2,7,11]` → `2 7 11` |
| 2-D and deeper | length-prefixed, recursively | `[[1,2],[3]]` → `2 2 1 2 1 3` |
| `ListNode` (linked list) | the values in order | `[1,2,3]` → `1 2 3` |
| `TreeNode` (binary tree) | level order, `null` for a missing child, trailing `null`s dropped | `[3,9,20,null,null,15,7]` → `3 9 20 null null 15 7` |

Lists and trees hold integers and can be a parameter or the return type, but not inside an array; an empty line is an empty list/tree. Their starters (every language except Bash) have a marked "node classes" section near the top. In a room, the **Node classes** switch next to the language picker either fills it with ready-made `ListNode`/`TreeNode` classes or replaces them with a short description of what the harness needs, so the candidate writes the classes from scratch (the default). Switching only rewrites that section, so code typed elsewhere is kept.

Strings inside arrays are single words. Output is the scalar on one line, a 1-D array space-separated on one line, or a 2-D array as one line per row. In the builder, type nested arrays as JSON; the starter code handles the encoding. See `client/problems/*.json` for complete examples:

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

Output is compared line by line, ignoring trailing whitespace. The reference solution runs against every test first, and the problem is only published if it passes all of them. Keep each test's input under about 60 KB: Piston rejects request bodies over ~100 KB (code + stdin), and the schema caps a single input at 64 KB. Expected outputs must stay under 30 KB, because a program's output is cut off at 32 KB before it's compared. Piston also caps how much output it keeps per run (`PISTON_OUTPUT_MAX_SIZE` on the Piston side): set it to at least `65536`, or tests with long outputs (grids, big arrays) will fail as "output too long".

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
- Notifications are polled (every 8 s while the tab is visible), not pushed.
- Excalidraw images aren't synced (the image tool is disabled).
- Bookable time slots aren't built yet.
- Seed-problem starters, including every nested-array type, were compiled and run locally for Python, JavaScript, TypeScript, Java, C, C++, Go, Swift, Ruby and Bash. The C#, Rust, Kotlin, PHP, Scala and Dart starters were not (no local toolchain), so try each once on your Piston.
- TypeScript starters begin with `/// <reference lib="es2022" />` so `Map`/`Set` type-check if Piston's `tsc` uses its default ES5 target. Iterating a `Map`/`Set` with `for...of` may still need `Array.from(...)` under that target.
- Piston compiles once per test case (it has no batch API), so Submit on compiled languages is slower than on interpreted ones. Raise `PISTON_CONCURRENCY` (and Piston's `PISTON_MAX_CONCURRENT_JOBS`) if that's a problem.
