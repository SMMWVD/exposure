# Publiek Deployen

De app kan lokaal blijven werken met CSV/JSON. Zodra je `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` instelt, gebruikt de server Supabase als database.

## 1. Supabase maken

1. Maak een project op Supabase.
2. Open de SQL editor.
3. Plak en run `supabase/schema.sql`.
4. Ga naar Project Settings > API.
5. Kopieer:
   - Project URL
   - `service_role` key

Gebruik de service role key alleen als server environment variable. Zet hem nooit in frontend JavaScript.

## 2. Lokaal testen met Supabase

Maak `.env`:

```bash
cp .env.example .env
```

Vul `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` in.

Start:

```bash
npm start
```

Als de server start met `Opslag: Supabase`, gebruik je de online database.

## 3. Public hosting met Render

Render heeft gratis web services voor hobby/testprojecten. Dit is de simpelste route.

1. Zet deze projectmap op GitHub.
2. Ga naar Render.
3. Klik **New +**.
4. Kies **Web Service**.
5. Connect je GitHub repo.
6. Kies:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: Free
7. Voeg environment variables toe:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
8. Klik **Deploy Web Service**.

Als Render `render.yaml` detecteert, kan hij veel van deze instellingen automatisch overnemen.

## 4. URLs

Na deploy krijg je een publieke URL, bijvoorbeeld:

```text
https://jouw-expo-schema.up.railway.app
```

Pagina's:

- Bord: `/`
- Studenten toevoegen: `/add.html`
- Publiek los inschrijven: `/signup.html`
- Beheerlink: wordt na toevoegen automatisch gegeven

## 5. Belangrijk

De huidige app heeft nog geen algemene admin-login. Studenten kunnen alleen hun eigen performance verwijderen met de beheerlink die ze na toevoegen krijgen.
