/** Browser-safe catalogue shared by the Guru.AI Skill Academy (no server imports). */

export const SKILL_STAGES = ["Beginner", "Intermediate", "Advanced", "Projects", "Practice", "Assessment"] as const;
export type SkillStage = (typeof SKILL_STAGES)[number];

export type SkillTrack = {
  slug: string;
  title: string;
  emoji: string;
  blurb: string;
  category: "Programming" | "AI & Data" | "Development" | "Security & Cloud" | "Career & Communication" | "Life Skills";
  /** AI mentor persona for this skill. */
  mentor: { name: string; role: string; emoji: string };
  /** What each stage covers, in order of SKILL_STAGES. */
  stages: Record<SkillStage, string>;
  /** Backwards-compatible flat roadmap (Beginner → Assessment). */
  levels: string[];
};

function track(
  slug: string,
  title: string,
  emoji: string,
  blurb: string,
  category: SkillTrack["category"],
  mentor: SkillTrack["mentor"],
  stages: Record<SkillStage, string>,
): SkillTrack {
  return { slug, title, emoji, blurb, category, mentor, stages, levels: SKILL_STAGES.map((s) => stages[s]) };
}

export const GURU_SKILL_TRACKS: SkillTrack[] = [
  track("programming", "Programming Foundations", "🧩", "Logic, problem solving and how code actually runs.", "Programming",
    { name: "Dev Bhaiya", role: "Programming mentor", emoji: "👨‍💻" }, {
      Beginner: "Variables, input/output, conditions and loops",
      Intermediate: "Functions, arrays, strings and debugging",
      Advanced: "Recursion, complexity and clean code",
      Projects: "Build a calculator, quiz app and file organiser",
      Practice: "50 logic-building problems with hints",
      Assessment: "Mixed programming fundamentals test",
    }),
  track("java", "Java", "☕", "OOP, collections and JVM essentials.", "Programming",
    { name: "Dev Bhaiya", role: "Java mentor", emoji: "☕" }, {
      Beginner: "Syntax, data types, control flow",
      Intermediate: "Classes, objects, inheritance, interfaces",
      Advanced: "Collections, generics, streams, exceptions, threads",
      Projects: "Bank system, student portal, JDBC CRUD app",
      Practice: "Coding drills on OOP and collections",
      Assessment: "Java certification-style test",
    }),
  track("python", "Python", "🐍", "From basics to automation and data work.", "Programming",
    { name: "Dev Bhaiya", role: "Python mentor", emoji: "🐍" }, {
      Beginner: "Syntax, lists, dicts, loops, functions",
      Intermediate: "OOP, modules, files, error handling",
      Advanced: "Comprehensions, decorators, generators, virtualenv",
      Projects: "Web scraper, expense tracker, automation bot",
      Practice: "Daily Python problem sets",
      Assessment: "Python proficiency test",
    }),
  track("c", "C Programming", "🔤", "Memory, pointers and how machines think.", "Programming",
    { name: "Ravi Sir", role: "C mentor", emoji: "🔤" }, {
      Beginner: "Data types, operators, loops, functions",
      Intermediate: "Arrays, strings, structures, file I/O",
      Advanced: "Pointers, dynamic memory, linked structures",
      Projects: "Library management, matrix tool, mini shell",
      Practice: "Pointer and array problem sets",
      Assessment: "C fundamentals test",
    }),
  track("cpp", "C++", "➕", "OOP plus STL for competitive coding.", "Programming",
    { name: "Dev Bhaiya", role: "C++ mentor", emoji: "➕" }, {
      Beginner: "Syntax, I/O, control flow, functions",
      Intermediate: "Classes, constructors, operator overloading",
      Advanced: "STL, templates, smart pointers, complexity",
      Projects: "Contest solutions, inventory system, game of life",
      Practice: "STL and OOP drills",
      Assessment: "C++ mastery test",
    }),
  track("javascript", "JavaScript", "🟨", "The language of the web, end to end.", "Programming",
    { name: "Neha Ma'am", role: "JavaScript mentor", emoji: "🟨" }, {
      Beginner: "Variables, functions, arrays, objects, DOM",
      Intermediate: "ES6+, async/await, fetch, modules",
      Advanced: "Closures, prototypes, event loop, performance",
      Projects: "Todo app, weather dashboard, quiz game",
      Practice: "JS output-prediction and DOM tasks",
      Assessment: "JavaScript skills test",
    }),
  track("dsa", "DSA", "🧠", "Data structures and algorithms for interviews.", "Programming",
    { name: "Coach Simran", role: "DSA mentor", emoji: "🧠" }, {
      Beginner: "Arrays, strings, hashing, complexity",
      Intermediate: "Stacks, queues, linked lists, trees, sorting",
      Advanced: "Graphs, DP, greedy, tries, heaps",
      Projects: "Pattern sheets, contest practice, mock rounds",
      Practice: "Topic-wise problems with hints",
      Assessment: "DSA interview simulation test",
    }),
  track("ai", "Artificial Intelligence", "🤖", "How AI systems think, plan and generate.", "AI & Data",
    { name: "Zara AI", role: "AI mentor", emoji: "🤖" }, {
      Beginner: "What AI is, search, rules, agents",
      Intermediate: "Knowledge, probability, NLP basics",
      Advanced: "Transformers, LLMs, prompting, RAG, ethics",
      Projects: "Chatbot, recommender, AI study assistant",
      Practice: "Concept and scenario questions",
      Assessment: "AI fundamentals test",
    }),
  track("ml", "Machine Learning", "📈", "Models, training and real evaluation.", "AI & Data",
    { name: "Zara AI", role: "ML mentor", emoji: "📈" }, {
      Beginner: "Supervised vs unsupervised, features, datasets",
      Intermediate: "Regression, trees, SVM, clustering, metrics",
      Advanced: "Neural nets, CNN/RNN, regularisation, tuning",
      Projects: "House price model, spam classifier, image classifier",
      Practice: "Maths + intuition problem sets",
      Assessment: "ML proficiency test",
    }),
  track("data-science", "Data Science", "📊", "Turn raw data into decisions.", "AI & Data",
    { name: "Zara AI", role: "Data science mentor", emoji: "📊" }, {
      Beginner: "Data types, statistics, Excel/Pandas basics",
      Intermediate: "Cleaning, EDA, visualisation, SQL",
      Advanced: "Feature engineering, A/B tests, pipelines",
      Projects: "Sales dashboard, churn analysis, EDA report",
      Practice: "Stats and SQL drills",
      Assessment: "Data science case test",
    }),
  track("web-development", "Web Development", "🌐", "Frontend, backend and deployment.", "Development",
    { name: "Neha Ma'am", role: "Web dev mentor", emoji: "🌐" }, {
      Beginner: "HTML, CSS, responsive layouts",
      Intermediate: "JavaScript, React, state, APIs",
      Advanced: "Auth, databases, performance, SEO, deployment",
      Projects: "Portfolio, blog with CMS, full-stack dashboard",
      Practice: "Build-along UI challenges",
      Assessment: "Full-stack web test",
    }),
  track("app-development", "App Development", "📱", "Build and ship mobile apps.", "Development",
    { name: "Dev Bhaiya", role: "App dev mentor", emoji: "📱" }, {
      Beginner: "App anatomy, UI basics, navigation",
      Intermediate: "State, storage, APIs, notifications",
      Advanced: "Auth, payments, performance, Play Store release",
      Projects: "Notes app, expense app, quiz app",
      Practice: "Screen-building challenges",
      Assessment: "App development test",
    }),
  track("cybersecurity", "Cybersecurity", "🛡️", "Defend systems, data and yourself.", "Security & Cloud",
    { name: "Colonel Vikram", role: "Security mentor", emoji: "🛡️" }, {
      Beginner: "Threats, passwords, phishing, safe browsing",
      Intermediate: "Networking, encryption, OWASP Top 10",
      Advanced: "Pen-testing basics, forensics, secure coding",
      Projects: "Security audit, hardened login, CTF walkthroughs",
      Practice: "Scenario-based defence questions",
      Assessment: "Cybersecurity fundamentals test",
    }),
  track("cloud", "Cloud Computing", "☁️", "Deploy and scale on the cloud.", "Security & Cloud",
    { name: "Prof. Iyer", role: "Cloud mentor", emoji: "☁️" }, {
      Beginner: "Cloud models, regions, IaaS/PaaS/SaaS",
      Intermediate: "Compute, storage, networking, IAM",
      Advanced: "Containers, CI/CD, serverless, cost control",
      Projects: "Deploy an app, static site + CDN, serverless API",
      Practice: "Architecture decision drills",
      Assessment: "Cloud essentials test",
    }),
  track("communication", "Communication Skills", "🗣️", "Speak, present and persuade clearly.", "Career & Communication",
    { name: "Coach Simran", role: "Communication mentor", emoji: "🗣️" }, {
      Beginner: "Clarity, listening, body language",
      Intermediate: "Presentations, storytelling, email etiquette",
      Advanced: "Persuasion, negotiation, conflict handling",
      Projects: "2-minute pitch, group discussion, mock presentation",
      Practice: "Daily speaking prompts",
      Assessment: "Communication assessment",
    }),
  track("english", "English", "📚", "Grammar, vocabulary and fluent speech.", "Career & Communication",
    { name: "Miss Ophelia", role: "English mentor", emoji: "📚" }, {
      Beginner: "Tenses, articles, sentence building",
      Intermediate: "Vocabulary, prepositions, comprehension",
      Advanced: "Writing, idioms, fluency and pronunciation",
      Projects: "Daily journal, book summary, spoken diary",
      Practice: "Grammar and comprehension drills",
      Assessment: "English proficiency test",
    }),
  track("aptitude", "Aptitude & Reasoning", "🧮", "Quant, logic and data interpretation.", "Career & Communication",
    { name: "Ravi Sir", role: "Aptitude mentor", emoji: "🧮" }, {
      Beginner: "Percentages, ratios, averages, speed maths",
      Intermediate: "Time-work, profit-loss, permutations, series",
      Advanced: "Data interpretation, puzzles, logical reasoning",
      Projects: "Speed-solving sprints, sectional mocks",
      Practice: "Timed mixed sets",
      Assessment: "Full aptitude mock test",
    }),
  track("interview-prep", "Interview Preparation", "🎤", "Resume, rounds and offers.", "Career & Communication",
    { name: "Coach Simran", role: "Career mentor", emoji: "🎤" }, {
      Beginner: "Resume, LinkedIn, self-introduction",
      Intermediate: "HR questions, STAR answers, group discussion",
      Advanced: "Technical rounds, system design basics, salary talk",
      Projects: "Mock interview, portfolio review, offer plan",
      Practice: "Rapid-fire question bank",
      Assessment: "Mock interview evaluation",
    }),
  track("spoken-english", "Spoken English", "💬", "Daily conversation and confidence drills.", "Life Skills",
    { name: "Miss Ophelia", role: "Speaking mentor", emoji: "💬" }, {
      Beginner: "Greetings and everyday sentences",
      Intermediate: "Describing people, places and events",
      Advanced: "Opinions, debates and interviews",
      Projects: "1-minute daily speaking videos",
      Practice: "Pronunciation and shadowing drills",
      Assessment: "Spoken fluency assessment",
    }),
  track("maths-tricks", "Maths Speed Tricks", "⚡", "Vedic shortcuts for exams and quizzes.", "Life Skills",
    { name: "Ravi Sir", role: "Speed maths mentor", emoji: "⚡" }, {
      Beginner: "Tables, addition and multiplication tricks",
      Intermediate: "Squares, cubes, roots, percentages",
      Advanced: "Approximation and DI shortcuts",
      Projects: "Personal shortcut sheet",
      Practice: "Timed calculation sprints",
      Assessment: "Speed maths test",
    }),
  track("gk-current-affairs", "GK & Current Affairs", "🌏", "Static GK plus exam-relevant news.", "Life Skills",
    { name: "Colonel Vikram", role: "GK mentor", emoji: "🌏" }, {
      Beginner: "India basics: polity, geography, symbols",
      Intermediate: "History, economy, science GK",
      Advanced: "World affairs and analysis",
      Projects: "Monthly current-affairs notes",
      Practice: "Daily 10-question quiz",
      Assessment: "GK mock test",
    }),
  track("reading-comprehension", "Reading Comprehension", "📖", "Passage strategy, inference and vocabulary.", "Life Skills",
    { name: "Miss Ophelia", role: "Reading mentor", emoji: "📖" }, {
      Beginner: "Skimming and scanning",
      Intermediate: "Inference and vocabulary in context",
      Advanced: "Tone, author intent, timed passages",
      Projects: "Weekly long-passage practice",
      Practice: "Passage sets with explanations",
      Assessment: "Comprehension assessment",
    }),
  track("finance", "Money & Finance", "💰", "Saving, budgeting, UPI safety and investing.", "Life Skills",
    { name: "Prof. Iyer", role: "Finance mentor", emoji: "💰" }, {
      Beginner: "Budgeting and saving basics",
      Intermediate: "Banking, UPI safety, credit score",
      Advanced: "Interest, loans, taxes, investing 101",
      Projects: "Personal budget and goal plan",
      Practice: "Money maths problems",
      Assessment: "Financial literacy test",
    }),
];

export const SKILL_CATEGORIES: SkillTrack["category"][] = [
  "Programming",
  "AI & Data",
  "Development",
  "Security & Cloud",
  "Career & Communication",
  "Life Skills",
];

export function findSkillTrack(slug: string) {
  return GURU_SKILL_TRACKS.find((t) => t.slug === slug) ?? null;
}
