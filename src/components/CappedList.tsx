import { Children, useState, type ReactNode } from "react";

/** Mobile-friendly long list: shows the first `limit` rows and a "Show more" button for the rest. */
export function CappedList({ children, limit = 8, className = "grid gap-2", step = 10 }: { children: ReactNode; limit?: number; className?: string; step?: number }) {
  const [n, setN] = useState(limit);
  const items = Children.toArray(children);
  return (
    <>
      <div className={className}>{items.slice(0, n)}</div>
      {items.length > n && (
        <button type="button" onClick={() => setN(n + step)} className="press mt-2 w-full rounded-2xl bg-muted py-3 text-sm font-bold">
          Show more ({items.length - n})
        </button>
      )}
    </>
  );
}
