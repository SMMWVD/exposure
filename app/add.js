const form = document.querySelector("#eventForm");
const status = document.querySelector("#formStatus");
const manageResult = document.querySelector("#manageResult");
const myEvents = document.querySelector("#myEvents");
const refreshMine = document.querySelector("#refreshMine");
const dateInput = form.elements.date;
const studentInput = form.elements.student;

dateInput.valueAsDate = new Date();
studentInput.value = localStorage.getItem("expoStudentName") || "";

function normalizeTimeInput(input) {
  const digits = input.value.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 4) input.value = `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

form.elements.start.addEventListener("blur", () => normalizeTimeInput(form.elements.start));
form.elements.end.addEventListener("blur", () => normalizeTimeInput(form.elements.end));
studentInput.addEventListener("input", () => {
  localStorage.setItem("expoStudentName", studentInput.value.trim());
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Wordt opgeslagen...";
  manageResult.hidden = true;

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.repeat = form.elements.repeat.checked ? "yes" : "";

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Opslaan is niet gelukt.");

    const previousDate = dateInput.value;
    const previousStudent = studentInput.value;
    form.reset();
    dateInput.value = previousDate;
    studentInput.value = previousStudent;
    localStorage.setItem("expoStudentName", previousStudent.trim());
    status.textContent = result.events?.length > 1
      ? `${result.events.length} performances opgeslagen.`
      : "Opgeslagen. Je performance staat op het bord.";
    manageResult.hidden = false;
    manageResult.innerHTML = `
      <strong>Opgeslagen</strong>
      <p>Je kunt je performances hieronder aanpassen door dezelfde naam te gebruiken.</p>
    `;
    await loadMine();
  } catch (error) {
    status.textContent = error.message;
  }
});

refreshMine.addEventListener("click", loadMine);

async function loadMine() {
  const student = studentInput.value.trim();
  if (!student) {
    myEvents.innerHTML = `<p class="helper-text">Vul eerst je naam in.</p>`;
    return;
  }

  const response = await fetch(`/api/events?student=${encodeURIComponent(student)}&v=${Date.now()}`, {
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    myEvents.innerHTML = `<p class="helper-text">${data.error || "Laden is niet gelukt."}</p>`;
    return;
  }

  if (!data.events.length) {
    myEvents.innerHTML = `<p class="helper-text">Nog geen performances op jouw naam.</p>`;
    return;
  }

  myEvents.innerHTML = "";
  data.events.forEach((event) => {
    const item = document.createElement("article");
    item.className = "manage-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.date)} ${escapeHtml(event.start)}-${escapeHtml(event.end)} · ${escapeHtml(event.location)}</span>
      </div>
      <button class="danger-button small-button" type="button">Verwijder</button>
    `;
    item.querySelector("button").addEventListener("click", async () => {
      await deleteMine(event.id, student);
    });
    myEvents.append(item);
  });
}

async function deleteMine(id, student) {
  const response = await fetch(`/api/events/${encodeURIComponent(id)}?student=${encodeURIComponent(student)}`, {
    method: "DELETE",
  });
  const result = await response.json();
  status.textContent = response.ok ? "Performance verwijderd." : result.error || "Verwijderen is niet gelukt.";
  await loadMine();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

await loadMine();
