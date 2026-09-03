import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const creatorId = process.env.FENOA_SEED_CREATOR_UID;
if (!projectId || !creatorId) {
  throw new Error(
    "FIREBASE_PROJECT_ID and FENOA_SEED_CREATOR_UID are required.",
  );
}

const app = initializeApp({
  ...(process.env.FIRESTORE_EMULATOR_HOST
    ? {}
    : { credential: applicationDefault() }),
  projectId,
});
const db = getFirestore(app);
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  const auth = getAuth(app);
  try {
    await auth.createUser({
      uid: creatorId,
      email: "creator@fenoa.local",
      password: "fenoa-local-password",
      displayName: "Mara Voss",
      emailVerified: true,
    });
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "auth/uid-already-exists"
    ) {
      throw error;
    }
  }
}

const timestamp = new Date().toISOString();
const worldId = "nightfall";
const worldRevisionId = "nightfall-v1";
const branchId = "nightfall-fragments";
const branchRevisionId = "nightfall-fragments-v1";
const nightfallCover = {
  storagePath: null,
  url: "/images/nightfall-cover.webp",
  alt: "A rain-swept Nightfall street folding toward a clock stopped at 2:17",
  generatedAt: "2026-09-03T07:01:52.000Z",
};

const characters = [
  {
    id: "john",
    name: "John Vale",
    role: "A former detective who still patrols the hours nobody remembers",
    appearance:
      "A battered coat, scarred hands, and the posture of a man expecting impact.",
    personality: "Violent, perceptive, and fiercely protective.",
    desire: "Keep Emma alive long enough to expose the disappearances.",
    fear: "That his own violence is part of what the city erases.",
    background:
      "Left the Nightfall police after an evidence room vanished during the missing period.",
    currentSituation:
      "Tracking the stopped clocks found beside every disappearance.",
    secret:
      "He wakes from 2:17 with blood on his hands more often than he admits.",
  },
  {
    id: "emma",
    name: "Emma Cross",
    role: "An investigative journalist tracing Nightfall's disappearances",
    appearance:
      "Rain-dark hair, ink-stained fingers, and a recorder that always dies at 2:00.",
    personality: "Relentless, skeptical, and dangerously curious.",
    desire: "Publish proof that the missing seventeen minutes are engineered.",
    fear: "Becoming another gap nobody remembers.",
    background:
      "Returned to Nightfall after her younger brother disappeared without a final memory.",
    currentSituation: "Following John despite believing he is hiding evidence.",
    secret: "Her brother left her a photograph stamped 2:11 AM.",
  },
  {
    id: "teddy",
    name: "Teddy Mercer",
    role: "John's oldest friend and keeper of impossible fragments",
    appearance:
      "Immaculate suits, a silver lighter, and eyes that never look at the clocks.",
    personality:
      "Intimidating, controlled, and loyal in ways that feel like ownership.",
    desire: "Keep the people he loves outside whatever waits at 2:17.",
    fear: "Remembering the missing period clearly enough to be noticed.",
    background:
      "Built influence across Nightfall while John was still a detective.",
    currentSituation:
      "Feeding John partial truths and watching Emma get too close.",
    secret: "He remembers fragments of every missing period.",
  },
  {
    id: "vera",
    name: "Vera Kane",
    role: "A young city official trying to contain public panic",
    appearance:
      "Severe tailoring, sleepless eyes, and an emergency badge with no issuing office.",
    personality:
      "Disciplined, empathetic, and willing to conceal one truth to prevent a larger collapse.",
    desire:
      "Stop Nightfall from tearing itself apart before she understands the phenomenon.",
    fear: "That the city limits are not boundaries but a trap.",
    background:
      "Inherited the emergency office after three predecessors disappeared.",
    currentSituation:
      "Testing every road out of Nightfall during the missing period.",
    secret: "Each road returns to the same intersection at 2:17.",
  },
];

const relationships = [
  {
    id: "john-protects-emma",
    fromCharacterId: "john",
    toCharacterId: "emma",
    kind: "protection",
    description:
      "John protects Emma but does not trust what her investigation will expose.",
  },
  {
    id: "teddy-deceives-emma",
    fromCharacterId: "teddy",
    toCharacterId: "emma",
    kind: "deception",
    description:
      "Teddy feeds Emma useful fragments so she never sees the whole pattern.",
  },
  {
    id: "john-loyal-teddy",
    fromCharacterId: "john",
    toCharacterId: "teddy",
    kind: "loyalty",
    description:
      "John's oldest loyalty is also the blind spot Teddy depends on.",
  },
  {
    id: "vera-fears-john",
    fromCharacterId: "vera",
    toCharacterId: "john",
    kind: "fear",
    description:
      "Vera believes John may be both Nightfall's best witness and its most dangerous variable.",
  },
];

const facts = [
  {
    id: "missing-time",
    category: "world_rule",
    statement: "Nobody remembers what occurs between 2:00 and 2:17 AM.",
    state: "unresolved",
  },
  {
    id: "recordings-fail",
    category: "world_rule",
    statement: "Electronic recordings fail throughout the missing period.",
    state: "true",
  },
  {
    id: "city-loop",
    category: "world_rule",
    statement:
      "Nobody has conclusively escaped Nightfall during the missing period.",
    state: "true",
  },
  {
    id: "teddy-remembers",
    category: "secret",
    statement: "Teddy remembers fragments of 2:17.",
    state: "true",
  },
  {
    id: "emma-does-not-know",
    category: "character_knowledge",
    statement: "Emma does not know Teddy remembers.",
    state: "true",
  },
];

const worldArtifact = {
  name: "Nightfall",
  premise:
    "Every night from 2:00 to 2:17 AM, the city loses its memory. The cameras die. The roads turn back. One man remembers enough to be afraid.",
  genre: "Supernatural noir",
  tone: "Rain-soaked dread with a pulse of human loyalty",
  aesthetic:
    "Wet asphalt, stopped clocks, sodium streetlights, and deep midnight blue cut by tarnished gold.",
  locations: [
    "Mercer Street",
    "The abandoned Central clock tower",
    "Nightfall city limits",
    "The evidence archive beneath City Hall",
  ],
  characters,
  relationships,
  facts,
  storySpark:
    "Emma finds a photograph exposed at 2:11 AM, the first evidence that should not exist. John recognizes the room. Teddy recognizes the figure in its reflection. None of them can admit what they know without changing who the others believe them to be.",
  coverImage: nightfallCover,
  remixEnabled: true,
};

const constraints = [
  {
    id: "emma-secret-lock",
    type: "knowledge_lock",
    label: "Emma cannot know Teddy remembers",
    description:
      "Keep Teddy's fractured memory hidden from Emma through Episode 6.",
    characterId: "emma",
    factId: "teddy-remembers",
    throughEpisode: 6,
  },
  {
    id: "lena-after-seven",
    type: "character_availability",
    label: "Lena cannot appear before Episode 7",
    description: "Preserve Lena as the late destabilizing arrival.",
    characterId: "lena",
    availableFromEpisode: 7,
  },
  {
    id: "mystery-unresolved",
    type: "fact_state_lock",
    label: "The 2:17 mystery stays unresolved",
    description:
      "This branch may deepen the central mystery but cannot solve it.",
    factId: "missing-time",
    requiredState: "unresolved",
  },
];

const branch = {
  creatorId,
  rootWorldId: worldId,
  baseWorldRevisionId: worldRevisionId,
  title: "The Fragments We Keep",
  creativeIntent:
    "Delay Teddy's reveal while making the missing time feel more dangerous.",
  inheritedSummary:
    `${worldArtifact.premise} ${facts.map((fact) => fact.statement).join(" ")}`.slice(
      0,
      1_600,
    ),
  inheritedCharacters: characters,
  inheritedRelationships: relationships,
  inheritedFacts: facts,
  inheritedConstraints: [],
  addedCharacters: [
    {
      id: "lena",
      name: "Lena Ward",
      role: "A stranger who claims to remember everything",
      appearance: "A rain-dark coat and an unblinking gaze.",
      personality: "Controlled, watchful, impossible to surprise.",
      desire: "Force Nightfall to acknowledge what happens at 2:17.",
      fear: "That remembering has made her part of the phenomenon.",
      background: "Unknown.",
      currentSituation: "Watching Teddy from across the city.",
      secret: "She recognizes the voice in Teddy's fragments.",
    },
  ],
  ruleOverrides: [],
  constraints,
  recentActivity: [],
  lastAgentAction: null,
  version: 1,
  updatedAt: timestamp,
};

const episodeSeeds = [
  [
    1,
    "The Minute Hand",
    "Emma wakes beside a stopped clock with rain inside her coat.",
  ],
  [
    2,
    "Negative Space",
    "John finds seventeen missing minutes in every camera on Mercer Street.",
  ],
  [
    3,
    "A Familiar Stranger",
    "Teddy recognizes a voice nobody else remembers hearing.",
  ],
  [
    4,
    "The City Limits",
    "Vera proves that every road out of Nightfall bends back at 2:17.",
  ],
  [
    5,
    "The Empty Frame",
    "Emma discovers someone deliberately removed the only surviving frame.",
  ],
  [
    6,
    "What Teddy Kept",
    "Teddy chooses a lie that protects Emma and isolates him.",
  ],
  [
    7,
    "The Woman Who Remembers",
    "Lena Ward arrives with a complete account of the missing time.",
  ],
] as const;

const episodes = episodeSeeds.map(([position, title, hook]) => ({
  id: `episode-${position}`,
  branchId,
  position,
  title,
  hook,
  keyBeats: [hook],
  narrative: "",
  effects: {
    participantIds: position === 7 ? ["lena"] : [],
    revealedFactIds: [],
    resolvedFactIds: [],
    relationshipChanges: [],
    ruleChanges: [],
  },
  version: 1,
  updatedAt: timestamp,
}));

const batch = db.batch();
batch.set(db.collection("users").doc(creatorId), {
  displayName: "Mara Voss",
  avatarUrl: null,
  bio: "Creator of uncanny worlds about memory, loyalty, and what cities choose to hide.",
  createdAt: timestamp,
  updatedAt: timestamp,
});
batch.set(db.collection("worldDrafts").doc(worldId), {
  creatorId,
  ...worldArtifact,
  latestRevisionId: worldRevisionId,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
});
batch.set(db.collection("worlds").doc(worldId), {
  creatorId,
  currentRevisionId: worldRevisionId,
  visibility: "published",
  name: worldArtifact.name,
  premise: worldArtifact.premise,
  genre: worldArtifact.genre,
  tone: worldArtifact.tone,
  coverImage: nightfallCover,
  remixEnabled: true,
  remixCount: 1,
  creatorPickBranchId: branchId,
  publishedAt: timestamp,
  updatedAt: timestamp,
});
batch.set(
  db
    .collection("worlds")
    .doc(worldId)
    .collection("revisions")
    .doc(worldRevisionId),
  {
    worldId,
    creatorId,
    revisionNumber: 1,
    ...worldArtifact,
    createdAt: timestamp,
  },
);
batch.delete(db.collection("creativeSessions").doc(branchId));
batch.delete(db.collection("worldCreativeSessions").doc(worldId));
const branchRef = db.collection("branchDrafts").doc(branchId);
batch.set(branchRef, branch, { merge: false });
for (const episode of episodes) {
  const { id, ...data } = episode;
  batch.set(branchRef.collection("episodes").doc(id), data);
}
batch.set(db.collection("branches").doc(branchId), {
  creatorId,
  rootWorldId: worldId,
  baseWorldRevisionId: worldRevisionId,
  parentBranchId: null,
  parentBranchRevisionId: null,
  currentRevisionId: branchRevisionId,
  visibility: "published",
  title: branch.title,
  creativeIntent: branch.creativeIntent,
  inheritedSummary: branch.inheritedSummary,
  episodeCount: episodes.length,
  likeCount: 0,
  publishedAt: timestamp,
  updatedAt: timestamp,
});
batch.set(
  db
    .collection("branches")
    .doc(branchId)
    .collection("revisions")
    .doc(branchRevisionId),
  {
    branchId,
    creatorId,
    revisionNumber: 1,
    state: { branch: { id: branchId, ...branch }, episodes },
    createdAt: timestamp,
  },
);
await batch.commit();
console.log(
  `Seeded real Nightfall world and ${episodes.length}-episode branch.`,
);
