const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "about", "into", "over", "after", "as",
  "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "shall", "should", "can", "could", "may",
  "might", "must", "i", "you", "he", "she", "it", "we", "they", "me", "him",
  "her", "us", "them", "my", "your", "his", "its", "our", "their", "this",
  "that", "these", "those", "who", "whom", "which", "what", "there", "here",
  "when", "where", "why", "how", "not", "no", "so", "than", "too", "very"
]);

const STATIC_VOICES = {
  "us-male": {
    id: "en-US-AndrewMultilingualNeural",
    label: "美音温暖男声 (Andrew)",
  },
};

const state = {
  isStaticMode: false,
  deferredInstallPrompt: null,
  plan: null,
  voices: STATIC_VOICES,
  cachedAudio: {},
  progress: {
    start_date: "2026-11-26",
    current_day: 1,
    voice_key: "us-male",
    completed_days: {},
    mastered_sentences: {},
    starred_sentences: {},
  },
  bookFilter: "all",
  activeDayNum: 1,
  layout: "paragraph",
  mode: "full",
  onlyStarred: false,
  revealAll: false,
  revealedSents: new Set(),

  alignment: null,
  audioLoading: false,
  activeSentIdx: 0,
  activeWordIdx: -1,
  sentPlayCount: 0,
  handledSentEndForPass: -1,
  shadowTimer: null,
  pregenPollTimer: null,
};

const els = {
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  closeDrawerBtn: document.getElementById("closeDrawerBtn"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  statDays: document.getElementById("statDays"),
  statWords: document.getElementById("statWords"),
  statStreak: document.getElementById("statStreak"),
  statSentences: document.getElementById("statSentences"),
  overallBar: document.getElementById("overallBar"),
  startDateInput: document.getElementById("startDateInput"),
  finishDateLabel: document.getElementById("finishDateLabel"),
  bookTabs: document.getElementById("bookTabs"),
  jumpCurrentBtn: document.getElementById("jumpCurrentBtn"),
  pregenBtn: document.getElementById("pregenBtn"),
  backupProgressBtn: document.getElementById("backupProgressBtn"),
  cachedCount: document.getElementById("cachedCount"),
  dayList: document.getElementById("dayList"),

  curDayBadge: document.getElementById("curDayBadge"),
  curBookBadge: document.getElementById("curBookBadge"),
  curDateBadge: document.getElementById("curDateBadge"),
  curWordBadge: document.getElementById("curWordBadge"),
  lessonHeading: document.getElementById("lessonHeading"),
  installPwaBtn: document.getElementById("installPwaBtn"),
  layoutSwitchWrap: document.getElementById("layoutSwitchWrap"),
  shortcutsHelpBtn: document.getElementById("shortcutsHelpBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  checkinBtn: document.getElementById("checkinBtn"),

  modeToolbar: document.getElementById("modeToolbar"),
  onlyStarredToggle: document.getElementById("onlyStarredToggle"),
  starredCountInLesson: document.getElementById("starredCountInLesson"),
  revealAllTempBtn: document.getElementById("revealAllTempBtn"),
  ebbinghausBar: document.getElementById("ebbinghausBar"),
  ebbChips: document.getElementById("ebbChips"),

  readingScroll: document.getElementById("readingScroll"),
  readingCanvas: document.getElementById("readingCanvas"),

  mobileSentBar: document.getElementById("mobileSentBar"),
  mRevealBtn: document.getElementById("mRevealBtn"),
  mLoopBtn: document.getElementById("mLoopBtn"),
  mStarBtn: document.getElementById("mStarBtn"),
  mMasterBtn: document.getElementById("mMasterBtn"),

  playerDock: document.getElementById("playerDock"),
  curTimeLbl: document.getElementById("curTimeLbl"),
  durTimeLbl: document.getElementById("durTimeLbl"),
  timelineTrack: document.getElementById("timelineTrack"),
  timelineProgress: document.getElementById("timelineProgress"),
  timelineTicks: document.getElementById("timelineTicks"),
  audioStatus: document.getElementById("audioStatus"),
  mobileAudioStatus: document.getElementById("mobileAudioStatus"),
  prevDayBtn: document.getElementById("prevDayBtn"),
  prevSentBtn: document.getElementById("prevSentBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  nextSentBtn: document.getElementById("nextSentBtn"),
  nextDayBtn: document.getElementById("nextDayBtn"),
  repeatModeSelect: document.getElementById("repeatModeSelect"),
  shadowPauseSelect: document.getElementById("shadowPauseSelect"),
  speedSelect: document.getElementById("speedSelect"),
  voiceSelectWrap: document.getElementById("voiceSelectWrap"),
  voiceSelect: document.getElementById("voiceSelect"),
  downloadMp3Btn: document.getElementById("downloadMp3Btn"),
  audioEl: document.getElementById("audioEl"),

  installModal: document.getElementById("installModal"),
  closeInstallModalBtn: document.getElementById("closeInstallModalBtn"),
  syncModal: document.getElementById("syncModal"),
  closeSyncModalBtn: document.getElementById("closeSyncModalBtn"),
  syncJsonArea: document.getElementById("syncJsonArea"),
  copySyncBtn: document.getElementById("copySyncBtn"),
  importSyncBtn: document.getElementById("importSyncBtn"),
  shortcutsModal: document.getElementById("shortcutsModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  metaThemeColor: document.getElementById("metaThemeColor"),
};

function setStatusText(txt) {
  els.audioStatus.textContent = txt;
  if (els.mobileAudioStatus) els.mobileAudioStatus.textContent = txt;
}

function isMobileViewport() {
  return window.innerWidth <= 860;
}

function closeMobileDrawer() {
  els.sidebar.classList.remove("mobile-open");
  els.sidebarBackdrop.classList.add("hidden");
}

function openMobileDrawer() {
  els.sidebar.classList.add("mobile-open");
  els.sidebarBackdrop.classList.remove("hidden");
}

function fmtTime(ms) {
  if (!ms || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function addDaysToDateStr(baseStr, offsetDays) {
  const parts = (baseStr || "2026-11-26").split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offsetDays);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return {
    iso: `${d.getFullYear()}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    short: `${m}月${day}日 ${wk}`,
    full: `${d.getFullYear()}年${m}月${day}日`,
  };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toFirstLetterHint(token) {
  return token.replace(/[A-Za-z0-9]+/g, (word) => {
    if (word.length <= 1) return word;
    const tailLen = Math.min(word.length - 1, 8);
    return word[0] + "_".repeat(tailLen);
  });
}

function shouldClozeWord(token, sIdx, wIdx) {
  const clean = token.replace(/[^A-Za-z']/g, "").toLowerCase();
  if (clean.length <= 2 || STOPWORDS.has(clean)) return false;
  return ((sIdx * 31 + wIdx * 17 + clean.charCodeAt(0)) % 10) < 5;
}

function getDayEntry(dayNum) {
  return state.plan.days.find((d) => d.day === dayNum) || state.plan.days[0];
}

function getLessonDayEntry(lessonNum) {
  return state.plan.days.find((d) => d.lesson_num === lessonNum);
}

async function saveProgress() {
  try {
    localStorage.setItem("eota_progress_v1", JSON.stringify(state.progress));
    if (!state.isStaticMode) {
      await fetch("./api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.progress),
      });
    }
  } catch (e) {
    // Offline or static mode — localStorage already saved
  }
}

function renderVoiceSelector() {
  els.voiceSelect.innerHTML = "";
  const entries = Object.entries(state.voices);
  for (const [vkey, cfg] of entries) {
    const opt = document.createElement("option");
    opt.value = vkey;
    opt.textContent = cfg.label;
    if (vkey === state.progress.voice_key) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  }
  if (state.isStaticMode && entries.length <= 1) {
    els.voiceSelectWrap.style.display = "none";
  }
}

function updateStatsAndHeader() {
  const totalDays = state.plan.summary.total_calendar_days;
  const completedKeys = Object.keys(state.progress.completed_days || {});
  const doneCount = completedKeys.length;

  let learnedWords = 0;
  for (const d of state.plan.days) {
    if (d.type === "learn" && state.progress.completed_days[d.day]) {
      learnedWords += d.words;
    }
  }

  let masteredSents = 0;
  for (const arr of Object.values(state.progress.mastered_sentences || {})) {
    masteredSents += (arr || []).length;
  }

  els.statDays.textContent = `${doneCount} / ${totalDays}`;
  els.statWords.textContent = learnedWords.toLocaleString();
  els.statSentences.textContent = masteredSents.toLocaleString();
  els.statStreak.textContent = `${doneCount} 天`;

  const pct = Math.min(100, (learnedWords / state.plan.summary.total_words) * 100);
  els.overallBar.style.width = `${pct.toFixed(1)}%`;

  els.startDateInput.value = state.progress.start_date || "2026-11-26";
  const endInfo = addDaysToDateStr(state.progress.start_date, totalDays - 1);
  els.finishDateLabel.textContent = `完结：${endInfo.full}`;

  if (!state.isStaticMode && els.cachedCount) {
    const vCached = (state.cachedAudio[state.progress.voice_key] || []).length;
    els.cachedCount.textContent = `${vCached}/${state.plan.summary.total_lessons}`;
  }
}

function renderSidebarList() {
  const cachedSet = new Set(
    state.isStaticMode
      ? Array.from({ length: state.plan.summary.total_lessons }, (_, i) => i + 1)
      : state.cachedAudio[state.progress.voice_key] || []
  );
  const frag = document.createDocumentFragment();
  let lastWeek = -1;

  for (const d of state.plan.days) {
    if (state.bookFilter !== "all" && String(d.book_num) !== state.bookFilter) {
      continue;
    }
    if (d.week !== lastWeek) {
      lastWeek = d.week;
      const wh = document.createElement("div");
      wh.className = "week-group-header";
      const wkStart = addDaysToDateStr(state.progress.start_date, (d.week - 1) * 7);
      wh.innerHTML = `<span>第 ${d.week} 周</span><span>${wkStart.short.split(" ")[0]}起</span>`;
      frag.appendChild(wh);
    }

    const isDone = Boolean(state.progress.completed_days[d.day]);
    const isActive = d.day === state.activeDayNum;
    const dateInfo = addDaysToDateStr(state.progress.start_date, d.day - 1);

    const row = document.createElement("div");
    row.className = `day-item ${d.type === "review" ? "review-item" : ""} ${isDone ? "done" : ""} ${isActive ? "active" : ""}`;
    row.dataset.day = d.day;

    if (d.type === "learn") {
      const hasAudio = cachedSet.has(d.lesson_num);
      row.innerHTML = `
        <div class="day-item-left">
          <span class="day-check">✓</span>
          <div class="day-item-titles">
            <div class="day-item-main">Day ${d.day} · 第 ${d.lesson_num} 课</div>
            <div class="day-item-sub">${d.book_en} ${d.chapter_label} · ${dateInfo.short}</div>
          </div>
        </div>
        <div class="day-item-right">
          ${hasAudio ? '<span title="美式同步音频就绪">🎧</span>' : ""}
          <span>${d.words}词</span>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="day-item-left">
          <span class="day-check">✓</span>
          <div class="day-item-titles">
            <div class="day-item-main">Day ${d.day} · 周度复盘日</div>
            <div class="day-item-sub">巩固第 ${d.week} 周共 ${d.words} 词 · ${dateInfo.short}</div>
          </div>
        </div>
        <div class="day-item-right"><span>🔁 复习</span></div>
      `;
    }

    row.addEventListener("click", () => {
      selectDay(d.day);
      if (isMobileViewport()) closeMobileDrawer();
    });
    frag.appendChild(row);
  }

  els.dayList.innerHTML = "";
  els.dayList.appendChild(frag);
}

function updateMobileThumbBarState() {
  const day = getDayEntry(state.activeDayNum);
  if (!day || day.type !== "learn") {
    els.mobileSentBar.style.display = "none";
    return;
  }
  els.mobileSentBar.style.display = "";
  const lKey = String(day.lesson_num);
  const isRev = state.revealedSents.has(state.activeSentIdx);
  const isLoop = els.repeatModeSelect.value === "one";
  const isStar = (state.progress.starred_sentences[lKey] || []).includes(state.activeSentIdx);
  const isMast = (state.progress.mastered_sentences[lKey] || []).includes(state.activeSentIdx);

  els.mRevealBtn.classList.toggle("on", isRev);
  els.mLoopBtn.classList.toggle("on", isLoop);
  els.mStarBtn.classList.toggle("on", isStar);
  els.mMasterBtn.classList.toggle("on", isMast);
}

function renderTokensHtml(sIdx, rawText, isSentenceRevealed) {
  const tokens = rawText.split(/\s+/).filter(Boolean);
  return tokens
    .map((tok, wIdx) => {
      const escapedOrig = escapeHtml(tok);
      if (state.mode === "full" || state.revealAll || isSentenceRevealed) {
        return `<span class="word-tok" data-sidx="${sIdx}" data-widx="${wIdx}">${escapedOrig}</span>`;
      }
      if (state.mode === "cloze") {
        const hide = shouldClozeWord(tok, sIdx, wIdx);
        return `<span class="word-tok ${hide ? "cloze-hidden" : ""}" data-sidx="${sIdx}" data-widx="${wIdx}">${escapedOrig}</span>`;
      }
      if (state.mode === "first") {
        const hint = escapeHtml(toFirstLetterHint(tok));
        return `<span class="word-tok first-hint" data-sidx="${sIdx}" data-widx="${wIdx}">${hint}</span>`;
      }
      return `<span class="word-tok" data-sidx="${sIdx}" data-widx="${wIdx}">${escapedOrig}</span>`;
    })
    .join(" ");
}

function renderActiveDayContent() {
  const day = getDayEntry(state.activeDayNum);
  const dateInfo = addDaysToDateStr(state.progress.start_date, day.day - 1);
  const isChecked = Boolean(state.progress.completed_days[day.day]);

  els.curDayBadge.textContent = `Day ${day.day} · W${day.week}`;
  els.curDateBadge.textContent = dateInfo.short;
  els.checkinBtn.className = `btn-checkin ${isChecked ? "checked" : ""}`;
  els.checkinBtn.textContent = isChecked ? "✓ 已打卡" : "✓ 打卡";

  if (day.type === "review") {
    els.curBookBadge.textContent = `${day.book_en} · 周复习`;
    els.curWordBadge.textContent = `${day.words} 词`;
    els.lessonHeading.textContent = `第 ${day.week} 周背诵复盘工作台`;
    els.modeToolbar.style.display = "none";
    els.layoutSwitchWrap.style.display = "none";
    els.ebbinghausBar.classList.add("hidden");
    els.playerDock.style.display = "none";
    els.mobileSentBar.style.display = "none";
    renderWeeklyReviewView(day);
    return;
  }

  els.modeToolbar.style.display = "flex";
  els.layoutSwitchWrap.style.display = "inline-flex";
  els.playerDock.style.display = "block";
  els.curBookBadge.textContent = `${day.book_en} ${day.chapter_label} · 第${day.lesson_num}课`;
  els.curWordBadge.textContent = `${day.words}词 · ${day.sentences.length}句`;
  els.lessonHeading.textContent = day.book_zh;

  if (day.ebbinghaus_lessons && day.ebbinghaus_lessons.length > 0) {
    els.ebbinghausBar.classList.remove("hidden");
    els.ebbChips.innerHTML = "";
    const labels = ["昨背", "前背", "4课前", "7课前", "15课前"];
    day.ebbinghaus_lessons.forEach((lNum, i) => {
      const targetDay = getLessonDayEntry(lNum);
      if (!targetDay) return;
      const chip = document.createElement("button");
      chip.className = "ebb-chip";
      chip.textContent = `第${lNum}课 (${labels[i] || "复习"})`;
      chip.addEventListener("click", () => selectDay(targetDay.day));
      els.ebbChips.appendChild(chip);
    });
  } else {
    els.ebbinghausBar.classList.add("hidden");
  }

  const lKey = String(day.lesson_num);
  const starredSet = new Set(state.progress.starred_sentences[lKey] || []);
  const masteredSet = new Set(state.progress.mastered_sentences[lKey] || []);
  els.starredCountInLesson.textContent = starredSet.size;
  els.readingCanvas.className = `reading-canvas ${state.revealAll ? "reveal-all" : ""}`;

  if (state.layout === "paragraph") {
    const htmlParts = [];
    for (const p of day.paragraphs) {
      const visibleIndices = p.sentence_indices.filter(
        (idx) => !state.onlyStarred || starredSet.has(idx)
      );
      if (visibleIndices.length === 0) continue;

      const sentsHtml = visibleIndices
        .map((sIdx) => {
          const s = day.sentences[sIdx];
          const isRev = state.revealedSents.has(sIdx);
          const classes = [
            "sent-span",
            sIdx === state.activeSentIdx ? "active" : "",
            starredSet.has(sIdx) ? "starred" : "",
            masteredSet.has(sIdx) ? "mastered" : "",
            state.mode === "blind" ? "blind-masked" : "",
            isRev ? "revealed" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<span class="${classes}" data-sidx="${sIdx}">${renderTokensHtml(sIdx, s.text, isRev)}</span>`;
        })
        .join(" ");

      htmlParts.push(
        `<p class="novel-paragraph ${p.is_continuation ? "continuation" : ""}">${sentsHtml}</p>`
      );
    }
    els.readingCanvas.innerHTML =
      htmlParts.length > 0
        ? htmlParts.join("")
        : `<div class="review-hub"><p>本课暂无标记为 ★ 的重点难句。点选句子后点底部「★ 标难句」或按 <kbd>S</kbd> 键即可添加！</p></div>`;

    els.readingCanvas.querySelectorAll(".sent-span").forEach((el) => {
      el.addEventListener("click", (ev) => {
        const idx = Number(el.dataset.sidx);
        if ((state.mode === "blind" || state.mode === "first") && idx === state.activeSentIdx && !ev.altKey) {
          toggleRevealSentence(idx);
          return;
        }
        jumpToSentence(idx, true);
      });
    });
  } else {
    const cards = [];
    for (const s of day.sentences) {
      if (state.onlyStarred && !starredSet.has(s.idx)) continue;
      const isRev = state.revealedSents.has(s.idx);
      const isStar = starredSet.has(s.idx);
      const isMast = masteredSet.has(s.idx);
      const spanClasses = [
        "sent-span",
        state.mode === "blind" ? "blind-masked" : "",
        isRev ? "revealed" : "",
      ]
        .filter(Boolean)
        .join(" ");

      cards.push(`
        <div class="sent-card ${s.idx === state.activeSentIdx ? "active" : ""}" data-card-sidx="${s.idx}">
          <div class="sent-card-head">
            <span>第 ${s.idx + 1}/${day.sentences.length} 句 · ${s.words}词</span>
            <div class="sent-card-actions">
              <button class="mini-btn act-play" data-sidx="${s.idx}">▶ 读</button>
              <button class="mini-btn act-loop ${state.activeSentIdx === s.idx && els.repeatModeSelect.value === "one" ? "on" : ""}" data-sidx="${s.idx}">🔁 循环</button>
              <button class="mini-btn act-reveal ${isRev ? "on" : ""}" data-sidx="${s.idx}">👁 显影</button>
              <button class="mini-btn act-star ${isStar ? "on" : ""}" data-sidx="${s.idx}">★ 难句</button>
              <button class="mini-btn act-master ${isMast ? "master-on" : ""}" data-sidx="${s.idx}">✓ 熟背</button>
            </div>
          </div>
          <div class="sent-card-body" data-sidx="${s.idx}">
            <span class="${spanClasses}" data-sidx="${s.idx}">${renderTokensHtml(s.idx, s.text, isRev)}</span>
          </div>
        </div>
      `);
    }
    els.readingCanvas.innerHTML =
      cards.length > 0
        ? cards.join("")
        : `<div class="review-hub"><p>本课暂无标记为 ★ 的重点难句。</p></div>`;

    els.readingCanvas.querySelectorAll(".sent-card-body, .act-play").forEach((el) => {
      el.addEventListener("click", () => jumpToSentence(Number(el.dataset.sidx), true));
    });
    els.readingCanvas.querySelectorAll(".act-loop").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.sidx);
        els.repeatModeSelect.value = els.repeatModeSelect.value === "one" && state.activeSentIdx === idx ? "seq" : "one";
        jumpToSentence(idx, true);
        renderActiveDayContent();
      });
    });
    els.readingCanvas.querySelectorAll(".act-reveal").forEach((el) => {
      el.addEventListener("click", () => toggleRevealSentence(Number(el.dataset.sidx)));
    });
    els.readingCanvas.querySelectorAll(".act-star").forEach((el) => {
      el.addEventListener("click", () => toggleStarSentence(Number(el.dataset.sidx)));
    });
    els.readingCanvas.querySelectorAll(".act-master").forEach((el) => {
      el.addEventListener("click", () => toggleMasterSentence(Number(el.dataset.sidx)));
    });
  }

  updateMobileThumbBarState();
}

function renderWeeklyReviewView(day) {
  const weekStarred = [];
  for (const item of day.review_lessons) {
    const lDay = getLessonDayEntry(item.lesson_num);
    const sArr = state.progress.starred_sentences[String(item.lesson_num)] || [];
    for (const sIdx of sArr) {
      if (lDay && lDay.sentences[sIdx]) {
        weekStarred.push({ lesson_num: item.lesson_num, day: lDay.day, sIdx, text: lDay.sentences[sIdx].text });
      }
    }
  }

  const starredHtml =
    weekStarred.length > 0
      ? `<h4 style="margin: 16px 0 10px;">★ 本周重点难句攻坚 (${weekStarred.length} 句)</h4>` +
        weekStarred
          .map(
            (ws) => `
          <div class="sent-card" style="cursor:pointer" data-jump-day="${ws.day}" data-jump-sidx="${ws.sIdx}">
            <div class="sent-card-head"><span>第 ${ws.lesson_num} 课 · 第 ${ws.sIdx + 1} 句</span><span>跳转跟读 →</span></div>
            <div class="sent-card-body">${escapeHtml(ws.text)}</div>
          </div>`
          )
          .join("")
      : `<p style="color:var(--text-muted); font-size:13px; margin-top:10px;">💡 平时背诵遇到长难句点「★ 标难句」，周复习日会自动汇总到这里集中消灭！</p>`;

  const cardsHtml = day.review_lessons
    .map((item) => {
      const done = Boolean(state.progress.completed_days[item.day]);
      return `
        <div class="review-lesson-card" data-jump-day="${item.day}">
          <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:6px;">
            <span>Day ${item.day} · 第 ${item.lesson_num} 课</span>
            <span style="color:${done ? "var(--emerald)" : "var(--text-muted)"}">${done ? "✓ 已背" : "待背"}</span>
          </div>
          <div style="font-size:12.5px; color:var(--text-secondary);">${item.book_en} ${item.chapter_label} · ${item.words} 词</div>
          <div style="font-size:12px; color:var(--accent); margin-top:8px;">进入首字母/全盲抽查 →</div>
        </div>
      `;
    })
    .join("");

  els.readingCanvas.innerHTML = `
    <div class="review-hub">
      <h3>📅 第 ${day.week} 周总复习（共 ${day.review_lessons.length} 课 · ${day.words} 词）</h3>
      <p style="color:var(--text-secondary); font-size:13.5px; line-height:1.65; margin-top:6px;">
        今天不加新负担！把本周 6 课切到<strong>「首字母」</strong>或<strong>「全盲默背」</strong>完整过一遍，通关后点击右上角完成打卡。
      </p>
      <div class="review-grid">${cardsHtml}</div>
      ${starredHtml}
    </div>
  `;

  els.readingCanvas.querySelectorAll("[data-jump-day]").forEach((el) => {
    el.addEventListener("click", async () => {
      const targetDay = Number(el.dataset.jumpDay);
      const targetSidx = el.dataset.jumpSidx ? Number(el.dataset.jumpSidx) : 0;
      await selectDay(targetDay);
      if (targetSidx > 0) jumpToSentence(targetSidx, true);
    });
  });
}

function toggleRevealSentence(sIdx) {
  if (state.revealedSents.has(sIdx)) state.revealedSents.delete(sIdx);
  else state.revealedSents.add(sIdx);
  renderActiveDayContent();
}

function toggleStarSentence(sIdx) {
  const day = getDayEntry(state.activeDayNum);
  if (day.type !== "learn") return;
  const key = String(day.lesson_num);
  const set = new Set(state.progress.starred_sentences[key] || []);
  if (set.has(sIdx)) set.delete(sIdx);
  else set.add(sIdx);
  state.progress.starred_sentences[key] = Array.from(set).sort((a, b) => a - b);
  saveProgress();
  renderActiveDayContent();
}

function toggleMasterSentence(sIdx) {
  const day = getDayEntry(state.activeDayNum);
  if (day.type !== "learn") return;
  const key = String(day.lesson_num);
  const set = new Set(state.progress.mastered_sentences[key] || []);
  if (set.has(sIdx)) set.delete(sIdx);
  else set.add(sIdx);
  state.progress.mastered_sentences[key] = Array.from(set).sort((a, b) => a - b);
  saveProgress();
  updateStatsAndHeader();
  renderActiveDayContent();
}

function clearShadowTimer() {
  if (state.shadowTimer) {
    clearTimeout(state.shadowTimer);
    state.shadowTimer = null;
  }
}

function updateMediaSession(day) {
  if (!("mediaSession" in navigator) || !day || day.type !== "learn") return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Day ${day.day} · 第 ${day.lesson_num} 课 (${day.words}词)`,
      artist: "Graham Greene · The End of the Affair",
      album: day.book_zh,
      artwork: [
        { src: "./icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
    navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
    navigator.mediaSession.setActionHandler("previoustrack", () => jumpToSentence(state.activeSentIdx - 1, true));
    navigator.mediaSession.setActionHandler("nexttrack", () => jumpToSentence(state.activeSentIdx + 1, true));
  } catch (e) {}
}

async function loadLessonAudio(lessonNum, autoPlay = false) {
  clearShadowTimer();
  els.audioEl.pause();
  state.alignment = null;
  state.audioLoading = true;
  setStatusText("⏳ 正在加载美式同步音频...");
  els.playPauseBtn.textContent = "⏳ 加载中";

  try {
    let alignment = null;
    const vkey = state.isStaticMode ? "us-male" : state.progress.voice_key;
    const padded = String(lessonNum).padStart(3, "0");

    if (state.isStaticMode) {
      const resp = await fetch(`./audio/${vkey}/lesson_${padded}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      alignment = await resp.json();
    } else {
      const resp = await fetch("./api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_num: lessonNum, voice_key: vkey }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "音频合成失败");
      alignment = data.alignment;
    }

    const curDay = getDayEntry(state.activeDayNum);
    if (curDay.lesson_num !== lessonNum) return;

    // Normalize mp3_url to relative path so GitHub Pages subpath works seamlessly
    const relMp3Url = (alignment.mp3_url || `./audio/${vkey}/lesson_${padded}.mp3`).replace(/^\//, "./");
    alignment.mp3_url = relMp3Url;

    state.alignment = alignment;
    state.audioLoading = false;

    if (!state.isStaticMode) {
      const vList = state.cachedAudio[vkey] || [];
      if (!vList.includes(lessonNum)) {
        vList.push(lessonNum);
        state.cachedAudio[vkey] = vList;
        updateStatsAndHeader();
        renderSidebarList();
      }
    }

    els.audioEl.src = relMp3Url;
    els.audioEl.playbackRate = Number(els.speedSelect.value || 1);
    els.downloadMp3Btn.href = relMp3Url;
    els.downloadMp3Btn.download = `The_End_of_the_Affair_Day${curDay.day}_Lesson${lessonNum}.mp3`;

    els.durTimeLbl.textContent = fmtTime(state.alignment.duration_ms);
    els.curTimeLbl.textContent = "00:00";
    els.timelineProgress.style.width = "0%";
    renderTimelineTicks();
    updateMediaSession(curDay);

    setStatusText(`🎧 美式同步就绪 · 第 ${lessonNum} 课`);
    els.playPauseBtn.textContent = "▶ 播放";

    if (autoPlay) {
      jumpToSentence(state.activeSentIdx, true);
    }
  } catch (err) {
    state.audioLoading = false;
    setStatusText(`⚠️ 音频加载失败: ${err.message}`);
    els.playPauseBtn.textContent = "▶ 重试";
  }
}

function renderTimelineTicks() {
  els.timelineTicks.innerHTML = "";
  if (!state.alignment || !state.alignment.duration_ms) return;
  const dur = state.alignment.duration_ms;
  for (const s of state.alignment.sentences) {
    if (s.start_ms <= 0) continue;
    const tick = document.createElement("div");
    tick.className = "sent-tick";
    tick.style.left = `${((s.start_ms / dur) * 100).toFixed(2)}%`;
    els.timelineTicks.appendChild(tick);
  }
}

function setActiveSentenceVisual(sIdx, scrollIntoView = true) {
  if (state.activeSentIdx !== sIdx) {
    state.activeSentIdx = sIdx;
    state.sentPlayCount = 0;
    state.handledSentEndForPass = -1;
  }

  els.readingCanvas.querySelectorAll(".sent-span.active, .sent-card.active").forEach((el) => {
    el.classList.remove("active");
  });

  const span = els.readingCanvas.querySelector(`.sent-span[data-sidx="${sIdx}"]`);
  const card = els.readingCanvas.querySelector(`.sent-card[data-card-sidx="${sIdx}"]`);
  if (span) span.classList.add("active");
  if (card) card.classList.add("active");

  updateMobileThumbBarState();

  const target = card || span;
  if (scrollIntoView && target) {
    const rect = target.getBoundingClientRect();
    const containerRect = els.readingScroll.getBoundingClientRect();
    if (rect.top < containerRect.top + 50 || rect.bottom > containerRect.bottom - 70) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function setActiveWordVisual(sIdx, wIdx) {
  if (state.activeWordIdx === wIdx && state.activeSentIdx === sIdx) return;
  state.activeWordIdx = wIdx;
  els.readingCanvas.querySelectorAll(".word-tok.speaking").forEach((el) => {
    el.classList.remove("speaking");
  });
  if (wIdx >= 0) {
    const wEl = els.readingCanvas.querySelector(`.word-tok[data-sidx="${sIdx}"][data-widx="${wIdx}"]`);
    if (wEl) wEl.classList.add("speaking");
  }
}

function jumpToSentence(sIdx, shouldPlay = true) {
  const day = getDayEntry(state.activeDayNum);
  if (day.type !== "learn") return;
  const maxIdx = day.sentences.length - 1;
  const clamped = Math.max(0, Math.min(maxIdx, sIdx));

  clearShadowTimer();
  state.sentPlayCount = 0;
  state.handledSentEndForPass = -1;
  setActiveSentenceVisual(clamped, true);

  if (!state.alignment) {
    if (shouldPlay && !state.audioLoading) {
      loadLessonAudio(day.lesson_num, true);
    }
    return;
  }

  const alignSent = state.alignment.sentences[clamped];
  if (alignSent) {
    els.audioEl.currentTime = Math.max(0, (alignSent.start_ms - 20) / 1000);
    if (shouldPlay) {
      els.audioEl.playbackRate = Number(els.speedSelect.value || 1);
      els.audioEl.play().catch(() => {});
    }
  }
}

function getShadowPauseMs(alignSent) {
  const val = els.shadowPauseSelect.value;
  if (val === "0") return 0;
  if (val === "2") return 2000;
  const dur = Math.max(800, alignSent.end_ms - alignSent.start_ms);
  if (val === "1x") return Math.round(dur * 1.0);
  if (val === "1.3x") return Math.round(dur * 1.3);
  return 0;
}

function syncLoop() {
  if (state.alignment && !els.audioEl.paused && !state.shadowTimer) {
    const tMs = els.audioEl.currentTime * 1000;
    const dur = state.alignment.duration_ms || els.audioEl.duration * 1000 || 1;
    els.curTimeLbl.textContent = fmtTime(tMs);
    els.timelineProgress.style.width = `${Math.min(100, (tMs / dur) * 100).toFixed(2)}%`;

    const repeatMode = els.repeatModeSelect.value;
    const shadowVal = els.shadowPauseSelect.value;
    const curSent = state.alignment.sentences[state.activeSentIdx];

    if (curSent && (repeatMode !== "seq" || shadowVal !== "0")) {
      if (tMs >= curSent.end_ms - 15 && state.handledSentEndForPass !== state.sentPlayCount) {
        state.handledSentEndForPass = state.sentPlayCount;
        state.sentPlayCount += 1;
        const targetReps = repeatMode === "one" ? Infinity : repeatMode === "rep2" ? 2 : repeatMode === "rep3" ? 3 : 1;
        const pauseMs = getShadowPauseMs(curSent);

        const proceedNextAction = () => {
          state.shadowTimer = null;
          if (state.sentPlayCount < targetReps) {
            state.handledSentEndForPass = -1;
            els.audioEl.currentTime = Math.max(0, (curSent.start_ms - 20) / 1000);
            setStatusText(
              repeatMode === "one"
                ? `🔁 单句循环中 · 第 ${state.activeSentIdx + 1} 句`
                : `🔁 第 ${state.activeSentIdx + 1} 句 (${state.sentPlayCount + 1}/${targetReps}遍)`
            );
            els.audioEl.play().catch(() => {});
          } else {
            const nextIdx = state.activeSentIdx + 1;
            if (nextIdx < state.alignment.sentences.length) {
              state.sentPlayCount = 0;
              state.handledSentEndForPass = -1;
              setActiveSentenceVisual(nextIdx, true);
              const nextSent = state.alignment.sentences[nextIdx];
              els.audioEl.currentTime = Math.max(0, (nextSent.start_ms - 15) / 1000);
              setStatusText(`🎧 正在朗读 · 第 ${nextIdx + 1}/${state.alignment.sentences.length} 句`);
              els.audioEl.play().catch(() => {});
            } else {
              els.audioEl.pause();
              setStatusText("✨ 本课朗读完毕！");
            }
          }
        };

        if (pauseMs > 0) {
          els.audioEl.pause();
          setStatusText(`🎤 留白 ${(pauseMs / 1000).toFixed(1)}s · 请开口背第 ${state.activeSentIdx + 1} 句`);
          state.shadowTimer = setTimeout(proceedNextAction, pauseMs);
          requestAnimationFrame(syncLoop);
          return;
        } else {
          proceedNextAction();
          requestAnimationFrame(syncLoop);
          return;
        }
      }
    } else if (state.alignment.sentences.length > 0) {
      let foundIdx = state.activeSentIdx;
      const sents = state.alignment.sentences;
      for (let i = 0; i < sents.length; i++) {
        const nextStart = i + 1 < sents.length ? sents[i + 1].start_ms : Infinity;
        if (tMs >= sents[i].start_ms - 40 && tMs < nextStart - 20) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== state.activeSentIdx) {
        setActiveSentenceVisual(foundIdx, true);
        setStatusText(`🎧 正在朗读 · 第 ${foundIdx + 1}/${sents.length} 句`);
      }
    }

    const activeAlign = state.alignment.sentences[state.activeSentIdx];
    if (activeAlign && activeAlign.words) {
      let wFound = -1;
      for (let w = 0; w < activeAlign.words.length; w++) {
        const wd = activeAlign.words[w];
        if (tMs >= wd.start_ms - 25 && tMs <= wd.end_ms + 45) {
          wFound = w;
          break;
        }
      }
      setActiveWordVisual(state.activeSentIdx, wFound);
    }
  }

  requestAnimationFrame(syncLoop);
}

async function selectDay(dayNum) {
  clearShadowTimer();
  els.audioEl.pause();
  state.activeDayNum = dayNum;
  state.activeSentIdx = 0;
  state.activeWordIdx = -1;
  state.sentPlayCount = 0;
  state.handledSentEndForPass = -1;
  state.revealedSents.clear();
  state.progress.current_day = dayNum;
  saveProgress();

  renderSidebarList();
  renderActiveDayContent();
  els.readingScroll.scrollTop = 0;

  const activeNav = els.dayList.querySelector(`.day-item[data-day="${dayNum}"]`);
  if (activeNav) activeNav.scrollIntoView({ block: "nearest" });

  const day = getDayEntry(dayNum);
  if (day.type === "learn") {
    await loadLessonAudio(day.lesson_num, false);
  }
}

function togglePlayPause() {
  const day = getDayEntry(state.activeDayNum);
  if (day.type !== "learn") return;

  if (state.shadowTimer) {
    clearShadowTimer();
    setStatusText("⏸ 已暂停");
    els.playPauseBtn.textContent = "▶ 继续";
    return;
  }

  if (!state.alignment) {
    loadLessonAudio(day.lesson_num, true);
    return;
  }

  if (els.audioEl.paused) {
    els.audioEl.playbackRate = Number(els.speedSelect.value || 1);
    els.audioEl.play().catch(() => {});
  } else {
    els.audioEl.pause();
  }
}

function setMode(newMode) {
  state.mode = newMode;
  state.revealedSents.clear();
  document.querySelectorAll(".mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === newMode);
  });
  renderActiveDayContent();
}

function setupPwaInstall() {
  // Hide install button if already running inside installed standalone WebAPK
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) {
    els.installPwaBtn.classList.add("hidden");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    els.installPwaBtn.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    els.installPwaBtn.classList.add("hidden");
  });

  els.installPwaBtn.addEventListener("click", async () => {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
    } else {
      els.installModal.classList.remove("hidden");
    }
  });

  els.closeInstallModalBtn.addEventListener("click", () => els.installModal.classList.add("hidden"));
  els.installModal.addEventListener("click", (e) => {
    if (e.target === els.installModal) els.installModal.classList.add("hidden");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  els.toggleSidebarBtn.addEventListener("click", () => {
    if (isMobileViewport()) {
      if (els.sidebar.classList.contains("mobile-open")) closeMobileDrawer();
      else openMobileDrawer();
    } else {
      els.sidebar.classList.toggle("collapsed");
    }
  });

  els.closeDrawerBtn.addEventListener("click", closeMobileDrawer);
  els.sidebarBackdrop.addEventListener("click", closeMobileDrawer);

  els.themeToggleBtn.addEventListener("click", () => {
    const html = document.documentElement;
    const next = html.dataset.theme === "dark" ? "light" : "dark";
    html.dataset.theme = next;
    els.themeToggleBtn.textContent = next === "dark" ? "☀️" : "🌙";
    if (els.metaThemeColor) els.metaThemeColor.content = next === "dark" ? "#1e1c19" : "#7b2e21";
    localStorage.setItem("eota_theme", next);
  });

  els.startDateInput.addEventListener("change", () => {
    state.progress.start_date = els.startDateInput.value || "2026-11-26";
    saveProgress();
    updateStatsAndHeader();
    renderSidebarList();
    renderActiveDayContent();
  });

  els.bookTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.bookFilter = btn.dataset.book;
      els.bookTabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderSidebarList();
    });
  });

  els.jumpCurrentBtn.addEventListener("click", () => {
    const nextDay = state.plan.days.find((d) => !state.progress.completed_days[d.day]);
    selectDay(nextDay ? nextDay.day : 1);
    if (isMobileViewport()) closeMobileDrawer();
  });

  els.pregenBtn.addEventListener("click", async () => {
    if (state.isStaticMode) return;
    els.pregenBtn.disabled = true;
    await fetch("./api/pregenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_key: state.progress.voice_key }),
    });
    startPregenPolling();
  });

  // Progress Backup / Sync modal
  els.backupProgressBtn.addEventListener("click", () => {
    els.syncJsonArea.value = JSON.stringify(state.progress);
    els.syncModal.classList.remove("hidden");
  });
  els.closeSyncModalBtn.addEventListener("click", () => els.syncModal.classList.add("hidden"));
  els.syncModal.addEventListener("click", (e) => {
    if (e.target === els.syncModal) els.syncModal.classList.add("hidden");
  });
  els.copySyncBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.syncJsonArea.value);
      els.copySyncBtn.textContent = "✓ 已复制";
      setTimeout(() => (els.copySyncBtn.textContent = "📋 复制当前进度码"), 1600);
    } catch (e) {
      els.syncJsonArea.select();
    }
  });
  els.importSyncBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(els.syncJsonArea.value.trim());
      if (parsed && typeof parsed === "object") {
        state.progress = { ...state.progress, ...parsed };
        saveProgress();
        updateStatsAndHeader();
        renderSidebarList();
        renderActiveDayContent();
        els.syncModal.classList.add("hidden");
      }
    } catch (e) {
      alert("进度码格式有误，请粘贴完整的 JSON 进度码");
    }
  });

  els.layoutSwitchWrap.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.layout = btn.dataset.layout;
      els.layoutSwitchWrap.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderActiveDayContent();
    });
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  els.onlyStarredToggle.addEventListener("change", () => {
    state.onlyStarred = els.onlyStarredToggle.checked;
    renderActiveDayContent();
  });

  els.revealAllTempBtn.addEventListener("click", () => {
    state.revealAll = !state.revealAll;
    els.revealAllTempBtn.textContent = state.revealAll ? "🙈 恢复遮挡" : "👁 全显影";
    renderActiveDayContent();
  });

  els.checkinBtn.addEventListener("click", () => {
    const dNum = state.activeDayNum;
    if (state.progress.completed_days[dNum]) {
      delete state.progress.completed_days[dNum];
    } else {
      state.progress.completed_days[dNum] = new Date().toISOString();
    }
    saveProgress();
    updateStatsAndHeader();
    renderSidebarList();
    renderActiveDayContent();
  });

  // Mobile One-Thumb Bar actions
  els.mRevealBtn.addEventListener("click", () => toggleRevealSentence(state.activeSentIdx));
  els.mLoopBtn.addEventListener("click", () => {
    els.repeatModeSelect.value = els.repeatModeSelect.value === "one" ? "seq" : "one";
    setStatusText(els.repeatModeSelect.value === "one" ? "🔁 已开启单句循环" : "▶️ 已切换为顺序连播");
    renderActiveDayContent();
  });
  els.mStarBtn.addEventListener("click", () => toggleStarSentence(state.activeSentIdx));
  els.mMasterBtn.addEventListener("click", () => toggleMasterSentence(state.activeSentIdx));

  // Audio controls
  els.playPauseBtn.addEventListener("click", togglePlayPause);
  els.prevSentBtn.addEventListener("click", () => jumpToSentence(state.activeSentIdx - 1, true));
  els.nextSentBtn.addEventListener("click", () => jumpToSentence(state.activeSentIdx + 1, true));
  els.prevDayBtn.addEventListener("click", () => {
    if (state.activeDayNum > 1) selectDay(state.activeDayNum - 1);
  });
  els.nextDayBtn.addEventListener("click", () => {
    if (state.activeDayNum < state.plan.summary.total_calendar_days) {
      selectDay(state.activeDayNum + 1);
    }
  });

  els.repeatModeSelect.addEventListener("change", updateMobileThumbBarState);

  els.speedSelect.addEventListener("change", () => {
    els.audioEl.playbackRate = Number(els.speedSelect.value || 1);
  });

  els.voiceSelect.addEventListener("change", () => {
    state.progress.voice_key = els.voiceSelect.value;
    saveProgress();
    updateStatsAndHeader();
    renderSidebarList();
    const curDay = getDayEntry(state.activeDayNum);
    if (curDay.type === "learn") {
      loadLessonAudio(curDay.lesson_num, false);
    }
  });

  els.timelineTrack.addEventListener("click", (e) => {
    if (!state.alignment || !state.alignment.duration_ms) return;
    const rect = els.timelineTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetMs = ratio * state.alignment.duration_ms;
    clearShadowTimer();
    els.audioEl.currentTime = targetMs / 1000;
    let sIdx = 0;
    for (let i = 0; i < state.alignment.sentences.length; i++) {
      if (targetMs >= state.alignment.sentences[i].start_ms - 50) sIdx = i;
    }
    setActiveSentenceVisual(sIdx, true);
  });

  els.audioEl.addEventListener("play", () => {
    els.playPauseBtn.textContent = "⏸ 暂停";
    setStatusText(`🎧 正在朗读 · 第 ${state.activeSentIdx + 1} 句`);
  });

  els.audioEl.addEventListener("pause", () => {
    if (!state.shadowTimer) {
      els.playPauseBtn.textContent = "▶ 播放";
    }
  });

  els.audioEl.addEventListener("ended", () => {
    els.playPauseBtn.textContent = "▶ 重播";
    setActiveWordVisual(state.activeSentIdx, -1);
    setStatusText("✨ 本课朗读完毕！");
  });

  els.shortcutsHelpBtn.addEventListener("click", () => els.shortcutsModal.classList.remove("hidden"));
  els.closeModalBtn.addEventListener("click", () => els.shortcutsModal.classList.add("hidden"));
  els.shortcutsModal.addEventListener("click", (e) => {
    if (e.target === els.shortcutsModal) els.shortcutsModal.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      jumpToSentence(state.activeSentIdx - 1, true);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      jumpToSentence(state.activeSentIdx + 1, true);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      jumpToSentence(state.activeSentIdx, true);
    } else if (e.key === "l" || e.key === "L") {
      e.preventDefault();
      els.repeatModeSelect.value = els.repeatModeSelect.value === "one" ? "seq" : "one";
      setStatusText(els.repeatModeSelect.value === "one" ? "🔁 已开启单句循环" : "▶️ 已切换为顺序连播");
      renderActiveDayContent();
    } else if (e.code === "Tab") {
      e.preventDefault();
      toggleRevealSentence(state.activeSentIdx);
    } else if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      toggleStarSentence(state.activeSentIdx);
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMasterSentence(state.activeSentIdx);
    } else if (["1", "2", "3", "4"].includes(e.key)) {
      const map = { "1": "full", "2": "cloze", "3": "first", "4": "blind" };
      setMode(map[e.key]);
    }
  });
}

function startPregenPolling() {
  if (state.pregenPollTimer) clearInterval(state.pregenPollTimer);
  state.pregenPollTimer = setInterval(async () => {
    try {
      const r = await fetch("./api/pregenerate/status");
      const st = await r.json();
      state.cachedAudio = st.cached_audio || state.cachedAudio;
      updateStatsAndHeader();
      renderSidebarList();
      if (st.running) {
        els.pregenBtn.innerHTML = `⚡ 合成中 (<span id="cachedCount">${st.done}/${st.total}</span>)`;
        els.cachedCount = document.getElementById("cachedCount");
        els.pregenBtn.disabled = true;
      } else {
        els.pregenBtn.innerHTML = `⚡ 缓存全书 (<span id="cachedCount">${st.done}/${st.total}</span>)`;
        els.cachedCount = document.getElementById("cachedCount");
        els.pregenBtn.disabled = false;
        clearInterval(state.pregenPollTimer);
        state.pregenPollTimer = null;
      }
    } catch (e) {
      clearInterval(state.pregenPollTimer);
    }
  }, 3000);
}

async function init() {
  const savedTheme = localStorage.getItem("eota_theme");
  if (savedTheme === "dark") {
    document.documentElement.dataset.theme = "dark";
    els.themeToggleBtn.textContent = "☀️";
    if (els.metaThemeColor) els.metaThemeColor.content = "#1e1c19";
  }

  setupPwaInstall();

  // Try local backend API first; automatically switch to static GitHub Pages mode if no Python backend
  let loadedFromServer = false;
  try {
    const res = await fetch("./api/plan");
    if (res.ok && (res.headers.get("content-type") || "").includes("application/json")) {
      const planRes = await res.json();
      const progRes = await fetch("./api/progress").then((r) => r.json());
      state.plan = planRes.plan;
      state.voices = planRes.voices;
      state.cachedAudio = planRes.cached_audio || {};
      state.progress = { ...state.progress, ...progRes };
      state.isStaticMode = false;
      loadedFromServer = true;
      els.backupProgressBtn.classList.remove("hidden");
      if (planRes.pregen && planRes.pregen.running) {
        startPregenPolling();
      }
    }
  } catch (e) {}

  if (!loadedFromServer) {
    state.isStaticMode = true;
    els.pregenBtn.classList.add("hidden");
    els.backupProgressBtn.classList.remove("hidden");
    state.plan = await fetch("./data/book_plan.json").then((r) => r.json());
    state.voices = STATIC_VOICES;
    try {
      const savedLocal = localStorage.getItem("eota_progress_v1") || localStorage.getItem("eota_progress_backup");
      if (savedLocal) {
        state.progress = { ...state.progress, ...JSON.parse(savedLocal) };
      }
    } catch (e) {}
    state.progress.voice_key = "us-male";
  }

  state.activeDayNum = state.progress.current_day || 1;

  renderVoiceSelector();
  updateStatsAndHeader();
  bindEvents();
  await selectDay(state.activeDayNum);

  requestAnimationFrame(syncLoop);
}

init();
