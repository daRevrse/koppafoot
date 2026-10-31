import { SITE_URL } from "~/lib/config";
import { destinationDuLien } from "~/lib/lien-notification";

// Les liens du site qu'Android confie à l'application : trois fichiers qui
// doivent dire la même chose, app.json et le assetlinks.json du site. Android
// les compare à l'installation, sans rien signaler quand ils divergent : le lien
// s'ouvre alors dans le navigateur, et personne ne comprend pourquoi.

const appJson = require("../../app.json") as {
  expo: {
    android: {
      package: string;
      intentFilters: {
        autoVerify?: boolean;
        data: { scheme: string; host: string; path?: string; pathPrefix?: string }[];
      }[];
    };
  };
};
const assetlinks = require("../../../public/.well-known/assetlinks.json") as {
  relation: string[];
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
}[];

const filtres = appJson.expo.android.intentFilters;
const adresses = filtres.flatMap((f) => f.data);

describe("les liens du site dans l'application", () => {
  it("le site désigne cette application", () => {
    expect(assetlinks[0].relation).toContain("delegate_permission/common.handle_all_urls");
    expect(assetlinks[0].target.package_name).toBe(appJson.expo.android.package);
  });

  it("les empreintes ont la forme qu'Android compare", () => {
    expect(assetlinks[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    for (const empreinte of assetlinks[0].target.sha256_cert_fingerprints) {
      expect(empreinte).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });

  it("Android vérifie les liens", () => {
    expect(filtres.length).toBeGreaterThan(0);
    for (const f of filtres) expect(f.autoVerify).toBe(true);
  });

  // Avant Android 12, un seul hôte non vérifié annule tous les autres. Le domaine
  // sans www redirige vers www, et Android ne suit pas les redirections pour
  // lire assetlinks.json : le déclarer casserait donc aussi www.
  it("ne déclare que l'hôte qui répond sans redirection, celui du site", () => {
    expect(new Set(adresses.map((a) => a.host))).toEqual(new Set([new URL(SITE_URL).host]));
    expect(new Set(adresses.map((a) => a.scheme))).toEqual(new Set(["https"]));
  });

  it("chaque adresse confiée à l'application a un écran natif", () => {
    expect(adresses.length).toBeGreaterThan(0);
    for (const a of adresses) {
      const lien = a.path ?? `${a.pathPrefix}x`;
      expect(destinationDuLien(lien).genre).not.toBe("site");
    }
  });
});
