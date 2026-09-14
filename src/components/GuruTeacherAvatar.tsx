import { TeacherCharacter, type TeacherCharacterState } from "@/components/TeacherCharacter";

/** Compatibility adapter for existing Guru.AI classroom calls. */
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
  const state: TeacherCharacterState = thinking
    ? "thinking"
    : speaking
      ? "speaking"
      : writing
        ? "explaining"
        : "idle";

  return (
    <TeacherCharacter state={state} teacherName={teacher} className={className} />
  );
}
