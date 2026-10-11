export const SCHOOL_STREAMS = [
  { id: "pcm", name: "Science · Mathematics (PCM)" },
  { id: "pcb", name: "Science · Biology (PCB)" },
  { id: "commerce", name: "Commerce" },
  { id: "humanities", name: "Humanities" },
  { id: "electives", name: "Other electives" },
] as const;
export type SchoolStream = typeof SCHOOL_STREAMS[number]["id"];

export function classNumber(name: string): number {
  return Number(name.match(/\d+/)?.[0] ?? 0);
}

export function officialBoardUrl(board: string): string | undefined {
  if (/cbse|central board/i.test(board)) return "https://cbseacademic.nic.in/";
  if (/icse|cisce|indian school certificate/i.test(board)) return "https://cisce.org/";
  if (/up.board|uttar pradesh/i.test(board)) return "https://upmsp.edu.in/";
  if (/maharashtra|msbshse|mh.board/i.test(board)) return "https://mahahsscboard.in/";
  if (/bihar|bseb/i.test(board)) return "https://biharboardonline.bihar.gov.in/";
  return undefined;
}

/** Subject choices, not a claim about every school's compulsory combination. */
export function schoolSubjects(board: string, grade: number, stream: SchoolStream = "pcm"): string[] {
  if (grade < 1 || grade > 12) return [];
  const regional = /maharashtra|msbshse|mh.board/i.test(board) ? "Marathi" : "Hindi";
  const languages = [regional, "English"];
  if (grade <= 2) return ["Mathematics", ...languages];
  if (grade <= 5) return ["Mathematics", ...languages, "Environmental Studies"];
  if (grade <= 10) {
    if (/icse|cisce|indian school certificate/i.test(board)) return ["Mathematics", "English Language", "English Literature", "Hindi", "Physics", "Chemistry", "Biology", "History and Civics", "Geography", "Computer Applications"];
    if (grade >= 9 && regional === "Marathi") return ["Mathematics", "Science and Technology", "History and Political Science", "Geography", ...languages, "Hindi"];
    return ["Mathematics", "Science", "Social Science", ...languages, grade <= 8 || /up.board|uttar pradesh|bihar|bseb/i.test(board) ? "Sanskrit" : "Information Technology"];
  }
  const electives: Record<SchoolStream, string[]> = {
    pcm: ["Mathematics", "Physics", "Chemistry"],
    pcb: ["Biology", "Physics", "Chemistry"],
    commerce: ["Accountancy", "Business Studies", "Economics"],
    humanities: ["History", "Geography", "Political Science", "Economics"],
    electives: ["Computer Science"],
  };
  return [...electives[stream], ...languages];
}

/** NCERT-aligned study outlines, not a verified current-year board syllabus. */
export function seniorStudyOutline(grade: number, subject: string): string[] | undefined {
  if (grade !== 12) return undefined;
  const outlines: Record<string, string[]> = {
    Mathematics: ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants", "Continuity and Differentiability", "Application of Derivatives", "Integrals", "Application of Integrals", "Differential Equations", "Vector Algebra", "Three Dimensional Geometry", "Linear Programming", "Probability"],
    Physics: ["Electric Charges and Fields", "Electrostatic Potential and Capacitance", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics"],
    Chemistry: ["Solutions", "Electrochemistry", "Chemical Kinetics", "The d- and f-Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules"],
  };
  return outlines[subject];
}