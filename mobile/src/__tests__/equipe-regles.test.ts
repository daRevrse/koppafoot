/**
 * @jest-environment node
 */
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { EMULATEUR, connecterEnAdmin, connecterEnTantQue, fermer, viderLaBase } from "../test-aides/emulateur";

// Les règles Firestore d'une équipe, jouées contre l'émulateur avec le vrai
// firestore.rules (voir mobile/outils/emulateurs/LISEZMOI.md). Sans émulateur,
// la suite est ignorée. Des cas dont l'issue est connue d'avance : ils disent
// aussi que le banc lit bien les règles.

const suite = EMULATEUR ? describe : describe.skip;

suite("les règles d'une équipe", () => {
  beforeEach(async () => {
    await viderLaBase();
    await setDoc(doc(connecterEnAdmin(), "teams/t1"), {
      name: "FC Koppa", manager_id: "m", staff_manager_ids: ["d"], staff: [], member_ids: ["a"],
    });
  });

  afterAll(fermer);

  it("laisse le manager changer les dossards", async () => {
    await expect(updateDoc(doc(connecterEnTantQue("m"), "teams/t1"), { squad_numbers: { a: "9" } })).resolves.toBeUndefined();
  });

  it("refuse un compte qui ne gère pas l'équipe", async () => {
    await expect(updateDoc(doc(connecterEnTantQue("x"), "teams/t1"), { squad_numbers: { a: "9" } })).rejects.toThrow(/permission/i);
  });

  it("laisse un délégué changer les dossards", async () => {
    await expect(updateDoc(doc(connecterEnTantQue("d"), "teams/t1"), { squad_numbers: { a: "9" } })).resolves.toBeUndefined();
  });

  it("refuse à un délégué de toucher au staff", async () => {
    await expect(updateDoc(doc(connecterEnTantQue("d"), "teams/t1"), { staff: [], staff_manager_ids: [] })).rejects.toThrow(/permission/i);
  });
});
