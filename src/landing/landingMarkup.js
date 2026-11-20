// Landing page ka HTML (header se footer tak). Text data-i18n se landingLogic.js bharta hai.
const MARKUP = `<header>
  <div class="wrap nav">
    <a class="logo" href="#top"><i>Q</i><span>Qelvaris</span></a>
    <nav class="links">
      <a href="#how" data-i18n="nav_how"></a>
      <a href="#features" data-i18n="nav_features"></a>
      <a href="#faq" data-i18n="nav_faq"></a>
    </nav>
    <div class="spacer"></div>
    <div class="lang" role="group" aria-label="Language">
      <button type="button" data-lang="en" class="on">EN</button>
      <button type="button" data-lang="hi">हिं</button>
    </div>
    <button type="button" class="btn ghost small" data-action="signin" data-i18n="nav_signin"></button>
    <a class="btn small" href="#try" data-i18n="nav_cta"></a>
  </div>
</header>

<main id="top">

  <!-- HERO -->
  <div class="wrap hero" id="try">
    <div>
      <p class="eyebrow" data-i18n="hero_eyebrow"></p>
      <h1 data-i18n="hero_h1"></h1>
      <p class="sub" data-i18n="hero_sub"></p>

      <form class="try" data-mode="lichess" novalidate>
        <div class="pills" role="group" aria-label="Source">
          <button type="button" class="pill on" data-src="lichess" aria-pressed="true">Lichess</button>
          <button type="button" class="pill" data-src="chesscom" aria-pressed="false">Chess.com</button>
          <button type="button" class="pill" data-src="pgn" aria-pressed="false">PGN</button>
        </div>
        <div class="row">
          <input class="uname" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Username" data-i18n-ph="ph_user">
          <button class="btn" type="submit"><span class="t-user" data-i18n="btn_analyse"></span><span class="t-pgn" data-i18n="btn_pgn"></span></button>
        </div>
        <p class="err" role="alert" hidden data-i18n="err_user"></p>
      </form>
      <p class="micro" data-i18n="micro_free"></p>
    </div>

    <!-- sample report (illustrative, not real user data) -->
    <aside class="report" aria-label="Sample report">
      <span class="tag" data-i18n="sample_tag"></span>
      <h3>Chess DNA</h3>
      <svg viewBox="0 0 300 280" role="img" aria-label="Skills radar chart">
        <g fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1">
          <polygon points="150,40 236.6,90 236.6,190 150,240 63.4,190 63.4,90"/>
          <polygon points="150,74 207.2,107 207.2,173 150,206 92.8,173 92.8,107"/>
          <polygon points="150,107 178.6,123.5 178.6,156.5 150,173 121.4,156.5 121.4,123.5"/>
          <line x1="150" y1="140" x2="150" y2="40"/><line x1="150" y1="140" x2="236.6" y2="90"/>
          <line x1="150" y1="140" x2="236.6" y2="190"/><line x1="150" y1="140" x2="150" y2="240"/>
          <line x1="150" y1="140" x2="63.4" y2="190"/><line x1="150" y1="140" x2="63.4" y2="90"/>
        </g>
        <polygon points="150,78 217.5,101 210.6,175 150,223 74.7,183.5 73.8,96" fill="rgba(53,214,192,.22)" stroke="#35d6c0" stroke-width="2.5" stroke-linejoin="round"/>
        <g fill="#35d6c0"><circle cx="150" cy="78" r="3.5"/><circle cx="217.5" cy="101" r="3.5"/><circle cx="210.6" cy="175" r="3.5"/><circle cx="150" cy="223" r="3.5"/><circle cx="74.7" cy="183.5" r="3.5"/><circle cx="73.8" cy="96" r="3.5"/></g>
        <text x="150" y="28" text-anchor="middle" data-i18n="sk_tactics"></text>
        <text x="248" y="92" data-i18n="sk_attack"></text>
        <text x="248" y="198" data-i18n="sk_endgames"></text>
        <text x="150" y="258" text-anchor="middle" data-i18n="sk_time"></text>
        <text x="52" y="198" text-anchor="end" data-i18n="sk_openings"></text>
        <text x="52" y="92" text-anchor="end" data-i18n="sk_defence"></text>
      </svg>
      <div class="leaks">
        <div class="leak"><div class="top"><span data-i18n="leak1"></span><b>−120</b></div><div class="bar"><span style="width:88%"></span></div></div>
        <div class="leak"><div class="top"><span data-i18n="leak2"></span><b>−80</b></div><div class="bar"><span style="width:58%"></span></div></div>
        <div class="leak"><div class="top"><span data-i18n="leak3"></span><b>−55</b></div><div class="bar"><span style="width:40%"></span></div></div>
      </div>
      <p class="note" data-i18n="rep_note"></p>
    </aside>
  </div>

  <!-- TRUST -->
  <div class="wrap trust">
    <div data-i18n="trust1"></div>
    <div data-i18n="trust2"></div>
    <div data-i18n="trust3"></div>
    <div data-i18n="trust4"></div>
  </div>

  <!-- PROBLEM -->
  <section>
    <div class="wrap">
      <h2 data-i18n="prob_h2"></h2>
      <div class="grid2">
        <div class="card bad"><h3 data-i18n="prob_a_t"></h3><p data-i18n="prob_a_d"></p></div>
        <div class="card good"><h3>Qelvaris</h3><p data-i18n="prob_b_d"></p></div>
      </div>
    </div>
  </section>

  <!-- HOW -->
  <section id="how">
    <div class="wrap">
      <p class="kicker" data-i18n="how_k"></p>
      <h2 data-i18n="how_h2"></h2>
      <div class="grid3">
        <div class="card"><div class="num">1</div><h3 data-i18n="s1_t"></h3><p data-i18n="s1_d"></p></div>
        <div class="card"><div class="num">2</div><h3 data-i18n="s2_t"></h3><p data-i18n="s2_d"></p></div>
        <div class="card"><div class="num">3</div><h3 data-i18n="s3_t"></h3><p data-i18n="s3_d"></p></div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section id="features">
    <div class="wrap">
      <p class="kicker" data-i18n="feat_k"></p>
      <h2 data-i18n="feat_h2"></h2>
      <div class="grid4">
        <div class="card"><p class="kicker">Chess DNA</p><h3 data-i18n="f1_t"></h3><p data-i18n="f1_d"></p></div>
        <div class="card"><p class="kicker">Leak Lab</p><h3 data-i18n="f2_t"></h3><p data-i18n="f2_d"></p></div>
        <div class="card"><p class="kicker">Review</p><h3 data-i18n="f3_t"></h3><p data-i18n="f3_d"></p></div>
        <div class="card"><p class="kicker">Openings</p><h3 data-i18n="f4_t"></h3><p data-i18n="f4_d"></p></div>
      </div>
    </div>
  </section>

  <!-- DEMO -->
  <section>
    <div class="wrap">
      <h2 data-i18n="demo_h2"></h2>
      <p class="lead" data-i18n="demo_sub"></p>
      <div class="demo">
        <div class="board" id="board" role="group" aria-label="Chess board"></div>
        <div>
          <h3 data-i18n="demo_q"></h3>
          <p class="msg" id="demo-msg" aria-live="polite"></p>
          <div class="actions">
            <button type="button" class="btn ghost" id="demo-show" data-i18n="demo_show"></button>
            <a class="btn hidden" id="demo-cta" href="#try" data-i18n="demo_cta"></a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- WHO -->
  <section>
    <div class="wrap">
      <h2 data-i18n="who_h2"></h2>
      <p class="lead" data-i18n="who_p1"></p>
      <p class="lead" data-i18n="who_p2"></p>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq">
    <div class="wrap">
      <h2 data-i18n="faq_h2"></h2>
      <details><summary><span data-i18n="q1"></span></summary><p data-i18n="a1"></p></details>
      <details><summary><span data-i18n="q2"></span></summary><p data-i18n="a2"></p></details>
      <details><summary><span data-i18n="q3"></span></summary><p data-i18n="a3"></p></details>
      <details><summary><span data-i18n="q4"></span></summary><p data-i18n="a4"></p></details>
      <details><summary><span data-i18n="q5"></span></summary><p data-i18n="a5"></p></details>
      <details><summary><span data-i18n="q6"></span></summary><p data-i18n="a6"></p></details>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section>
    <div class="wrap">
      <div class="final">
        <h2 data-i18n="cta_h2"></h2>
        <p class="lead" style="margin-left:auto;margin-right:auto" data-i18n="cta_sub"></p>
        <form class="try" data-mode="lichess" novalidate>
          <div class="pills" role="group" aria-label="Source">
            <button type="button" class="pill on" data-src="lichess" aria-pressed="true">Lichess</button>
            <button type="button" class="pill" data-src="chesscom" aria-pressed="false">Chess.com</button>
            <button type="button" class="pill" data-src="pgn" aria-pressed="false">PGN</button>
          </div>
          <div class="row">
            <input class="uname" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Username" data-i18n-ph="ph_user">
            <button class="btn" type="submit"><span class="t-user" data-i18n="btn_analyse"></span><span class="t-pgn" data-i18n="btn_pgn"></span></button>
          </div>
          <p class="err" role="alert" hidden data-i18n="err_user"></p>
        </form>
        <p class="micro" data-i18n="micro_free"></p>
      </div>
    </div>
  </section>

</main>

<div class="wrap">
  <footer>
    <span data-i18n="foot_note"></span>
    <span data-i18n="foot_disc"></span>
  </footer>
</div>`;
export default MARKUP;
