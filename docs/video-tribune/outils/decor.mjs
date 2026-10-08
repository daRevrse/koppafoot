// Le décor de la vidéo, posé sur les ÉMULATEURS (jamais en production) :
//
//   · Kafui Mensah, joueur de l'Avenir d'Adakpamé : c'est lui qui publie à
//     l'écran ;
//   · une Tribune déjà vivante : des supporters, un manager, et les
//     publications du compte officiel KoppaFoot (résultat, inscriptions,
//     vainqueur), avec les textes exacts que le serveur écrit
//     (lib/tribune-server, announcementFor) ;
//   · aucun partenaire : la vidéo parle de la Tribune, pas des annonces.
//
//   node decor.mjs              la Tribune avant la publication de Kafui
//   node decor.mjs reactions    après : 48 « j'aime » et trois commentaires
//                               sur la publication de Kafui
//
// Les personnes et les équipes sont fictives (celles des autres vidéos).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(path.resolve(import.meta.dirname, "../../../package.json"));
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const app = getApps()[0] ?? initializeApp({ projectId: "demo-koppafoot" });
const auth = getAuth(app);
const db = getFirestore(app);
const ETAT = path.join(import.meta.dirname, "state.json");

async function compte(email, prenom, nom, role) {
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch { u = await auth.createUser({ email, password: "Video2026!", displayName: `${prenom} ${nom}`, emailVerified: true }); }
  await db.collection("users").doc(u.uid).set({
    email, phone: null, first_name: prenom, last_name: nom, user_type: "user",
    location_city: "Lomé", profile_picture_url: null, cover_photo_url: null, is_active: true,
    auth_providers: ["email"], evolution_role: role, gender: "male",
    created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  return u.uid;
}
const il_y_a = (minutes) => Timestamp.fromMillis(Date.now() - minutes * 60000);

// ── Après la publication : les réactions ────────────────────
if (process.argv[2] === "reactions") {
  const { kafui, amis } = JSON.parse(fs.readFileSync(ETAT, "utf8"));
  const snap = await db.collection("posts").where("author_id", "==", kafui).get();
  const post = snap.docs.sort((a, b) => b.data().created_at.toMillis() - a.data().created_at.toMillis())[0];
  if (!post) throw new Error("Kafui n'a encore rien publié : lancer le tournage d'abord.");
  // 48 « j'aime » : les amis du décor, complétés d'identifiants fictifs.
  const likes = [...amis.map((a) => a.uid), ...Array.from({ length: 48 - amis.length }, (_, i) => `supporter-${i}`)];
  const commentaires = [
    [amis[0], "Quel but Kafui !! 🔥🔥", 3],
    [amis[1], "Bravo les gars, on remet ça samedi 💪", 2],
    [amis[2], "J'étais au bord du terrain, l'ambiance 😍", 1],
  ];
  for (const d of (await post.ref.collection("comments").get()).docs) await d.ref.delete();
  for (const [a, texte, min] of commentaires) {
    await post.ref.collection("comments").add({ author_id: a.uid, author_name: a.nom, content: texte, created_at: il_y_a(min) });
  }
  await post.ref.update({ likes, comment_count: commentaires.length });
  console.log(`réactions posées : ${likes.length} j'aime, ${commentaires.length} commentaires sur ${post.id}`);
  process.exit(0);
}

// ── Les comptes ─────────────────────────────────────────────
const kafui = await compte("kafui@exemple.tg", "Kafui", "Mensah", "player");
// Le nom et le rôle tels que la Tribune les écrit (feed/page, handlePost) :
// le prénom et l'initiale ; « Manager » ou « Arbitre », sinon « Joueur ».
const amis = [
  { uid: await compte("afi@exemple.tg", "Afi", "Lawson", null), nom: "Afi L.", role: "Joueur" },
  { uid: await compte("kossi@exemple.tg", "Kossi", "Mensah", "manager"), nom: "Kossi M.", role: "Manager" },
  { uid: await compte("dodzi@exemple.tg", "Dodzi", "Amegah", null), nom: "Dodzi A.", role: "Joueur" },
  { uid: await compte("yawa@exemple.tg", "Yawa", "Kpodar", "player"), nom: "Yawa K.", role: "Joueur" },
];

// ── La Tribune : on repart de zéro ──────────────────────────
for (const d of (await db.collection("posts").get()).docs) await d.ref.delete();
for (const d of (await db.collection("partenariats").get()).docs) await d.ref.delete();

const publication = (champs, minutes) => db.collection("posts").add({
  author_avatar: "", metadata: null, likes: [], comment_count: 0, media_urls: [], pinned: false, link: null,
  created_at: il_y_a(minutes), updated_at: il_y_a(minutes), ...champs,
});
const officiel = (type, content, link, minutes, extra = {}) => publication({
  author_id: "system", author_name: "KoppaFoot", author_role: "official", type, content, link, ...extra,
}, minutes);
const de = (a, content, minutes, extra = {}) => publication({
  author_id: a.uid, author_name: a.nom, author_role: a.role, type: "text", content, ...extra,
}, minutes);

// Du plus récent au plus ancien, sous la future publication de Kafui.
await officiel("match_result", "🏁 Coupe des Quartiers, Avenir d'Adakpamé 2-1 Olympique de Tokoin.", "/c/coupe-des-quartiers", 35,
  { likes: amis.map((a) => a.uid), comment_count: 6 });
await de(amis[0], "Quel match à Bè ce soir ! L'ambiance était folle 🔥", 52, { likes: amis.slice(1).map((a) => a.uid), comment_count: 2 });
await officiel("competition_announcement", "📋 Les inscriptions sont ouvertes pour Tournoi de Noël de Bè. Managers, inscrivez votre équipe !", "/c/tournoi-noel", 95,
  { likes: amis.slice(0, 3).map((a) => a.uid), comment_count: 4 });
await de(amis[1], "Entraînement demain 6 h au terrain de Tokoin. Tout le monde à l'heure !", 140, { likes: amis.slice(2).map((a) => a.uid), comment_count: 1 });
await officiel("competition_announcement", "🏆 Coupe de l'été 2026 est terminée. Vainqueur : Avenir d'Adakpamé !", "/c/coupe-ete", 300,
  { likes: amis.map((a) => a.uid), comment_count: 9 });
await de(amis[3], "Qui vient voir la demi-finale samedi ? On se retrouve devant la buvette.", 420, { likes: [amis[0].uid], comment_count: 3 });

fs.writeFileSync(ETAT, JSON.stringify({ kafui, amis }, null, 2));
console.log("Tribune posée : 6 publications (3 officielles), Kafui prêt à publier");
