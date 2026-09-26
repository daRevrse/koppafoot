// Construit le PDF du tutoriel à partir de ../source/tutoriel.html.
//   node build-pdf.mjs [sortie.pdf]
import { chromium } from "playwright";
import path from "node:path";

const TUTO = process.env.TUTO ?? path.resolve(import.meta.dirname, "../source");
const out = process.argv[2] ?? path.resolve(import.meta.dirname, "../Tutoriel-manager-KoppaFoot.pdf");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.goto("file://" + path.join(TUTO, "tutoriel.html"), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
// Toutes les images doivent être chargées avant l'impression.
const manquantes = await page.evaluate(() =>
  [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src")),
);
if (manquantes.length) console.log("Images manquantes :", manquantes.join(", "));
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log("PDF :", out);
