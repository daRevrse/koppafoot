import { base, vider } from "../test-aides/faux-firestore";

// L'envoi d'un push (src/lib/fcm-server). FCM répond jeton par jeton : seule une
// réponse qui dit le jeton mort le retire du compte. Retirer sur n'importe
// quelle erreur, c'est vider tous les téléphones à la première panne de FCM,
// et rien ne les réinscrit tant que personne ne touche à l'interrupteur.

const mockEnvoi = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { arrayRemove: (...retires: string[]) => ({ retires }) },
}));
jest.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ sendEachForMulticast: (message: unknown) => mockEnvoi(message) }),
}));
jest.mock("@/lib/firebase-admin", () => ({
  __esModule: true,
  default: {},
  adminDb: require("../test-aides/faux-firestore").adminDb,
}));

// `require`, et non `import` : le module tire firebase-admin, dont la
// vérification de types de l'application mobile n'a pas les types.
const { sendPushToUser } = require("@/lib/fcm-server") as {
  sendPushToUser: (uid: string, n: { title: string; body: string }) => Promise<void>;
};

/** La réponse de FCM : un code d'erreur par jeton, `null` quand il est parti. */
const reponse = (...codes: (string | null)[]) => ({
  responses: codes.map((code) => (code ? { success: false, error: { code } } : { success: true })),
});

beforeEach(() => {
  vider();
  mockEnvoi.mockReset();
  base.set("users/u1", { fcm_tokens: ["j1", "j2"] });
});

describe("sendPushToUser", () => {
  it("retire le jeton que FCM dit mort, et lui seul", async () => {
    mockEnvoi.mockResolvedValue(reponse(null, "messaging/registration-token-not-registered"));
    await sendPushToUser("u1", { title: "But", body: "1-0" });
    expect(base.get("users/u1")?.fcm_tokens).toEqual({ retires: ["j2"] });
  });

  it("retire un jeton mal formé", async () => {
    mockEnvoi.mockResolvedValue(reponse("messaging/invalid-registration-token", null));
    await sendPushToUser("u1", { title: "But", body: "1-0" });
    expect(base.get("users/u1")?.fcm_tokens).toEqual({ retires: ["j1"] });
  });

  it.each([
    ["une panne de FCM", "messaging/internal-error"],
    ["FCM indisponible", "messaging/server-unavailable"],
    ["un quota dépassé", "messaging/quota-exceeded"],
    ["un message refusé", "messaging/invalid-argument"],
    ["une clé de service qui ne va pas", "messaging/mismatched-credential"],
    ["une erreur inconnue", "app/network-error"],
  ])("garde tous les jetons sur %s : l'erreur ne dit rien du téléphone", async (_cas, code) => {
    mockEnvoi.mockResolvedValue(reponse(code, code));
    await sendPushToUser("u1", { title: "But", body: "1-0" });
    expect(base.get("users/u1")?.fcm_tokens).toEqual(["j1", "j2"]);
  });
});
