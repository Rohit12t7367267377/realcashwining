/**
 * Animated 2D AI teacher character for the interactive classroom.
 * Blinks, bobs, points at the board and lip-syncs while speaking or writing.
 */
export function GuruTeacherAvatar({
  teacher = "Guru",
  speaking = false,
  writing = false,
  thinking = false,
  className = "h-[210px] w-[124px]",
}: {
  teacher?: string;
  speaking?: boolean;
  writing?: boolean;
  thinking?: boolean;
  className?: string;
}) {
  return (
    <div className="shrink-0 text-center">
      <style>{`
        @keyframes guru-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.1) } }
        @keyframes guru-talk { 0%,100% { transform: scaleY(0.5) } 50% { transform: scaleY(1.3) } }
        @keyframes guru-point { 0%,100% { transform: rotate(-16deg) } 50% { transform: rotate(8deg) } }
        @keyframes guru-write { 0%,100% { transform: rotate(-4deg) translateY(0) } 50% { transform: rotate(10deg) translateY(-6px) } }
        @keyframes guru-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        .guru-eye { animation: guru-blink 5s infinite; transform-origin: center }
        .guru-mouth-talk { animation: guru-talk .26s infinite; transform-origin: center }
        .guru-arm { animation: guru-point 2.4s ease-in-out infinite; transform-origin: 74px 96px }
        .guru-arm-write { animation: guru-write .5s ease-in-out infinite; transform-origin: 74px 96px }
        .guru-body { animation: guru-bob 3.4s ease-in-out infinite }
      `}</style>

      <svg viewBox="0 0 120 170" className={`guru-body ${className}`} role="img" aria-label={`${teacher}, your AI teacher`}>
        <rect x="38" y="120" width="12" height="40" rx="6" fill="hsl(220 30% 30%)" />
        <rect x="58" y="120" width="12" height="40" rx="6" fill="hsl(220 30% 30%)" />
        <path d="M32 74h44a10 10 0 0 1 10 10v34a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V84a10 10 0 0 1 10-10z" fill="hsl(255 70% 58%)" />
        <path d="M54 74h4v52h-4z" fill="hsl(0 0% 100% / .25)" />
        <g className={writing ? "guru-arm-write" : "guru-arm"}>
          <rect x="70" y="88" width="30" height="9" rx="4.5" fill="hsl(28 60% 72%)" />
          <rect x="96" y="70" width="4" height="26" rx="2" fill={writing ? "hsl(45 95% 60%)" : "hsl(0 0% 95%)"} />
        </g>
        <circle cx="54" cy="48" r="24" fill="hsl(28 60% 76%)" />
        <path d="M30 42a24 24 0 0 1 48 0c-6-8-16-12-24-12s-18 4-24 12z" fill="hsl(255 40% 25%)" />
        <g className="guru-eye">
          <circle cx="45" cy="47" r="3.2" fill="hsl(220 40% 20%)" />
          <circle cx="63" cy="47" r="3.2" fill="hsl(220 40% 20%)" />
        </g>
        <ellipse cx="54" cy="60" rx="6" ry="4" className={speaking ? "guru-mouth-talk" : ""} fill="hsl(0 60% 40%)" />
        <g fill="none" stroke="hsl(220 30% 25%)" strokeWidth="1.6">
          <circle cx="45" cy="47" r="7" />
          <circle cx="63" cy="47" r="7" />
          <path d="M52 47h4" />
        </g>
        {thinking ? (
          <g fill="hsl(0 0% 100% / .9)">
            <circle cx="86" cy="26" r="3" />
            <circle cx="94" cy="20" r="4" />
            <circle cx="104" cy="13" r="5.5" />
          </g>
        ) : null}
      </svg>

      <div className="mt-1 text-[11px] font-bold text-muted-foreground">
        {thinking ? `${teacher} is thinking…` : writing ? `${teacher} is writing…` : speaking ? `${teacher} is teaching…` : teacher}
      </div>
    </div>
  );
}
