const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

loadEnvFile();

const port = Number(process.env.PORT || 5173);
const appDir = path.join(__dirname, "app");
const dataDir = path.join(__dirname, "data");
const schedulePath = path.join(appDir, "schedule.csv");
const codesPath = path.join(dataDir, "event-codes.json");
const signupsPath = path.join(dataDir, "signups.json");
const headers = ["id", "date", "start", "end", "title", "student", "location", "capacity", "description"];
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseServiceKey);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, ".env");
    const content = require("node:fs").readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function csvValue(value) {
  const text = String(value ?? "").trim();
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

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

  const [csvHeaders, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(csvHeaders.map((header, index) => [header, record[index] ?? ""])),
  );
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), "application/json; charset=utf-8");
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(value);
}

function makeId() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function makeCode() {
  return crypto.randomBytes(5).toString("hex");
}

function normalizeTime(value) {
  return String(value || "").slice(0, 5);
}

function publicEvent(event) {
  return {
    id: event.id,
    date: event.date,
    start: normalizeTime(event.start),
    end: normalizeTime(event.end),
    title: event.title,
    student: event.student || "",
    location: event.location || "",
    capacity: Math.max(0, Number.parseInt(event.capacity || "0", 10) || 0),
    description: event.description || "",
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readEvents() {
  const csv = await fs.readFile(schedulePath, "utf8");
  const events = parseCsv(csv)
    .filter((event) => event.date && event.start && event.end && event.title)
    .map((event) => ({
      id: event.id || makeId(),
      date: event.date,
      start: event.start,
      end: event.end,
      title: event.title,
      student: event.student || "",
      location: event.location || "",
      capacity: Math.max(0, Number.parseInt(event.capacity || "0", 10) || 0),
      description: event.description || "",
    }))
    .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));

  return events;
}

async function writeEvents(events) {
  const lines = [
    headers.join(","),
    ...events.map((event) => headers.map((header) => csvValue(event[header])).join(",")),
  ];
  await fs.writeFile(schedulePath, `${lines.join("\n")}\n`, "utf8");
}

async function supabaseRequest(endpoint, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function readSupabaseEvents() {
  const rows = await supabaseRequest(
    "performances?select=id,date,start,end,title,student,location,capacity,description&order=date.asc&order=start.asc",
  );
  return rows.map(publicEvent);
}

async function getSupabaseEventsWithSignupCounts() {
  const [events, signups] = await Promise.all([
    readSupabaseEvents(),
    supabaseRequest("signups?select=performance_id,email"),
  ]);

  return events.map((event) => {
    const registered = signups.filter((signup) => signup.performance_id === event.id).length;
    const available = event.capacity > 0 ? Math.max(0, event.capacity - registered) : null;
    return {
      ...event,
      registered,
      available,
      isFull: event.capacity > 0 && registered >= event.capacity,
    };
  });
}

async function insertSupabaseEvent(event, manageCode) {
  const rows = await supabaseRequest("performances", {
    method: "POST",
    prefer: "return=representation",
    body: {
      ...event,
      manage_code: manageCode,
    },
  });

  return publicEvent(rows[0]);
}

async function deleteSupabaseEvent(id, code) {
  const rows = await supabaseRequest(
    `performances?select=id,manage_code&id=eq.${encodeURIComponent(id)}&limit=1`,
  );

  if (!rows.length) return { status: 404, error: "Performance niet gevonden." };
  if (rows[0].manage_code !== code) return { status: 403, error: "Deze verwijderlink klopt niet." };

  await supabaseRequest(`performances?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
  return { ok: true };
}

async function insertSupabaseSignup(eventId, name, email) {
  const events = await getSupabaseEventsWithSignupCounts();
  const event = events.find((item) => item.id === eventId);
  if (!event) return { status: 404, error: "Performance niet gevonden." };
  if (event.isFull) return { status: 409, error: "Deze performance zit vol." };

  if (email) {
    const existing = await supabaseRequest(
      `signups?select=id&performance_id=eq.${encodeURIComponent(eventId)}&email=eq.${encodeURIComponent(email)}&limit=1`,
    );
    if (existing.length) return { status: 409, error: "Dit e-mailadres staat al ingeschreven." };
  }

  await supabaseRequest("signups", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      performance_id: eventId,
      name,
      email,
    },
  });

  return { ok: true, eventId };
}

async function getEventsWithSignupCounts() {
  if (useSupabase) return getSupabaseEventsWithSignupCounts();

  const [events, signups] = await Promise.all([readEvents(), readJsonFile(signupsPath, {})]);
  return events.map((event) => {
    const registered = Array.isArray(signups[event.id]) ? signups[event.id].length : 0;
    const available = event.capacity > 0 ? Math.max(0, event.capacity - registered) : null;
    return {
      ...event,
      registered,
      available,
      isFull: event.capacity > 0 && registered >= event.capacity,
    };
  });
}

async function listEvents(_req, res) {
  try {
    sendJson(res, 200, { events: await getEventsWithSignupCounts() });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Schema laden is niet gelukt." });
  }
}

async function addEvent(req, res) {
  try {
    const input = JSON.parse(await readBody(req));
    const event = Object.fromEntries(headers.map((header) => [header, String(input[header] ?? "").trim()]));
    event.id = makeId();
    event.capacity = Math.max(0, Number.parseInt(event.capacity || "0", 10) || 0);

    if (!isValidDate(event.date) || !isValidTime(event.start) || !isValidTime(event.end)) {
      sendJson(res, 400, { error: "Vul een geldige datum, starttijd en eindtijd in." });
      return;
    }

    if (!event.title || !event.student || !event.location) {
      sendJson(res, 400, { error: "Titel, student en locatie zijn verplicht." });
      return;
    }

    if (event.capacity < 1) {
      sendJson(res, 400, { error: "Publieksplekken moet minimaal 1 zijn." });
      return;
    }

    if (event.end <= event.start) {
      sendJson(res, 400, { error: "De eindtijd moet later zijn dan de starttijd." });
      return;
    }

    const manageCode = makeCode();

    if (useSupabase) {
      const savedEvent = await insertSupabaseEvent(event, manageCode);
      sendJson(res, 201, {
        ok: true,
        event: savedEvent,
        manageUrl: `/manage.html?id=${encodeURIComponent(savedEvent.id)}&code=${encodeURIComponent(manageCode)}`,
      });
      return;
    }

    const [events, codes] = await Promise.all([readEvents(), readJsonFile(codesPath, {})]);
    events.push(event);
    codes[event.id] = manageCode;
    await Promise.all([writeEvents(events), writeJsonFile(codesPath, codes)]);

    sendJson(res, 201, {
      ok: true,
      event,
      manageUrl: `/manage.html?id=${encodeURIComponent(event.id)}&code=${encodeURIComponent(manageCode)}`,
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Opslaan is niet gelukt." });
  }
}

async function deleteEvent(req, res, id, code) {
  try {
    if (useSupabase) {
      const result = await deleteSupabaseEvent(id, code);
      if (!result.ok) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    const [events, codes, signups] = await Promise.all([
      readEvents(),
      readJsonFile(codesPath, {}),
      readJsonFile(signupsPath, {}),
    ]);

    if (!codes[id] || codes[id] !== code) {
      sendJson(res, 403, { error: "Deze verwijderlink klopt niet." });
      return;
    }

    const nextEvents = events.filter((event) => event.id !== id);
    if (nextEvents.length === events.length) {
      sendJson(res, 404, { error: "Performance niet gevonden." });
      return;
    }

    delete codes[id];
    delete signups[id];
    await Promise.all([writeEvents(nextEvents), writeJsonFile(codesPath, codes), writeJsonFile(signupsPath, signups)]);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Verwijderen is niet gelukt." });
  }
}

async function addSignup(req, res) {
  try {
    const input = JSON.parse(await readBody(req));
    const eventId = String(input.eventId || "").trim();
    const name = String(input.name || "").trim();
    const email = String(input.email || "").trim().toLowerCase();

    if (!eventId || !name) {
      sendJson(res, 400, { error: "Kies een performance en vul je naam in." });
      return;
    }

    const events = await getEventsWithSignupCounts();
    const event = events.find((item) => item.id === eventId);
    if (!event) {
      sendJson(res, 404, { error: "Performance niet gevonden." });
      return;
    }

    if (event.isFull) {
      sendJson(res, 409, { error: "Deze performance zit vol." });
      return;
    }

    if (useSupabase) {
      const result = await insertSupabaseSignup(eventId, name, email);
      if (!result.ok) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      sendJson(res, 201, result);
      return;
    }

    const signups = await readJsonFile(signupsPath, {});
    signups[eventId] ||= [];

    if (email && signups[eventId].some((signup) => signup.email === email)) {
      sendJson(res, 409, { error: "Dit e-mailadres staat al ingeschreven." });
      return;
    }

    signups[eventId].push({
      name,
      email,
      createdAt: new Date().toISOString(),
    });

    await writeJsonFile(signupsPath, signups);
    sendJson(res, 201, { ok: true, eventId });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Inschrijven is niet gelukt." });
  }
}

async function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(appDir, pathname));

  if (!filePath.startsWith(appDir)) {
    send(res, 403, "Verboden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    send(res, 200, content, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  } catch (error) {
    if (error.code === "ENOENT") {
      send(res, 404, "Niet gevonden");
      return;
    }

    console.error(error);
    send(res, 500, "Serverfout");
  }
}

function getLocalUrls() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${port}`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/events") {
    listEvents(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/events") {
    addEvent(req, res);
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/events/")) {
    deleteEvent(req, res, decodeURIComponent(url.pathname.replace("/api/events/", "")), url.searchParams.get("code") || "");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/signups") {
    addSignup(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveFile(req, res);
    return;
  }

  send(res, 405, "Methode niet toegestaan");
});

server.listen(port, "0.0.0.0", () => {
  const localUrls = getLocalUrls();
  console.log(`Performancebord: http://localhost:${port}`);
  console.log(`Studenten: http://localhost:${port}/add.html`);
  console.log(`Publiek: http://localhost:${port}/signup.html`);
  console.log(`Opslag: ${useSupabase ? "Supabase" : "lokale CSV/JSON"}`);
  if (localUrls.length) {
    console.log("Telefoon op hetzelfde wifi-netwerk:");
    localUrls.forEach((url) => {
      console.log(`- Studenten: ${url}/add.html`);
      console.log(`- Publiek: ${url}/signup.html`);
    });
  }
});
