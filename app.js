// ══════════════════════════════════════════
// COLOUR PALETTE — available for subjects
// ══════════════════════════════════════════

const PALETTE = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#10b981", // green
  "#a855f7", // purple
  "#ec4899", // pink
  "#f59e0b", // yellow
  "#06b6d4", // cyan
  "#ef4444", // red
  "#84cc16", // lime
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#14b8a6", // teal
];

// Default subjects loaded for brand-new accounts
const DEFAULT_SUBJECTS = [
  { name: "Mathematics",      short: "Math",  color: "#f97316" },
  { name: "Physics",          short: "Phys",  color: "#3b82f6" },
  { name: "Chemistry",        short: "Chem",  color: "#10b981" },
  { name: "Biology",          short: "Bio",   color: "#a855f7" },
  { name: "English",          short: "Eng",   color: "#ec4899" },
  { name: "Computer Science", short: "CS",    color: "#f59e0b" },
];

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════

let currentUser   = null;
let subjects      = [];   // [{ name, short, color }]
let sessions      = [];
let marks         = [];
let timerInterval = null;
let timerSeconds  = 0;
let timerRunning  = false;
let timerSubject  = null; // set after subjects load
let authMode      = "login";
let selectedColor = PALETTE[0]; // colour picked in modal

// Chart.js instances
let chartDashTime  = null;
let chartDashMarks = null;
let chartWeekly    = null;
let chartPerf      = null;

// ══════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ══════════════════════════════════════════

const store = {
  get: (key) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
};

function loadUserData(email) {
  subjects = store.get(`subjects:${email}`) || DEFAULT_SUBJECTS;
  sessions = store.get(`sessions:${email}`) || [];
  marks    = store.get(`marks:${email}`)    || [];
  // Set default timer subject to first in list
  timerSubject = subjects.length ? subjects[0].name : null;
}

function saveSubjects() { store.set(`subjects:${currentUser.email}`, subjects); }
function saveSessions() { store.set(`sessions:${currentUser.email}`, sessions); }
function saveMarks()    { store.set(`marks:${currentUser.email}`, marks); }

// ── Convenience lookups ──
function subjectColor(name) {
  const s = subjects.find(s => s.name === name);
  return s ? s.color : "#888";
}
function subjectShort(name) {
  const s = subjects.find(s => s.name === name);
  return s ? s.short : name.slice(0, 4);
}

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById("tab-login").classList.toggle("active",  mode === "login");
  document.getElementById("tab-signup").classList.toggle("active", mode === "signup");
  document.getElementById("field-name").style.display = mode === "signup" ? "block" : "none";
  document.getElementById("auth-submit-btn").textContent = mode === "login" ? "Login →" : "Create Account →";
  document.getElementById("auth-error").textContent = "";
}

function handleAuth(e) {
  e.preventDefault();
  const name     = document.getElementById("input-name").value.trim();
  const email    = document.getElementById("input-email").value.trim().toLowerCase();
  const password = document.getElementById("input-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";

  if (authMode === "signup") {
    if (!name || !email || !password) { errEl.textContent = "All fields are required."; return; }
    if (store.get(`user:${email}`))   { errEl.textContent = "Account already exists. Please login."; return; }
    store.set(`user:${email}`, { name, email, password });
    loginAs({ name, email, password });
  } else {
    if (!email || !password) { errEl.textContent = "Enter your email and password."; return; }
    const userData = store.get(`user:${email}`);
    if (!userData)                          { errEl.textContent = "No account found. Please sign up first."; return; }
    if (userData.password !== password)     { errEl.textContent = "Incorrect password."; return; }
    loginAs(userData);
  }
}

function loginAs(userData) {
  currentUser = userData;
  loadUserData(userData.email);

  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display  = "block";

  document.getElementById("user-avatar").textContent    = userData.name[0].toUpperCase();
  document.getElementById("user-name-disp").textContent  = userData.name;
  document.getElementById("user-email-disp").textContent = userData.email;
  document.getElementById("dash-greeting").textContent   = `Welcome back, ${userData.name.split(" ")[0]} 👋`;

  buildSubjectGrid();
  buildMarkSubjectSelect();
  navigate("dashboard");
}

function logout() {
  if (timerRunning) { clearInterval(timerInterval); timerRunning = false; timerSeconds = 0; }
  currentUser = null; subjects = []; sessions = []; marks = [];
  document.getElementById("app-screen").style.display  = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("input-email").value    = "";
  document.getElementById("input-password").value = "";
  document.getElementById("input-name").value     = "";
  document.getElementById("auth-error").textContent = "";
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════

function navigate(page) {
  document.querySelectorAll(".page").forEach(p     => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelector(`[data-page="${page}"]`).classList.add("active");

  if (page === "dashboard")   renderDashboard();
  if (page === "timer")       { buildSubjectGrid(); renderSessions(); }
  if (page === "marks")       { buildMarkSubjectSelect(); renderMarksTable(); }
  if (page === "analytics")   renderAnalytics();
  if (page === "suggestions") renderSuggestions();
  if (page === "subjects")    renderSubjectsManage();
}

// ══════════════════════════════════════════
// SUBJECT MODAL
// ══════════════════════════════════════════

function openModal() {
  if (subjects.length >= 12) {
    alert("You've reached the maximum of 12 subjects. Delete one to add a new one.");
    return;
  }
  // Reset fields
  document.getElementById("modal-subject-name").value  = "";
  document.getElementById("modal-subject-short").value = "";
  document.getElementById("modal-error").textContent   = "";
  selectedColor = pickUnusedColor();
  buildColorSwatches();
  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById("modal-subject-name").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

function buildColorSwatches() {
  const wrap = document.getElementById("color-swatches");
  wrap.innerHTML = "";
  PALETTE.forEach(col => {
    const div = document.createElement("div");
    div.className = "color-swatch" + (col === selectedColor ? " selected" : "");
    div.style.background = col;
    div.title = col;
    div.onclick = () => {
      selectedColor = col;
      document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      div.classList.add("selected");
    };
    wrap.appendChild(div);
  });
}

function pickUnusedColor() {
  const used = subjects.map(s => s.color);
  return PALETTE.find(c => !used.includes(c)) || PALETTE[0];
}

function submitAddSubject(e) {
  e.preventDefault();
  const name  = document.getElementById("modal-subject-name").value.trim();
  const short = document.getElementById("modal-subject-short").value.trim();
  const errEl = document.getElementById("modal-error");
  errEl.textContent = "";

  if (!name)  { errEl.textContent = "Please enter a subject name."; return; }
  if (!short) { errEl.textContent = "Please enter a short label."; return; }
  if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = "A subject with that name already exists."; return;
  }

  subjects.push({ name, short, color: selectedColor });
  saveSubjects();
  closeModal();

  // Refresh wherever subjects are shown
  buildSubjectGrid();
  buildMarkSubjectSelect();
  renderSubjectsManage();

  // If timer has no subject selected yet, default to the new one
  if (!timerSubject) timerSubject = name;
}

// ══════════════════════════════════════════
// SUBJECTS MANAGEMENT PAGE
// ══════════════════════════════════════════

function renderSubjectsManage() {
  const wrap = document.getElementById("subjects-grid-manage");
  if (!subjects.length) {
    wrap.innerHTML = `<div class="subjects-empty">No subjects yet. Click "+ Add Subject" to get started.</div>`;
    return;
  }
  wrap.innerHTML = subjects.map((s, i) => `
    <div class="subject-manage-card">
      <div class="subject-manage-dot" style="background:${s.color}"></div>
      <div class="subject-manage-info">
        <div class="subject-manage-name">${s.name}</div>
        <div class="subject-manage-short">${s.short}</div>
      </div>
      <button class="subject-manage-delete" onclick="deleteSubject(${i})" title="Delete subject">✕</button>
    </div>
  `).join("");
}

function deleteSubject(index) {
  const subj = subjects[index];
  const sessCount = sessions.filter(s => s.subject === subj.name).length;
  const markCount = marks.filter(m => m.subject === subj.name).length;

  let msg = `Delete "${subj.name}"?`;
  if (sessCount || markCount) {
    msg += `\n\nThis will also delete ${sessCount} session(s) and ${markCount} mark(s) linked to this subject.`;
  }
  if (!confirm(msg)) return;

  subjects = subjects.filter((_, i) => i !== index);
  sessions = sessions.filter(s => s.subject !== subj.name);
  marks    = marks.filter(m => m.subject !== subj.name);

  saveSubjects(); saveSessions(); saveMarks();

  // If the deleted subject was selected in the timer, reset
  if (timerSubject === subj.name) {
    timerSubject = subjects.length ? subjects[0].name : null;
    if (!timerRunning) {
      const lbl = document.getElementById("timer-subject-label");
      if (lbl) lbl.textContent = timerSubject ? "Selected: " + timerSubject : "No subjects yet";
    }
  }

  buildSubjectGrid();
  buildMarkSubjectSelect();
  renderSubjectsManage();
}

// ══════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtHours(s) { return (s / 3600).toFixed(1); }

function fmtClock(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function pctClass(p) { return p >= 75 ? "pct-high" : p >= 50 ? "pct-mid" : "pct-low"; }

function getSubjectStats() {
  const now = new Date();
  return subjects.map(sub => {
    const ss       = sessions.filter(s => s.subject === sub.name);
    const totalSecs = ss.reduce((a, s) => a + s.seconds, 0);
    const weekSecs  = ss.filter(s => (now - new Date(s.date)) < 7 * 86400000)
                        .reduce((a, s) => a + s.seconds, 0);
    const sm      = marks.filter(m => m.subject === sub.name);
    const avgMark = sm.length ? sm.reduce((a, m) => a + m.pct, 0) / sm.length : null;
    return { subject: sub.name, short: sub.short, color: sub.color, totalSecs, weekSecs, avgMark, markCount: sm.length };
  });
}

// ══════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════

const CHART_DEFAULTS = {
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1a1a2e", borderColor: "#2a2a3e", borderWidth: 1,
      titleColor: "#888", bodyColor: "#e8e8f0",
      titleFont: { family: "Syne" }, bodyFont: { family: "Syne" }
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#555", font: { family: "Syne", size: 11 } }, border: { display: false } },
    y: { grid: { color: "#16162a" }, ticks: { color: "#555", font: { family: "Syne", size: 11 } }, border: { display: false } }
  },
  animation: { duration: 400 }
};

function makeBarChart(canvasId, labels, data, colors, yFormatter) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();

  // colors can be a single string or an array
  const bgColors  = Array.isArray(colors) ? colors.map(c => c + "99") : colors + "99";
  const brdColors = colors;

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor:      brdColors,
        borderWidth:      1.5,
        borderRadius:     6,
        borderSkipped:    false
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      responsive: true, maintainAspectRatio: false,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { label: ctx => yFormatter(ctx.raw) } }
      },
      scales: {
        ...CHART_DEFAULTS.scales,
        y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => yFormatter(v) } }
      }
    }
  });
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

function renderDashboard() {
  const stats      = getSubjectStats();
  const totalSecs  = sessions.reduce((a, s) => a + s.seconds, 0);
  const totalTests = marks.length;
  const overallAvg = marks.length ? marks.reduce((a, m) => a + m.pct, 0) / marks.length : null;
  const active     = stats.filter(s => s.totalSecs > 0).length;

  document.getElementById("stat-total-time").textContent = fmtHours(totalSecs) + "h";
  document.getElementById("stat-tests").textContent      = totalTests;
  document.getElementById("stat-active").textContent     = active;

  const avgEl = document.getElementById("stat-avg");
  if (overallAvg !== null) {
    avgEl.textContent = overallAvg.toFixed(0) + "%";
    avgEl.style.color = overallAvg >= 60 ? "var(--green)" : "var(--red)";
  } else {
    avgEl.textContent = "—";
    avgEl.style.color = "";
  }

  const hasTime  = stats.filter(s => s.totalSecs > 0);
  const hasMarks = stats.filter(s => s.avgMark !== null);

  makeBarChart("chart-dash-time",  hasTime.map(s => s.short),  hasTime.map(s => parseFloat(fmtHours(s.totalSecs))), hasTime.map(s => s.color),  v => v + "h");
  makeBarChart("chart-dash-marks", hasMarks.map(s => s.short), hasMarks.map(s => +s.avgMark.toFixed(1)),            hasMarks.map(s => s.color), v => v + "%");
}

// ══════════════════════════════════════════
// TIMER
// ══════════════════════════════════════════

function buildSubjectGrid() {
  const grid = document.getElementById("subject-grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!subjects.length) {
    grid.innerHTML = `<div style="color:var(--text4); font-size:13px; grid-column:1/-1; text-align:center; padding:16px 0">
      No subjects yet. <button onclick="navigate('subjects')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-family:Syne,sans-serif;font-size:13px;font-weight:700">Add subjects →</button>
    </div>`;
    document.getElementById("timer-subject-label").textContent = "Add subjects to start timing";
    return;
  }

  // Ensure timerSubject is valid
  if (!timerSubject || !subjects.find(s => s.name === timerSubject)) {
    timerSubject = subjects[0].name;
  }

  subjects.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "subject-btn" + (s.name === timerSubject ? " selected" : "");
    btn.style.setProperty("--col", s.color);
    btn.textContent = s.short;
    btn.title = s.name;
    btn.onclick = () => {
      if (!timerRunning) {
        timerSubject = s.name;
        buildSubjectGrid();
        document.getElementById("timer-subject-label").textContent = "Selected: " + s.name;
      }
    };
    grid.appendChild(btn);
  });

  document.getElementById("timer-subject-label").textContent = "Selected: " + timerSubject;
}

function toggleTimer() {
  if (!timerSubject || !subjects.length) return;
  const btn      = document.getElementById("btn-timer-toggle");
  const resetBtn = document.getElementById("btn-timer-reset");

  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning     = false;
    btn.textContent  = "▶ Start";
    btn.className    = "btn btn-start";
    document.getElementById("timer-display").classList.remove("running");

    if (timerSeconds > 0) {
      sessions.push({ subject: timerSubject, seconds: timerSeconds, date: new Date().toISOString() });
      saveSessions();
      timerSeconds = 0;
      document.getElementById("timer-display").textContent = "00:00:00";
      resetBtn.style.display = "none";
      renderSessions();
    }
  } else {
    timerRunning    = true;
    btn.textContent = "⏹ Stop & Save";
    btn.className   = "btn btn-stop";
    document.getElementById("timer-display").classList.add("running");
    resetBtn.style.display = "inline-block";
    timerInterval = setInterval(() => {
      timerSeconds++;
      document.getElementById("timer-display").textContent = fmtClock(timerSeconds);
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 0;
  document.getElementById("timer-display").textContent    = "00:00:00";
  document.getElementById("timer-display").classList.remove("running");
  document.getElementById("btn-timer-toggle").textContent = "▶ Start";
  document.getElementById("btn-timer-toggle").className   = "btn btn-start";
  document.getElementById("btn-timer-reset").style.display = "none";
}

function renderSessions() {
  const wrap = document.getElementById("sessions-list");
  if (!sessions.length) {
    wrap.innerHTML = '<div class="empty-state">No sessions yet. Start your first one!</div>';
    return;
  }
  wrap.innerHTML = [...sessions].reverse().slice(0, 20).map(s => `
    <div class="session-item">
      <div style="display:flex; align-items:center">
        <div class="session-dot" style="background:${subjectColor(s.subject)}"></div>
        <span class="session-sub" style="color:${subjectColor(s.subject)}">${subjectShort(s.subject)}</span>
      </div>
      <div style="text-align:right">
        <div class="session-time">${fmtTime(s.seconds)}</div>
        <div class="session-date">${new Date(s.date).toLocaleDateString()}</div>
      </div>
    </div>
  `).join("");
}

// ══════════════════════════════════════════
// MARKS
// ══════════════════════════════════════════

function buildMarkSubjectSelect() {
  const sel = document.getElementById("mark-subject");
  if (!sel) return;
  sel.innerHTML = subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
}

function addMark(e) {
  e.preventDefault();
  const subject = document.getElementById("mark-subject").value;
  const score   = parseFloat(document.getElementById("mark-score").value);
  const total   = parseFloat(document.getElementById("mark-total").value);
  const label   = document.getElementById("mark-label").value.trim();
  const errEl   = document.getElementById("mark-error");
  errEl.textContent = "";

  if (isNaN(score) || isNaN(total) || total <= 0 || score < 0 || score > total) {
    errEl.textContent = "Enter a valid score and total."; return;
  }

  marks.push({ subject, score, total, pct: (score / total) * 100, label, date: new Date().toISOString(), id: Date.now() });
  saveMarks();
  document.getElementById("mark-score").value = "";
  document.getElementById("mark-label").value = "";
  renderMarksTable();
}

function deleteMark(id) {
  marks = marks.filter(m => m.id !== id);
  saveMarks();
  renderMarksTable();
}

function renderMarksTable() {
  const wrap = document.getElementById("marks-table-wrap");
  if (!marks.length) { wrap.innerHTML = '<div class="empty-state">No marks logged yet.</div>'; return; }
  const rows = [...marks].reverse().map(m => `
    <tr>
      <td style="color:${subjectColor(m.subject)}; font-weight:600">${subjectShort(m.subject)}</td>
      <td style="color:var(--text2)">${m.label || "—"}</td>
      <td style="font-family:'DM Mono',monospace">${m.score}/${m.total}</td>
      <td><span class="pct-badge ${pctClass(m.pct)}">${m.pct.toFixed(0)}%</span></td>
      <td style="color:var(--text3); font-size:12px">${new Date(m.date).toLocaleDateString()}</td>
      <td><button class="btn-danger" onclick="deleteMark(${m.id})">✕</button></td>
    </tr>
  `).join("");
  wrap.innerHTML = `
    <table class="marks-table">
      <thead><tr><th>Subject</th><th>Label</th><th>Score</th><th>%</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ══════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════

function renderAnalytics() {
  const stats     = getSubjectStats();
  const withWeek  = stats.filter(s => s.weekSecs > 0);
  const withMarks = stats.filter(s => s.avgMark !== null);

  makeBarChart("chart-weekly",      withWeek.map(s => s.short),  withWeek.map(s => parseFloat(fmtHours(s.weekSecs))), withWeek.map(s => s.color),  v => v + "h");
  makeBarChart("chart-performance", withMarks.map(s => s.short), withMarks.map(s => +s.avgMark.toFixed(1)),           withMarks.map(s => s.color), v => v + "%");

  const rows = stats.map(s => `
    <tr>
      <td style="color:${s.color}; font-weight:600">${s.subject}</td>
      <td style="font-family:'DM Mono',monospace; font-size:13px">${fmtHours(s.totalSecs)}h</td>
      <td style="font-family:'DM Mono',monospace; font-size:13px; color:var(--text2)">${fmtHours(s.weekSecs)}h</td>
      <td style="color:var(--text3)">${s.markCount}</td>
      <td>${s.avgMark !== null ? `<span class="pct-badge ${pctClass(s.avgMark)}">${s.avgMark.toFixed(0)}%</span>` : `<span style="color:var(--text4)">—</span>`}</td>
    </tr>
  `).join("");

  document.getElementById("analytics-breakdown-wrap").innerHTML = `
    <table class="marks-table analytics-breakdown">
      <thead><tr><th>Subject</th><th>Total Study</th><th>This Week</th><th>Tests</th><th>Avg Mark</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ══════════════════════════════════════════
// SUGGESTIONS
// ══════════════════════════════════════════

function renderSuggestions() {
  const stats = getSubjectStats();
  const sugs  = [];

  stats.forEach(s => {
    const wh = s.weekSecs / 3600;
    if (s.avgMark !== null && s.avgMark < 60 && wh < 5)
      sugs.push({ type: "critical", subject: s.subject, msg: `Your ${s.subject} average is ${s.avgMark.toFixed(0)}% with only ${wh.toFixed(1)}h this week. Increase study time by at least 2 hrs/week.` });
    else if (s.avgMark !== null && s.avgMark < 60)
      sugs.push({ type: "warning",  subject: s.subject, msg: `${s.subject} marks are below 60%. You're putting in time — try different techniques, practice tests, or seek help.` });
    else if (s.avgMark !== null && s.avgMark >= 60 && wh < 2)
      sugs.push({ type: "info",     subject: s.subject, msg: `Good marks in ${s.subject}! Maintain at least 2h/week to keep it consistent.` });
    else if (s.avgMark !== null && s.avgMark >= 80 && wh > 10)
      sugs.push({ type: "success",  subject: s.subject, msg: `You're excelling in ${s.subject} with ${wh.toFixed(1)}h/week. Consider redistributing some time to weaker subjects.` });
  });

  if (!sugs.length) sugs.push({ type: "info", subject: "General", msg: "Keep logging your study sessions and test marks to receive personalised suggestions!" });

  const icons = { critical: "🔴", warning: "🟡", info: "🔵", success: "🟢" };
  document.getElementById("suggestions-list").innerHTML = sugs.map(s => `
    <div class="suggestion-card sug-${s.type}">
      <div class="sug-icon">${icons[s.type]}</div>
      <div>
        <div class="sug-subject">${s.subject}</div>
        <div class="sug-msg">${s.msg}</div>
      </div>
    </div>
  `).join("");
}

// ══════════════════════════════════════════
// KEYBOARD SHORTCUT — close modal with Escape
// ══════════════════════════════════════════
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});
