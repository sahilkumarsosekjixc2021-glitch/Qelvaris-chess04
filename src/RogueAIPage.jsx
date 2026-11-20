import { useNavigate } from "react-router-dom";
import RogueAIMode from "./rogue";

export default function RogueAIPage() {
  const navigate = useNavigate();

  const saveGame = (r) => {
    // optional: yahan apna save logic lagao (neeche dekho)
    console.log("Rogue match ended:", r);
  };

  return <RogueAIMode onHome={() => navigate("/")} onGameEnd={saveGame} />;
}