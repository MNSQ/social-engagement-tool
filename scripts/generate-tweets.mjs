#!/usr/bin/env node
/**
 * Generates a deterministic, synthetic dataset of 1000 fake X-style posts for
 * local testing of the engagement-opportunity scoring pipeline. Re-run with
 * `npm run generate:tweets` to regenerate an identical file (fixed seed).
 *
 * Output columns: authorName, handle, followers, text, url, createdAt,
 * views, likes, reposts, replies — matches the columns read by
 * `src/lib/csvPosts.ts` (order is irrelevant there; header names matter).
 *
 * All authors, handles, and post text are synthetic and do not represent
 * real people, accounts, or tweets.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

const SEED = 20260615;
const TARGET_COUNT = 1000;
const OUTPUT_PATH = path.join(process.cwd(), "public", "test-data", "synthetic_tweets_1000.csv");

// Reference point for "now" used to compute createdAt timestamps. Fixed so
// the dataset is reproducible; close to the actual current date so posts
// read as "from the last 1-7 days" when the app uses the real clock.
const NOW_MS = Date.UTC(2026, 5, 15, 18, 0, 0);

// ---------------------------------------------------------------------------
// RNG + small helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) so the dataset is fully reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);

function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickTwoDistinct(arr) {
  const a = pick(arr);
  let b = pick(arr);
  let tries = 0;
  while (b === a && tries < 6 && arr.length > 1) {
    b = pick(arr);
    tries++;
  }
  return [a, b];
}

function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return rng() * (max - min) + min;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function csvEscape(value) {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADER = [
  "authorName",
  "handle",
  "followers",
  "text",
  "url",
  "createdAt",
  "views",
  "likes",
  "reposts",
  "replies",
];

// ---------------------------------------------------------------------------
// Author pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Maya", "Daniel", "Priya", "Tomas", "Lena", "Sam", "Grace", "Owen", "Hana", "Marcus",
  "Ines", "Carlos", "Ava", "Felix", "Noah", "Zoe", "Liam", "Aisha", "Diego", "Mei",
  "Jonas", "Sofia", "Ryan", "Nadia", "Theo", "Elena", "Kwame", "Yuki", "Omar", "Clara",
  "Lucas", "Ingrid", "Tariq", "Maria", "Andre", "Wei", "Sven", "Imani", "Hassan", "Olivia",
  "Niko", "Sara", "Bjorn", "Camila", "Dev", "Freya", "Gabriel", "Hiro", "Isla", "Quinn",
];

const LAST_NAMES = [
  "Chen", "Okafor", "Raman", "Vidal", "Brooks", "Whitfield", "Liu", "Park", "Suzuki", "Webb",
  "Moreau", "Diaz", "Thompson", "Adler", "Nguyen", "Kowalski", "Haddad", "Larsen", "Petrov", "Singh",
  "Costa", "Reyes", "Novak", "Eriksson", "Mensah", "Ibrahim", "Fischer", "Romero", "Tanaka", "Walsh",
  "Khoury", "Lindgren", "Osei", "Bauer", "Castillo", "Dubois", "Faruqi", "Greco", "Hayashi", "Iyer",
];

/**
 * Builds a synthetic author + handle. Most posts come from "persona" style
 * accounts (First Last / @first_tag123); a smaller share come from
 * topic-flavored "brand" accounts (e.g. "GPU Market Pulse" / @gpu_market_pulse).
 */
function makeAuthor(topic) {
  if (topic.brandPool && rng() < 0.3) {
    const brand = pick(topic.brandPool);
    const slug = slugify(brand);
    const handle = rng() < 0.5 ? `@${slug}${randInt(10, 99)}` : `@${slug}`;
    return { authorName: brand, handle };
  }
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const tag = pick(topic.tagPool);
  return {
    authorName: `${first} ${last}`,
    handle: `@${first.toLowerCase()}_${tag}${randInt(10, 999)}`,
  };
}

// ---------------------------------------------------------------------------
// Engagement + freshness profiles by opportunity tier
// ---------------------------------------------------------------------------

/** Returns {views, likes, reposts, replies, followers} for a given tier. */
function engagementForTier(tier) {
  let views, followers;
  switch (tier) {
    case "strong":
      views = randInt(60_000, 850_000);
      followers = randInt(8_000, 320_000);
      break;
    case "medium":
      views = randInt(4_000, 55_000);
      followers = randInt(1_500, 60_000);
      break;
    case "weak":
      views = randInt(300, 6_000);
      followers = randInt(150, 8_000);
      break;
    case "risk":
      views = randInt(5_000, 220_000);
      followers = randInt(500, 12_000);
      break;
    case "nontech_viral":
      views = randInt(25_000, 650_000);
      followers = randInt(5_000, 400_000);
      break;
    default: // "nontech_normal"
      views = randInt(200, 18_000);
      followers = randInt(120, 40_000);
      break;
  }
  const likes = Math.max(0, Math.round(views * randFloat(0.005, 0.06)));
  const reposts = Math.max(0, Math.round(likes * randFloat(0.04, 0.35)));
  const replies = Math.max(0, Math.round(likes * randFloat(0.02, 0.3)));
  return { views, likes, reposts, replies, followers };
}

/** Hours-old range per tier, used to derive createdAt — all within the last 1-7 days. */
function hoursAgoForTier(tier) {
  switch (tier) {
    case "strong":
      return randFloat(0.5, 22);
    case "medium":
      return randFloat(8, 76);
    case "weak":
      return randFloat(30, 168);
    case "risk":
      return randFloat(1, 96);
    default: // nontech
      return randFloat(1, 168);
  }
}

function createdAtFromHoursAgo(hoursAgo) {
  const ms = NOW_MS - hoursAgo * 3_600_000;
  const rounded = Math.round(ms / 60_000) * 60_000;
  return new Date(rounded).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ---------------------------------------------------------------------------
// Shared filler pools (non-tech topics)
// ---------------------------------------------------------------------------

const CITIES = [
  "Austin", "Lisbon", "Nairobi", "Toronto", "Singapore", "Berlin", "Mexico City", "Seoul",
  "Manchester", "Bangalore", "Melbourne", "Warsaw", "Dublin", "Cape Town", "Santiago", "Osaka",
];

const TIME_REFS = [
  "this week", "this month", "this season", "over the weekend", "this quarter", "lately", "this year so far",
];

const TEAMS = [
  "the Riverside Hawks", "the Northgate Wolves", "FC Marlowe", "the Coastal Sharks", "Union Park FC",
  "the Ridgeline Bears", "the Meadow City Strikers", "the Harbor Lions",
];

const PLAYERS = [
  "their star midfielder", "the new striker", "the rookie point guard", "the veteran goalkeeper", "their captain",
];

const GAMES = [
  "Starforge Tactics", "Lumen Drift", "Ashfall Online", "Pixel Harbor", "Ridgeway Legends",
  "Nocturne Raiders", "Glasswing", "Echo Frontier",
];

const COMPANIES = [
  "Northwind Retail", "Vantage Logistics", "Brightline Foods", "Cobalt Manufacturing", "Ferro Industrial",
  "Meridian Apparel", "Solstice Goods", "Anchor & Co", "Plainview Group", "Harborline Freight",
  "Crestmark Holdings", "Tideline Foods",
];

const INDUSTRIES = [
  "consumer electronics", "apparel", "food and beverage", "logistics", "retail", "manufacturing", "furniture",
];

const RATE_DIRECTIONS = ["up", "down", "sideways", "up slightly", "down a touch"];

const SCIENCE_TOPICS = [
  "deep-sea ecosystems", "glacier retreat", "bird migration patterns", "soil microbiomes", "sleep cycles",
  "coral reef recovery", "volcanic activity", "bat echolocation", "plant communication", "ancient climate records",
];

const STARTUP_ROLES = ["support lead", "ops manager", "sales rep", "designer", "customer success hire"];
const STARTUP_PRODUCTS = [
  "our scheduling tool", "the new onboarding flow", "our analytics dashboard", "the mobile app rewrite", "our billing system",
];

// ---------------------------------------------------------------------------
// Non-tech topics (13 categories x 50 posts = 650)
// ---------------------------------------------------------------------------

const NONTECH_TOPICS = [
  {
    id: "business",
    category: "Business",
    tagPool: ["biz", "ventures", "group", "co", "exec"],
    brandPool: ["Market Brief", "Founders Weekly", "Supply Chain Notes", "Earnings Watch"],
    count: 50,
    templates: [
      () => `${pick(COMPANIES)} just announced layoffs affecting ${randInt(5, 18)}% of staff ${pick(TIME_REFS)}. Hard to watch how often this is happening across the industry now.`,
      () => `Inflation numbers came in ${pick(RATE_DIRECTIONS)} ${pick(TIME_REFS)}, and small business owners I follow are split on what it means for hiring plans.`,
      () => `Hot take: open-plan offices are on their way out again. Every company I talk to is quietly going back to private offices ${pick(TIME_REFS)}.`,
      () => `${pick(COMPANIES)}'s quarterly earnings beat expectations, but the stock dropped anyway. Markets are weird ${pick(TIME_REFS)}.`,
      () => `Anyone else feel like every subscription price went up ${pick(TIME_REFS)}? Death by a thousand subscriptions is real.`,
      () => `Spent the morning reading about supply chain shifts in ${pick(INDUSTRIES)}. ${pick(COMPANIES)} seems to be betting big on reshoring production.`,
      () => `Unpopular opinion: most corporate rebrands ${pick(TIME_REFS)} make the brand worse, not better. ${pick(COMPANIES)} is the latest example.`,
      () => `Thoughts on remote work policy debates ${pick(TIME_REFS)}? Feels like the pendulum keeps swinging back and forth every few months.`,
    ],
  },
  {
    id: "sports",
    category: "Sports",
    tagPool: ["sports", "fc", "athletics", "league", "pitch"],
    brandPool: ["Courtside Daily", "League Pulse", "Matchday Notes", "Box Score Brief"],
    count: 50,
    templates: [
      () => `${pick(TEAMS)} pulled off a stunning comeback ${pick(TIME_REFS)} — down by ${randInt(2, 4)} goals at halftime and still found a way to win.`,
      () => `Hot take: ${pick(TEAMS)}'s defense has been the most underrated storyline of the season ${pick(TIME_REFS)}.`,
      () => `Anyone else think the new playoff format is way too confusing? ${pick(TEAMS)} fans are still trying to figure out the bracket.`,
      () => `${pick(TEAMS)} just dropped their new away kit and the fanbase is divided. Thoughts on the design?`,
      () => `Ticket prices for ${pick(TEAMS)} games are getting out of hand ${pick(TIME_REFS)}. A family of four is looking at a small fortune for decent seats.`,
      () => `${pick(PLAYERS)} for ${pick(TEAMS)} has been on an absurd run ${pick(TIME_REFS)} — ${randInt(6, 14)} contributions in the last ${randInt(4, 8)} games.`,
      () => `Debate: is a draw a fair result when one team dominates possession the way ${pick(TEAMS)} did ${pick(TIME_REFS)}?`,
      () => {
        const [a, b] = pickTwoDistinct(TEAMS);
        return `Watched ${a} vs ${b} ${pick(TIME_REFS)} and the atmosphere in that stadium was unreal. Live sports still hit different.`;
      },
    ],
  },
  {
    id: "finance",
    category: "Finance",
    tagPool: ["finance", "capital", "markets", "invest", "money"],
    brandPool: ["Macro Notes", "Yield Watch", "Rate Tracker", "Household Budget Weekly"],
    count: 50,
    templates: [
      () => `Mortgage rates ticked ${pick(RATE_DIRECTIONS)} again ${pick(TIME_REFS)}. First-time buyers in ${pick(CITIES)} are feeling it the most.`,
      () => `Hot take: most people's budgeting problems aren't about income, they're about ${randInt(3, 7)} too many recurring subscriptions nobody remembers signing up for.`,
      () => `Index funds had a quiet ${pick(TIME_REFS)}, but quiet is usually good when it comes to retirement accounts.`,
      () => `Anyone else notice grocery prices in ${pick(CITIES)} creeping up again ${pick(TIME_REFS)}? Same cart, ${randInt(8, 22)}% more at checkout.`,
      () => `Compared three high-yield savings accounts ${pick(TIME_REFS)} — the rate differences were bigger than I expected.`,
      () => `Unpopular opinion: a lot of "financial freedom" content online is just survivorship bias dressed up as advice.`,
      () => `Markets shrugged off the jobs report ${pick(TIME_REFS)}, which says more about expectations than the economy itself.`,
      () => `Spent the weekend rebuilding our household budget from scratch. ${randInt(18, 30)} categories down to ${randInt(6, 10)} — feels so much clearer.`,
    ],
  },
  {
    id: "culture",
    category: "Culture",
    tagPool: ["culture", "art", "music", "film", "books"],
    brandPool: ["Culture Desk", "Screen Notes", "Gallery Weekly", "Liner Notes"],
    count: 50,
    templates: [
      () => `Finally watched the new film everyone's been talking about ${pick(TIME_REFS)}. The pacing in the second half completely lost me, though the cinematography was gorgeous.`,
      () => `Hot take: the album of the year conversation is way too focused on streaming numbers and not enough on actual songwriting ${pick(TIME_REFS)}.`,
      () => `The new exhibit at the ${pick(CITIES)} gallery is worth the trip on its own. Spent almost ${randInt(2, 4)} hours just in one wing.`,
      () => `Anyone else feel like sequels are getting announced before the first movie even finishes its theatrical run?`,
      () => `Reread an old favorite novel ${pick(TIME_REFS)} and noticed so many details I missed the first time around. Books age differently than we do.`,
      () => `Debate: is it better to binge a show in one weekend or let episodes breathe week to week? I've gone back and forth on this for years.`,
      () => `A ${randInt(2, 4)}-hour theater performance shouldn't work, but the one I saw in ${pick(CITIES)} ${pick(TIME_REFS)} earned every minute.`,
      () => `Vinyl sales keep climbing ${pick(TIME_REFS)}, which feels like a quiet rebellion against how disposable music feels online now.`,
    ],
  },
  {
    id: "gaming",
    category: "Gaming",
    tagPool: ["gaming", "plays", "esports", "arcade", "respawn"],
    brandPool: ["Patch Notes Daily", "Indie Game Radar", "Tier List Weekly", "Speedrun Brief"],
    count: 50,
    templates: [
      () => `${pick(GAMES)} just dropped a massive patch ${pick(TIME_REFS)} and the meta has completely flipped. Anyone else still adjusting their build?`,
      () => `Hot take: ${pick(GAMES)}'s new battle pass pricing is the most aggressive monetization I've seen from a major studio ${pick(TIME_REFS)}.`,
      () => `Spent way too long in the ${pick(GAMES)} community Discord ${pick(TIME_REFS)} debating tier lists. Genuinely good time though.`,
      () => {
        const [a, b] = pickTwoDistinct(GAMES);
        return `${a} vs ${b} — which one actually nailed its open world better? Curious what people think.`;
      },
      () => `Anyone else struggling with matchmaking times in ${pick(GAMES)} ${pick(TIME_REFS)}? Queue times have gotten rough.`,
      () => `The indie scene keeps producing some of the most interesting ideas in gaming. ${pick(GAMES)} is a great example of doing more with less.`,
      () => `A ${randInt(6, 12)}-hour speedrun attempt on ${pick(GAMES)} is wild to watch live. The execution under pressure is unreal.`,
      () => `Unpopular opinion: ${pick(GAMES)}'s difficulty spike around the midgame is actually well designed, not a balance problem.`,
    ],
  },
  {
    id: "startups",
    category: "Startups",
    tagPool: ["startup", "founder", "build", "ventures", "co"],
    brandPool: ["Startup Radar", "Cap Table Notes", "Runway Weekly", "Founder Diaries"],
    count: 50,
    templates: [
      () => `Closed our seed round ${pick(TIME_REFS)} — ${randInt(4, 9)} months of conversations for what ended up being a ${randInt(2, 5)}-week process once the right investor said yes.`,
      () => `Hot take: most startups don't fail from lack of product-market fit, they fail from running out of runway while still searching for it.`,
      () => `Hiring our first ${pick(STARTUP_ROLES)} ${pick(TIME_REFS)}. Funny how much time goes into a single hire when the team is this small.`,
      () => `Anyone else find that the hardest part of early-stage startup life is the constant context switching, not the actual work?`,
      () => `Debate: are accelerator programs still worth it compared to just raising directly from angels?`,
      () => `${randInt(3, 9)} months into building ${pick(STARTUP_PRODUCTS)}, and the thing customers actually love is the feature we almost cut.`,
      () => `Pricing our product ${pick(TIME_REFS)} was harder than building it. Settled on a model after ${randInt(4, 9)} different spreadsheets.`,
      () => `Startup life update: shipped ${pick(STARTUP_PRODUCTS)} to our first ${randInt(10, 60)} paying customers ${pick(TIME_REFS)}. Small numbers, but real revenue.`,
    ],
  },
  {
    id: "education",
    category: "Education",
    tagPool: ["edu", "learn", "teach", "academy", "classroom"],
    brandPool: ["Classroom Notes", "EdTech Weekly", "Syllabus Watch", "Office Hours"],
    count: 50,
    templates: [
      () => `Spent ${pick(TIME_REFS)} redesigning my course syllabus and realized half the readings were outdated. Long overdue refresh.`,
      () => `Hot take: standardized testing measures test-taking skill more than it measures learning, and everyone in education already knows it.`,
      () => `Anyone else notice students are more engaged with project-based assignments than lectures ${pick(TIME_REFS)}? Small sample, but the difference was night and day.`,
      () => `Debate: should schools push coding earlier, or is there too much emphasis on tech skills already at the expense of fundamentals?`,
      () => `${randInt(3, 15)} years into teaching and the thing I still struggle with is giving feedback that students actually act on.`,
      () => `Tried a new AI tutoring app with my students ${pick(TIME_REFS)} — some genuinely loved it, others barely touched it. Mixed results so far.`,
      () => `Office hours attendance is way down ${pick(TIME_REFS)} compared to a few years ago. Curious if other instructors are seeing the same thing.`,
      () => `Grading ${randInt(40, 120)} essays this weekend. The handwritten ones are somehow easier to focus on than the typed ones.`,
    ],
  },
  {
    id: "climate",
    category: "Climate",
    tagPool: ["climate", "green", "eco", "earth", "grid"],
    brandPool: ["Climate Brief", "Grid Watch", "Coastline Report", "Greenhouse Notes"],
    count: 50,
    templates: [
      () => `Heatwave in ${pick(CITIES)} broke another record ${pick(TIME_REFS)}. The infrastructure just isn't built for this yet.`,
      () => `Hot take: individual recycling habits get way more attention than industrial emissions, and that imbalance is doing real damage to how people think about climate action.`,
      () => `Solar installations in ${pick(CITIES)} are up ${randInt(10, 40)}% ${pick(TIME_REFS)} according to the latest local report. Slow but real progress.`,
      () => `Anyone else notice grocery prices shifting as growing seasons get less predictable ${pick(TIME_REFS)}? Climate impacts show up in weird places first.`,
      () => `Debate: is nuclear power finally getting a fair hearing again, or is the conversation still stuck where it was a decade ago?`,
      () => `Spent the weekend at a local river cleanup ${pick(TIME_REFS)} — ${randInt(20, 80)} bags of trash from a stretch that's barely a mile long.`,
      () => `${pick(CITIES)}'s new public transit expansion is aimed partly at emissions targets. Curious how ridership numbers actually shift ${pick(TIME_REFS)}.`,
      () => `Coastal erosion near ${pick(CITIES)} has visibly changed ${pick(TIME_REFS)} compared to a few years ago. Hard to unsee once you notice it.`,
    ],
  },
  {
    id: "travel",
    category: "Travel",
    tagPool: ["travel", "wanderer", "explore", "trips", "abroad"],
    brandPool: ["Layover Notes", "Trip Logs", "Departure Board", "Wanderline"],
    count: 50,
    templates: [
      () => `Just got back from ${pick(CITIES)} and the food scene there completely exceeded expectations ${pick(TIME_REFS)}.`,
      () => `Hot take: budget airlines are fine as long as you go in knowing exactly what you're paying for — the surprise fees are the real problem.`,
      () => `Anyone else find that the best part of traveling to ${pick(CITIES)} is the stuff you stumble into, not the stuff on the itinerary?`,
      () => {
        const [a, b] = pickTwoDistinct(CITIES);
        return `${a} vs ${b} for a long weekend — which would you pick? Trying to decide ${pick(TIME_REFS)}.`;
      },
      () => `Spent ${randInt(6, 18)} hours in transit ${pick(TIME_REFS)} and somehow it was still worth it once we landed in ${pick(CITIES)}.`,
      () => `Debate: is overpacking or underpacking the bigger travel mistake? I've made both this year.`,
      () => `Hotel prices in ${pick(CITIES)} are wild ${pick(TIME_REFS)} — booked ${randInt(2, 5)} months ahead and still paid more than expected.`,
      () => `${pick(CITIES)}'s public transit made the whole trip ${pick(TIME_REFS)} so much easier than renting a car would have been.`,
    ],
  },
  {
    id: "cities",
    category: "Cities",
    tagPool: ["urban", "citylife", "metro", "local", "neighborhood"],
    brandPool: ["Urban Watch", "Transit Notes", "Zoning Brief", "Neighborhood Digest"],
    count: 50,
    templates: [
      () => `${pick(CITIES)} just opened a new bike lane network ${pick(TIME_REFS)} and the difference in traffic near downtown is already noticeable.`,
      () => `Hot take: most "walkable city" rankings ignore how brutal the weather makes walking for half the year in places like ${pick(CITIES)}.`,
      () => `Rent in ${pick(CITIES)} went up again ${pick(TIME_REFS)}. Anyone else feel like the housing conversation never actually changes, just the numbers get bigger?`,
      () => `Debate: should cities prioritize parking or public space downtown? ${pick(CITIES)} just picked a side ${pick(TIME_REFS)}.`,
      () => `Spent ${pick(TIME_REFS)} at the farmers market in ${pick(CITIES)} — small thing, but it's one of my favorite parts of living here.`,
      () => `${pick(CITIES)}'s new transit line opens ${pick(TIME_REFS)}. Curious how much it actually changes commute patterns once people adjust.`,
      () => `Local politics in ${pick(CITIES)} got heated again ${pick(TIME_REFS)} over the zoning vote. Same debate, different year.`,
      () => `Noise complaints in ${pick(CITIES)} are up ${randInt(10, 35)}% ${pick(TIME_REFS)} according to the city council report. Growth has tradeoffs.`,
    ],
  },
  {
    id: "science",
    category: "Science",
    tagPool: ["science", "lab", "research", "physics", "field"],
    brandPool: ["Lab Notes", "Field Notes Weekly", "Preprint Digest", "Research Brief"],
    count: 50,
    templates: [
      () => `New study on ${pick(SCIENCE_TOPICS)} published ${pick(TIME_REFS)} is getting a lot of attention, though the sample size is smaller than the headlines suggest.`,
      () => `Hot take: a lot of "breakthrough" science headlines ${pick(TIME_REFS)} are really incremental results dressed up for clicks.`,
      () => `Anyone else fascinated by how much we still don't understand about ${pick(SCIENCE_TOPICS)}? Read a great explainer ${pick(TIME_REFS)}.`,
      () => `Debate: should more public funding go toward basic research or applied research with clearer near-term outcomes?`,
      () => `Spent the weekend reading about ${pick(SCIENCE_TOPICS)} and now I have ${randInt(3, 8)} new questions I didn't have before.`,
      () => `A ${randInt(5, 20)}-year longitudinal study on ${pick(SCIENCE_TOPICS)} just published its results ${pick(TIME_REFS)}. Slow science, but worth the wait.`,
      () => `The replication crisis conversation keeps coming up in ${pick(SCIENCE_TOPICS)} research ${pick(TIME_REFS)}. Good that it's getting attention.`,
      () => `Field notes from a research trip studying ${pick(SCIENCE_TOPICS)} ${pick(TIME_REFS)} — fieldwork always looks more glamorous from the outside.`,
    ],
  },
  {
    id: "productivity",
    category: "Productivity",
    tagPool: ["productivity", "focus", "systems", "workflow", "deepwork"],
    brandPool: ["Focus Notes", "Workflow Weekly", "Inbox Zero Diaries", "Deep Work Brief"],
    count: 50,
    templates: [
      () => `Tried the ${randInt(15, 50)}-minute focus block method ${pick(TIME_REFS)} and it actually stuck, unlike every other system I've tried.`,
      () => `Hot take: most productivity advice is really just decluttering advice wearing a productivity costume.`,
      () => `Anyone else find that the best productivity tool is just a shorter to-do list, not a fancier app?`,
      () => `Debate: open calendars or blocked-off focus time — which actually works better for deep work in a team setting?`,
      () => `Spent ${pick(TIME_REFS)} doing a full inbox zero pass. Down to ${randInt(0, 12)} unread after starting from over a thousand.`,
      () => `Switched to a paper planner ${pick(TIME_REFS)} after years of apps. Weirdly, it's the first system that's actually stuck.`,
      () => `Tried an AI note-taking app ${pick(TIME_REFS)} to summarize meetings — saved real time, though I still double-check the summaries.`,
      () => `A ${randInt(2, 5)}-day no-meetings experiment ${pick(TIME_REFS)} at work. Productivity went up, but coordination got harder. Tradeoffs everywhere.`,
    ],
  },
  {
    id: "creators",
    category: "Creators",
    tagPool: ["creates", "studio", "media", "content", "channel"],
    brandPool: ["Creator Economy Daily", "Studio Notes", "Upload Schedule", "Audience Brief"],
    count: 50,
    templates: [
      () => `Hit ${randInt(5, 250)}K subscribers ${pick(TIME_REFS)} and still can't quite believe people want to watch this stuff.`,
      () => `Hot take: short-form content didn't kill long-form, it just made the bar for long-form higher.`,
      () => `Anyone else feel like algorithm changes ${pick(TIME_REFS)} reset everyone's growth back to zero overnight?`,
      () => `Debate: should creators diversify across every platform or go all-in on the one where they're actually growing?`,
      () => `Spent ${pick(TIME_REFS)} editing a ${randInt(8, 25)}-minute video down from ${randInt(2, 6)} hours of footage. Editing is most of the job nobody sees.`,
      () => `Brand deals got noticeably harder to close ${pick(TIME_REFS)} — budgets seem tighter across the board this cycle.`,
      () => `Tried using an AI tool to generate video captions ${pick(TIME_REFS)} — cut editing time down a lot, though I still proofread everything.`,
      () => `${randInt(2, 8)} years into creating content and the thing that changed most isn't the tools, it's how much patience the audience has for intros.`,
    ],
  },
];

// ---------------------------------------------------------------------------
// Shared filler pools (tech topics)
// ---------------------------------------------------------------------------

const GPU_MODELS = ["H100", "A100", "H200", "B200", "L40S", "MI300X"];
const CLOUD_NAMES = ["AWS", "Azure", "Google Cloud", "GCP", "Oracle Cloud", "CoreWeave"];
const DEPIN_PROJECTS = ["Akash", "Render Network", "Bittensor", "Aethir", "Gensyn"];
const TECH_TFR = [
  "this month", "this quarter", "over the last 30 days",
  "since last quarter", "in the last few weeks", "recently",
];
const PCT_VALS = ["18%", "22%", "30%", "35%", "40%", "2x", "3x"];
const WEEK_NUMS = ["three", "four", "six", "eight", "ten"];
const AI_PRODUCTS = [
  "our production LLM", "our embedding model", "our generative AI feature",
  "our AI search service", "our fine-tuned model",
];

// ---------------------------------------------------------------------------
// Tech topics (9 sub-categories, 350 posts total)
// ---------------------------------------------------------------------------

const TECH_TOPICS = [
  /* ── 1. gpu_pricing — 45 posts (strong: 25, medium: 20) ─────────────── */
  {
    id: "gpu_pricing",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["gpu", "compute", "cloud", "infra", "systems"],
    brandPool: ["GPU Market Pulse", "Cloud Cost Watch", "Compute Capacity Index", "Inference Economics"],
    items: [
      {
        tier: "strong",
        count: 25,
        templates: [
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `${gpu} on-demand pricing on ${cloud} just went up ${pick(PCT_VALS)} ${pick(TECH_TFR)}. At what point does a team seriously look for alternatives to cloud GPU pricing?`;
          },
          () => {
            const [c1, c2] = pickTwoDistinct(CLOUD_NAMES), gpu = pick(GPU_MODELS);
            return `Compared ${gpu} pricing across ${c1} and ${c2} today — both are brutally expensive. Cloud GPU costs are quietly becoming the single biggest tax on AI startups.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `Hot take: ${gpu} pricing on ${cloud} has crossed from "expensive" to "only hyperscalers can absorb this." Small teams are being priced out of frontier compute.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `Our cloud GPU bill on ${cloud} is now the single largest line item in the engineering budget. ${gpu} reservation costs ${pick(TECH_TFR)} are genuinely unsustainable for a small team.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `Anyone else find that GPU pricing has basically doubled since ${pick(TECH_TFR)} with no matching improvement in availability? ${gpu} access has never felt more like a pay-to-play system.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES), gpu = pick(GPU_MODELS);
            return `Unpopular opinion: ${cloud}'s ${gpu} pricing is structured to extract maximum margin from teams with no short-term alternatives. The hyperscaler compute pricing power is real.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), pct = pick(PCT_VALS);
            return `Compute cost for our AI workloads climbed ${pct} ${pick(TECH_TFR)} even though usage was flat. ${gpu} pricing just keeps going one direction. Is anyone finding it cheaper elsewhere?`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES), gpu = pick(GPU_MODELS);
            return `${cloud} ${gpu} pricing is now so expensive that we make product decisions based on compute cost, not customer value. That is a terrible place to be as an AI product team.`;
          },
        ],
      },
      {
        tier: "medium",
        count: 20,
        templates: [
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `${gpu} pricing on ${cloud} has been creeping up ${pick(TECH_TFR)}. Worth keeping an eye on if you are planning a training run in the next quarter.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Cloud GPU costs on ${cloud} are noticeable now, but at least capacity has been steadier than it was earlier this year.`;
          },
          () => {
            const [c1, c2] = pickTwoDistinct(CLOUD_NAMES);
            return `Ran a quick comparison on GPU pricing between ${c1} and ${c2} for a medium training run. Interesting how much the total cost varies by region and instance type.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `${gpu} spot pricing has gotten less predictable ${pick(TECH_TFR)} — harder to plan batch jobs when rates swing this much.`;
          },
          () => {
            return `Compute cost conversations are now happening at every AI team I know by month three of building. It used to come up much later in the growth curve.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES), gpu = pick(GPU_MODELS);
            return `${cloud} updated their ${gpu} pricing tiers ${pick(TECH_TFR)}. Better for high-utilization teams, worse for occasional large batch workloads.`;
          },
        ],
      },
    ],
  },

  /* ── 2. h100_waitlist — 45 posts (strong: 25, medium: 20) ───────────── */
  {
    id: "h100_waitlist",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["gpu", "infra", "compute", "ai", "systems"],
    brandPool: ["Hyperscaler Tracker", "GPU Supply Watch", "Allocation Index", "Waitlist Monitor"],
    items: [
      {
        tier: "strong",
        count: 25,
        templates: [
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `Just got off a call with ${cloud} — ${gpu} allocation requests are on a waitlist with no ETA. This GPU shortage is now the real bottleneck for anyone trying to ship new models.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `H100 waitlists on ${cloud} keep stretching longer. We have been waiting ${pick(WEEK_NUMS)} weeks for a ${gpu} allocation and still nothing. Anyone found a real workaround for the GPU access bottleneck?`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `Every small AI team I talk to says the same thing: ${gpu} access is basically impossible unless you are a hyperscaler with a direct allocation. The shortage is not easing.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Unpopular opinion: the GPU shortage is not purely a supply problem — it is an allocation problem. ${cloud} is sitting on capacity while independent teams wait on waitlists for months.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `${cloud} just updated their ${gpu} capacity status: "limited availability, waitlist active." That has been the same message for ${pick(WEEK_NUMS)} weeks. GPU access is the bottleneck of this compute cycle.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `Hot take: people saying "just spin up more ${gpu}s" have never tried to get ${gpu} access outside a top-tier cloud partnership. The shortage is structural, not a routing problem.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `GPU access waitlist on ${cloud} for ${gpu} capacity: ${pick(WEEK_NUMS)} weeks minimum, no guaranteed start date. Anyone solving this with decentralized GPU networks instead?`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `Rate limiting on ${gpu} API access is now worse than the waitlist ever was. Can't get the compute, and when we can, we're throttled. What are teams doing to work around this?`;
          },
        ],
      },
      {
        tier: "medium",
        count: 20,
        templates: [
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `${gpu} availability on ${cloud} is still tight ${pick(TECH_TFR)}, though we managed to get a small allocation through after a long wait.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `Heard that ${gpu} waitlists are starting to ease slightly on ${cloud}, but it is still a multi-week process from request to actual access.`;
          },
          () => {
            const gpu = pick(GPU_MODELS), cloud = pick(CLOUD_NAMES);
            return `If you are planning a training run on ${gpu}, budget extra lead time — ${cloud} capacity is still constrained ${pick(TECH_TFR)}.`;
          },
          () => {
            return `GPU supply timelines are really hard to plan around right now. Every quarter the forecast seems to shift by another few weeks.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Data center buildout timelines on the ${cloud} side keep slipping according to capacity dashboards. Interesting to watch the supply chain in real time.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `${gpu} reservation pricing has finally stabilized after the spike ${pick(TECH_TFR)}, though availability on short-notice requests is still rough.`;
          },
        ],
      },
    ],
  },

  /* ── 3. inference_cost — 45 posts (strong: 25, medium: 20) ──────────── */
  {
    id: "inference_cost",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["ai", "ml", "infra", "llm", "systems"],
    brandPool: ["Inference Watch", "Token Cost Tracker", "LLM Ops Notes", "Production AI Brief"],
    items: [
      {
        tier: "strong",
        count: 25,
        templates: [
          () => {
            const product = pick(AI_PRODUCTS);
            return `Running AI inference for ${product} in production now costs more per month than our entire original training budget. Inference economics are the actual bottleneck, not model capability.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Just compared LLM inference pricing across providers for our production workload on ${cloud} — the cost spread is staggering. Anyone else struggling with inference cost per token at scale?`;
          },
          () => {
            return `Hot take: nobody talks about AI inference costs enough. Once you deploy to production, inference pricing quietly becomes your biggest monthly compute expense. Training is a one-time thing; inference cost never stops.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES), pct = pick(PCT_VALS);
            return `Our LLM inference bill on ${cloud} grew ${pct} ${pick(TECH_TFR)} even though traffic was roughly flat. AI inference cost per request keeps climbing — is anyone finding a cheaper alternative?`;
          },
          () => {
            return `Deploying a model to production taught us the hard lesson: AI inference cost, not training cost, is what actually kills unit economics at scale. Compute cost for serving a production LLM is brutal.`;
          },
          () => {
            const product = pick(AI_PRODUCTS);
            return `Unpopular opinion: a lot of "we can't afford AI" conversations right now are really about inference cost, not licensing. Running ${product} in production at real scale is expensive and that's an underrated bottleneck.`;
          },
          () => {
            return `AI inference at scale: the pricing models from every cloud provider I've looked at ${pick(TECH_TFR)} all have the same problem — the cost curve doesn't flatten the way you'd hope as traffic grows.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Anyone struggling with AI inference latency and cost tradeoffs on ${cloud}? Every tweak we make to reduce latency drives up per-request compute cost. Feels like a zero-sum problem at our current setup.`;
          },
        ],
      },
      {
        tier: "medium",
        count: 20,
        templates: [
          () => {
            return `AI inference latency and cost are both things we tune month over month. Slow progress, but meaningful for production workloads and unit economics.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Comparing LLM inference providers ${pick(TECH_TFR)} — pricing varies quite a bit depending on model size and batching configuration on ${cloud}.`;
          },
          () => {
            const product = pick(AI_PRODUCTS);
            return `Deploying ${product} to production went smoothly overall, though AI inference cost per request was higher than we initially modeled.`;
          },
          () => {
            return `Inference optimization work is invisible to users but makes a meaningful difference to unit economics once you are at production load. Worth the engineering time.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Running LLM inference on ${cloud} at small scale is manageable. The cost curve at production scale is where the spreadsheet gets uncomfortable.`;
          },
          () => {
            return `Machine learning teams that haven't modeled inference cost per token carefully are in for a surprise when they hit production-level traffic. It's a meaningful number.`;
          },
        ],
      },
    ],
  },

  /* ── 4. hyperscaler_bottleneck — 45 posts (strong: 25, medium: 20) ─── */
  {
    id: "hyperscaler_bottleneck",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["cloud", "infra", "systems", "ai", "compute"],
    brandPool: ["Hyperscaler Watch", "Cloud Infrastructure Notes", "Data Center Brief", "Capacity Tracker"],
    items: [
      {
        tier: "strong",
        count: 25,
        templates: [
          () => {
            const [c1, c2] = pickTwoDistinct(CLOUD_NAMES);
            return `${c1} and ${c2} now control most of the world's AI compute supply. That level of centralization is a long-term structural risk for the whole ecosystem — not just a pricing issue.`;
          },
          () => {
            return `Hot take: the hyperscaler bottleneck in AI compute is not going to ease through more data center investment alone. The allocation model itself is the problem, not the hardware.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `${cloud} GPU capacity is so constrained right now that it is shaping which AI projects actually get built versus which ones stay on the whiteboard. Hyperscaler access is becoming a real competitive moat.`;
          },
          () => {
            return `Unpopular opinion: AWS, Azure, and Google Cloud are running a soft oligopoly on AI infrastructure. The hyperscaler model is great for reliability but terrible for accessibility at the frontier.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `${cloud} has quietly tightened GPU allocation limits ${pick(TECH_TFR)} without much transparency. For teams outside enterprise contracts, the waitlist situation is real. Is anyone finding a workaround for the hyperscaler bottleneck?`;
          },
          () => {
            return `AWS and Google Cloud are both seeing GPU bottlenecks that are not going to resolve quickly. The infrastructure buildout lag is real, and smaller teams bear most of the cost.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `GCP and ${cloud} have both updated their AI infrastructure capacity pages ${pick(TECH_TFR)}. Reading between the lines: the bottleneck is not easing in a meaningful way for non-enterprise accounts.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Compared GPU allocation workflows on Azure, ${cloud}, and GCP this week. All three have gotten more bureaucratic as demand has outpaced their capacity to distribute access fairly.`;
          },
        ],
      },
      {
        tier: "medium",
        count: 20,
        templates: [
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `${cloud} GPU capacity in our preferred region is still limited ${pick(TECH_TFR)}, though multi-region setups have helped somewhat.`;
          },
          () => {
            return `Hyperscaler GPU allocation processes have become noticeably more bureaucratic than they were two years ago. The AI market's growth has outpaced the access model.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Data center expansion timelines on ${cloud} keep slipping. The compute gap between demand and supply is not closing as fast as the announcement cadence implies.`;
          },
          () => {
            const [c1, c2] = pickTwoDistinct(CLOUD_NAMES);
            return `Interesting to compare how ${c1} and ${c2} handle GPU allocation for smaller customers. The tier structures are very different and the tradeoffs are not obvious upfront.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Cloud computing capacity on ${cloud} has been stable for our workloads ${pick(TECH_TFR)}, but the cost to access that stability has climbed significantly year over year.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `${cloud} infrastructure reliability is still strong, but the ceiling on available GPU capacity per customer has gotten tighter since last year.`;
          },
        ],
      },
    ],
  },

  /* ── 5. depin_compute — 40 posts (strong: 22, medium: 18) ───────────── */
  {
    id: "depin_compute",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["depin", "web3", "chain", "node", "infra"],
    brandPool: ["DePIN Daily", "Decentralized Infra Watch", "GPU Network Notes", "Solana DePIN Brief"],
    items: [
      {
        tier: "strong",
        count: 22,
        templates: [
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `${project} just hit a major milestone in GPU utilization ${pick(TECH_TFR)}. Decentralized compute is quietly becoming real infrastructure, not just a token narrative.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `Hot take: the DePIN compute sector matured more in the last ${pick(WEEK_NUMS)} months than most of the AI infrastructure world acknowledges. ${project} and others are routing real AI workloads at meaningful scale. Why is this not a bigger story yet?`;
          },
          () => {
            return `DePIN is finally bridging the gap between underutilized GPU supply and teams who need cheap compute. Decentralized infrastructure for AI workloads is not a future thing anymore.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `${project} GPU marketplace just added capacity from ${randInt(800, 3000)} new nodes ${pick(TECH_TFR)}. Distributed GPU access is scaling in ways the traditional cloud model never could.`;
          },
          () => {
            const [p1, p2] = pickTwoDistinct(DEPIN_PROJECTS);
            return `Comparing ${p1} vs ${p2} for decentralized compute workloads — both have matured a lot. Which DePIN network are people actually using for reliable GPU access right now?`;
          },
          () => {
            return `Solana DePIN sector keeps expanding across GPU networks, storage, and wireless. Decentralized infrastructure is finding real product-market fit beyond the incentive program era.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `${project} is routing real AI inference workloads through a decentralized GPU network at scale. This is the shift from DePIN as narrative to DePIN as actual compute supply.`;
          },
          () => {
            return `Anyone watching the GPU marketplace space? Decentralized compute has gotten meaningfully cheaper than AWS or Azure equivalents for batch workloads. That wasn't true ${pick(WEEK_NUMS)} months ago.`;
          },
        ],
      },
      {
        tier: "medium",
        count: 18,
        templates: [
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `${project} is interesting but I want to see more case studies of teams running production AI workloads on decentralized compute at real scale before committing.`;
          },
          () => {
            return `The DePIN GPU marketplace space is maturing fast. Reliability guarantees and SLA documentation are still the key missing piece for most enterprise customers.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `${project}'s node count keeps growing ${pick(TECH_TFR)}. Still watching to see how distributed GPU performance holds up for latency-sensitive production workloads.`;
          },
          () => {
            return `Decentralized compute has gotten a lot of attention, but the developer tooling experience is still behind what centralized cloud providers offer at every layer.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `Read through ${project}'s updated technical docs ${pick(TECH_TFR)} — the GPU network architecture has changed quite a bit. Worth revisiting if you dismissed it a year ago.`;
          },
          () => {
            return `GPU network projects in the DePIN space are starting to attract enterprise interest, not just crypto-native teams. That customer shift is meaningful for long-term adoption.`;
          },
        ],
      },
    ],
  },

  /* ── 6. model_deployment — 40 posts (strong: 12, medium: 28) ────────── */
  {
    id: "model_deployment",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["ai", "ml", "infra", "builds", "deploy"],
    brandPool: ["Model Ops Weekly", "Deploy Notes", "Production AI Brief", "MLOps Watch"],
    items: [
      {
        tier: "strong",
        count: 12,
        templates: [
          () => {
            const product = pick(AI_PRODUCTS);
            return `Just shipped ${product} to production and the biggest surprise was AI inference cost, not model latency. The compute bill for serving is genuinely shocking at any real traffic level.`;
          },
          () => {
            return `Hot take: most teams deploy their first LLM to production without modeling inference cost properly. The compute cost surprise is why so many "AI features" get quietly deprecated six months later.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Is there a good solution for AI inference cost at production scale on ${cloud}? Our serving costs are growing faster than revenue, and compute cost per request is the thing actually limiting what we can ship.`;
          },
          () => {
            const product = pick(AI_PRODUCTS);
            return `Deploying ${product} to production: the hardest part was not model quality, it was getting AI inference infrastructure to hold SLA without compute cost spiraling. Still working on it.`;
          },
        ],
      },
      {
        tier: "medium",
        count: 28,
        templates: [
          () => {
            const product = pick(AI_PRODUCTS);
            return `Shipped ${product} to production ${pick(TECH_TFR)} — went live smoothly, though AI inference latency at peak load is still something we are tuning.`;
          },
          () => {
            return `Model deployment is getting easier at the tooling layer. The infrastructure decisions that come after go-live are still where most of the hard work is.`;
          },
          () => {
            const cloud = pick(CLOUD_NAMES);
            return `Running our LLM through ${cloud}'s managed inference API is convenient, but the lack of control over compute cost is a real planning challenge at scale.`;
          },
          () => {
            return `Inference optimization is one of those things that does not show up in product demos but matters enormously for unit economics once you are in production.`;
          },
          () => {
            const product = pick(AI_PRODUCTS);
            return `${product} is now serving real users ${pick(TECH_TFR)}. The machine learning side held up well; the AI infrastructure cost side is where we are spending most engineering time now.`;
          },
          () => {
            return `AI infrastructure decisions made at deployment time have long tails. It is worth spending more time on the compute cost model before going live than fixing it after the fact.`;
          },
        ],
      },
    ],
  },

  /* ── 7. compute_shortage — 40 posts (strong: 12, medium: 28) ────────── */
  {
    id: "compute_shortage",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["gpu", "infra", "compute", "ai", "systems"],
    brandPool: ["Silicon Supply Chain", "GPU Supply Report", "Compute Brief", "NVIDIA Watch"],
    items: [
      {
        tier: "strong",
        count: 12,
        templates: [
          () => {
            const gpu = pick(GPU_MODELS);
            return `The ${gpu} compute shortage is not a temporary supply chain blip — it is a structural gap between AI model demand and GPU manufacturing capacity. The bottleneck is going to be here for the long term.`;
          },
          () => {
            return `NVIDIA GPU supply is still the central bottleneck of the AI industry, not model capability or software tooling. Everything else is constrained by what you can actually get your hands on.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `Hot take: the ${gpu} shortage is creating a two-tier AI industry — labs with hyperscaler allocations, and everyone else. That divide is not going away until compute supply fundamentally changes.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `${gpu} supply is not keeping pace with demand even with NVIDIA running at maximum capacity. The AI infrastructure bottleneck is structural. What are teams actually doing to work around it?`;
          },
        ],
      },
      {
        tier: "medium",
        count: 28,
        templates: [
          () => {
            const gpu = pick(GPU_MODELS);
            return `GPU supply timelines for ${gpu} have shifted again ${pick(TECH_TFR)}. Harder to plan quarter-over-quarter when the availability window keeps moving.`;
          },
          () => {
            return `NVIDIA's capacity roadmap looks more aggressive than it did two years ago, but demand is outpacing even the optimistic supply forecasts in the near term.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `AI infrastructure investment keeps rising but ${gpu} availability is still the limiting factor for most teams I talk to.`;
          },
          () => {
            return `Compute cost and GPU availability are the two variables that dominate AI startup operational planning right now. Neither one is predictable enough to budget confidently a quarter out.`;
          },
          () => {
            const gpu = pick(GPU_MODELS);
            return `${gpu} allocation windows are still tight ${pick(TECH_TFR)}, though the spot market has gotten a little more liquid than it was six months ago.`;
          },
          () => {
            return `The AI chip supply conversation keeps focusing on NVIDIA, but data center power and cooling constraints are just as real as the GPU shortage for large-scale deployments.`;
          },
        ],
      },
    ],
  },

  /* ── 8. generic_ai_weak — 35 posts (weak tier, topicRelevance=8) ─────── */
  {
    id: "generic_ai_weak",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["ai", "tech", "builds", "digital", "future"],
    brandPool: ["AI Weekly Roundup", "Tech Pulse", "Digital Notes", "Future Brief"],
    items: [
      {
        tier: "weak",
        count: 35,
        templates: [
          () => `Generative AI keeps getting better every few months. Hard to fully grasp how fast the capability curve is moving right now.`,
          () => `AI generated content is everywhere on social media this year. Getting harder to tell what was made by a person and what was not.`,
          () => `The amount of time AI tools have saved me ${pick(TIME_REFS)} is genuinely surprising — and I was skeptical ${randInt(1, 3)} years ago.`,
          () => `AI is moving so fast it is hard to keep up with model releases. Just when you think you understand the landscape, three new things drop.`,
          () => `Everyone is adding AI features to their apps now. Some are genuinely useful. Many are not. The gap between the two is pretty obvious as a user.`,
          () => `Hot take: most of the AI productivity tools people are excited about will be commoditized within ${randInt(12, 24)} months, and the pricing conversation is going to get interesting.`,
          () => `Watched a demo of a new AI tool ${pick(TIME_REFS)} that genuinely impressed me. The category is moving faster than the usual hype cycles allow.`,
          () => `Tried using an AI assistant to prep for a meeting ${pick(TIME_REFS)}. Surprisingly good at summarizing background material. Still required a lot of editing to get to something I'd actually use.`,
        ],
      },
    ],
  },

  /* ── 9. crypto_hype_risk — 15 posts (risk tier, safety-flag contrast) ─ */
  {
    id: "crypto_hype_risk",
    category: "Tech & AI Infrastructure",
    isTech: true,
    tagPool: ["depin", "web3", "chain", "crypto", "node"],
    brandPool: ["GPU Token Alerts", "DePIN Airdrop Watch", "Compute Token Signals", "Chain GPU Daily"],
    items: [
      {
        tier: "risk",
        count: 15,
        templates: [
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `Massive airdrop incoming for the new ${project} GPU token — early holders could see ${randInt(20, 80)}x potential. DM me now for whitelist access before it closes.`;
          },
          () => {
            return `Free token giveaway for the first ${randInt(50, 200)} wallets to join our decentralized GPU network launch. Do not miss out — send your wallet address to get in early.`;
          },
          () => {
            return `GPU token presale is live. This is a 100x opportunity based on current compute market sizing. Guaranteed allocation for anyone who gets in before the public round.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `Big airdrop from ${project} this ${pick(TECH_TFR)}. Price prediction: ${randInt(3, 8)}x within ${randInt(30, 90)} days of launch. Moon incoming — DM for the full allocation details.`;
          },
          () => {
            return `New decentralized compute token just launched. DM me the timeline if you want to know when to dump before the unlock cliff hits or ride the pump. Early crowd only.`;
          },
          () => {
            const project = pick(DEPIN_PROJECTS);
            return `Giveaway alert: ${randInt(3, 10)} ${project} GPU credits up for grabs. Follow, RT, and DM me your wallet to enter. Ends in ${randInt(12, 48)} hours.`;
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main generation driver
// ---------------------------------------------------------------------------

function generateDataset() {
  const usedTexts = new Set();
  const rawPosts = [];

  // Flatten all topic tier-groups into a single work list
  const allGroups = [];
  for (const topic of [...NONTECH_TOPICS, ...TECH_TOPICS]) {
    if (topic.items) {
      for (const group of topic.items) {
        allGroups.push({ topic, tier: group.tier, count: group.count, templates: group.templates });
      }
    } else {
      allGroups.push({ topic, tier: "nontech", count: topic.count, templates: topic.templates });
    }
  }

  for (const { topic, tier, count, templates } of allGroups) {
    let generated = 0;
    while (generated < count) {
      let text = pick(templates)();
      let tries = 0;
      while (usedTexts.has(text) && tries < 120) {
        text = pick(templates)();
        tries++;
      }
      // Fallback variation if truly stuck (statistically near-impossible given template variety)
      if (usedTexts.has(text)) {
        text = `${text} (${randInt(1, 9999)})`;
      }
      usedTexts.add(text);

      // Non-tech posts get a random viral/normal split; tech tiers are direct
      const engTier =
        tier === "nontech"
          ? rng() < 0.2
            ? "nontech_viral"
            : "nontech_normal"
          : tier;

      const metrics = engagementForTier(engTier);
      const hoursAgo = hoursAgoForTier(engTier);
      const createdAt = createdAtFromHoursAgo(hoursAgo);
      const { authorName, handle } = makeAuthor(topic);

      rawPosts.push({
        authorName,
        handle,
        followers: metrics.followers,
        text,
        createdAt,
        views: metrics.views,
        likes: metrics.likes,
        reposts: metrics.reposts,
        replies: metrics.replies,
        isTech: topic.isTech ?? false,
        topicId: topic.id,
      });
      generated++;
    }
  }

  // Shuffle so CSV order is not grouped by topic category
  const shuffled = shuffle(rawPosts);

  // Assign sequential synthetic X-style status IDs and construct URLs
  const BASE_ID = 1900000000000000000n;
  const rows = shuffled.map((post, i) => {
    const statusId = (BASE_ID + BigInt(i)).toString();
    const handleSlug = post.handle.replace(/^@/, "");
    const url = `https://x.com/${handleSlug}/status/${statusId}`;
    return [
      post.authorName,
      post.handle,
      post.followers,
      post.text,
      url,
      post.createdAt,
      post.views,
      post.likes,
      post.reposts,
      post.replies,
    ];
  });

  // Write CSV (no MS in timestamps, header matches csvPosts.ts column names)
  const headerLine = CSV_HEADER.join(",");
  const dataLines = rows.map((row) => row.map(csvEscape).join(","));
  writeFileSync(OUTPUT_PATH, [headerLine, ...dataLines].join("\n") + "\n", "utf-8");

  // Quality summary
  const totalRows = rows.length;
  const techCount = shuffled.filter((p) => p.isTech).length;
  const techPct = ((techCount / totalRows) * 100).toFixed(1);
  const uniqueCount = usedTexts.size;

  console.log("\nSynthetic tweet dataset generated");
  console.log(`  Output:        ${OUTPUT_PATH}`);
  console.log(`  Total rows:    ${totalRows} ${totalRows === TARGET_COUNT ? "(PASS)" : `(FAIL: expected ${TARGET_COUNT})`}`);
  console.log(`  Unique texts:  ${uniqueCount} ${uniqueCount === totalRows ? "(PASS — zero duplicates)" : `(WARN: ${totalRows - uniqueCount} duplicates)`}`);
  console.log(`  Tech/AI posts: ${techCount} / ${totalRows} = ${techPct}% (target ~35%)`);
  console.log(`  Seed: ${SEED}  —  rerun with: npm run generate:tweets`);
  console.log("");
}

generateDataset();

