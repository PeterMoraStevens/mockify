// Room lifetime rules, shared by the server and the room UI.

export const ROOM_DEFAULT_MS = 60 * 60_000;
/** Hard cap on a room's lifetime, extensions included. */
export const ROOM_MAX_MS = 3 * 60 * 60_000;
export const ROOM_EXTEND_OPTIONS_MIN = [15, 30] as const;
/** Open (not ended, not expired) rooms one person can have created at once. */
export const MAX_OPEN_ROOMS = 3;
/** Reviews can still be left this long after a room ends. */
export const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60_000;
/** Warn people in the room this long before it closes. */
export const ROOM_WARN_MS = 5 * 60_000;

export type ReviewRole = "interviewer" | "candidate";

/** What each side rates. score_1..3 in the reviews table, in this order. */
export const REVIEW_CRITERIA: Record<ReviewRole, { key: string; label: string; hint: string }[]> = {
  // Written by the interviewer, about the candidate.
  interviewer: [
    { key: "problemSolving", label: "Problem solving", hint: "Approach, correctness, handling edge cases" },
    { key: "communication", label: "Communication", hint: "Thinking out loud, clarifying questions" },
    { key: "codeQuality", label: "Code quality", hint: "Readable, well-structured, idiomatic" },
  ],
  // Written by the candidate, about the interviewer.
  candidate: [
    { key: "clarity", label: "Clarity", hint: "Explained the problem and expectations clearly" },
    { key: "helpfulness", label: "Helpfulness", hint: "Useful hints without giving it away" },
    { key: "professionalism", label: "Professionalism", hint: "Respectful, on time, felt like a real interview" },
  ],
};

/** Coding rooms get the editor and tests; system design rooms are whiteboard-only. Switchable in the room. */
export const ROOM_MODES = ["coding", "design"] as const;
export type RoomMode = (typeof ROOM_MODES)[number];
export const isRoomMode = (m: unknown): m is RoomMode => m === "coding" || m === "design";

export type RoomSummary = {
  id: string;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  open: boolean;
  createdByMe: boolean;
  problemSlug: string | null;
  problemTitle: string | null;
  mode: RoomMode;
  participants: { id: string; displayName: string; username: string }[];
};
