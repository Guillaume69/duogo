const { withAndroidStyles } = require("@expo/config-plugins");

// L'app est verrouillée en mode clair (app.json `userInterfaceStyle: "light"`). Mais le
// thème natif généré par Expo hérite de `Theme.*.DayNight.*` : ses composants natifs (dont
// la NativeTabs BottomNavigation) résolvent leurs couleurs selon le mode clair/sombre DU
// TÉLÉPHONE. Le verrou `userInterfaceStyle` est appliqué au runtime (MODE_NIGHT_NO) APRÈS
// la création de l'activity, et `MainActivity` a `android:configChanges="…uiMode…"` (pas de
// recréation au changement de thème système) -> la barre d'onglets pouvait rester figée en
// sombre. On supprime la résolution sombre à la racine : on remplace le parent `DayNight`
// du thème AppTheme par sa variante `Light`. Plus aucun rendu sombre possible, à froid
// comme à chaud, quel que soit le réglage du téléphone.
const withLightThemeLock = (config) =>
  withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style ?? [];
    const appTheme = styles.find((style) => style.$?.name === "AppTheme");
    const parent = appTheme?.$?.parent;
    if (parent && parent.includes("DayNight")) {
      appTheme.$.parent = parent.replace("DayNight", "Light");
    }
    return cfg;
  });

module.exports = withLightThemeLock;
