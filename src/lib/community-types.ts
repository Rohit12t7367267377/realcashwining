// Client-side shapes of Community server-function results (kept explicit so the UI stays type-checked).
export type Author = { name: string; username: string | null; avatar: string | null };
export type PersonHit = { userId: string; name: string; username: string | null; avatar: string | null; bio: string | null; isPrivate: boolean; followers: number };
export type FollowRequest = { userId: string; createdAt: string; author: Author };
export type BlockedUser = { userId: string; author: Author };
export type Connection = { userId: string; author: Author };
export type AnalyticsDay = { day: string; validViews: number; watchSeconds: number; avgViewSeconds: number; avgPctViewed: number; likes: number; comments: number; newFollowers: number };
export type AnalyticsPost = { id: string; title: string; category: string; mediaType: string | null; likes: number; comments: number; validViews: number; avgPct: number };
