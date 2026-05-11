# Afstudeer Expo Performancebord

Dit is een lokaal scherm voor performances met tijdsloten. Het scherm leest `app/schedule.csv`, laat zien wat nu bezig is, wat straks begint, en maakt daaronder een blokkenschema per locatie. Studenten kunnen ook via hun telefoon performances toevoegen zolang ze op hetzelfde wifi-netwerk zitten.

## Schema aanpassen

Open `app/schedule.csv` in Excel, Numbers, Google Sheets of een teksteditor. Laat de eerste regel staan. Als studenten de invulpagina gebruiken, wordt dit bestand automatisch bijgewerkt.

Kolommen:

- `date`: datum als `YYYY-MM-DD`
- `start`: starttijd als `HH:MM`
- `end`: eindtijd als `HH:MM`
- `title`: titel van de performance
- `student`: naam student
- `location`: ruimte of podium
- `capacity`: aantal publieksplekken
- `description`: korte extra regel, mag leeg blijven

Sla het bestand weer op als CSV. Het scherm probeert elke 30 seconden opnieuw te laden.

## Lokaal draaien

Gebruik in deze map:

```bash
npm start
```

Open daarna:

```text
http://localhost:5173
```

De invulpagina staat op:

```text
http://localhost:5173/add.html
```

De publieksinschrijving staat op:

```text
http://localhost:5173/signup.html
```

Voor telefoons gebruik je het netwerkadres dat `node server.js` in de terminal print, bijvoorbeeld:

```text
http://192.168.1.24:5173/add.html
```

Deel met studenten de `/add.html` link. Deel met publiek de `/signup.html` link.

Voor een expo-scherm kun je de browser fullscreen zetten. Touch werkt al voor de locatieknoppen, maar het bord is ook bruikbaar zonder touchscreen.

## Praktische setup

- Zet de computer of mini-pc zo dat hij niet automatisch in slaap valt.
- Maak het browservenster fullscreen.
- Laat studenten de invulpagina gebruiken, of bewerk `schedule.csv` handmatig.
- Gebruik korte titels voor betere leesbaarheid op afstand.
- Deel de invullink alleen met deelnemers. Iedereen op hetzelfde netwerk die de link heeft kan toevoegen.
- Na toevoegen krijgt een student een beheerlink. Met die link kan alleen die performance worden verwijderd.
- Inschrijvingen worden opgeslagen in `data/signups.json`.

## Publiek beschikbaar maken

Zie `DEPLOY.md`. Kort gezegd: maak een Supabase database, zet `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` als environment variables, en deploy deze map als Node web service.
