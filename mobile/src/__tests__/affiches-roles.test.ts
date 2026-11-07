import * as fs from "fs";
import * as path from "path";
import { AFFICHES } from "~/components/evolution/affiches";
import { ROLES } from "~/lib/roles";

// Les affiches des rôles, celles du site, embarquées dans l'appli : elles
// doivent s'ouvrir dans Expo Go sans réseau, et sans alourdir l'appli.

const ASSETS = path.join(__dirname, "..", "..", "assets", "roles");

describe("les affiches des rôles", () => {
  it.each(["joueur", "manager", "arbitre"])("%s.jpg existe et pèse 150 000 octets au plus", (nom) => {
    const fichier = path.join(ASSETS, `${nom}.jpg`);
    expect(fs.existsSync(fichier)).toBe(true);
    expect(fs.statSync(fichier).size).toBeLessThanOrEqual(150_000);
  });

  it("donne une affiche à chaque rôle de la pile", () => {
    for (const r of ROLES) expect(AFFICHES[r.role]).toBeDefined();
  });
});
