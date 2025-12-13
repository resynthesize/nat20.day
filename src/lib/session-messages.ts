/**
 * 365 increasingly agitated messages for days since last session.
 *
 * Messages use {name} placeholder which gets replaced with a random party member name.
 * The tone escalates from content rest (day 1) to existential dread (day 365).
 */

// Messages organized by day ranges for easier maintenance
// Each array element corresponds to a specific day (index 0 = day 0, index 1 = day 1, etc.)

const messages: string[] = [
  // Day 0: Just played!
  "The party counts their loot",

  // Days 1-7: Content rest at the tavern
  "The party rests at the tavern",
  "The adventurers sleep in",
  "{name} orders another round",
  "The party enjoys a well-earned break",
  "{name} sharpens their weapons",
  "The tavern keeper knows everyone's order by heart",
  "{name} regales the bar with tales of adventure",

  // Days 8-14: Getting restless
  "{name} starts a bar tab they'll regret",
  "The dice gather dust on the shelf",
  "{name} reorganizes their inventory for the third time",
  "The party debates which tavern has better ale",
  "{name} practices their intimidation face in a mirror",
  "Cobwebs gather on your dice",
  "{name} is teaching the tavern cat to fetch",

  // Days 15-21: Boredom sets in
  "{name} has memorized the menu",
  "The bartender is tired of {name}'s stories",
  "{name} starts making up backstory details",
  "Your character sheets grow dusty",
  "{name} is worried they forgot how to roll a d20",
  "The party argues about rules they'll never use",
  "{name} is pretty sure they left something in the dungeon",

  // Days 22-30: Cabin fever
  "{name} challenges a broom to a duel",
  "The tavern's dart board has seen better days",
  "{name} has named all the tavern's rats",
  "The party has run out of things to argue about",
  "{name} wrote fanfiction about the party. It's bad.",
  "Your miniatures judge you from the shelf",
  "{name} forgot what their character's voice sounds like",
  "The BBEG sends a 'miss you' card",
  "The party starts a book club. Nobody reads the book.",

  // Days 31-45: Desperation creeps in
  "{name} considers becoming an NPC",
  "The tavern keeper asks when you're leaving",
  "{name} has developed opinions about fantasy economics",
  "Your dice have started a union",
  "{name} astral projects just to feel something",
  "The party's reputation is now 'those people who sit in the corner'",
  "{name} challenges villagers to arm wrestling",
  "The BBEG wonders if you forgot about them",
  "{name} is on a first-name basis with every shopkeeper",
  "The quest board has your wanted poster now",
  "{name} hosts a one-person book club meeting",
  "Your character's backstory trauma is healing. Concerning.",
  "{name} starts collecting spoons",
  "The tavern bard writes a song about waiting",
  "{name} learned to juggle. Poorly.",

  // Days 46-60: Existential questioning
  "Does your character even exist if you don't play them?",
  "{name} stares wistfully at a map",
  "The dungeon misses you",
  "{name} has rewritten their backstory five times",
  "Your dice have forgotten your touch",
  "{name} wonders if the real treasure was the sessions we missed",
  "The party's mounts have gotten fat",
  "{name} is pretty sure they've leveled down",
  "Somewhere, a dragon laughs at your empty schedule",
  "{name} has taken up knitting adventurer socks",
  "The tavern is considering a loyalty program just for you",
  "{name} drew a map of the tavern. In excessive detail.",
  "Your spell slots have expired",
  "{name} forgot how many hit points they have",
  "The BBEG has moved on to threatening a different party",

  // Days 61-90: Deep despair
  "{name} talks to their character sheet late at night",
  "A bard writes a song about the adventurers who never returned",
  "{name} has started a support group for inactive PCs",
  "Your dice have filed for abandonment",
  "{name} wonders if this is their retirement arc",
  "The tavern dedicated a booth to the party. It's a memorial.",
  "{name} teaches combat techniques to squirrels",
  "Your character's deity leaves a voicemail",
  "{name} is haunted by the ghost of sessions past",
  "The party's legend fades from tavern gossip",
  "{name} petitions to become furniture",
  "Your initiative bonus has atrophied",
  "{name} runs a mock battle with dinner rolls",
  "The quest-giver found someone else",
  "{name} practices monologues to an empty room",
  "Your equipment has deprecated",
  "{name} wonders if this is limbo",
  "The tavern cat shows more ambition than the party",
  "{name} contemplates a career change to farming",
  "Your party's theme song plays in a minor key now",
  "{name} alphabetizes their spell list. Again.",
  "The map on the wall mocks you",
  "{name} has befriended the dust bunnies",
  "Your backstory antagonist died of old age",
  "{name} is fluent in tavern small talk",
  "The party's wanted posters have faded",
  "{name} measures time in missed sessions",
  "Your dice refuse to make eye contact",
  "{name} has memorized every knot in the tavern's wood",
  "The DM's notes have composted",

  // Days 91-120: Absurdist territory
  "{name} starts a philosophical debate with a chair",
  "Your character exists in a state of quantum irrelevance",
  "{name} has written a 50-page history of the tavern",
  "The party's bonds of friendship are held together by inertia",
  "{name} petitions the gods for literally anything to happen",
  "Your alignment has drifted to 'true apathetic'",
  "{name} developed a rivalry with the tavern's resident drunk",
  "The dice have evolved beyond the need for rolling",
  "{name} is considering a multiclass into 'person who does nothing'",
  "Your character sheet has yellowed",
  "{name} teaches the tavern cat to play dead. It's too easy.",
  "The party's reputation is now 'furniture'",
  "{name} has named every ceiling beam",
  "Your spell components have expired",
  "{name} forgot which edition you're playing",
  "The BBEG sends a sympathy card",
  "{name} carved the party's initials into every table",
  "Your miniatures have started their own campaign",
  "{name} wonders if they've become an NPC in someone else's story",
  "The tavern keeper's grandchildren ask about 'the old adventurers'",
  "{name} hosts séances to contact their motivation",
  "Your character's arc has flatlined",
  "{name} believes the tavern might be a pocket dimension",
  "The party's inventory has fossilized",
  "{name} teaches pigeons military formations",
  "Your initiative has rolled a natural 1 on existing",
  "{name} petitions for honorary tavern staff status",
  "The dungeon has been gentrified in your absence",
  "{name} measures their life in spilled ale",
  "Your party has become a local legend. The boring kind.",

  // Days 121-180: Descent into madness
  "{name} insists the tavern walls are closing in. They're not.",
  "Your dice have achieved enlightenment without you",
  "{name} runs a census of the tavern's spider population",
  "The party's adventuring license has lapsed",
  "{name} debates philosophy with their reflection",
  "Your character's motivation has filed for divorce",
  "{name} has started an in-tavern courier service",
  "The map has more personality than the party now",
  "{name} organizes competitive dust-watching",
  "Your party's theme has become elevator music",
  "{name} petitions to rename the tavern after themselves",
  "The BBEG sent a fruit basket",
  "{name} wrote a dissertation on tavern chair ergonomics",
  "Your backstory has become ancient history",
  "{name} founded a secret society. It's just them.",
  "The party's battle cry has become a yawn",
  "{name} hosts a talk show for inanimate objects",
  "Your character exists in name only",
  "{name} believes they've discovered time travel. They haven't.",
  "The tavern keeper writes about you in their memoir",
  "{name} started a religion based on the tavern menu",
  "Your dice have unionized against neglect",
  "{name} claims the corner booth by divine right",
  "The party's legend has become a cautionary tale",
  "{name} teaches philosophy to the tavern's cockroaches",
  "Your spell list has cobwebs",
  "{name} believes the ale is speaking to them",
  "The dungeon sent a 'we've moved on' announcement",
  "{name} runs an underground fighting ring for bread crumbs",
  "Your miniatures have developed their own society",
  "{name} composed an opera about waiting",
  "The party's bonds have become co-dependency",
  "{name} petitions the universe for a random encounter",
  "Your character sheet is now a historical document",
  "{name} founded a university in the tavern. Enrollment: 0",
  "The BBEG's henchmen have grandchildren now",
  "{name} wrote the tavern's official biography",
  "Your party exists in a state of suspended irrelevance",
  "{name} believes the tavern is a metaphor. For what, unclear.",
  "The tavern keeper's therapist has heard about you",
  "{name} started a conspiracy theory about the soup",
  "Your dice have moved on emotionally",
  "{name} claims sovereignty over the corner booth",
  "The party's story has become a myth. A boring myth.",
  "{name} runs election campaigns for tavern furniture",
  "Your initiative bonus has become theoretical",
  "{name} believes they've achieved immortality through inaction",
  "The dungeon has become a tourist attraction",
  "{name} wrote a constitution for the tavern",
  "Your party's wanted poster is in a museum",
  "{name} petitions to have the tavern declared a heritage site",
  "The BBEG retired and opened a bakery",
  "{name} teaches interpretive dance to bar stools",
  "Your character's arc has become a circle",
  "{name} claims to remember what sunlight looks like",
  "The party's reputation has become folklore",
  "{name} founded a monastery dedicated to waiting",
  "Your spell slots have rust",
  "{name} believes the tavern exists outside of time",

  // Days 181-270: Fever dream territory
  "{name} insists they've achieved a new state of being",
  "Your dice have written a memoir about abandonment",
  "{name} claims the tavern speaks to them in riddles",
  "The party has transcended the need for adventure",
  "{name} runs a government from the corner booth",
  "Your character exists in collective memory only",
  "{name} founded a time-measuring system based on ale refills",
  "The dungeon sent archaeologists to study where you used to adventure",
  "{name} believes they've solved the meaning of life. It's soup.",
  "Your party's theme song plays in reverse now",
  "{name} claims diplomatic immunity from boredom",
  "The BBEG became a life coach",
  "{name} teaches metaphysics to the tavern cat",
  "Your initiative has achieved negative numbers",
  "{name} believes the tavern is the true endgame",
  "The party's legend has become a children's fable",
  "{name} petitions reality for a plot hook",
  "Your dice have achieved sentience and chosen silence",
  "{name} founded a think tank in the corner booth",
  "The dungeon has been demolished and is now condos",
  "{name} claims to have discovered new emotions",
  "Your character sheet has been carbon-dated",
  "{name} runs a philosophy podcast from the tavern",
  "The party's story is now considered apocryphal",
  "{name} believes they exist in a simulation of waiting",
  "Your spell components have evolved into new species",
  "{name} petitions the gods. The gods have moved.",
  "The BBEG sends holiday cards out of habit",
  "{name} founded an archaeological dig of the party's past",
  "Your miniatures have developed language",
  "{name} claims the tavern menu contains hidden prophecies",
  "The party has become a philosophical thought experiment",
  "{name} teaches advanced nothing to aspiring hermits",
  "Your dice roll themselves now. They choose not to.",
  "{name} believes time is a suggestion",
  "The dungeon's location has been forgotten by cartographers",
  "{name} runs a museum of the party's glory days",
  "Your character's backstory has become prehistory",
  "{name} claims to communicate with future sessions",
  "The party's bonds have become quantum entanglement",
  "{name} founded a religion. Tenet: wait",
  "Your initiative modifier has become imaginary",
  "{name} petitions entropy itself for change",
  "The BBEG's grandchildren ask about 'the old rivalry'",
  "{name} claims the tavern is a nexus of all realities",
  "Your party exists as a cautionary legend",
  "{name} teaches transcendence to furniture",
  "The dungeon has been reclaimed by nature and then paved over",
  "{name} believes they've outlasted the concept of adventure",
  "Your dice have written you out of their will",
  "{name} founded an empire. Territory: one booth",
  "The party's story is told in hushed, confused tones",
  "{name} claims to have seen the tavern's true form",
  "Your character exists in hypothetical tense only",
  "{name} runs a support group for eternal waiters",
  "The BBEG's evil plan has been made obsolete by technology",
  "{name} petitions the narrative for relevance",
  "Your spell list has been translated to a dead language",
  "{name} believes the tavern is the only real place",
  "The party has become a parable about inaction",
  "{name} teaches the void to the void",
  "Your miniatures have outlived their purpose",
  "{name} claims sovereignty over the concept of corners",
  "The dungeon exists only in unreliable histories now",
  "{name} founded a calendar system. Day 1: waiting began.",
  "Your initiative has been redefined as a myth",
  "{name} believes they've achieved perfect stillness",
  "The party's wanted poster is considered folk art",
  "{name} runs diplomatic missions between bar stools",
  "Your character's arc has become a dot",
  "{name} claims the ale has achieved sentience",
  "The BBEG died of natural causes. Their heir doesn't know you.",
  "{name} petitions the author for a new chapter",
  "Your dice have evolved beyond physical form",
  "{name} founded a university of waiting. Accredited.",
  "The party exists as a rumor of a legend of a myth",
  "{name} teaches advanced existence to the wind",
  "Your spell slots have become archaeological artifacts",
  "{name} believes the tavern contains all possible futures",
  "The dungeon has been forgotten by the earth itself",
  "{name} claims to have mapped the infinite",
  "Your party's reputation has become ambient noise",
  "{name} runs a census of all things that don't happen",

  // Days 271-365: Cosmic horror / acceptance
  "{name} has achieved oneness with the tavern",
  "Your dice exist in a superposition of being rolled and not",
  "{name} claims the tavern is the universe's waiting room",
  "The party has transcended the mortal concept of sessions",
  "{name} founded a philosophy of eternal almost-adventure",
  "Your character exists as a waveform of possibility",
  "{name} petitions the cosmos for acknowledgment",
  "The BBEG's evil has been inherited by a museum",
  "{name} teaches nothingness to the everything",
  "Your initiative has merged with the infinite",
  "{name} believes waiting is the true adventure",
  "The dungeon exists only in dreams now",
  "{name} claims to remember a time before the tavern",
  "Your party's legend has become background radiation",
  "{name} founded a monastery of infinite patience",
  "The dice have transcended dice-ness",
  "{name} runs negotiations between existence and non-existence",
  "Your character's backstory has become origin mythology",
  "{name} claims the corner booth is a throne of eternity",
  "The party has become one with the waiting",
  "{name} teaches the void how to wait",
  "Your spell list has become ancient scripture",
  "{name} believes the tavern exists in all times at once",
  "The BBEG's legacy is a footnote in a footnote",
  "{name} petitions the fundamental forces for a side quest",
  "Your miniatures have achieved enlightenment",
  "{name} claims to have transcribed the silence",
  "The dungeon has been erased from reality's memory",
  "{name} founded an order of infinite repose",
  "Your dice have become concepts rather than objects",
  "{name} runs a government of one, ruling nothing",
  "The party exists as an echo of an intention",
  "{name} teaches patience to eternity",
  "Your character has become a platonic ideal of waiting",
  "{name} claims the ale contains universal truth",
  "The BBEG exists only as a 'what if'",
  "{name} petitions the author of reality for resolution",
  "Your initiative exists in all dice rolls simultaneously",
  "{name} believes they've achieved the final level: acceptance",
  "The tavern has become the party's phylactery",
  "{name} founded a tradition of remembering when things happened",
  "Your spell slots have merged with the heat death of the universe",
  "{name} claims to have befriended entropy",
  "The dungeon has been retconned out of existence",
  "{name} runs a memorial for adventures that never were",
  "Your party's bonds have become the ties that bind reality",
  "{name} teaches the cosmos about anticipation",
  "The dice exist as prayers now",
  "{name} claims the corner booth is where time goes to rest",
  "Your character exists in the space between sessions",
  "{name} founded a paradox and lives in it",
  "The BBEG has been forgotten by evil itself",
  "{name} petitions the end of all things for a session zero",
  "Your miniatures have become relics of a lost age",
  "{name} believes the tavern is the afterlife. Maybe it is.",
  "The party has become a fixed point in the non-happening",
  "{name} teaches nothing to no one, forever",
  "Your initiative modifier has become a universal constant",
  "{name} claims to have witnessed the last roll",
  "The dungeon exists only in the spaces between thoughts",
  "{name} founded an ending that never comes",
  "Your dice have become stars that forgot how to shine",
  "{name} runs an empire of almost",
  "The party's legend has become the sound of one hand rolling",
  "{name} teaches eternity how to be patient",
  "Your character exists as a promise never kept",
  "{name} claims the tavern will outlast the gods",
  "The BBEG's evil has dissolved into ambient apathy",
  "{name} petitions existence itself for one more encounter",
  "Your spell list has become a lullaby for the universe",
  "{name} believes they've achieved the true ending: waiting",
  "The party has become the answer to a question no one asked",
  "{name} founded a silence so profound it echoes",
  "Your miniatures have outlived the concept of play",
  "{name} claims the corner booth exists in every tavern",
  "The dungeon has become a metaphor that forgot what it meant",
  "{name} runs a wake for campaigns that never were",
  "Your initiative has become a philosophical constant",
  "{name} teaches the end how to begin. It refuses.",
  "The dice have become prayers to forgotten gods",
  "{name} claims to have achieved perfect memory of nothing",
  "Your party exists as a gentle reminder of what could have been",
  "{name} founded an infinity and filled it with waiting",
  "The BBEG exists only as a feeling of unfinished business",
  "{name} petitions the void. The void is also waiting.",
  "Your character has become a story that tells itself to sleep",
  "{name} believes the tavern is where adventures go to dream",
  "The party has transcended. Transcended what? Unclear.",
  "{name} teaches the universe about the ones who waited",
  "Your spell slots have become the currency of patience",
  "{name} claims the ale is tears of forgotten gods",
  "The dungeon has become a bedtime story for reality",
  "{name} founded a legacy of almost-adventures",
  "Your dice roll eternally in a dimension of what-ifs",

  // Day 365: The ultimate message
  "One year. {name} lights a candle for the campaign that was.",
]

/**
 * Get a session flavor message based on days since last session.
 *
 * @param days - Number of days since last session (null if no sessions)
 * @param partyMemberNames - Array of party member names to randomly insert
 * @returns A flavor text message
 */
export function getSessionFlavorText(
  days: number | null,
  partyMemberNames: string[] = []
): string {
  if (days === null) {
    return 'No sessions logged yet. When did you last play?'
  }

  // Clamp to valid range
  const index = Math.min(Math.max(0, days), messages.length - 1)
  let message = messages[index]

  // Replace {name} placeholder with a random party member name
  if (message.includes('{name}') && partyMemberNames.length > 0) {
    const randomName = partyMemberNames[Math.floor(Math.random() * partyMemberNames.length)]
    message = message.replace('{name}', randomName)
  } else if (message.includes('{name}')) {
    // Fallback if no names provided
    message = message.replace('{name}', 'An adventurer')
  }

  return message
}

/**
 * Get a deterministic message (same message for same day/seed combo).
 * Use this to prevent the message from changing on every render.
 *
 * @param days - Number of days since last session
 * @param partyMemberNames - Array of party member names
 * @param seed - Optional seed for deterministic name selection (e.g., date string)
 */
export function getSessionFlavorTextDeterministic(
  days: number | null,
  partyMemberNames: string[] = [],
  seed?: string
): string {
  if (days === null) {
    return 'No sessions logged yet. When did you last play?'
  }

  const index = Math.min(Math.max(0, days), messages.length - 1)
  let message = messages[index]

  if (message.includes('{name}') && partyMemberNames.length > 0) {
    // Use a simple hash of the seed (or day count) to pick a consistent name
    const hashSource = seed ?? String(days)
    let hash = 0
    for (let i = 0; i < hashSource.length; i++) {
      hash = ((hash << 5) - hash) + hashSource.charCodeAt(i)
      hash = hash & hash // Convert to 32-bit integer
    }
    const nameIndex = Math.abs(hash) % partyMemberNames.length
    message = message.replace('{name}', partyMemberNames[nameIndex])
  } else if (message.includes('{name}')) {
    message = message.replace('{name}', 'An adventurer')
  }

  return message
}
