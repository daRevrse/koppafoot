// Aperçu d'une page au nom d'un compte, en format téléphone (mise au point du tournage).
//   node apercu-page.mjs <profil> <email|-> <mdp|-> <url> <sortie.png> [pleine]
import { open, go, settle, loginUI, PHONE } from "./lib.mjs";
const [profil, email, mdp, url, sortie, pleine] = process.argv.slice(2);
const { ctx, page } = await open(profil, PHONE);
if (email && email !== "-") await loginUI(page, email, mdp);
await go(page, url);
await settle(page, 3500);
await page.screenshot({ path: sortie, fullPage: pleine === "pleine", type: "png" });
console.log(page.url());
await ctx.close();
