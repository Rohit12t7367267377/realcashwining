/**
 * Animated 2D AI teacher character standing at a whiteboard.
 * The character blinks, moves its pointer arm and its mouth animates while
 * speaking; board lines appear one by one as the lesson is taught.
 */
export function GuruTeacherBoard({
  title,
  lines,
  revealed,
  speaking,
  teacher = "Guru",
}: {
  title: string;
  lines: string[];
  revealed: number;
  speaking: boolean;
  teacher?: string;
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-3 ring-1 ring-border">
      <style>{`
        @keyframes guru-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.1) } }
        @keyframes guru-talk { 0%,100% { transform: scaleY(0.5) } 50% { transform: scaleY(1.25) } }
        @keyframes guru-point { 0%,100% { transform: rotate(-14deg) } 50% { transform: rotate(6deg) } }
        @keyframes guru-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        .guru-eye { animation: guru-blink 5s infinite; transform-origin: center }
        .guru-mouth-talk { animation: guru-talk .28s infinite; transform-origin: center }
        .guru-arm { animation: guru-point 2.4s ease-in-out infinite; transform-origin: 74px 96px }
        .guru-body { animation: guru-bob 3.4s ease-in-out infinite }
      `}</style>

      <div className="flex items-stretch gap-2">
        {/* Whiteboard */}
        <div className="min-w-0 flex-1 rounded-2xl bg-[hsl(150_35%_18%)] p-3 text-white shadow-lift ring-4 ring-[hsl(30_45%_35%)]">
          <div className="border-b border-white/30 pb-1 text-sm font-black tracking-wide">{title}</div>
          <ul className="mt-2 space-y-1.5">
            {lines.slice(0, revealed).map((l, i) => (
              <li key={i} className="animate-rise-in flex gap-2 text-[13px] leading-snug">
                <span className="opacity-60">{i + 1}.</span>
                <span className="font-medium">{l}</span>
              </li>
            ))}
            {revealed === 0 && <li className="text-[13px] opacity-70">Ask a topic and I&apos;ll teach it on the board…</li>}
          </ul>
        </div>

        {/* 2D teacher */}
        <svg viewBox="0 0 120 170" className="guru-body h-[190px] w-[110px] shrink-0" role="img" aria-label={`${teacher}, your AI teacher`}>
          {/* legs + body */}
          <rect x="38" y="120" width="12" height="40" rx="6" fill="hsl(220 30% 30%)" />
          <rect x="58" y="120" width="12" height="40" rx="6" fill="hsl(220 30% 30%)" />
          <path d="M32 74h44a10 10 0 0 1 10 10v34a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V84a10 10 0 0 1 10-10z" fill="hsl(255 70% 58%)" />
          <path d="M54 74h4v52h-4z" fill="hsl(0 0% 100% / .25)" />
          {/* pointer arm */}
          <g className="guru-arm">
            <rect x="70" y="88" width="30" height="9" rx="4.5" fill="hsl(28 60% 72%)" />
            <rect x="96" y="70" width="4" height="26" rx="2" fill="hsl(0 0% 95%)" />
          </g>
          {/* head */}
          <circle cx="54" cy="48" r="24" fill="hsl(28 60% 76%)" />
          <path d="M30 42a24 24 0 0 1 48 0c-6-8-16-12-24-12s-18 4-24 12z" fill="hsl(255 40% 25%)" />
          <g className="guru-eye">
            <circle cx="45" cy="47" r="3.2" fill="hsl(220 40% 20%)" />
            <circle cx="63" cy="47" r="3.2" fill="hsl(220 40% 20%)" />
          </g>
          <ellipse
            cx="54"
            cy="60"
            rx="6"
            ry="4"
            className={speaking ? "guru-mouth-talk" : ""}
            fill="hsl(0 60% 40%)"
          />
          {/* glasses */}
          <g fill="none" stroke="hsl(220 30% 25%)" strokeWidth="1.6">
            <circle cx="45" cy="47" r="7" />
            <circle cx="63" cy="47" r="7" />
            <path d="M52 47h4" />
          </g>
        </svg>
      </div>

      <div className="mt-2 text-center text-[11px] font-bold text-muted-foreground">
        {speaking ? `${teacher} is teaching…` : `${teacher} — your AI teacher`}
      </div>
    </div>
  );
}
