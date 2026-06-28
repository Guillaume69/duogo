// Metro config. Par défaut, Metro traite `.xml` comme du code source ; on le bascule
// en ASSET pour pouvoir `require()` les drawables vectoriels de `@expo/material-symbols`
// (icônes Material), consommés par l'`Icon` natif d'`@expo/ui` côté Android.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("xml");

module.exports = config;
