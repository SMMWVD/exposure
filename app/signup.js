const form = document.querySelector("#signupForm");
const select = form.elements.eventId;
const status = document.querySelector("#signupStatus");
const list = document.querySelector("#signupList");

function eventLabel(event) {
  const space = event.isFull ? "vol" : spotsLabel(event.available);
  return `${event.date} ${event.start} - ${event.title} (${space})`;
}

function spotsLabel(count) {
  return `${count} ${count === 1 ? "plek" : "plekken"} vrij`;
}

async function loadEvents() {
  const response = await fetch(`/api/events?v=${Date.now()}`, { cache: "no-store" });
  const data = await response.json();
  const events = data.events.filter((event) => event.capacity > 0);

  select.innerHTML = "";
  list.innerHTML = "";

  events.forEach((event) => {
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = eventLabel(event);
    option.disabled = event.isFull;
    select.append(option);

    const card = document.createElement("article");
    card.className = `signup-card${event.isFull ? " is-full" : ""}`;
    card.innerHTML = `
      <strong>${escapeHtml(event.title)}</strong>
      <span>${escapeHtml(event.date)} ${escapeHtml(event.start)}-${escapeHtml(event.end)}</span>
      <span>${escapeHtml(event.location)} · ${escapeHtml(event.student)}</span>
      <span>${event.isFull ? "Vol" : `${event.available} van ${event.capacity} ${event.capacity === 1 ? "plek" : "plekken"} vrij`}</span>
    `;
    list.append(card);
  });

  if (!events.some((event) => !event.isFull)) {
    status.textContent = "Er zijn nu geen beschikbare plekken.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Wordt ingeschreven...";

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Inschrijven is niet gelukt.");
    form.reset();
    status.textContent = "Je bent ingeschreven.";
    await loadEvents();
  } catch (error) {
    status.textContent = error.message;
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

await loadEvents();
