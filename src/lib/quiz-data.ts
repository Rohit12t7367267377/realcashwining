// Quiz question bank
export type Category = {
  id: string;
  name: string;
  short: string;
  emoji: string;
  color: string;
  description: string;
};

export const CATEGORIES: Category[] = [
  { id: "sports", name: "Sports", short: "Live & Trivia", emoji: "🏆", color: "from-emerald-500 to-green-600", description: "Cricket, Football, Tennis & more — live match quizzes" },
  { id: "gk", name: "General Knowledge", short: "All Competitive Exams", emoji: "🌍", color: "from-sky-500 to-blue-600", description: "SSC, UPSC, Banking, Railway, Police, Current Affairs" },
  { id: "coding", name: "Coding & Tech", short: "All Languages", emoji: "💻", color: "from-violet-500 to-fuchsia-600", description: "Python, JS, Java, C++, DSA, OS, DB" },
];

export type Question = { q: string; options: string[]; answer: number };

export type Contest = {
  id: string;
  categoryId: string;
  title: string;
  entryFee: number;
  prize: number;
  spots: number;
  filled: number;
  questions: Question[];
  durationSec: number;
};

const QBANK: Record<string, Question[]> = {
  sports: [
    { q: "How many players are on a cricket team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
    { q: "Which country won the FIFA World Cup 2022?", options: ["France", "Brazil", "Argentina", "Germany"], answer: 2 },
    { q: "Tennis Grand Slam played on clay courts?", options: ["Wimbledon", "US Open", "French Open", "Australian Open"], answer: 2 },
    { q: "How many points is a three-pointer in basketball?", options: ["1", "2", "3", "4"], answer: 2 },
    { q: "Olympic rings — how many?", options: ["4", "5", "6", "7"], answer: 1 },
    { q: "Who has most Ballon d'Or wins (as of 2024)?", options: ["Ronaldo", "Messi", "Modric", "Benzema"], answer: 1 },
    { q: "Pro Kabaddi League is from which country?", options: ["Iran", "India", "Pakistan", "Bangladesh"], answer: 1 },
    { q: "Field hockey team size?", options: ["9", "10", "11", "12"], answer: 2 },
    { q: "Badminton scoring system — first to?", options: ["15", "21", "25", "30"], answer: 1 },
    { q: "Formula 1 race distance is approx?", options: ["100 km", "200 km", "305 km", "500 km"], answer: 2 },
    { q: "First batter to score 100 international centuries?", options: ["Kohli", "Tendulkar", "Ponting", "Lara"], answer: 1 },
    { q: "Cricket — an over has how many legal balls?", options: ["4", "5", "6", "8"], answer: 2 },
  ],
  gk: [
    { q: "Capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2 },
    { q: "Who wrote 'Discovery of India'?", options: ["Gandhi", "Nehru", "Tagore", "Patel"], answer: 1 },
    { q: "Which Article deals with Right to Equality?", options: ["14", "19", "21", "32"], answer: 0 },
    { q: "RBI was nationalised in?", options: ["1947", "1949", "1955", "1969"], answer: 1 },
    { q: "First Governor-General of independent India?", options: ["Mountbatten", "Rajagopalachari", "Nehru", "Patel"], answer: 0 },
    { q: "Headquarters of SSC?", options: ["Mumbai", "Kolkata", "New Delhi", "Chennai"], answer: 2 },
    { q: "Largest planet in solar system?", options: ["Saturn", "Earth", "Jupiter", "Neptune"], answer: 2 },
    { q: "Battle of Plassey was fought in?", options: ["1757", "1764", "1857", "1761"], answer: 0 },
    { q: "Currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], answer: 2 },
    { q: "First Railway in India ran between?", options: ["Delhi-Agra", "Bombay-Thane", "Howrah-Delhi", "Madras-Bangalore"], answer: 1 },
    { q: "Square root of 2025?", options: ["43", "45", "47", "49"], answer: 1 },
    { q: "Author of National Anthem of India?", options: ["Tagore", "Bankim", "Iqbal", "Sarojini"], answer: 0 },
    { q: "How many states in India?", options: ["27", "28", "29", "30"], answer: 1 },
    { q: "Finance Commission constituted under Article?", options: ["280", "270", "360", "148"], answer: 0 },
    { q: "Headquarters of IBPS?", options: ["Delhi", "Mumbai", "Chennai", "Pune"], answer: 1 },
  ],
  coding: [
    { q: "Which is NOT a JavaScript primitive type?", options: ["string", "number", "object", "boolean"], answer: 2 },
    { q: "Time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], answer: 1 },
    { q: "Python: type of `3 / 2`?", options: ["int", "float", "double", "str"], answer: 1 },
    { q: "SQL: which removes duplicates?", options: ["UNIQUE", "DISTINCT", "DEDUPE", "FILTER"], answer: 1 },
    { q: "HTTP status for 'Not Found'?", options: ["403", "404", "500", "302"], answer: 1 },
    { q: "C++: keyword for inheritance access?", options: ["extends", "inherits", "public/private", "implements"], answer: 2 },
    { q: "Java: which is NOT an OOP pillar?", options: ["Encapsulation", "Inheritance", "Compilation", "Polymorphism"], answer: 2 },
    { q: "Git: undo last commit but keep changes?", options: ["git reset --hard", "git reset --soft HEAD~1", "git revert", "git clean"], answer: 1 },
    { q: "Linux: list files with permissions?", options: ["ls", "ls -l", "ls -a", "pwd"], answer: 1 },
    { q: "React: hook for side effects?", options: ["useState", "useEffect", "useMemo", "useRef"], answer: 1 },
    { q: "DSA: stack follows?", options: ["FIFO", "LIFO", "Random", "Priority"], answer: 1 },
    { q: "DB: ACID — A stands for?", options: ["Atomic", "Async", "Available", "Auto"], answer: 0 },
    { q: "JS: `typeof null` returns?", options: ["null", "undefined", "object", "string"], answer: 2 },
    { q: "Python list comprehension syntax?", options: ["[x for x in y]", "{x: x for x in y}", "(x for x in y)", "for x in y: x"], answer: 0 },
    { q: "OS: thread vs process — threads share?", options: ["Stack", "Registers", "Memory/heap", "PC"], answer: 2 },
  ],
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildContests(): Contest[] {
  const out: Contest[] = [];
  for (const cat of CATEGORIES) {
    const qs = QBANK[cat.id] ?? [];
    if (!qs.length) continue;
    const tiers = [
      { suffix: "Mini", entry: 10, prize: 50, spots: 50, dur: 300 },
      { suffix: "Pro", entry: 25, prize: 250, spots: 100, dur: 600 },
      { suffix: "Free", entry: 0, prize: 20, spots: 200, dur: 300 },
    ];
    for (const t of tiers) {
      out.push({
        id: `${cat.id}-${t.suffix.toLowerCase()}`,
        categoryId: cat.id,
        title: `${cat.name} ${t.suffix}`,
        entryFee: t.entry,
        prize: t.prize,
        spots: t.spots,
        filled: Math.floor(Math.random() * t.spots * 0.7),
        questions: shuffle(qs).slice(0, Math.min(10, qs.length)),
        durationSec: t.dur,
      });
    }
  }
  return out;
}

export const CONTESTS: Contest[] = buildContests();
