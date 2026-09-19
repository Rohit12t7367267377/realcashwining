# Real Teacher Voice and Lip-Sync

## Goal
Make the existing reusable 2D teacher speak every generated lesson with the student’s selected real teacher voice, while driving the mouth from the actual audio signal instead of a fixed looping animation.

## What will change
- Add one reusable teacher-audio hook that plays generated speech, exposes speaking/loading/error state, and measures live audio volume for mouth movement.
- Extend `TeacherCharacter` with a lip-sync input and several mouth shapes that respond to the measured voice amplitude while speech is playing.
- Route classroom, floating board lessons, and Photo Doubt/Ask AI board speech through the centralized teacher voice function, which already resolves student preference → selected character voice → fallback voice.
- Keep replay and stop controls working, clean up audio resources on navigation, and show safe voice errors without interrupting lesson text or board content.
- Preserve the existing teacher states, gestures, selected character, teaching flow, navigation, authentication, and layout.

## Technical details
- Use the browser Web Audio analyser on the existing audio element; sample at a bounded interval and map volume into closed, small, medium, and wide mouth shapes.
- Fall back to a natural timed mouth animation when audio analysis is unavailable, so Safari/autoplay restrictions do not leave a frozen face.
- Use `guruEngineSpeak` for lesson speech so configured character and student voice preferences are honored without any new database fields or migrations.
- Keep audio generation server-side and the API key private.
- No database, schema, authentication, environment, or Supabase connection changes.

## Validation
- Run TypeScript and existing tests.
- Verify a signed-in classroom lesson generates audio, uses a resolved voice, moves the mouth only while audio is audible, and returns to idle when ended or stopped.
- Verify the floating teacher board and Ask AI board use the same speech/lip-sync path.
- Check desktop and mobile layouts and runtime console errors.
