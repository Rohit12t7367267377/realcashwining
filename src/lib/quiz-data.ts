// Quiz question bank (mock data)
export type Category = {
  id: string;
  name: string;
  short: string;
  emoji: string;
  color: string;
  description: string;
};

export const CATEGORIES: Category[] = [
  { id: "ssc", name: "SSC", short: "Staff Selection", emoji: "📋", color: "from-rose-500 to-pink-600", description: "CGL, CHSL, MTS & more" },
  { id: "upsc", name: "UPSC", short: "Civil Services", emoji: "🏛️", color: "from-purple-500 to-fuchsia-600", description: "Prelims practice MCQs" },
  { id: "railway", name: "Railway", short: "RRB", emoji: "🚆", color: "from-amber-500 to-orange-600", description: "NTPC, Group D, ALP" },
  { id: "banking", name: "Banking", short: "IBPS / SBI", emoji: "🏦", color: "from-emerald-500 to-teal-600", description: "PO, Clerk, RRB" },
  { id: "police", name: "Police", short: "Constable & SI", emoji: "👮", color: "from-blue-500 to-indigo-600", description: "State police exams" },
  { id: "gk", name: "GK & Current", short: "Affairs", emoji: "🌍", color: "from-cyan-500 to-sky-600", description: "Daily current affairs" },
  { id: "reasoning", name: "Reasoning", short: "Logical", emoji: "🧠", color: "from-violet-500 to-purple-600", description: "Verbal & non-verbal" },
  { id: "english", name: "English", short: "Language", emoji: "🔤", color: "from-pink-500 to-rose-600", description: "Grammar, vocab, comp" },
];

export type Question = {
  q: string;
  options: string[];
  answer: number; // index
};

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
  ssc: [
    { q: "Who is the current Cabinet Secretary of India (as of 2024)?", options: ["Rajiv Gauba", "T V Somanathan", "P K Mishra", "Ajit Doval"], answer: 1 },
    { q: "The headquarters of SSC is located in?", options: ["Mumbai", "Kolkata", "New Delhi", "Chennai"], answer: 2 },
    { q: "Which is the smallest 4-digit number divisible by 12?", options: ["1000", "1008", "1012", "1020"], answer: 1 },
    { q: "Antonym of 'Benevolent'?", options: ["Kind", "Malevolent", "Generous", "Helpful"], answer: 1 },
    { q: "If A=1, B=2, ... then CAT = ?", options: ["24", "27", "26", "20"], answer: 0 },
    { q: "LCM of 12, 15, 20 is?", options: ["60", "120", "180", "240"], answer: 0 },
    { q: "Largest planet in solar system?", options: ["Saturn", "Earth", "Jupiter", "Neptune"], answer: 2 },
    { q: "Author of 'Discovery of India'?", options: ["Tagore", "Nehru", "Gandhi", "Ambedkar"], answer: 1 },
    { q: "Square root of 2025?", options: ["43", "45", "47", "49"], answer: 1 },
    { q: "One word for 'A person who knows many languages'?", options: ["Linguist", "Polyglot", "Translator", "Bilingual"], answer: 1 },
  ],
  upsc: [
    { q: "Which Article deals with Right to Equality?", options: ["Article 14", "Article 19", "Article 21", "Article 32"], answer: 0 },
    { q: "Who was the first Governor-General of independent India?", options: ["Mountbatten", "Rajagopalachari", "Nehru", "Patel"], answer: 0 },
    { q: "The Tropic of Cancer does NOT pass through?", options: ["Gujarat", "MP", "Odisha", "Kerala"], answer: 3 },
    { q: "Finance Commission is constituted under?", options: ["Article 280", "Article 270", "Article 360", "Article 148"], answer: 0 },
    { q: "Battle of Plassey was fought in?", options: ["1757", "1764", "1857", "1761"], answer: 0 },
    { q: "Which Schedule of the Constitution deals with anti-defection?", options: ["8th", "9th", "10th", "11th"], answer: 2 },
    { q: "Highest peak of Western Ghats?", options: ["Doddabetta", "Anamudi", "Mullayanagiri", "Nilgiri"], answer: 1 },
    { q: "RBI was nationalised in?", options: ["1947", "1949", "1955", "1969"], answer: 1 },
  ],
  railway: [
    { q: "First Railway in India ran between?", options: ["Delhi-Agra", "Bombay-Thane", "Howrah-Delhi", "Madras-Bangalore"], answer: 1 },
    { q: "Headquarters of Indian Railways?", options: ["Mumbai", "Kolkata", "New Delhi", "Chennai"], answer: 2 },
    { q: "Longest railway platform in the world?", options: ["Gorakhpur", "Hubballi", "Kharagpur", "Kollam"], answer: 1 },
    { q: "Train speed: covers 360 km in 4 hrs. Speed in m/s?", options: ["20", "25", "30", "100"], answer: 1 },
    { q: "Konkan Railway runs along which coast?", options: ["East", "West", "South", "North"], answer: 1 },
    { q: "Vande Bharat is which type of train?", options: ["Freight", "Semi-high speed", "Metro", "Goods"], answer: 1 },
    { q: "Rail Budget merged with Union Budget in?", options: ["2015", "2016", "2017", "2018"], answer: 2 },
  ],
  banking: [
    { q: "RBI's current Governor (2024)?", options: ["Urjit Patel", "Shaktikanta Das", "Raghuram Rajan", "D Subbarao"], answer: 1 },
    { q: "CRR stands for?", options: ["Cash Reserve Ratio", "Current Rate Ratio", "Credit Reserve Rate", "Cash Repo Ratio"], answer: 0 },
    { q: "Headquarters of World Bank?", options: ["Geneva", "New York", "Washington DC", "London"], answer: 2 },
    { q: "Father of Indian Banking?", options: ["RBI", "M Visvesvaraya", "Tata", "Premji"], answer: 1 },
    { q: "NEFT is operated by?", options: ["RBI", "NPCI", "SBI", "NABARD"], answer: 0 },
    { q: "Demonetisation in India occurred on?", options: ["8 Nov 2015", "8 Nov 2016", "8 Dec 2016", "8 Oct 2016"], answer: 1 },
    { q: "Repo rate is rate at which?", options: ["RBI lends to banks", "Banks lend to RBI", "Banks lend to public", "Govt lends to RBI"], answer: 0 },
  ],
  police: [
    { q: "IPC stands for?", options: ["Indian Penal Code", "Indian Police Code", "Indian Public Code", "Indian Private Code"], answer: 0 },
    { q: "IPC came into force in?", options: ["1858", "1860", "1862", "1872"], answer: 2 },
    { q: "FIR is registered under which section of CrPC?", options: ["144", "154", "164", "174"], answer: 1 },
    { q: "Director General of Police is appointed by?", options: ["President", "PM", "State Government", "Home Minister"], answer: 2 },
    { q: "NCB stands for?", options: ["National Crime Bureau", "Narcotics Control Bureau", "National Cyber Bureau", "Nation Control Board"], answer: 1 },
    { q: "Which is highest gallantry award in India?", options: ["Param Vir Chakra", "Ashoka Chakra", "Maha Vir", "Vir Chakra"], answer: 1 },
  ],
  gk: [
    { q: "Capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2 },
    { q: "G20 Summit 2023 was hosted by?", options: ["Indonesia", "India", "Italy", "Brazil"], answer: 1 },
    { q: "Chandrayaan-3 landed on moon in?", options: ["July 2023", "August 2023", "Sep 2023", "Oct 2023"], answer: 1 },
    { q: "ICC Men's Cricket World Cup 2023 winner?", options: ["India", "Australia", "England", "NZ"], answer: 1 },
    { q: "Currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], answer: 2 },
    { q: "Nobel Peace Prize 2023 winner?", options: ["Narges Mohammadi", "Maria Ressa", "Abiy Ahmed", "WFP"], answer: 0 },
    { q: "First woman President of India?", options: ["Indira Gandhi", "Pratibha Patil", "Sushma Swaraj", "Droupadi Murmu"], answer: 1 },
  ],
  reasoning: [
    { q: "Find next: 2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "36"], answer: 1 },
    { q: "If MONDAY is coded as NPOEBZ, then FRIDAY?", options: ["GSJEBZ", "GSKEBZ", "GSJEAZ", "GTJEBZ"], answer: 0 },
    { q: "Pointing to a man, woman said 'his mother is the only daughter of my mother'. How is the man related?", options: ["Brother", "Son", "Nephew", "Father"], answer: 1 },
    { q: "Odd one out: 8, 27, 64, 100, 125", options: ["8", "100", "27", "125"], answer: 1 },
    { q: "If '+' means '×', '×' means '−', then 6 + 3 × 2 = ?", options: ["16", "20", "12", "10"], answer: 0 },
    { q: "A is brother of B. B is brother of C. C is father of D. How is D related to A?", options: ["Son", "Nephew", "Niece", "Niece or Nephew"], answer: 3 },
    { q: "Complete: AZ, BY, CX, ?", options: ["DV", "DW", "DU", "EW"], answer: 1 },
  ],
  english: [
    { q: "Synonym of 'Abundant'?", options: ["Scarce", "Plentiful", "Empty", "Limited"], answer: 1 },
    { q: "Choose correct: 'He ___ to the market every day.'", options: ["go", "goes", "going", "gone"], answer: 1 },
    { q: "Antonym of 'Transparent'?", options: ["Clear", "Visible", "Opaque", "Lucid"], answer: 2 },
    { q: "Plural of 'Crisis'?", options: ["Crisises", "Crises", "Crisi", "Crisis"], answer: 1 },
    { q: "Identify error: 'The news are shocking.'", options: ["The", "news", "are", "shocking"], answer: 2 },
    { q: "One word: 'A speech made without preparation'?", options: ["Lecture", "Extempore", "Recital", "Oration"], answer: 1 },
    { q: "Choose correct preposition: 'He is good ___ maths.'", options: ["in", "at", "on", "for"], answer: 1 },
  ],
};

export const CONTESTS: Contest[] = CATEGORIES.flatMap((cat, i) => [
  {
    id: `${cat.id}-mini`,
    categoryId: cat.id,
    title: `${cat.name} Mini Sprint`,
    entryFee: 20,
    prize: 150,
    spots: 100,
    filled: 60 + i * 3,
    questions: QBANK[cat.id] ?? [],
    durationSec: 5 * 60,
  },
  {
    id: `${cat.id}-pro`,
    categoryId: cat.id,
    title: `${cat.name} Pro Contest`,
    entryFee: 30,
    prize: 500,
    spots: 200,
    filled: 120 + i * 5,
    questions: QBANK[cat.id] ?? [],
    durationSec: 8 * 60,
  },
  {
    id: `${cat.id}-free`,
    categoryId: cat.id,
    title: `${cat.name} Practice (Free)`,
    entryFee: 0,
    prize: 0,
    spots: 9999,
    filled: 4321,
    questions: QBANK[cat.id] ?? [],
    durationSec: 6 * 60,
  },
]);

export function getContest(id: string) {
  return CONTESTS.find((c) => c.id === id);
}

export const LEADERBOARD = [
  { name: "Aarav Sharma", score: 9850, wins: 42, avatar: "🦁" },
  { name: "Priya Patel", score: 9420, wins: 38, avatar: "🦊" },
  { name: "Rohit Verma", score: 9100, wins: 35, avatar: "🐯" },
  { name: "Sneha Iyer", score: 8870, wins: 33, avatar: "🦄" },
  { name: "Karan Mehta", score: 8540, wins: 30, avatar: "🐲" },
  { name: "Ananya Gupta", score: 8210, wins: 28, avatar: "🦋" },
  { name: "Vikram Singh", score: 7990, wins: 26, avatar: "🦅" },
  { name: "Divya Reddy", score: 7740, wins: 24, avatar: "🐺" },
  { name: "Arjun Nair", score: 7510, wins: 22, avatar: "🐬" },
  { name: "Meera Joshi", score: 7280, wins: 20, avatar: "🦚" },
];
