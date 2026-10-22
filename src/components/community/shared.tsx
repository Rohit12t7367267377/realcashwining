import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Author = { name: string; username: string | null; avatar: string | null };

export function UserAvatar({ author, size = 40, className }: { author: Author; size?: number; className?: string }) {
  return (
    <Avatar className={cn("shrink-0", className)} style={{ width: size, height: size }}>
      {author.avatar && <AvatarImage src={author.avatar} alt="" />}
      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function UserLink({ id, author, sub, size = 40 }: { id: string; author: Author; sub?: string; size?: number }) {
  return (
    <Link to="/u/$id" params={{ id }} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <UserAvatar author={author} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight">{author.name}</span>
        {(sub ?? (author.username ? `@${author.username}` : "")) && <span className="block truncate text-[11px] text-muted-foreground">{sub ?? `@${author.username}`}</span>}
      </span>
    </Link>
  );
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className={cn("h-3.5 w-3.5", value >= n - 0.25 ? "fill-warning text-warning" : value >= n - 0.75 ? "fill-warning/50 text-warning" : "fill-muted text-muted-foreground/40")} aria-hidden>
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9 4.8 17.7l1-5.9L1.5 7.7l5.9-.8L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

export const CATEGORY_LABEL: Record<string, string> = { post: "Explanation", video: "Video", quiz: "Quiz", notes: "Notes", exam_tip: "Exam tip", news: "News", discussion: "Q&A" };
