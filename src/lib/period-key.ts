export function periodKeyFor(period: "week" | "month" | "year", d: Date = new Date()) {
  const y = d.getUTCFullYear();
  if (period === "year") return String(y);
  if (period === "month") return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const start = new Date(Date.UTC(y, 0, 1));
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
