# Polished 2D AI Teacher Character

## Goal
Replace the basic classroom avatar with one reusable, polished 2D teacher who visibly teaches, reacts, listens, and speaks while preserving the existing Guru.AI flows and layout.

## What will change
- Create a reusable `TeacherCharacter` component with a layered, replaceable SVG illustration.
- Support these typed states: idle, speaking, thinking, happy, explaining, encouraging, confused, correct, wrong, and listening.
- Add subtle blinking, breathing, head, mouth, eyebrow, expression, and hand/gesture animation, with reduced-motion support.
- Keep stable responsive sizes for mobile, tablet, and desktop.
- Replace the existing basic classroom character and the duplicate character embedded in the teaching-board presentation.
- Keep the existing teacher name, voice playback, board reveal, question flow, answer checking, and all Guru.AI behavior unchanged.

## Integration behavior
- Loading an AI response → `thinking`
- Playing teacher audio → `speaking`
- Revealing lesson-board content → `explaining`
- Voice input active → `listening`
- Correct answer feedback → `correct`
- Partial answer feedback → `encouraging`
- Wrong answer feedback → `wrong`
- No active action → `idle`

## Technical details
- Character artwork remains frontend-only and is organized as SVG layers inside the character component, so custom artwork can later replace the visual layer without changing classroom screens.
- Props will expose state, teacher name, size/presentation mode, and future-safe voice/lip-sync hooks.
- Existing `GuruTeacherAvatar` will become a compatibility wrapper or be replaced at its call sites; duplicated inline teacher artwork in `GuruTeacherBoard` will use the same component.
- No database, schema, authentication, API, server function, environment, or backend files will be changed.

## Validation
- Verify TypeScript and existing tests.
- Open the Guru.AI classroom at desktop and mobile sizes to confirm the character renders, animates, and does not disrupt the board or controls.
- Confirm the runtime console has no new errors.
