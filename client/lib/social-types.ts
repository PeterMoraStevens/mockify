// Types shared with the browser (social.ts itself is server-only).
export type Person = { id: string; username: string; displayName: string };
export type FriendLists = { friends: Person[]; incoming: Person[]; outgoing: Person[] };
export type Invite = { id: string; roomId: string; from: Person; createdAt: number; expiresAt: number };
