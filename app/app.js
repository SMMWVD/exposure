const eventsUrl = "/api/events";
const scheduleUrl = "./schedule.csv";
const refreshMs = 10_000;

let events = [];

const elements = {
  today: document.querySelector("#today"),
  now: document.querySelector("#now"),
  timelineWrap: document.querySelector(".timeline-wrap"),
  timeline: document.querySelector("#timeline"),
  lastUpdated: document.querySelector("#lastUpdated"),
  signupDialog: document.querySelector("#signupDialog"),
  signupForm: document.querySelector("#boardSignupForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMeta: document.querySelector("#dialogMeta"),
  dialogStatus: document.querySelector("#dialogStatus"),
  dialogSubmit: document.querySelector("#dialogSubmit"),
  dialogClose: document.querySelector(".dialog-close"),
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function toDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function normalizeEvent(event) {
  return {
    ...event,
    capacity: Number.parseInt(event.capacity || "0", 10) || 0,
    registered: Number.parseInt(event.registered || "0", 10) || 0,
    available:
      event.available === null || event.available === undefined
        ? null
        : Number.parseInt(event.available || "0", 10) || 0,
    isFull: Boolean(event.isFull),
    startsAt: toDateTime(event.date, event.start),
    endsAt: toDateTime(event.date, event.end),
  };
}

function formatTime(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function spotsLabel(count) {
  return `${count} ${count === 1 ? "plek" : "plekken"} vrij`;
}

function signupLabel(event) {
  if (!event.capacity) return "Geen inschrijving nodig";
  if (event.isFull) return "Vol";
  return "Tik om in te schrijven";
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getScheduleRange(visibleEvents) {
  if (!visibleEvents.length) return { start: 9 * 60, end: 18 * 60 };

  const starts = visibleEvents.map((event) => timeToMinutes(event.start));
  const ends = visibleEvents.map((event) => timeToMinutes(event.end));
  return {
    start: Math.max(0, Math.floor((Math.min(...starts) - 30) / 30) * 30),
    end: Math.min(24 * 60, Math.ceil((Math.max(...ends) + 30) / 30) * 30),
  };
}

function getTodayEvents(now) {
  return events.filter((event) => isSameDay(event.startsAt, now));
}

function getCurrentEvent(now, visibleEvents) {
  return visibleEvents.find((event) => event.startsAt <= now && event.endsAt > now);
}

function renderTimeline(now, visibleEvents, currentEvent, nextEvent) {
  elements.timeline.innerHTML = "";
  if (!visibleEvents.length) {
    elements.timeline.innerHTML = `<div class="empty">Nog geen performances gepland</div>`;
    return;
  }

  const slotMinutes = 15;
  const majorSlotMinutes = 30;
  const range = getScheduleRange(visibleEvents);
  const slotCount = Math.max(1, Math.ceil((range.end - range.start) / slotMinutes));
  const performanceRows = [...new Set(visibleEvents.map((event) => event.title || "Performance"))];
  const stageLabelWidth = 220;
  const gridTemplateColumns = `${stageLabelWidth}px repeat(${slotCount}, minmax(46px, 1fr))`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const nowPercent = ((nowMinutes - range.start) / (range.end - range.start)) * 100;
  const showNowMarker = nowMinutes >= range.start && nowMinutes <= range.end;

  elements.timeline.className = "timeline timetable";
  elements.timeline.style.setProperty("--schedule-columns", gridTemplateColumns);
  elements.timeline.style.setProperty("--stage-label-width", `${stageLabelWidth}px`);

  const corner = document.createElement("div");
  corner.className = "time-corner";
  corner.textContent = "Performance";
  elements.timeline.append(corner);

  for (let minute = range.start; minute < range.end; minute += slotMinutes) {
    const cell = document.createElement("div");
    const isMajor = minute % majorSlotMinutes === 0;
    cell.className = `time-cell${isMajor ? " is-major" : ""}`;
    cell.textContent = minutesToTime(minute);
    elements.timeline.append(cell);
  }

  performanceRows.forEach((title) => {
    const rowEvents = visibleEvents.filter((event) => (event.title || "Performance") === title);
    const label = document.createElement("div");
    label.className = "stage-label";
    label.textContent = title;
    elements.timeline.append(label);

    const row = document.createElement("div");
    row.className = "stage-row";
    row.style.gridTemplateColumns = `repeat(${slotCount}, minmax(42px, 1fr))`;
    row.style.setProperty("--slot-count", slotCount);

    rowEvents.forEach((event) => {
      const startColumn = Math.max(1, Math.floor((timeToMinutes(event.start) - range.start) / slotMinutes) + 1);
      const endColumn = Math.max(startColumn + 1, Math.ceil((timeToMinutes(event.end) - range.start) / slotMinutes) + 1);
      const article = document.createElement("article");
      const stateClass =
        event === currentEvent ? "is-current" : event === nextEvent ? "is-next" : event.endsAt <= now ? "is-past" : "";

      article.className = `event-block ${stateClass} ${event.isFull ? "is-full" : ""}`.trim();
      article.style.gridColumn = `${startColumn} / ${endColumn}`;
      article.dataset.eventId = event.id;
      article.tabIndex = event.capacity && !event.isFull ? 0 : -1;
      article.setAttribute("role", event.capacity && !event.isFull ? "button" : "article");
      article.setAttribute("aria-label", `${event.title}, ${signupLabel(event)}`);
      article.innerHTML = `
        <strong>${escapeHtml(event.location)}</strong>
        <span>${escapeHtml(event.start)}-${escapeHtml(event.end)}</span>
        <span>${event.isFull ? "vol" : event.capacity ? escapeHtml(spotsLabel(event.available)) : escapeHtml(event.student)}</span>
      `;

      if (event.capacity && !event.isFull) {
        article.addEventListener("click", () => openSignupDialog(event.id));
        article.addEventListener("keydown", (keyboardEvent) => {
          if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
            keyboardEvent.preventDefault();
            openSignupDialog(event.id);
          }
        });
      }

      row.append(article);
    });

    elements.timeline.append(row);
  });

  const bottomCorner = document.createElement("div");
  bottomCorner.className = "time-corner time-corner-bottom";
  bottomCorner.textContent = "";
  elements.timeline.append(bottomCorner);

  for (let minute = range.start; minute < range.end; minute += slotMinutes) {
    const cell = document.createElement("div");
    const isMajor = minute % majorSlotMinutes === 0;
    cell.className = `time-cell time-cell-bottom${isMajor ? " is-major" : ""}`;
    cell.textContent = minutesToTime(minute);
    elements.timeline.append(cell);
  }

  if (showNowMarker) {
    const marker = document.createElement("div");
    marker.className = "now-marker";
    marker.innerHTML = `<span>${formatTime(now)}</span>`;
    elements.timeline.append(marker);

    requestAnimationFrame(() => {
      const tableWidth = elements.timeline.getBoundingClientRect().width;
      const markerLeft = stageLabelWidth + (tableWidth - stageLabelWidth) * (nowPercent / 100);
      marker.style.left = `${markerLeft}px`;
    });
  }

  if (showNowMarker) {
    requestAnimationFrame(() => {
      const maxScroll = elements.timelineWrap.scrollWidth - elements.timelineWrap.clientWidth;
      const target = maxScroll * (nowPercent / 100) - elements.timelineWrap.clientWidth * 0.18;
      elements.timelineWrap.scrollLeft = Math.max(0, Math.min(maxScroll, target));
    });
  }
}

function openSignupDialog(eventId) {
  const event = events.find((item) => item.id === eventId);
  if (!event || event.isFull || !event.capacity) return;

  elements.signupForm.reset();
  elements.signupForm.elements.eventId.value = event.id;
  elements.dialogTitle.textContent = event.title;
  elements.dialogMeta.innerHTML = `
    <span>${escapeHtml(event.date)} ${escapeHtml(event.start)}-${escapeHtml(event.end)}</span>
    <span>${escapeHtml(event.student)}</span>
    <span>${escapeHtml(event.location)}</span>
    <span>${escapeHtml(spotsLabel(event.available))}</span>
  `;
  elements.dialogStatus.textContent = "";
  elements.dialogSubmit.disabled = false;
  elements.dialogSubmit.textContent = "Inschrijven";
  elements.signupDialog.showModal();
  elements.signupForm.elements.name.focus();
}

function closeSignupDialog() {
  elements.signupDialog.close();
}

async function submitBoardSignup(event) {
  event.preventDefault();
  elements.dialogStatus.textContent = "Wordt ingeschreven...";
  elements.dialogSubmit.disabled = true;

  try {
    const payload = Object.fromEntries(new FormData(elements.signupForm).entries());
    const response = await fetch("/api/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Inschrijven is niet gelukt.");

    elements.dialogStatus.textContent = "Je bent ingeschreven.";
    elements.dialogSubmit.textContent = "Gelukt";
    await loadSchedule();
    setTimeout(() => {
      if (elements.signupDialog.open) closeSignupDialog();
    }, 1400);
  } catch (error) {
    elements.dialogStatus.textContent = error.message;
    elements.dialogSubmit.disabled = false;
  }
}

function render() {
  const now = new Date();
  const visibleEvents = getTodayEvents(now);
  const currentEvent = getCurrentEvent(now, visibleEvents);
  const nextEvent = visibleEvents.find((event) => event.startsAt > now);

  elements.today.textContent = formatDate(now);
  elements.now.textContent = formatTime(now);
  renderTimeline(now, visibleEvents, currentEvent, nextEvent);
}

async function loadSchedule() {
  try {
    let loadedFromApi = false;

    if (window.location.protocol !== "file:") {
      try {
        const apiResponse = await fetch(`${eventsUrl}?v=${Date.now()}`, { cache: "no-store" });
        if (apiResponse.ok) {
          const data = await apiResponse.json();
          events = data.events.map(normalizeEvent).sort((a, b) => a.startsAt - b.startsAt);
          loadedFromApi = true;
        }
      } catch (error) {
        console.warn(error);
      }
    }

    if (!loadedFromApi) {
      const response = await fetch(`${scheduleUrl}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const csv = await response.text();
      events = parseCsv(csv)
        .filter((event) => event.date && event.start && event.end && event.title)
        .map(normalizeEvent)
        .sort((a, b) => a.startsAt - b.startsAt);
    }

    if (elements.lastUpdated) elements.lastUpdated.textContent = `Bijgewerkt om ${formatTime(new Date())}`;
    render();
  } catch (error) {
    if (elements.lastUpdated) elements.lastUpdated.textContent = "Kan schedule.csv niet laden";
    elements.timeline.innerHTML = `<div class="empty">Controleer of de lokale server draait.</div>`;
    console.error(error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

await loadSchedule();
elements.signupForm.addEventListener("submit", submitBoardSignup);
elements.dialogClose.addEventListener("click", closeSignupDialog);
elements.signupDialog.addEventListener("click", (event) => {
  if (event.target === elements.signupDialog) closeSignupDialog();
});
setInterval(loadSchedule, refreshMs);
setInterval(render, 1_000);
