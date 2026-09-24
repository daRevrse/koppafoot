// https://docs.expo.dev/guides/using-eslint/
//
// Ce fichier doit exister : sans lui, ESLint remonte jusqu'à la configuration
// du site (../eslint.config.mjs), qui ignore mobile/** — rien ne serait lint.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "@/lib/firebase", "@/lib/firebase-admin", "@/lib/firestore",
            "@/lib/competition-firestore", "@/lib/*-admin", "@/lib/fcm-*",
            "@/contexts/*", "@/components/*", "@/hooks/*", "@/app/*",
            "next", "next/*",
          ],
          message:
            "L'application n'importe du site que des modules sans SDK (voir docs/plans/2026-09-24-app-mobile-lot1-design.md).",
        }],
      }],
    },
  },
]);
