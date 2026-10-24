/** Built-in NCERT-aligned chapter lists. Used when the AI is unavailable and nothing is cached yet. */
const S = (names: string): string[] => names.split("|").map((x) => x.trim()).filter(Boolean);

const TABLE: Record<number, Record<string, string[]>> = {
  9: {
    Mathematics: S("Number Systems|Polynomials|Coordinate Geometry|Linear Equations in Two Variables|Introduction to Euclid's Geometry|Lines and Angles|Triangles|Quadrilaterals|Circles|Heron's Formula|Surface Areas and Volumes|Statistics"),
    Science: S("Matter in Our Surroundings|Is Matter Around Us Pure|Atoms and Molecules|Structure of the Atom|The Fundamental Unit of Life|Tissues|Motion|Force and Laws of Motion|Gravitation|Work and Energy|Sound|Improvement in Food Resources"),
  },
  10: {
    Mathematics: S("Real Numbers|Polynomials|Pair of Linear Equations in Two Variables|Quadratic Equations|Arithmetic Progressions|Triangles|Coordinate Geometry|Introduction to Trigonometry|Some Applications of Trigonometry|Circles|Areas Related to Circles|Surface Areas and Volumes|Statistics|Probability"),
    Science: S("Chemical Reactions and Equations|Acids, Bases and Salts|Metals and Non-metals|Carbon and its Compounds|Life Processes|Control and Coordination|How do Organisms Reproduce|Heredity|Light - Reflection and Refraction|The Human Eye and the Colourful World|Electricity|Magnetic Effects of Electric Current|Our Environment"),
    "Social Science": S("The Rise of Nationalism in Europe|Nationalism in India|The Making of a Global World|The Age of Industrialisation|Print Culture and the Modern World|Resources and Development|Forest and Wildlife Resources|Water Resources|Agriculture|Minerals and Energy Resources|Manufacturing Industries|Lifelines of National Economy|Power Sharing|Federalism|Democracy and Diversity|Gender, Religion and Caste|Popular Struggles and Movements|Political Parties|Outcomes of Democracy|Development|Sectors of the Indian Economy|Money and Credit|Globalisation and the Indian Economy|Consumer Rights"),
    English: S("A Letter to God|Nelson Mandela: Long Walk to Freedom|Two Stories about Flying|From the Diary of Anne Frank|Glimpses of India|Mijbil the Otter|Madam Rides the Bus|The Sermon at Benares|The Proposal|Tenses and Modals|Subject-Verb Concord|Reported Speech|Letter and Article Writing"),
    Hindi: S("सूरदास के पद|राम-लक्ष्मण-परशुराम संवाद|देव के सवैये और कवित्त|आत्मकथ्य|उत्साह और अट नहीं रही है|यह दंतुरित मुसकान और फसल|छाया मत छूना|कन्यादान|संगतकार|नेताजी का चश्मा|बालगोबिन भगत|लखनवी अंदाज़|मानवीय करुणा की दिव्य चमक|एक कहानी यह भी|स्त्री शिक्षा के विरोधी कुतर्कों का खंडन|नौबतखाने में इबादत|संस्कृति|व्याकरण और पत्र-लेखन"),
    Sanskrit: S("शुचिपर्यावरणम्|बुद्धिर्बलवती सदा|शिशुलालनम्|जननी तुल्यवत्सला|सुभाषितानि|सौहार्दं प्रकृतेः शोभा|विचित्रः साक्षी|सूक्तिमौक्तिकम्|भूकम्पविभीषिका|अन्योक्तयः|व्याकरण"),
  },
  11: {
    Mathematics: S("Sets|Relations and Functions|Trigonometric Functions|Complex Numbers and Quadratic Equations|Linear Inequalities|Permutations and Combinations|Binomial Theorem|Sequences and Series|Straight Lines|Conic Sections|Introduction to Three Dimensional Geometry|Limits and Derivatives|Statistics|Probability"),
    Physics: S("Units and Measurements|Motion in a Straight Line|Motion in a Plane|Laws of Motion|Work, Energy and Power|System of Particles and Rotational Motion|Gravitation|Mechanical Properties of Solids|Mechanical Properties of Fluids|Thermal Properties of Matter|Thermodynamics|Kinetic Theory|Oscillations|Waves"),
    Chemistry: S("Some Basic Concepts of Chemistry|Structure of Atom|Classification of Elements and Periodicity|Chemical Bonding and Molecular Structure|Thermodynamics|Equilibrium|Redox Reactions|Organic Chemistry: Basic Principles|Hydrocarbons"),
    Biology: S("The Living World|Biological Classification|Plant Kingdom|Animal Kingdom|Morphology of Flowering Plants|Anatomy of Flowering Plants|Structural Organisation in Animals|Cell: The Unit of Life|Biomolecules|Cell Cycle and Cell Division|Photosynthesis in Higher Plants|Respiration in Plants|Plant Growth and Development|Breathing and Exchange of Gases|Body Fluids and Circulation|Excretory Products and their Elimination|Locomotion and Movement|Neural Control and Coordination|Chemical Coordination and Integration"),
  },
  12: {
    Biology: S("Reproduction in Organisms|Sexual Reproduction in Flowering Plants|Human Reproduction|Reproductive Health|Principles of Inheritance and Variation|Molecular Basis of Inheritance|Evolution|Human Health and Disease|Microbes in Human Welfare|Biotechnology: Principles and Processes|Biotechnology and its Applications|Organisms and Populations|Ecosystem|Biodiversity and Conservation"),
    English: S("The Last Lesson|Lost Spring|Deep Water|The Rattrap|Indigo|Poets and Pancakes|The Interview|Going Places|My Mother at Sixty-six|Keeping Quiet|A Thing of Beauty|A Roadside Stand|Aunt Jennifer's Tigers|The Third Level|The Tiger King|Journey to the End of the Earth|The Enemy|On the Face of It|Memories of Childhood|Writing Skills"),
    Hindi: S("आरोह: हरिवंश राय बच्चन|आत्म-परिचय|पतंग|कविता के बहाने|कैमरे में बंद अपाहिज|सहर्ष स्वीकारा है|उषा|बादल राग|कवितावली|रुबाइयाँ|बाज़ार दर्शन|काले मेघा पानी दे|चार्ली चैप्लिन यानी हम सब|नमक|शिरीष के फूल|भक्तिन|पहलवान की ढोलक|वितान: सिल्वर वैडिंग|जूझ|अतीत में दबे पाँव|रचना और अभिव्यक्ति"),
  },
};

export function fallbackChapters(grade: number, subject: string): string[] | undefined {
  const g = TABLE[grade];
  if (!g) return undefined;
  const key = Object.keys(g).find((k) => k.toLowerCase() === subject.trim().toLowerCase());
  return key ? g[key] : undefined;
}
