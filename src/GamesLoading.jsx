import { tx } from "./i18n/pages/misc"; // QV-I18N
import PageLoader from "./PageLoader";

/* Games ka loading screen: ab sab pages jaisa (glass king, orbits, taare).
   Games.jsx mein koi change nahi chahiye, wo pehle ki tarah <GamesLoading /> hi use karta hai. */
export default function GamesLoading() {
  return (
    <PageLoader
      page="games"
      title={tx("Opening your game archive...")}
      messages={[
        "Loading your games",
        "Sorting your results",
        "Checking your reviews",
      ]}
    />
  );
}