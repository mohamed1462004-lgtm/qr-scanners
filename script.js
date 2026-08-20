/* ============================================================
   ENACTUS BUC — Closing Ceremony Check-In
   Same backend logic as before: html5-qrcode camera + JSONP
   call to the Google Apps Script /exec endpoint (no fetch(),
   to avoid the CORS/redirect issue the Apps Script API has).
   ============================================================ */

// ---- CONFIG -------------------------------------------------
// Paste your Apps Script Web App /exec URL here.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwIUlACbJSQ4hZNkgB-cTQLOBRinF-is3oVuObqoNAI61NgPB1eYSUkBKii7T7aWXDgKg/exec";

// How long the result sheet stays open before the camera resumes
const RESULT_DISPLAY_MS = 3200;

// ---- DOM refs -------------------------------------------------
const frameEl        = document.getElementById('frame');
const hintEl          = document.getElementById('hint');
const restartBtn      = document.getElementById('restartBtn');
const sheet            = document.getElementById('sheet');
const sheetBackdrop    = document.getElementById('sheetBackdrop');
const sheetIcon        = document.getElementById('sheetIcon');
const sheetStatus      = document.getElementById('sheetStatus');
const sheetName        = document.getElementById('sheetName');
const sheetMessage     = document.getElementById('sheetMessage');
const sheetBarFill     = document.getElementById('sheetBarFill');
const confettiCanvas   = document.getElementById('confetti');

let html5QrCode = null;
let isBusy = false; // true while a scan is being verified / result is showing

// ---- Camera setup --------------------------------------------
function startScanner() {
  html5QrCode = new Html5Qrcode("reader");
  const config = {
    fps: 10,
    qrbox: { width: 220, height: 220 },
    aspectRatio: 1.0,
  };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    () => { /* per-frame "not found" noise, ignore */ }
  ).catch(err => {
    hintEl.textContent = "مش قادرين نفتح الكاميرا — تأكد إنك سمحت بصلاحية الكاميرا";
    restartBtn.hidden = false;
    console.error("Camera start failed:", err);
  });
}

function onScanSuccess(decodedText) {
  if (isBusy) return; // ignore repeated triggers while we're handling one
   (قبل isBusy = true;): alert("الكود اللي اتقرى: [" + decodedText + "]"); 
  isBusy = true;
  frameEl.classList.add('frozen');
  hintEl.textContent = "بنتأكد من التذكرة...";

  html5QrCode.pause(true);
  checkTicketJSONP(decodedText);
}

restartBtn.addEventListener('click', () => {
  restartBtn.hidden = true;
  hintEl.textContent = "وجّه الكاميرا ناحية الكود";
  startScanner();
});

// ---- JSONP call to Apps Script --------------------------------
// Same technique as the original GitHub Pages frontend: a <script>
// tag load bypasses the Apps Script CORS/redirect problem that a
// normal fetch() runs into.
function checkTicketJSONP(code) {
  const callbackName = "__enactusCheck_" + Date.now();
  const script = document.createElement('script');

  let settled = false;
  const cleanup = () => {
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
    clearTimeout(timeoutId);
  };

  window[callbackName] = (data) => {
    if (settled) return;
    settled = true;
    cleanup();
    handleResult(data);
  };

  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    handleResult({ status: "error" });
  }, 10000);

  const url = APPS_SCRIPT_URL
    + "?code=" + encodeURIComponent(code)
    + "&callback=" + callbackName;

  script.src = url;
  script.onerror = () => {
    if (settled) return;
    settled = true;
    cleanup();
    handleResult({ status: "error" });
  };

  document.body.appendChild(script);
}

// ---- Result UI --------------------------------------------------
function handleResult(data) {
  const status = data && data.status ? data.status : "error";
  const name = data && data.name ? data.name : "";

  sheet.classList.remove('valid', 'used', 'invalid', 'error', 'shake');

  const presets = {
    valid: {
      icon: "✓",
      title: "تم الدخول",
      message: "أهلاً بيك في الحفلة",
    },
    used: {
      icon: "↻",
      title: "التذكرة مستخدمة",
      message: "التذكرة دي دخلت قبل كده",
    },
    invalid: {
      icon: "✕",
      title: "تذكرة غير صالحة",
      message: "الكود ده مش متسجل عندنا",
    },
    error: {
      icon: "!",
      title: "حصل خطأ",
      message: "مقدرناش نتواصل مع السيرفر، جرب تاني",
    },
  };

  const preset = presets[status] || presets.error;
  const cssClass = presets[status] ? status : "error";

  sheetIcon.textContent = preset.icon;
  sheetStatus.textContent = preset.title;
  sheetName.textContent = name;
  sheetName.style.display = name ? "block" : "none";
  sheetMessage.textContent = preset.message;

  sheet.classList.add(cssClass);
  sheetBackdrop.classList.add('show');

  requestAnimationFrame(() => {
    sheet.classList.add('show');
    if (cssClass === 'invalid' || cssClass === 'error') {
      sheet.classList.add('shake');
    }
  });

  if (cssClass === 'valid') {
    launchConfetti();
  }

  // progress bar countdown
  sheetBarFill.style.transition = 'none';
  sheetBarFill.style.transform = 'scaleX(1)';
  requestAnimationFrame(() => {
    sheetBarFill.style.transition = `transform ${RESULT_DISPLAY_MS}ms linear`;
    sheetBarFill.style.transform = 'scaleX(0)';
  });

  setTimeout(closeResult, RESULT_DISPLAY_MS);
}

function closeResult() {
  sheet.classList.remove('show');
  sheetBackdrop.classList.remove('show');
  frameEl.classList.remove('frozen');
  hintEl.textContent = "وجّه الكاميرا ناحية الكود";

  setTimeout(() => {
    isBusy = false;
    if (html5QrCode) {
      html5QrCode.resume();
    }
  }, 320);
}

// ---- Confetti (lightweight canvas burst, no dependency) -------
function launchConfetti() {
  const ctx = confettiCanvas.getContext('2d');
  const resize = () => {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  };
  resize();

  const colors = ['#F5E1A0', '#FFD873', '#5B8CFF', '#3ECF8E', '#2F5FCE'];
  const count = 90;
  const particles = Array.from({ length: count }, () => ({
    x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 60,
    y: confettiCanvas.height * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -9 - 3,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 14,
    gravity: 0.28 + Math.random() * 0.1,
    life: 0,
    maxLife: 90 + Math.random() * 30,
  }));

  let frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;

    particles.forEach(p => {
      if (p.life >= p.maxLife) return;
      alive = true;
      p.life++;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;

      const fade = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(fade, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });

    if (alive && frame < 200) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
});

// ---- Go -----------------------------------------------------
startScanner();
