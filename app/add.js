const form = document.querySelector("#eventForm");
const status = document.querySelector("#formStatus");
const manageResult = document.querySelector("#manageResult");
const dateInput = form.elements.date;

dateInput.valueAsDate = new Date();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Wordt opgeslagen...";
  manageResult.hidden = true;

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Opslaan is niet gelukt.");

    const previousDate = dateInput.value;
    form.reset();
    dateInput.value = previousDate;
    status.textContent = "Opgeslagen. Je performance staat op het bord.";
    manageResult.hidden = false;
    manageResult.innerHTML = `
      <strong>Bewaar deze beheerlink</strong>
      <p>Met deze link kun je jouw performance later verwijderen.</p>
      <a href="${result.manageUrl}">${window.location.origin}${result.manageUrl}</a>
    `;
  } catch (error) {
    status.textContent = error.message;
  }
});
