# community-moderation.de — Redesign & Onepager-Ausbau

**Datum:** 2026-08-10
**Status:** freigegeben, in Umsetzung

## Ziel

`community-moderation.de` wird von einer famefact-Ablegerseite zu einer eigenständig auftretenden
Marke mit einem einzigen Ranking- und Conversion-Ziel: das Keyword **„community moderation"** im
**deutschen Markt**. Vorbild und Wettbewerber ist `community-management.ch` (gleiche Firmengruppe,
Zielmarkt Schweiz) — die neue Seite muss inhaltlich mindestens gleichziehen und gestalterisch
deutlich darüber liegen.

Betreiberin bleibt die **track by track GmbH (famefact)**. famefact tritt als Absender und
Vertrauensanker auf, nicht als Absenderdesign.

## Nicht-Ziele

- Kein Ranking auf „community management" (bedient famefact.com und community-management.ch).
- Kein Backend, keine Lead-Datenbank, kein Formularversand.
- Keine Preisliste mit Festpreisen (famefact rechnet Retainer individuell).

## Marke & Design

**Richtung:** „Dark Signal + Thread-Motiv". Das Design-Primitiv ist der Kommentar-Thread:
Chat-Bubbles sind keine Deko, sondern Content-Container für Hero, Leistungen und Check.

| Token | Wert | Rolle |
|---|---|---|
| `--void` | `#0B0B0F` | Canvas |
| `--surface` | `#13141C` | Karten, Bubbles |
| `--line` | `#262838` | Hairlines |
| `--ink` | `#F2F2F7` | Text |
| `--muted` | `#9A9BAC` | Fließtext sekundär |
| `--accent` | `#6E5BFF` | Electric Indigo — Marke, CTA, Moderator-Bubbles |
| `--signal` | `#FF4D6D` | Coral — ausschließlich Eskalation/Krise/Recht |

**Typografie:** Bricolage Grotesque (Display) + Inter (Text), beide **self-hosted** als
`woff2` unter `/public/fonts/`. Das alte BaseLayout lud Google Fonts per `@import` vom
Google-CDN — für eine deutsche Agenturseite ein DSGVO-Risiko und wird mit entfernt.

**Logo:** Inline-SVG, zwei versetzte Sprechblasen (die hintere in Coral, die vordere in Indigo)
plus Wortmarke `community moderation` in Bricolage. Kein famefact-Logo im Header.

## Informationsarchitektur

Onepager (`/`) als Ranking-Träger, ~4.000 Wörter, 13 Sektionen:

1. **Hero** — H1 „Community Moderation, die nicht schläft.", animierter Thread, zwei CTAs, Trust-Bar.
2. **Problem** — „Wenn die Kommentarspalte schneller wächst als das Team" (~400 W).
3. **Definition & Abgrenzung** — Was ist Community Moderation, Abgrenzung zu Community Management
   und Social Customer Care (~500 W). Bewusst zitierfähig für AI Overviews / ChatGPT.
4. **Leistungen** — 6 Module: Kommentar- & DM-Moderation, Regelwerk/Netiquette, Eskalation,
   Hate Speech & Recht, Reporting, Tool- & Ticket-Setup (~600 W).
5. **Kanäle** — Instagram, Facebook, TikTok, YouTube, LinkedIn, Reddit, Foren/Discord (~350 W).
6. **Selbst-Check** — 6 Fragen, Sofort-Auswertung, 3 Ergebnisprofile.
7. **Ablauf** — 4 Schritte, Onboarding in 14 Tagen (~350 W).
8. **Menschen** — Szenenfotos + 4 echte famefact-Portraits mit Namen und Rolle (~250 W).
9. **Recht & Sicherheit** — DSA, NetzDG, DSGVO, Löschfristen, Dokumentation (~450 W).
10. **Kosten** — Retainer-Logik, Preistreiber, ehrliche Bandbreiten (~400 W).
11. **Referenzen** — Vattenfall, CASIO, REWE, AutoHero, Fleurop, Oxford (~150 W).
12. **FAQ** — 12 Fragen mit `FAQPage`-Schema (~600 W).
13. **Abschluss-CTA**.

Sektion 9 ist der strategische Hebel: `community-management.ch` behandelt DSA/NetzDG praktisch
nicht, während genau das die Kernsorge deutscher Auftraggeber beim Auslagern von Moderation ist.

Bestandsseiten bleiben erhalten und werden auf das neue Design gehoben:
`/community-management-agentur/`, `/social-media-moderation/`, `/krisenkommunikation-social-media/`.
Neu: `/impressum/`, `/datenschutz/`.

## Conversion

Einziger primärer Kanal: **WhatsApp**, Nummer `+49 171 5280138` — ausschließlich als
WhatsApp-Kontakt, nicht als allgemeine Telefonnummer ausgeschrieben.

- Sticky WhatsApp-Button (unten rechts, ab Scrollposition sichtbar).
- Vier Einstiege im Fließtext.
- **Selbst-Check** als Lead-Magnet: 6 Fragen, rein clientseitig (kein Cookie, kein Storage,
  kein Netzwerk-Request). Die Auswertung erzeugt einen `wa.me`-Deeplink, dessen `?text=`-Parameter
  das Ergebnis bereits enthält. Damit ersetzt eine statische Seite eine Formular-Backend-Strecke:
  keine Function, kein Datenspeicher, keine Einwilligung — der Nutzer sendet seine Daten selbst.
- Fallback im Footer: `info@famefact.com` und `030 403 665 430`.

## Technik

Astro 5, statisch, Deploy über Vercel-Git-Integration.

- `src/layouts/BaseLayout.astro` — Design-System, Fonts, Nav, Footer, Sticky-CTA.
- `src/pages/index.astro` — Onepager.
- `src/pages/impressum/index.astro`, `src/pages/datenschutz/index.astro`.
- Bilder: 6 Szenenfotos aus dem agent-hub-Drive (`/public/images/scenes/`) und 5 echte
  famefact-Portraits (`/public/images/people/`), lokal auf 1400 px bzw. 480 px optimiert.
- Schema.org: `ProfessionalService`, `Service`, `FAQPage`, `BreadcrumbList`.

**Impressumsdaten:** track by track GmbH, Schliemannstr. 23, 10437 Berlin, GF Tobias Sander,
Amtsgericht Berlin-Charlottenburg HRB 129805 B, USt-IdNr. DE814954842.

## Abnahmekriterien

- `npm run build` läuft ohne Fehler durch (`astro check` inklusive).
- Startseite ≥ 3.800 Wörter sichtbarer Text.
- Kein Request an ein Drittanbieter-CDN im ausgelieferten HTML.
- WhatsApp-Deeplink trägt das Check-Ergebnis im `text`-Parameter.
- Impressum und Datenschutz sind on-site erreichbar, nicht per Weiterleitung auf famefact.com.
- Screenshot-Prüfung Desktop und Mobil ohne horizontales Scrollen.
