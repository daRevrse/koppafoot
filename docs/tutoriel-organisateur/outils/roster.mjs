// Effectifs fictifs, déterministes.
const PRENOMS = ["Kossi","Komlan","Yao","Koffi","Ayité","Edem","Délali","Sena","Elom","Kodjo","Akakpo","Folly","Ekoué","Kwami","Mawuli","Dodzi","Selom","Messan","Afi","Enyonam","Yawo","Kokou","Atsu","Kafui","Mawuena","Dela","Etse","Fiifi"];
const NOMS = ["Adjévi","Kao","Amégan","Adoboli","Dossou","Gansou","Johnson","Tepe","Akpaki","Kpodzro","Attiogbé","Agbeko","Doe","Bawa","Hounkpati","Lawson","Mensah","Agbodjan","Kponton","Amouzou","Ahadji","Sodji","Klutse","Gbeassor","Akue","Tsogbe","Ayivi","Dzidzonu"];
const POSTES = ["Gardien","Défenseur","Défenseur","Défenseur","Défenseur","Milieu","Milieu","Milieu","Milieu","Attaquant","Attaquant","Gardien","Défenseur","Milieu","Attaquant"];
export function roster(teamIndex, n = 15) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = PRENOMS[(teamIndex * 7 + i * 3) % PRENOMS.length];
    const f = NOMS[(teamIndex * 5 + i * 11) % NOMS.length];
    out.push([`${p} ${f}`, String(i + 1), POSTES[i]]);
  }
  return out;
}
export const TEAMS = [
  ["AS Bè","ASB","#dc2626","as-be"],["FC Tokoin","FCT","#2563eb","fc-tokoin"],["Étoile d'Adidogomé","EDA","#f59e0b","etoile-adidogome"],
  ["Racing Agoè","RAG","#16a34a","racing-agoe"],["Espoir Nyékonakpoè","ENY","#7c3aed","espoir-nyekonakpoe"],["Jeunesse Hédzranawoé","JHE","#0891b2","jeunesse-hedzranawoe"],
  ["Union Kodjoviakopé","UKO","#111827","union-kodjoviakope"],["Olympique Baguida","OBA","#ea580c","olympique-baguida"],
];
