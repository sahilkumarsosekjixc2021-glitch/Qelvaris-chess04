import { tx } from "./i18n/pages/misc"; // QV-I18N
import PageLoader from "./PageLoader";

/* Play ka loading screen: ab sab pages jaisa (glass king, orbits, taare).
   Play.jsx mein koi change nahi chahiye, wo pehle ki tarah <PlayLoading /> hi use karta hai. */
export default function PlayLoading() {
  return (
    <PageLoader
      page="play"
      title={tx("Preparing your battlefield...")}
      messages={[
        "Setting up the board",
        "Waking up the engine",
        "Choosing your missions",
      ]}
    />
  );
}