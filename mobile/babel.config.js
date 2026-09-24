// Explicite pour que Jest transforme aussi les fichiers de ../src, hors du
// dossier de l'application (Metro, lui, se passerait de ce fichier).
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
