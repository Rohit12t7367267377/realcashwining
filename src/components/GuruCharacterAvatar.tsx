/** 2D SVG avatar for Guru.AI teacher characters — style + accent colour driven. */
type Props = {
  accent?: string | null;
  style?: string | null;
  emoji?: string | null;
  size?: number;
  className?: string;
};

const HAIR: Record<string, string> = {
  classic: "#3f3f46",
  maths: "#1f2937",
  science: "#4c1d95",
  tech: "#111827",
  ai: "#0e7490",
  language: "#7c2d12",
  exam: "#27272a",
  college: "#374151",
  career: "#4a044e",
};

export function GuruCharacterAvatar({ accent, style, emoji, size = 56, className }: Props) {
  const color = accent || "#6366f1";
  const hair = HAIR[style ?? "classic"] ?? HAIR.classic;
  const glasses = style === "tech" || style === "college" || style === "ai";
  const cap = style === "exam";

  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={`bg-${style ?? "c"}-${color.replace("#", "")}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="26" fill={`url(#bg-${style ?? "c"}-${color.replace("#", "")})`} />
        {/* shoulders */}
        <path d="M18 100c0-18 14-28 32-28s32 10 32 28z" fill="#ffffff" opacity="0.92" />
        <path d="M50 72v28" stroke={color} strokeWidth="3" opacity="0.5" />
        {/* neck + face */}
        <rect x="45" y="58" width="10" height="10" rx="4" fill="#f2c9a6" />
        <circle cx="50" cy="44" r="19" fill="#f7d3ae" />
        {/* hair */}
        <path d="M31 42c0-13 9-21 19-21s19 8 19 21c-4-8-11-11-19-11s-15 3-19 11z" fill={hair} />
        {/* eyes + smile */}
        <circle cx="43" cy="44" r="2.4" fill="#1f2937" />
        <circle cx="57" cy="44" r="2.4" fill="#1f2937" />
        <path d="M44 53q6 5 12 0" stroke="#b45309" strokeWidth="2" fill="none" strokeLinecap="round" />
        {glasses && (
          <g stroke="#1f2937" strokeWidth="1.8" fill="none">
            <circle cx="43" cy="44" r="6" />
            <circle cx="57" cy="44" r="6" />
            <path d="M49 44h2" />
          </g>
        )}
        {cap && <path d="M28 30h44l-22-12z" fill="#111827" />}
        {emoji && (
          <text x="78" y="88" fontSize="20" textAnchor="middle">
            {emoji}
          </text>
        )}
      </svg>
    </div>
  );
}
