const { withAndroidManifest } = require("@expo/config-plugins");

// Sous l'edge-to-edge forcé du SDK 56, `adjustResize` ne redimensionne plus correctement le
// contenu RN (resize partiel) et entre en conflit avec toute gestion clavier en JS. On met
// l'activity en `adjustNothing` : le système ne resize ni ne pan, le JS a le contrôle total.
// - Chat : on réduit nous-mêmes le conteneur (paddingBottom = hauteur clavier) -> la FlashList
//   rétrécit (scrollable) et le composer remonte (cf. src/app/(app)/chat/[id].tsx).
// - Formulaires : `KeyboardAwareScrollView` de keyboard-controller (qui scrolle le champ focus
//   au-dessus du clavier indépendamment du soft input mode).
// Les events RN `keyboardDidShow/Hide` se déclenchent quand même sous `adjustNothing`.
const withAdjustNothing = (config) =>
  withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find(
      (activity) => activity.$?.["android:name"] === ".MainActivity",
    );
    if (mainActivity) {
      mainActivity.$["android:windowSoftInputMode"] = "adjustNothing";
    }
    return cfg;
  });

module.exports = withAdjustNothing;
