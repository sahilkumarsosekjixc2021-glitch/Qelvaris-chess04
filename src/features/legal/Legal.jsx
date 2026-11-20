// QV-LEGAL: Privacy Policy aur Terms. /?page=privacy ya /?page=terms par khulte hain (login ke bina bhi).
// Ye ek simple template hai jo is app ke asli kaam par likha hai. Launch se pehle ek baar khud padh lo.
import { CONTACT_EMAIL, FEEDBACK_URL } from "../feedback/feedback";
import "./legal.css";

const UPDATED = "November 2026";

function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="qlg-date">Last updated: {UPDATED}</p>
      <p>
        Qelvaris helps you find the repeat mistakes in your own chess games. This page explains what we
        collect and what we do with it, in plain words.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your email, a username, a display name and a password. These are
          handled by our sign-in provider, Supabase. We never see your password in plain text.
        </li>
        <li>
          <strong>Your chess games:</strong> when you connect Lichess or Chess.com, we read your public games
          using only your username. We never ask for your Lichess or Chess.com password.
        </li>
        <li>
          <strong>Basic usage and speed data:</strong> we use Vercel Analytics and Speed Insights to see page
          views and loading speed. They do not use cookies to track you across other sites.
        </li>
        <li>
          <strong>App events and errors:</strong> we record simple events (for example &quot;connected games&quot;,
          &quot;finished a daily step&quot;) and error messages, linked to your account id, so we can fix bugs and see
          where people get stuck. These events never contain your games, moves or password. If your browser sends
          a Do Not Track signal, we do not record them.
        </li>
        <li>
          <strong>Feedback:</strong> if you fill in our feedback form (a Google Form), we receive your answers,
          and your email only if you choose to write it.
        </li>
        <li>
          <strong>Payments (only if you subscribe):</strong> payments are handled by PayPal. We never see your card
          or PayPal password. We store only your subscription id, its status and the date it runs until.
        </li>
      </ul>

      <h2>Where your games and progress live</h2>
      <p>
        Your games, reviews, streak and QC (Qelvaris Credits) are stored in your own browser on your device
        (IndexedDB). Game analysis runs on your device with the Stockfish engine. This data is not uploaded
        to our servers unless you choose to. Clearing your browser data or switching to another device will not
        carry it with you, so please use <em>Settings, Export backup</em> to keep a file copy.
      </p>
      <p>
        <strong>Cloud backup (optional):</strong> if you press <em>Back up now</em> (or turn on automatic backup)
        in Settings, one copy of your games, reviews, training, progress and favourites is stored in your account
        on Supabase, so you can restore it on another device. Only you can read that copy. It is deleted when you
        delete your account.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To let you sign in and use the app.</li>
        <li>To keep the site fast and fix problems.</li>
        <li>To improve Qelvaris using the feedback you choose to send.</li>
      </ul>
      <p>We do not sell your personal data and we do not show ads.</p>

      <h2>Who else handles data</h2>
      <p>
        Supabase (sign-in and optional cloud backup), Vercel (hosting, analytics), PayPal (payments, only if you subscribe), Google (feedback form), and Lichess and Chess.com
        (their public game data, which you ask us to read). Each has its own privacy policy.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Delete your game data:</strong> Settings, Delete my data removes everything stored in this
          browser for your account.
        </li>
        <li>
          <strong>Export your data:</strong> Settings, Export backup downloads your games, reviews and progress
          as a file you can keep or import again.
        </li>
        <li>
          <strong>Delete your account:</strong> Settings, Delete my account removes your login and your data on
          this device. If that does not work for any reason, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email you signed up with and we will
          delete it.
        </li>
        <li>
          <strong>Ask a question, or ask us to correct or look up your data:</strong> email the same address.
        </li>
      </ul>

      <h2>Where your data is processed</h2>
      <p>
        We use Supabase (sign-in), Vercel (hosting and basic analytics) and Google Forms (feedback). These
        providers may process data in countries other than yours. If you live in the EU, the UK or another region
        with data protection laws, you have rights to access, correct, export and delete your personal data, and
        to object to how it is used. You can use the options above or email us, and we will answer within a
        reasonable time.
      </p>

      <h2>Children</h2>
      <p>
        Qelvaris is meant for people aged 13 and over. If the minimum age to use online services in your country
        is higher (for example 16 in some EU countries), you need to meet that age or have a parent or guardian
        agree on your behalf. We do not knowingly collect personal data from younger children. If you think a
        child has given us their data, email us and we will delete it.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we will update the date at the top of this page.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">Feedback form</a>
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="qlg-date">Last updated: {UPDATED}</p>
      <p>By using Qelvaris you agree to these terms. If you do not agree, please do not use the site.</p>

      <h2>What Qelvaris is</h2>
      <p>
        Qelvaris is a free chess training tool that analyses your own games and suggests what to practise. It is
        in early access, so things may change, break or be removed.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give a real email and keep your password private. You are responsible for activity on your account.</li>
        <li>Do not try to break, overload or attack the site, or access other people&apos;s data.</li>
        <li>You must be 13 or older.</li>
      </ul>

      <h2>Your games and content</h2>
      <p>
        You keep ownership of your games. You give us permission only to read and analyse the games you connect so
        the app can work for you. Only connect games you are allowed to use.
      </p>

      <h2>Analysis is a guide, not a guarantee</h2>
      <p>
        Engine analysis and leak reports are suggestions to help you practise. They can be wrong or incomplete, and
        we do not promise any change in your rating.
      </p>

      <h2>Qelvaris Credits (QC)</h2>
      <p>
        QC are a points system inside the app for rewards and cosmetic items. They have no cash value, cannot be
        withdrawn or sold, and may be changed, reset or removed as the app develops.
      </p>

      <h2>Not affiliated</h2>
      <p>
        Qelvaris is an independent project. It is not affiliated with or endorsed by Lichess or Chess.com. Their
        names belong to them.
      </p>

      <h2>No warranty and limits</h2>
      <p>
        The service is provided &quot;as is&quot; without promises that it will always be available or error free. To
        the extent allowed by law, we are not liable for losses from using or being unable to use Qelvaris,
        including loss of data stored in your browser. Please keep a backup.
      </p>

      <h2>Stopping and changes</h2>
      <p>
        You can stop using Qelvaris at any time. We may suspend accounts that break these terms. We may update these
        terms, and the date above will change when we do. Continued use means you accept the update.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  );
}

export default function Legal({ page = "privacy", onBack }) {
  const isTerms = page === "terms";
  return (
    <main className="qlg">
      <div className="qlg-wrap">
        <button type="button" className="qlg-back" onClick={onBack}>
          ← Back to Qelvaris
        </button>
        <nav className="qlg-tabs" aria-label="Legal pages">
          <a href="/?page=privacy" className={!isTerms ? "is-on" : ""}>Privacy</a>
          <a href="/?page=terms" className={isTerms ? "is-on" : ""}>Terms</a>
        </nav>
        {isTerms ? <Terms /> : <Privacy />}
      </div>
    </main>
  );
}
