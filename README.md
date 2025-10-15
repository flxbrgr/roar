# ArenaFlow – Tournament Operations Suite

ArenaFlow ist eine von Grund auf erneuerte Alternative zu Tournify. Die Lösung kombiniert ein API-gestütztes Backend mit einer reaktiven Weboberfläche, die sich von Beginn an an internationale Zielgruppen richtet. Alle Kernmodule – von der Turniererstellung über die Auslosung bis hin zur Tabelle – sind mehrsprachig nutzbar und lassen sich auf Desktop, Tablet und Mobilgeräten bedienen.

## Projektstruktur

```
.
├── client      # Vite + React + TypeScript Frontend mit i18next
├── server      # Express API mit Terminierung für Spielpläne & Ergebnisse
├── package.json# Workspaces & Meta-Skripte
└── README.md
```

### Backend (server)
* Express-API mit Endpunkten für Turniere, Teams, Spielplan-Generierung und Ergebnisverwaltung.
* Unterstützt Round-Robin-Spielpläne, K.-o.-Bäume (inkl. BYE-Auffüllung) und Tabellenberechnung inkl. Torverhältnis.
* In-Memory-Datenspeicher (einfach austauschbar gegen eine persistente Datenbank).

### Frontend (client)
* Moderne React-Oberfläche mit Tailwind-Styling und React Query für Datenabgleich.
* Sofortige Sprachumschaltung (Deutsch/Englisch) dank i18next und Browser-Spracherkennung.
* Komponenten für Turniererstellung, Teamverwaltung, Spielplan, Turnierbaum und Ergebniserfassung.
* Responsive Layouts für große Control-Desks ebenso wie Companion-Apps.

## Getting Started

```bash
npm install           # Installiert Abhängigkeiten für Client & Server
npm run dev           # Startet den Express-Server (Port 4000)
cd client && npm run dev  # Separat: Vite-Dev-Server (Port 5173, proxied API)
```

Weitere Skripte:

| Befehl                | Beschreibung                               |
|-----------------------|---------------------------------------------|
| `npm run test`        | Führt Vitest in allen Workspaces aus        |
| `npm run lint`        | Lintet Client und Server                    |
| `npm run build`       | Baut den Client (Server hat keinen Build)   |

## API-Überblick

| Methode & Route                                      | Beschreibung                              |
|------------------------------------------------------|-------------------------------------------|
| `GET /api/tournaments`                               | Listet alle Turniere                      |
| `POST /api/tournaments`                              | Legt ein Turnier an (Name, Teams etc.)    |
| `GET /api/tournaments/:id`                           | Liefert Turnier mit Tabelle               |
| `POST /api/tournaments/:id/teams`                    | Fügt ein Team hinzu                       |
| `POST /api/tournaments/:id/schedule/round-robin`     | Erstellt Round-Robin-Spielplan            |
| `POST /api/tournaments/:id/schedule/knockout`        | Erstellt K.-o.-Baum                       |
| `POST /api/tournaments/:id/matches/:matchId/result`  | Speichert ein Spielergebnis               |
| `PUT /api/tournaments/:id/settings`                  | Justiert Punktevergabe                    |

## Potenzielle "Killer Features"

* **Live-Coaching Companion App:** Second-Screen-Ansicht mit Live-Daten, Timeouts und taktischen Notizen für Trainer.
* **AI-basierte Auslosung & Insights:** KI-Unterstützung für balancierte Gruppen, Upset-Wahrscheinlichkeiten und Storytelling.
* **Sponsoring & Monetarisierung:** Automatisch gebrandete Widgets, QR-Ticket-Check-in und White-Label-Exports.
* **OTT-Integration:** Direkte Einbindung von Streaming-Overlays, Highlight-Clipping und Social Push.
* **Offline-Modus für Arenen:** Synchronisierter Edge-Cache für Veranstalter mit schwacher Internetanbindung.

## Roadmap Ideen

1. Persistente Speicherung (z.B. PostgreSQL + Prisma) und Benutzerkonten.
2. Drag-and-Drop-Editor für Spielpläne und Broadcast-Visuals.
3. Native App-Shell (React Native / Capacitor) für Offline-Scoring.
4. Erweiterte Statistiken: Shot Charts, Heatmaps, Elo-basiertes Power-Ranking.
5. Integrationen mit Zahlungs- und Ticketing-Anbietern.

## Lizenz

Diese Demo basiert auf der MIT-Lizenz gemäß `LICENSE`.
