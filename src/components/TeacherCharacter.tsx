import { cn } from "@/lib/utils";

export type TeacherCharacterState =
  | "idle"
  | "speaking"
  | "thinking"
  | "happy"
  | "explaining"
  | "encouraging"
  | "confused"
  | "correct"
  | "wrong"
  | "listening";

export type TeacherCharacterGesture = "auto" | "open" | "point" | "listen" | "celebrate";

type TeacherCharacterProps = {
  state?: TeacherCharacterState;
  teacherName?: string;
  gesture?: TeacherCharacterGesture;
  className?: string;
  showStatus?: boolean;
};

const STATUS: Record<TeacherCharacterState, string> = {
  idle: "Ready to teach",
  speaking: "Teaching",
  thinking: "Thinking",
  happy: "Happy to help",
  explaining: "Explaining",
  encouraging: "Keep going",
  confused: "Let’s look again",
  correct: "That’s correct",
  wrong: "Let’s fix it together",
  listening: "Listening",
};

function resolveGesture(state: TeacherCharacterState, gesture: TeacherCharacterGesture) {
  if (gesture !== "auto") return gesture;
  if (state === "explaining" || state === "speaking") return "point";
  if (state === "listening") return "listen";
  if (state === "correct" || state === "happy") return "celebrate";
  return "open";
}

/**
 * Reusable, state-driven 2D teacher presentation.
 * The SVG is deliberately layered (face, expression, mouth, arms and clothing)
 * so professional artwork or real lip-sync can replace individual layers later.
 */
export function TeacherCharacter({
  state = "idle",
  teacherName = "Guru",
  gesture = "auto",
  className,
  showStatus = true,
}: TeacherCharacterProps) {
  const activeGesture = resolveGesture(state, gesture);
  const isPositive = state === "happy" || state === "correct" || state === "encouraging";
  const isConcerned = state === "confused" || state === "wrong";

  return (
    <figure
      className={cn("teacher-character", className)}
      data-state={state}
      data-gesture={activeGesture}
      aria-label={`${teacherName}, AI teacher. ${STATUS[state]}.`}
    >
      <div className="teacher-stage" aria-hidden="true">
        <span className="teacher-status-signal" />
        <svg viewBox="0 0 260 360" className="teacher-art" role="presentation">
          <defs>
            <linearGradient id="teacher-jacket" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--teacher-jacket-light)" />
              <stop offset="1" stopColor="var(--teacher-jacket)" />
            </linearGradient>
            <linearGradient id="teacher-shirt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--teacher-shirt)" />
              <stop offset="1" stopColor="var(--teacher-shirt-shade)" />
            </linearGradient>
            <filter id="teacher-soft-shadow" x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="var(--teacher-shadow)" floodOpacity="0.28" />
            </filter>
          </defs>

          <ellipse className="teacher-ground" cx="130" cy="339" rx="82" ry="12" />

          <g className="teacher-body" filter="url(#teacher-soft-shadow)">
            <path className="teacher-neck" d="M111 147h38v42c0 12-8 20-19 20s-19-8-19-20z" />

            <g className="teacher-torso">
              <path fill="url(#teacher-jacket)" d="M72 201c10-20 31-31 58-31s48 11 58 31l17 120H55z" />
              <path fill="url(#teacher-shirt)" d="M106 174l24 22 24-22 13 147H93z" />
              <path className="teacher-lapel" d="M106 176l24 20-24 39-18-47zm48 0l-24 20 24 39 18-47z" />
              <path className="teacher-jacket-seam" d="M130 196v125M75 226l-8 95m118-95 8 95" />
              <path className="teacher-pocket" d="M155 245h27v18h-27z" />
              <path className="teacher-pocket-mark" d="M159 245l8 9 11-9" />
              <circle className="teacher-button" cx="130" cy="252" r="3.5" />
              <circle className="teacher-button" cx="130" cy="277" r="3.5" />
            </g>

            <g className="teacher-arm teacher-arm-left">
              <path className="teacher-sleeve" d="M77 204c-15 4-25 17-30 36l-12 45 23 7 17-41 21-25z" />
              <path className="teacher-skin" d="M35 281c-6 8-5 19 3 24 8 4 17 0 21-10l2-7-23-8z" />
              <path className="teacher-hand-line" d="M42 287l-3 10m9-8-2 11m9-8-2 8" />
            </g>

            <g className="teacher-arm teacher-arm-right">
              <path className="teacher-sleeve" d="M183 204c15 4 25 17 30 36l9 38-23 7-15-36-20-23z" />
              <path className="teacher-skin" d="M199 277c-2 10 3 19 12 21 9 1 16-6 16-16l-3-8z" />
              <path className="teacher-hand-line" d="M208 280l3 11m3-12 3 10m2-12 3 8" />
              <g className="teacher-pointer">
                <rect x="218" y="171" width="5" height="111" rx="2.5" />
                <circle cx="220.5" cy="169" r="5" />
              </g>
            </g>

            <g className="teacher-head">
              <ellipse className="teacher-ear" cx="82" cy="111" rx="12" ry="17" />
              <ellipse className="teacher-ear" cx="178" cy="111" rx="12" ry="17" />
              <path className="teacher-face" d="M82 91c0-39 20-65 48-65s48 26 48 65v25c0 38-21 62-48 62s-48-24-48-62z" />
              <path className="teacher-hair-back" d="M80 99c-9-32 4-72 46-81 37-8 63 24 55 70-8-28-28-41-54-39-22 2-34 18-47 50z" />
              <path className="teacher-hair-highlight" d="M101 47c13-18 38-24 57-10-23-5-39 2-51 20z" />
              <path className="teacher-sideburn" d="M83 81c10-5 15 0 15 13v24H83zm94 1c-10-6-15 0-15 13v23h15z" />

              <g className="teacher-brows">
                <path className="teacher-brow teacher-brow-left" d="M98 91q13-7 24 0" />
                <path className="teacher-brow teacher-brow-right" d="M138 91q13-7 24 0" />
              </g>

              <g className="teacher-eyes">
                <g className="teacher-eye teacher-eye-left">
                  <ellipse className="teacher-eye-white" cx="110" cy="106" rx="10" ry="7" />
                  <circle className="teacher-iris" cx="111" cy="106" r="4.5" />
                  <circle className="teacher-pupil" cx="111" cy="106" r="2.2" />
                  <circle className="teacher-eye-glint" cx="109.5" cy="104.5" r="1" />
                </g>
                <g className="teacher-eye teacher-eye-right">
                  <ellipse className="teacher-eye-white" cx="150" cy="106" rx="10" ry="7" />
                  <circle className="teacher-iris" cx="149" cy="106" r="4.5" />
                  <circle className="teacher-pupil" cx="149" cy="106" r="2.2" />
                  <circle className="teacher-eye-glint" cx="147.5" cy="104.5" r="1" />
                </g>
              </g>

              <path className="teacher-nose" d="M130 108l-4 20q4 4 10 0" />
              <path className="teacher-cheek teacher-cheek-left" d="M95 128q9 5 18 0" />
              <path className="teacher-cheek teacher-cheek-right" d="M147 128q9 5 18 0" />

              <g className="teacher-mouth">
                {isPositive ? (
                  <path className="teacher-mouth-line" d="M113 140q17 18 34 0q-17 7-34 0z" />
                ) : isConcerned ? (
                  <path className="teacher-mouth-line" d="M116 149q14-11 28 0" />
                ) : (
                  <path className="teacher-mouth-line" d="M116 142q14 10 28 0" />
                )}
                <ellipse className="teacher-mouth-open" cx="130" cy="145" rx="10" ry="7" />
              </g>

              <g className="teacher-glasses">
                <rect x="94" y="96" width="31" height="22" rx="9" />
                <rect x="135" y="96" width="31" height="22" rx="9" />
                <path d="M125 105h10m31-3 12-5M94 102l-12-5" />
              </g>
            </g>
          </g>

          <g className="teacher-thoughts">
            <circle cx="193" cy="61" r="5" />
            <circle cx="207" cy="45" r="8" />
            <path d="M218 16h26a9 9 0 0 1 9 9v10a9 9 0 0 1-9 9h-26a9 9 0 0 1-9-9V25a9 9 0 0 1 9-9z" />
            <path className="teacher-thought-mark" d="M225 24c2-5 12-5 12 1 0 4-5 4-5 8m0 5h.1" />
          </g>

          <g className="teacher-listening-waves">
            <path d="M190 78q18 16 0 32" />
            <path d="M199 68q31 27 0 52" />
          </g>

          <g className="teacher-correct-sparkles">
            <path d="M210 55l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" />
            <path d="M55 88l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />
          </g>
        </svg>
      </div>

      {showStatus ? (
        <figcaption className="teacher-caption" aria-live="polite">
          <span className="teacher-caption-name">{teacherName}</span>
          <span className="teacher-caption-state">{STATUS[state]}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}