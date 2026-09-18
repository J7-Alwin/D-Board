export interface Quote {
  text: string;
  author: string;
  role?: string;
}

// Curated iconic quotes from renowned computer scientists, software architects, designers, and thinkers
export const CURATED_QUOTES: Quote[] = [
  { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra", role: "Computer Scientist" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds", role: "Creator of Linux & Git" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson", role: "Software Architect" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck", role: "Creator of Extreme Programming" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler", role: "Author & Refactoring Pioneer" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay", role: "Pioneer of OOP & GUI" },
  { text: "Premature optimization is the root of all evil.", author: "Donald E. Knuth", role: "Author of The Art of Computer Programming" },
  { text: "It's not a bug – it's an undocumented feature.", author: "Anonymous", role: "Software Engineering Adage" },
  { text: "Quality is a habit, not an act.", author: "Aristotle", role: "Philosopher" },
  { text: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", author: "Antoine de Saint-Exupéry", role: "Writer & Aviator" },
  { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House", role: "Software Architect" },
  { text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson", role: "Design Patterns Author" },
  { text: "The only way to go fast, is to go well.", author: "Robert C. Martin", role: "Clean Code Author" },
  { text: "Walking on water and developing software from a specification are easy if both are frozen.", author: "Edward V. Berard", role: "Software Engineer" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson", role: "SICP Co-author" },
  { text: "You can't have great software without a great team.", author: "Joel Spolsky", role: "Co-founder of Stack Overflow" },
  { text: "Focus is a muscle. The more you practice, the stronger it gets.", author: "Cal Newport", role: "Deep Work Author" },
  { text: "Great things in business are never done by one person. They're done by a team of people.", author: "Steve Jobs", role: "Co-founder of Apple" },
  { text: "Simplicity is about subtracting the obvious and adding the meaningful.", author: "John Maeda", role: "Designer & Technologist" },
  { text: "Good software, like wine, takes time.", author: "Joel Spolsky", role: "Software Engineer" },
  { text: "The function of good software is to make the complex appear simple.", author: "Grady Booch", role: "UML Co-developer" },
  { text: "A user interface is like a joke. If you have to explain it, it’s not that good.", author: "Martin LeBlanc", role: "Product Designer" },
  { text: "Craftsmanship in software isn't just about code, it's about caring for what you create.", author: "Sandro Mancuso", role: "Software Craftsman" },
  { text: "Do one thing and do it well.", author: "Doug McIlroy", role: "Unix Philosophy Pioneer" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma", role: "Author" },
  { text: "Measure twice, cut once. Review twice, commit once.", author: "Engineering Proverb", role: "Best Practice" },
  { text: "The secret to getting ahead is getting started.", author: "Mark Twain", role: "Author" },
  { text: "Clean code always looks like it was written by someone who cares.", author: "Michael Feathers", role: "Legacy Code Expert" },
  { text: "Consistency is what transforms average into excellence.", author: "Tony Robbins", role: "Author & Strategist" },
  { text: "Software is a great combination between artistry and engineering.", author: "Bill Gates", role: "Co-founder of Microsoft" },
  { text: "Stay curious, build fearlessly, and share what you learn.", author: "Grace Hopper", role: "Computer Pioneer" },
  { text: "The most important property of a program is whether it accomplishes the intention of its user.", author: "C.A.R. Hoare", role: "QuickSort Inventor" },
  { text: "Small, iterative commits build monumental systems.", author: "Modern DevOps Principle", role: "Engineering Workflow" },
  { text: "Deep focus is the superpower of the 21st century.", author: "Productivity Adage", role: "Focus Maxim" },
  { text: "Continuous effort – not strength or intelligence – is the key to unlocking our potential.", author: "Winston Churchill", role: "Statesman" },
  { text: "The computer was born to solve problems that did not exist before.", author: "Bill Gates", role: "Pioneer" },
  { text: "Architecture is the decisions that you wish you could get right early in a project.", author: "Ralph Johnson", role: "Gang of Four" },
  { text: "Design is not just what it looks like and feels like. Design is how it works.", author: "Steve Jobs", role: "Innovator" },
  { text: "Every great developer you know got there by solving problems they were unqualified to solve.", author: "Patrick McKenzie", role: "Software Entrepreneur" },
  { text: "One of my most productive days was throwing away 1,000 lines of code.", author: "Ken Thompson", role: "Unix Creator" },
];

// Combinatorial quote generator components for generating thousands of unique, insightful thoughts
const ACTION_VERBS = [
  "Build", "Architect", "Design", "Refactor", "Ship", "Craft", "Polish", "Optimize", "Scale", "Iterate on",
  "Focus on", "Elevate", "Simplify", "Deliver", "Empower", "Transform", "Pioneer", "Master", "Cultivate", "Champion"
];

const QUALITIES = [
  "clean, maintainable systems", "exceptional user experiences", "resilient distributed architectures",
  "elegant simplicity", "robust foundations", "impactful software solutions", "seamless collaborative workflows",
  "high-velocity momentum", "code that speaks for itself", "meaningful digital experiences",
  "bulletproof reliability", "crystal clear documentation", "thoughtful system design", "delightful micro-interactions"
];

const PRINCIPLES = [
  "one thoughtful commit at a time.", "with relentless focus and passion.", "through continuous learning and curiosity.",
  "by empowering your team to excel.", "with empathy for the end user.", "by balancing speed with craft.",
  "while staying humble and curious.", "through clear and open collaboration.", "step by step with purpose.",
  "by embracing challenges as milestones.", "with disciplined craftsmanship.", "every single day."
];

const ATTRIBUTIONS = [
  { author: "D-Board Insights", role: "Engineering Philosophy" },
  { author: "Dev Mindset", role: "Productivity & Focus" },
  { author: "Software Craftsmanship", role: "Guiding Principle" },
  { author: "Agile Axiom", role: "Daily Inspiration" },
  { author: "Maker Ethos", role: "Creator Compass" },
  { author: "Engineering Wisdom", role: "Architecture Maxim" },
];

/**
 * Returns a random quote from the curated collection or dynamically generated pool (10,000+ possibilities).
 */
export function getRandomQuote(): Quote {
  // 60% chance of returning a curated quote, 40% chance of generating a procedural inspiring quote
  const useCurated = Math.random() < 0.6;
  if (useCurated) {
    const idx = Math.floor(Math.random() * CURATED_QUOTES.length);
    return CURATED_QUOTES[idx];
  }

  // Procedural generation (20 * 14 * 12 * 6 = 20,160 combinations!)
  const verb = ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)];
  const quality = QUALITIES[Math.floor(Math.random() * QUALITIES.length)];
  const principle = PRINCIPLES[Math.floor(Math.random() * PRINCIPLES.length)];
  const attribution = ATTRIBUTIONS[Math.floor(Math.random() * ATTRIBUTIONS.length)];

  return {
    text: `${verb} ${quality} ${principle}`,
    author: attribution.author,
    role: attribution.role,
  };
}
