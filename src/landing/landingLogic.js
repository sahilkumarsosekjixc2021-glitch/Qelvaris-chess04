// Landing page ka behaviour (EN/Hindi, username form, demo board).
// initLanding(root, { onStart, onSignIn }) root ke andar sab kuch jodta hai.

export function initLanding(root, { onStart, onSignIn } = {}) {
  var I18N = {
      en: {
        nav_how: "How it works", nav_features: "Features", nav_faq: "FAQ", nav_cta: "Start free", nav_signin: "Sign in",
        hero_eyebrow: "For players rated 800–1800 who want to actually improve",
        hero_h1: "See where your rating is <em>leaking</em>.",
        hero_sub: "Enter your Lichess or Chess.com username. Qelvaris reads your recent games and shows the habits costing you the most rating points.",
        ph_user: "Your username", btn_analyse: "Analyse my games", btn_pgn: "Upload PGN",
        micro_free: "Free · No card needed · Quick free account",
        err_user: "Please enter a username.",
        sample_tag: "Sample report", rep_note: "Estimated rating points lost. Sample player, for illustration.",
        sk_tactics: "Tactics", sk_attack: "Attack", sk_endgames: "Endgames", sk_time: "Time use", sk_openings: "Openings", sk_defence: "Defence",
        leak1: "Hanging pieces", leak2: "Opening gaps", leak3: "Missed tactics",
        trust1: "Works with Lichess and Chess.com", trust2: "No Lichess or Chess.com password", trust3: "Engine-checked moves", trust4: "Your games stay in your browser",
        prob_h2: "Puzzles don't fix the mistakes you actually make.",
        prob_a_t: "Generic puzzles", prob_a_d: "Random positions. The same difficulty for everyone. Easy to forget.",
        prob_b_d: "Positions from your own games. Built around your repeat habits. They come back until they stick.",
        how_k: "How it works", how_h2: "From your games to a plan in three steps",
        s1_t: "Connect your games", s1_d: "Type your username or upload a PGN. Nothing is posted anywhere.",
        s2_t: "Find your leaks", s2_d: "See which habits cost you the most rating points, ranked.",
        s3_t: "Fix it and prove it", s3_d: "Train on your own mistakes, then show the improvement in real games.",
        feat_k: "What you get", feat_h2: "Everything points at one goal: fewer repeat mistakes.",
        f1_t: "See where your points go", f1_d: "A six-skill profile and a ranked list of habits, with estimated rating points lost.",
        f2_t: "Never repeat the same mistake", f2_d: "Your real mistakes come back as positions until they stick. A habit counts as Fixed only when it improves in real games.",
        f3_t: "Learn from every turning point", f3_d: "Jump to the moments that decided the game. Guess your move first, then see the answer.",
        f4_t: "Know where your preparation ends", f4_d: "An opening tree of your games shows where you leave book and how you score from there.",
        demo_h2: "Try a Leak Lab moment", demo_sub: "Illustrative position. Click the piece that is hanging.",
        demo_q: "White to move. One piece is in danger.",
        demo_show: "Show me",
        demo_ok: "Right. The bishop on c4 is attacked by the queen and protected by nothing. In Leak Lab, positions like this come from your own games.",
        demo_no: "Not that one. Look for the piece that is attacked and that nothing protects.",
        demo_cta: "Find my leaks",
        who_h2: "Built for improving players",
        who_p1: "If you are rated roughly 800–1800 and keep losing to the same kind of mistake, this is for you.",
        who_p2: "It does not replace playing. It makes every game worth learning from.",
        faq_h2: "Questions",
        q1: "Is it free to start?", a1: "Yes. Create a free account, connect your games and see your top finding. No card needed.",
        q2: "Do I need my Lichess or Chess.com password?", a2: "No. We read your public games from your username and nothing is posted anywhere.",
        q3: "Where is my data stored?", a3: "Your games and analysis stay in your browser. Only your account details (email and username) are stored for login. You can export a backup or delete your games from Settings at any time.",
        q4: "How many games are read?", a4: "You choose how many recent games to read, or upload a PGN for older ones.",
        q5: "Does it work on my phone?", a5: "Yes, the site is built for phones. On a slower phone you can lower the analysis depth in Settings.",
        q6: "Is there a Hindi version?", a6: "Yes. Switch the language at the top of the page any time.",
        cta_h2: "Your next move is a better you.", cta_sub: "Find your first leak today.",
        foot_note: "© 2026 Qelvaris", foot_disc: "Not affiliated with Lichess or Chess.com."
      },
      hi: {
        nav_how: "कैसे काम करता है", nav_features: "फ़ीचर्स", nav_faq: "सवाल-जवाब", nav_cta: "मुफ़्त शुरू करो", nav_signin: "साइन इन",
        hero_eyebrow: "800–1800 रेटिंग के खिलाड़ियों के लिए, जो सच में बेहतर होना चाहते हैं",
        hero_h1: "देखो तुम्हारी रेटिंग कहाँ <em>लीक</em> हो रही है।",
        hero_sub: "अपना Lichess या Chess.com यूज़रनेम डालो। Qelvaris तुम्हारी हाल की गेम्स पढ़कर वो आदतें दिखाता है जो तुम्हारे सबसे ज़्यादा रेटिंग पॉइंट खा रही हैं।",
        ph_user: "तुम्हारा यूज़रनेम", btn_analyse: "मेरी गेम्स का विश्लेषण करो", btn_pgn: "PGN अपलोड करो",
        micro_free: "मुफ़्त · कार्ड नहीं चाहिए · बस एक मुफ़्त अकाउंट",
        err_user: "कृपया यूज़रनेम डालो।",
        sample_tag: "सैंपल रिपोर्ट", rep_note: "खोए हुए अनुमानित रेटिंग पॉइंट। सैंपल खिलाड़ी, सिर्फ़ उदाहरण के लिए।",
        sk_tactics: "टैक्टिक्स", sk_attack: "अटैक", sk_endgames: "एंडगेम", sk_time: "समय का उपयोग", sk_openings: "ओपनिंग", sk_defence: "डिफ़ेंस",
        leak1: "बिना सुरक्षा के मोहरे", leak2: "ओपनिंग की कमियाँ", leak3: "छूटी हुई टैक्टिक्स",
        trust1: "Lichess और Chess.com के साथ चलता है", trust2: "Lichess/Chess.com पासवर्ड नहीं चाहिए", trust3: "इंजन से जाँची हुई चालें", trust4: "तुम्हारी गेम्स तुम्हारे ब्राउज़र में रहती हैं",
        prob_h2: "पज़ल वो गलतियाँ नहीं सुधारते जो तुम असल में करते हो।",
        prob_a_t: "आम पज़ल", prob_a_d: "बेतरतीब पोज़ीशन। सबके लिए एक जैसी कठिनाई। आसानी से भूल जाते हैं।",
        prob_b_d: "तुम्हारी अपनी गेम्स की पोज़ीशन। तुम्हारी दोहराई जाने वाली आदतों पर बनी। तब तक लौटती हैं जब तक पक्की न हो जाएँ।",
        how_k: "कैसे काम करता है", how_h2: "तुम्हारी गेम्स से प्लान तक, तीन कदम में",
        s1_t: "अपनी गेम्स जोड़ो", s1_d: "यूज़रनेम डालो या PGN अपलोड करो। कहीं कुछ पोस्ट नहीं होता।",
        s2_t: "अपनी लीक्स खोजो", s2_d: "देखो कौन सी आदतें तुम्हें सबसे ज़्यादा रेटिंग पॉइंट का नुकसान कराती हैं, क्रम से।",
        s3_t: "सुधारो और साबित करो", s3_d: "अपनी ही गलतियों पर अभ्यास करो, फिर असली गेम्स में सुधार देखो।",
        feat_k: "तुम्हें क्या मिलता है", feat_h2: "सब कुछ एक ही लक्ष्य के लिए: दोहराई जाने वाली गलतियाँ कम।",
        f1_t: "देखो पॉइंट कहाँ जा रहे हैं", f1_d: "छह स्किल की प्रोफ़ाइल और आदतों की क्रमबद्ध सूची, खोए हुए अनुमानित रेटिंग पॉइंट के साथ।",
        f2_t: "वही गलती दोबारा मत करो", f2_d: "तुम्हारी असली गलतियाँ पोज़ीशन बनकर लौटती हैं, जब तक पक्की न हो जाएँ। आदत तभी Fixed मानी जाती है जब असली गेम्स में सुधरे।",
        f3_t: "हर निर्णायक मोड़ से सीखो", f3_d: "उन पलों पर जाओ जिन्होंने गेम तय की। पहले अपनी चाल सोचो, फिर जवाब देखो।",
        f4_t: "जानो तुम्हारी तैयारी कहाँ खत्म होती है", f4_d: "तुम्हारी गेम्स का ओपनिंग ट्री दिखाता है कि तुम बुक कहाँ छोड़ते हो और वहाँ से स्कोर कैसा रहता है।",
        demo_h2: "Leak Lab का एक पल आज़माओ", demo_sub: "उदाहरण पोज़ीशन। जो मोहरा बिना सुरक्षा के है, उस पर क्लिक करो।",
        demo_q: "सफ़ेद की चाल। एक मोहरा खतरे में है।",
        demo_show: "दिखाओ",
        demo_ok: "सही! c4 का ऊँट वज़ीर के हमले में है और उसे कोई बचा नहीं रहा। Leak Lab में ऐसी पोज़ीशन तुम्हारी अपनी गेम्स से आती हैं।",
        demo_no: "ये नहीं। देखो कौन सा मोहरा हमले में है और उसकी रक्षा कोई नहीं कर रहा।",
        demo_cta: "मेरी लीक्स खोजो",
        who_h2: "सुधरते खिलाड़ियों के लिए",
        who_p1: "अगर तुम्हारी रेटिंग लगभग 800 से 1800 के बीच है और तुम बार-बार एक जैसी गलतियों से हारते हो, तो ये तुम्हारे लिए है।",
        who_p2: "ये खेलने की जगह नहीं लेता। ये हर गेम को सीखने लायक बनाता है।",
        faq_h2: "सवाल-जवाब",
        q1: "क्या शुरू करना मुफ़्त है?", a1: "हाँ। मुफ़्त अकाउंट बनाओ, गेम्स जोड़ो और अपनी सबसे बड़ी लीक देखो। कार्ड नहीं चाहिए।",
        q2: "क्या Lichess या Chess.com का पासवर्ड चाहिए?", a2: "नहीं। हम सिर्फ़ तुम्हारे यूज़रनेम से सार्वजनिक गेम्स पढ़ते हैं और कहीं कुछ पोस्ट नहीं करते।",
        q3: "मेरा डेटा कहाँ रहता है?", a3: "तुम्हारी गेम्स और विश्लेषण तुम्हारे ब्राउज़र में रहते हैं। लॉगिन के लिए सिर्फ़ तुम्हारे अकाउंट की जानकारी (ईमेल और यूज़रनेम) रखी जाती है। Settings से कभी भी बैकअप एक्सपोर्ट कर सकते हो या अपनी गेम्स मिटा सकते हो।",
        q4: "कितनी गेम्स पढ़ी जाती हैं?", a4: "तुम चुनते हो कि हाल की कितनी गेम्स पढ़नी हैं। पुरानी गेम्स के लिए PGN अपलोड करो।",
        q5: "क्या फ़ोन पर चलेगा?", a5: "हाँ, साइट फ़ोन के लिए बनी है। धीमे फ़ोन पर Settings में विश्लेषण की गहराई कम कर सकते हो।",
        q6: "क्या हिंदी में है?", a6: "हाँ, पेज के ऊपर से भाषा कभी भी बदल सकते हो।",
        cta_h2: "तुम्हारी अगली चाल, एक बेहतर तुम।", cta_sub: "आज अपनी पहली लीक खोजो।",
        foot_note: "© 2026 Qelvaris", foot_disc: "Lichess या Chess.com से संबद्ध नहीं।"
      }
    };


  var lang = "en";
  try { var saved = localStorage.getItem("qv_lang"); if (saved === "hi" || saved === "en") lang = saved; } catch (e) {}

  function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || ""; }

  function applyLang() {
    root.setAttribute("lang", lang);
    var nodes = root.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = t(nodes[i].getAttribute("data-i18n"));
    var phs = root.querySelectorAll("[data-i18n-ph]");
    for (var j = 0; j < phs.length; j++) phs[j].setAttribute("placeholder", t(phs[j].getAttribute("data-i18n-ph")));
    var btns = root.querySelectorAll(".lang button");
    for (var k = 0; k < btns.length; k++) btns[k].classList.toggle("on", btns[k].getAttribute("data-lang") === lang);
    var m = root.querySelector("#demo-msg");
    if (m && m.getAttribute("data-key")) m.textContent = t(m.getAttribute("data-key"));
  }

  root.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      lang = b.getAttribute("data-lang");
      try { localStorage.setItem("qv_lang", lang); } catch (e) {}
      applyLang();
    });
  });

  /* ---------- username forms ---------- */
  root.querySelectorAll("form.try").forEach(function (form) {
    var input = form.querySelector(".uname");
    var err = form.querySelector(".err");
    var pills = form.querySelectorAll(".pill");

    pills.forEach(function (p) {
      p.addEventListener("click", function () {
        pills.forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); });
        p.classList.add("on"); p.setAttribute("aria-pressed", "true");
        form.setAttribute("data-mode", p.getAttribute("data-src"));
        err.hidden = true;
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var src = form.getAttribute("data-mode");
      var name = (input.value || "").trim();
      if (src !== "pgn" && !name) { err.hidden = false; input.focus(); return; }
      err.hidden = true;
      // Account zaroori hai: pehle signup, phir Connect mein ye source/username khud bhar jayenge
      if (onStart) onStart({ source: src, username: src === "pgn" ? "" : name });
    });
  });

  /* ---------- demo board ---------- */
  // White to move. Black queen on b4 attacks the bishop on c4; nothing defends it.
  var FEN = ["5rk1", "p4ppp", "8", "8", "1qB5", "8", "PP3PPP", "R1B2RK1"];
  var GLYPH = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F\uFE0E" };
  var NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  var FILES = "abcdefgh";
  var board = root.querySelector("#board");
  var msg = root.querySelector("#demo-msg");
  var cta = root.querySelector("#demo-cta");
  var solved = false;

  function setMsg(key, cls) {
    msg.setAttribute("data-key", key);
    msg.textContent = t(key);
    msg.className = "msg" + (cls ? " " + cls : "");
  }

  function build() {
    for (var r = 0; r < 8; r++) {
      var row = FEN[r], f = 0;
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch >= "1" && ch <= "8") {
          for (var n = 0; n < parseInt(ch, 10); n++) { addSq(f, 8 - r, null); f++; }
        } else {
          addSq(f, 8 - r, ch); f++;
        }
      }
    }
  }

  function addSq(fileIdx, rank, piece) {
    var b = document.createElement("button");
    var sq = FILES.charAt(fileIdx) + rank;
    b.type = "button";
    b.setAttribute("data-sq", sq);
    var light = (fileIdx + rank) % 2 === 0;
    var cls = "sq " + (light ? "l" : "d");
    var label = sq;
    if (piece) {
      var isWhite = piece === piece.toUpperCase();
      var low = piece.toLowerCase();
      cls += isWhite ? " w" : " k";
      b.textContent = GLYPH[low];
      label += ", " + (isWhite ? "white " : "black ") + NAMES[low];
    }
    b.className = cls;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", function () { guess(sq, b); });
    board.appendChild(b);
  }

  function clearMarks() {
    board.querySelectorAll(".hit,.miss").forEach(function (s) { s.classList.remove("hit", "miss"); });
  }

  function win() {
    solved = true;
    cta.classList.remove("hidden");
    setMsg("demo_ok", "ok");
  }

  function guess(sq, el) {
    if (solved) return;
    clearMarks();
    if (sq === "c4") { el.classList.add("hit"); win(); }
    else { el.classList.add("miss"); setMsg("demo_no", "no"); }
  }

  root.querySelector("#demo-show").addEventListener("click", function () {
    clearMarks();
    var target = board.querySelector('[data-sq="c4"]');
    if (target) target.classList.add("hit");
    win();
  });

  root.querySelectorAll('[data-action="signin"]').forEach(function (b) {
    b.addEventListener("click", function () { if (onSignIn) onSignIn(); });
  });

  build();
  applyLang();

}
