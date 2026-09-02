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
      displayName: "Fenoa Creator",
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
const branchId = "nightfall-fragments";

const branch = {
  creatorId,
  rootWorldId: "nightfall",
  baseWorldRevisionId: "nightfall-v1",
  title: "The Fragments We Keep",
  creativeIntent:
    "Delay Teddy's reveal while making the missing time feel more dangerous.",
  inheritedSummary:
    "Nightfall loses every memory and electronic recording between 2:00 and 2:17 AM. Teddy remembers fragments; Emma does not know.",
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
  constraints: [
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
  ],
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

const batch = db.batch();
const branchRef = db.collection("branchDrafts").doc(branchId);
batch.delete(db.collection("creativeSessions").doc(branchId));
batch.set(branchRef, branch, { merge: false });
for (const [position, title, hook] of episodeSeeds) {
  const id = `episode-${position}`;
  batch.set(branchRef.collection("episodes").doc(id), {
    branchId,
    position,
    title,
    hook,
    keyBeats: [hook],
    narrative: "",
    effects: {
      participantIds: [],
      revealedFactIds: [],
      resolvedFactIds: [],
      relationshipChanges: [],
      ruleChanges: [],
    },
    version: 1,
    updatedAt: timestamp,
  });
}
await batch.commit();
console.log(`Seeded ${branchId} with ${episodeSeeds.length} real episodes.`);
