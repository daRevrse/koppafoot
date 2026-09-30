// Scène 5 : après le match. Edem retrouve la victoire sur la fiche de son équipe.
import { open, go, settle, shot, loadState, PHONE } from "./lib.mjs";
const { teamUrl } = loadState();
const { ctx, page } = await open("edem-tel", PHONE);
await go(page, "/notifications");
await settle(page, 2500);
await shot(page, "21-notifications-match");
await go(page, teamUrl);
await settle(page, 3500);
await shot(page, "22-equipe-victoire");
await ctx.close();
