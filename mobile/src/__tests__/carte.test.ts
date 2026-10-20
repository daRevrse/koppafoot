import { estLienCourt, hoteGoogle, lienItineraire, lirePosition, positionLue } from "@/lib/carte";

// Le module vit côté site (src/lib/carte) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const lu = (texte: string) => {
  const p = lirePosition(texte);
  return p ? [p.lat, p.lng] : null;
};

describe("lirePosition", () => {
  it("lit des coordonnées collées telles quelles", () => {
    expect(lu("6.1319, 1.2253")).toEqual([6.1319, 1.2253]);
    expect(lu("6.1319 1.2253")).toEqual([6.1319, 1.2253]);
    expect(lu(`6°07'54.8"N 1°13'31.1"E`)).toEqual([6.131889, 1.225306]);
  });

  it("prend l'épingle d'un lien de lieu, pas le centre de l'écran", () => {
    expect(lu("https://www.google.com/maps/place/Stade/@6.13,1.22,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0x2!8m2!3d6.1319!4d1.2253!16s"))
      .toEqual([6.1319, 1.2253]);
  });

  it("lit les autres formes de liens Maps", () => {
    expect(lu("https://www.google.com/maps/@6.1401,1.2111,15z")).toEqual([6.1401, 1.2111]);
    expect(lu("https://maps.google.com/?q=6.1319,1.2253")).toEqual([6.1319, 1.2253]);
    expect(lu("https://www.google.com/maps/search/?api=1&query=6.1319%2C1.2253")).toEqual([6.1319, 1.2253]);
    expect(lu("https://www.google.com/maps/search/6.1319,+1.2253?entry=tts")).toEqual([6.1319, 1.2253]);
    expect(lu("https://www.google.com/maps/place/6%C2%B007'54.8%22N+1%C2%B013'31.1%22E/@6.1,1.2,17z"))
      .toEqual([6.131889, 1.225306]);
    expect(lu("geo:6.1319,1.2253?z=17")).toEqual([6.1319, 1.2253]);
  });

  it("ne devine rien d'un nom, d'un lien court ou d'un champ vide", () => {
    // Une recherche par nom : sa page n'annonce que le centre par défaut de Maps.
    expect(lu("https://www.google.com/maps?q=Stade+de+K%C3%A9gu%C3%A9")).toBeNull();
    expect(lu("https://maps.app.goo.gl/AbCdEf")).toBeNull();
    expect(lu("Stade de Kégué")).toBeNull();
    expect(lu("0,0")).toBeNull();
    expect(lu("2026 12")).toBeNull();
  });
});

describe("positionLue", () => {
  it("relit un document, et écarte ce qui n'est pas un point", () => {
    expect(positionLue({ lat: 6.1319, lng: 1.2253 })).toEqual({ lat: 6.1319, lng: 1.2253 });
    expect(positionLue(null)).toBeNull();
    expect(positionLue({ lat: 120, lng: 1 })).toBeNull();
    expect(positionLue({ lat: "x", lng: 1 })).toBeNull();
  });
});

describe("les liens à suivre", () => {
  it("reconnaît le lien court du bouton « Partager »", () => {
    expect(estLienCourt("https://maps.app.goo.gl/AbC")).toBe(true);
    expect(estLienCourt("https://goo.gl/maps/AbC")).toBe(true);
    expect(estLienCourt("https://goo.gl/xyz")).toBe(false);
    expect(estLienCourt("https://exemple.com/maps")).toBe(false);
  });

  it("ne suit que des hôtes de Google", () => {
    for (const h of ["www.google.com", "maps.google.tg", "www.google.co.uk", "www.google.com.br", "consent.google.com"]) {
      expect(hoteGoogle(h)).toBe(true);
    }
    for (const h of ["google.com.evil.io", "evilgoogle.com", "google.evil.com", "localhost", "169.254.169.254"]) {
      expect(hoteGoogle(h)).toBe(false);
    }
  });
});

describe("lienItineraire", () => {
  it("mène au point, ou à l'adresse écrite faute de point", () => {
    expect(lienItineraire({ lat: 6.1319, lng: 1.2253 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=6.1319%2C1.2253",
    );
    expect(lienItineraire("Agoè, Lomé")).toContain("destination=Ago%C3%A8%2C%20Lom%C3%A9");
  });
});
