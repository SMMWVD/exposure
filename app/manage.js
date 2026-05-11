const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const code = params.get("code");
const button = document.querySelector("#deleteButton");
const status = document.querySelector("#manageStatus");

if (!id || !code) {
  button.disabled = true;
  status.textContent = "Deze beheerlink mist informatie.";
}

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Wordt verwijderd...";

  try {
    const response = await fetch(`/api/events/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Verwijderen is niet gelukt.");
    status.textContent = "Verwijderd. De performance verdwijnt van het bord.";
  } catch (error) {
    button.disabled = false;
    status.textContent = error.message;
  }
});
