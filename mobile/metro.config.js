// Metro ne regarde que le dossier de l'application. Les modules sans SDK du
// site vivent dans ../src : on les lui fait surveiller, et l'alias `@/` de
// tsconfig.json (qu'Expo applique aussi à Metro) les résout.
//
// UN PAQUET IMPORTÉ DEPUIS ../src SE RÉSOUT COMME DEPUIS L'APPLICATION. Sans
// ça, Metro le chercherait d'abord dans koppafoot/node_modules, celui du
// site : une seconde copie en local (yup, pour lib/champs-valides), et sur
// EAS — où seul mobile/ est installé — une résolution différente de celle
// qu'on a testée. Avec cette règle, un module partagé qui importerait un
// paquet absent de l'application échoue ici, tout de suite, et non au build.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const siteSrc = path.resolve(projectRoot, "../src");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), siteSrc];

const dansLeSite = (fichier) => {
  const relatif = path.relative(siteSrc, fichier);
  return relatif !== "" && !relatif.startsWith("..") && !path.isAbsolute(relatif);
};
const paquet = (nom) => !nom.startsWith(".") && !nom.startsWith("@/") && !path.isAbsolute(nom);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (paquet(moduleName) && dansLeSite(context.originModulePath)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "package.json") },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
