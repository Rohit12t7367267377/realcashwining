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
  { id: "cricket", name: "Cricket", short: "Live & Trivia", emoji: "🏏", color: "from-green-500 to-emerald-600", description: "Live match quizzes" },
  { id: "football", name: "Football", short: "Live & Trivia", emoji: "⚽", color: "from-lime-500 to-green-600", description: "Live match quizzes" },
  { id: "tennis", name: "Tennis", short: "Grand Slams", emoji: "🎾", color: "from-yellow-500 to-amber-600", description: "ATP, WTA & majors" },
  { id: "basketball", name: "Basketball", short: "NBA & FIBA", emoji: "🏀", color: "from-orange-500 to-red-600", description: "NBA, FIBA, players" },
  { id: "badminton", name: "Badminton", short: "BWF", emoji: "🏸", color: "from-sky-500 to-blue-600", description: "BWF, players, rules" },
  { id: "hockey", name: "Hockey", short: "FIH", emoji: "🏑", color: "from-teal-500 to-cyan-600", description: "Field & ice hockey" },
  { id: "kabaddi", name: "Kabaddi", short: "PKL", emoji: "🤼", color: "from-red-500 to-rose-600", description: "Pro Kabaddi & rules" },
  { id: "sports-other", name: "Other Sports", short: "Multi", emoji: "🏅", color: "from-indigo-500 to-violet-600", description: "Olympics, F1, golf & more" },
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
  cricket: [
    { q: "Who won the ICC Cricket World Cup 2023?", options: ["India", "Australia", "England", "New Zealand"], answer: 1 },
    { q: "Highest individual score in ODI cricket?", options: ["264", "237*", "219", "200*"], answer: 0 },
    { q: "Who holds the record for most runs in T20Is?", options: ["Virat Kohli", "Rohit Sharma", "Babar Azam", "Martin Guptill"], answer: 1 },
    { q: "How many players are in a cricket team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
    { q: "Which country invented cricket?", options: ["India", "Australia", "England", "South Africa"], answer: 2 },
    { q: "First batter to score a double century in ODIs?", options: ["Sachin Tendulkar", "Virender Sehwag", "Rohit Sharma", "Chris Gayle"], answer: 0 },
    { q: "IPL was first played in?", options: ["2007", "2008", "2009", "2010"], answer: 1 },
  ],
  football: [
    { q: "Who won the FIFA World Cup 2022?", options: ["France", "Brazil", "Argentina", "Germany"], answer: 2 },
    { q: "Most Ballon d'Or wins?", options: ["Ronaldo", "Messi", "Pelé", "Maradona"], answer: 1 },
    { q: "How long is a standard football match?", options: ["80 min", "90 min", "100 min", "120 min"], answer: 1 },
    { q: "Which club has the most UCL titles?", options: ["Barcelona", "Bayern", "Real Madrid", "Milan"], answer: 2 },
    { q: "Goalkeeper allowed to use hands inside?", options: ["Halfway line", "Penalty area", "Goal area only", "Anywhere"], answer: 1 },
    { q: "Top scorer in FIFA World Cup history?", options: ["Klose", "Ronaldo", "Müller", "Pelé"], answer: 0 },
    { q: "Yellow + Yellow = ?", options: ["Warning", "Red card", "Free kick", "Nothing"], answer: 1 },
  ],
  tennis: [
    { q: "Most Grand Slam singles titles (men, as of 2024)?", options: ["Federer", "Nadal", "Djokovic", "Sampras"], answer: 2 },
    { q: "Wimbledon is played on?", options: ["Clay", "Hard", "Grass", "Carpet"], answer: 2 },
    { q: "How many Grand Slams in a year?", options: ["3", "4", "5", "6"], answer: 1 },
    { q: "Tiebreak is usually first to?", options: ["5", "6", "7", "10"], answer: 2 },
    { q: "Serena Williams Grand Slam singles count?", options: ["21", "22", "23", "24"], answer: 2 },
    { q: "French Open surface?", options: ["Grass", "Hard", "Clay", "Carpet"], answer: 2 },
  ],
  basketball: [
    { q: "How many points is a free throw?", options: ["1", "2", "3", "4"], answer: 0 },
    { q: "Most NBA championship rings (player)?", options: ["MJ", "Russell", "LeBron", "Kobe"], answer: 1 },
    { q: "Standard NBA game length?", options: ["40 min", "48 min", "60 min", "36 min"], answer: 1 },
    { q: "Players on court per team?", options: ["4", "5", "6", "7"], answer: 1 },
    { q: "Height of NBA rim?", options: ["9 ft", "10 ft", "11 ft", "12 ft"], answer: 1 },
    { q: "FIBA HQ is in?", options: ["NY", "Geneva", "Mies", "Paris"], answer: 2 },
  ],
  badminton: [
    { q: "Olympic badminton singles points to win a game?", options: ["15", "21", "25", "30"], answer: 1 },
    { q: "BWF stands for?", options: ["Badminton World Federation", "British Worldwide Fed.", "Badminton World Forum", "Best World Federation"], answer: 0 },
    { q: "First Indian to win Olympic medal in badminton?", options: ["Saina Nehwal", "PV Sindhu", "Pullela Gopichand", "Jwala Gutta"], answer: 0 },
    { q: "All England is held in?", options: ["Wembley", "Birmingham", "Manchester", "London"], answer: 1 },
    { q: "Number of players in doubles per side?", options: ["1", "2", "3", "4"], answer: 1 },
  ],
  hockey: [
    { q: "India's hockey gold count in Olympics?", options: ["6", "7", "8", "9"], answer: 2 },
    { q: "Players per team in field hockey?", options: ["10", "11", "12", "9"], answer: 1 },
    { q: "Hockey World Cup is held every?", options: ["2 years", "3 years", "4 years", "5 years"], answer: 2 },
    { q: "Dhyan Chand was famous for?", options: ["Cricket", "Hockey", "Football", "Boxing"], answer: 1 },
    { q: "Penalty corner is awarded to?", options: ["Defending team", "Attacking team", "Umpire", "Goalkeeper"], answer: 1 },
  ],
  kabaddi: [
    { q: "Players per team in Kabaddi?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "Duration of a Pro Kabaddi half?", options: ["15 min", "20 min", "25 min", "30 min"], answer: 1 },
    { q: "Pro Kabaddi League started in?", options: ["2012", "2013", "2014", "2015"], answer: 2 },
    { q: "Bonus line is which line?", options: ["1st", "2nd", "3rd from baulk", "Mid"], answer: 2 },
    { q: "Most successful PKL franchise?", options: ["Patna Pirates", "Jaipur", "Bengaluru", "U Mumba"], answer: 0 },
  ],
  "sports-other": [
    { q: "Olympic motto?", options: ["Faster, Higher, Stronger", "Win or Lose", "Sport for All", "Play Hard"], answer: 0 },
    { q: "F1 World Champion 2023?", options: ["Hamilton", "Verstappen", "Leclerc", "Perez"], answer: 1 },
    { q: "Golf major NOT in USA?", options: ["Masters", "US Open", "The Open", "PGA"], answer: 2 },
    { q: "Boxing weight class — heavyweight starts above?", options: ["80 kg", "85 kg", "90.7 kg", "100 kg"], answer: 2 },
    { q: "Chess world champion 2023?", options: ["Magnus", "Ding Liren", "Nepo", "Anand"], answer: 1 },
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
