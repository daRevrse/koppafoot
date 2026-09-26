// Chapitre 4 : répondre aux demandes de créneau.
// Deux clubs demandent le même samedi soir, en coulisses (par la vraie route
// de l'API, comme depuis la fiche du terrain) ; Yawo répond à l'écran.
import { open, go, region, settle, loadState, saveState, corps } from "./lib.mjs";
import { api } from "./admin.mjs";
import { EDEM, KOKOU, SAMEDI } from "./roster.mjs";

const { venueId, teamId, oppTeamId } = loadState();
await api(EDEM.email, EDEM.mdp, "POST", "/api/bookings", {
  venueId, date: SAMEDI, time: "18:00", duration: 1.5, telephone: "90 11 22 33", message: "", equipeId: teamId,
});
const bK = await api(KOKOU.email, KOKOU.mdp, "POST", "/api/bookings", {
  venueId, date: SAMEDI, time: "18:30", duration: 1.5, telephone: "91 22 33 44",
  message: "Nous serons 14, avec notre arbitre.", equipeId: oppTeamId,
});
saveState({ bookingKokou: bK.id });
await new Promise((r) => setTimeout(r, 2000));

const { ctx, page } = await open("yawo");

// La cloche : chaque demande sonne.
await go(page, "/notifications");
await settle(page, 1500);
const n1 = page.getByText("Demande de créneau").first().locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
const n2 = page.getByText("Demande de créneau").nth(1).locator("xpath=ancestor::*[self::a or self::li or self::button][1]");
await region(page, "19-notif-demandes", n1, {
  margin: 16, hideHeader: false, bas: n2,
  marks: [{ loc: n1, union: n2, n: 1, badge: "top" }],
});

// Mes terrains : le compteur des demandes en attente.
await go(page, "/mes-terrains");
await settle(page, 1500);
const compteur = page.locator("main a[href='/mes-terrains/reservations']").first();
await region(page, "20-compteur", compteur, { margin: 24, marks: [{ loc: compteur, n: 1, badge: "top" }] });

// Réservations reçues : les deux demandes.
await go(page, "/mes-terrains/reservations");
await settle(page, 1500);
const attente = page.locator("section").filter({ hasText: "En attente de réponse" }).first();
const lEdem = attente.locator("li").filter({ hasText: "Edem Amouzou" }).first();
const lKokou = attente.locator("li").filter({ hasText: "Kokou Tepe" }).first();
await region(page, "21-demandes", attente, {
  margin: 24,
  marks: [
    { loc: lEdem.locator("p").first(), n: 1 },
    { loc: lEdem.locator("a[href^='tel:']"), union: lEdem.locator("a[href^='mailto:']"), n: 2 },
    { loc: lKokou.getByText("Nous serons 14, avec notre arbitre."), n: 3 },
    { loc: lEdem.getByRole("button", { name: "Confirmer" }), n: 4, badge: "top" },
    { loc: lEdem.getByRole("button", { name: "Refuser" }), n: 5, badge: "top" },
  ],
});

// Confirmer Edem : la demande de Kokou chevauche désormais un créneau pris.
await lEdem.getByRole("button", { name: "Confirmer" }).click();
await settle(page, 2000);
const kokou = page.locator("section").filter({ hasText: "En attente de réponse" }).locator("li").filter({ hasText: "Kokou Tepe" }).first();
await region(page, "22-chevauchement", kokou, {
  margin: 24,
  marks: [
    { loc: kokou.getByText(/^Chevauche un créneau déjà pris/).locator("xpath=.."), n: 1 },
    { loc: kokou.getByRole("button", { name: "Refuser" }), n: 2, badge: "top" },
  ],
});

// Refuser en proposant 20 h.
await kokou.getByRole("button", { name: "Refuser" }).click();
await settle(page, 600);
await kokou.getByText("Proposer un autre créneau à l'équipe").click();
await settle(page, 400);
await kokou.locator('input[type="time"]').last().fill("20:00");
await settle(page, 400);
await region(page, "23-refus-proposition", kokou, {
  margin: 24,
  marks: [
    { loc: kokou.getByText("Proposer un autre créneau à l'équipe"), n: 1 },
    { loc: kokou.locator('input[type="date"]').last(), union: kokou.locator('input[type="time"]').last(), n: 2 },
    { loc: kokou.getByRole("button", { name: "Refuser et proposer" }), n: 3, badge: "top" },
  ],
});
await kokou.getByRole("button", { name: "Refuser et proposer" }).click();
await settle(page, 2000);

// Kokou prend le créneau proposé, depuis ses réservations.
await api(KOKOU.email, KOKOU.mdp, "PATCH", `/api/bookings/${bK.id}`, { action: "prendre-proposition" });
await go(page, "/mes-terrains/reservations");
await settle(page, 2000);
const aVenir = page.locator("section").filter({ hasText: "À venir" }).first();
const refusees = page.locator("section").filter({ hasText: "Refusées ou annulées" }).first();
await region(page, "24-a-venir", corps(page), {
  depuis: aVenir, bas: refusees,
  marks: [
    { loc: aVenir.locator("li").filter({ hasText: "20:00" }).locator("p").first(), n: 1 },
    { loc: aVenir.locator("li").filter({ hasText: "Edem Amouzou" }).getByRole("button", { name: "Annuler" }), n: 2, badge: "top" },
    { loc: refusees.getByText("Refusé", { exact: true }), n: 3, pad: 3 },
  ],
});
await ctx.close();
