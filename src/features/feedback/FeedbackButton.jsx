// QV-FEEDBACK: neeche kone mein chhota "Feedback" button. Google Form naye tab mein khulta hai.
import { tx } from "../../i18n/pages/misc"; // QV-I18N
import { FEEDBACK_URL } from "./feedback";
import { track } from "../telemetry/track"; // QV-TRACK
import "./feedback.css";

export default function FeedbackButton() {
  return (
    <a
      className="qfb"
      href={FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={tx("Tell us what to improve (2 minutes)")}
      onClick={() => track("feedback_click")}
    >
      <span aria-hidden="true">✎</span> {" "}{tx("Feedback")}</a>
  );
}
