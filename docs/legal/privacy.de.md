version: 2026-04-28

# Datenschutzerklärung — St. Mina Connect

## 1. Verantwortliche Stelle

St. Mina Koptisch-Orthodoxe Kirche
München, Deutschland
E-Mail: privacy@stmina.de

Eine Postanschrift der Gemeinde wird auf Anfrage mitgeteilt und vor einer öffentlichen Veröffentlichung in diese Erklärung aufgenommen.

## 2. Datenschutzkontakt

Datenschutzfragen, Anträge zur Wahrnehmung von Betroffenenrechten und Beschwerden richten Sie bitte an **privacy@stmina.de**.

Die Gemeinde hat keinen formalen Datenschutzbeauftragten nach Art. 37 DSGVO / § 38 BDSG bestellt, da die gesetzlichen Schwellen (Kerntätigkeit, große Mengen besonderer Kategorien personenbezogener Daten) für diese kleine, interne App nicht erreicht werden. Die genannte Adresse ist die Datenschutzkontaktstelle der Gemeinde und erreicht die für den Datenschutz zuständige ehrenamtlich tätige Person.

## 3. Zweck der App

St. Mina Connect unterstützt die ehrenamtlichen Mitarbeitenden der Gemeinde („Diener") dabei, neue Mitglieder zu registrieren, die Anwesenheit bei Gemeindeveranstaltungen zu dokumentieren, längere Abwesenheiten zu erkennen und seelsorgliche Folgeaktionen zu koordinieren. **Mitglieder selbst melden sich nicht an.** Nur Diener und Administrierende der Gemeinde nutzen die App.

## 4. Kategorien betroffener Personen

- **Diener** (Ehrenamtliche) und Geistliche, die sich zur Nutzung der App authentifizieren.
- **Mitglieder** der Gemeinde sowie der Gemeinde bekannte Neuzugänge, deren seelsorgliche Daten von Dienern in die App eingegeben werden. Mitglieder interagieren nicht direkt mit der App.

## 5. Verarbeitete personenbezogene Daten

| Kategorie                   | Beispiele                                    | Quelle                                                                      | Speicherort                      |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| Identität der Diener        | E-Mail, Anzeigename, Rolle                   | Bei Registrierung durch den Diener selbst angegeben                         | Supabase Auth (EU/Frankfurt)     |
| Kontaktdaten der Mitglieder | Vor-/Nachname, Telefon, Region, Sprache      | Eingabe durch Diener bei Registrierung; mündliche Angabe durch das Mitglied | Supabase Postgres (EU/Frankfurt) |
| Seelsorgliche Notizen       | Freitext-Kommentare zu einem Mitglied        | Eingabe durch zugewiesene Diener                                            | Supabase Postgres (EU/Frankfurt) |
| Anwesenheit                 | Welches Mitglied bei welcher Veranstaltung   | Eingabe durch Diener auf dem Check-in-Bildschirm                            | Supabase Postgres (EU/Frankfurt) |
| Folgeaktionen               | Seelsorgliche Aktionen zu einem Mitglied     | Eingabe durch Diener                                                        | Supabase Postgres (EU/Frankfurt) |
| Betriebslogs                | Absturzberichte, Fehlerlogs (keine Analytik) | Supabase-Plattform                                                          | Supabase, ≤ 30 Tage              |

Besondere Kategorien personenbezogener Daten (religiöse Überzeugung, Gesundheit, ethnische Herkunft etc.) werden nicht als eigene Datenfelder erfasst. Zur Nuance einer impliziten Religionszugehörigkeit siehe Abschnitt 7.

## 6. Herkunft der Mitgliederdaten (Art. 14 DSGVO)

Mitgliederdaten werden zum Zeitpunkt der Registrierung durch den Diener vom Mitglied erhoben — typischerweise persönlich bei einer Gemeindeveranstaltung — sowie aus den seelsorglichen Beobachtungen des zugewiesenen Dieners. Mitglieder werden bei der Registrierung mündlich darüber informiert, dass ihre Kontaktdaten zur seelsorglichen Begleitung von der Gemeinde gespeichert werden, und können der Verarbeitung jederzeit widersprechen (siehe Abschnitt 12).

## 7. Rechtsgrundlage (Art. 6 und Art. 9 DSGVO)

### Daten der Diener

- **Art. 6 Abs. 1 lit. b DSGVO** — Erfüllung der Vereinbarung zwischen der Gemeinde und dem Diener (ehrenamtliche Mitarbeit). Soweit Art. 6 Abs. 1 lit. b für ehrenamtliche Tätigkeiten als zu eng angesehen wird, stützt sich die Gemeinde ergänzend auf **Art. 6 Abs. 1 lit. f DSGVO** (berechtigtes Interesse an der Koordination des Dienerteams). Personalbezogene Daten werden in Anlehnung an **§ 26 BDSG** verarbeitet.

### Daten der Mitglieder

- **Art. 6 Abs. 1 lit. f DSGVO** — berechtigtes Interesse der Gemeinde an der seelsorglichen Begleitung ihrer Gemeinschaft (Registrierung, Erkennung längerer Abwesenheit, Folgeaktionen). Die Verarbeitung beschränkt sich auf das für diesen Zweck erforderliche Minimum, Daten werden nicht außerhalb des Dienerteams weitergegeben, und Mitglieder können jederzeit widersprechen. Eine Interessenabwägung wurde intern dokumentiert. Sie kommt zu dem Ergebnis, dass die Interessen der Mitglieder angesichts des begrenzten Umfangs, des EU-Hostings, der strikten Zugriffskontrollen (RLS, rollenbasierte Zugriffe) und des vollständigen Verzichts auf Tracking, Profiling oder Drittweitergabe nicht überwiegen.

### Besondere Kategorien (Art. 9 DSGVO)

Die App verarbeitet die religiöse Überzeugung von Mitgliedern **nicht** als eigenes Datenfeld. Allein die Tatsache, dass eine Person im seelsorglichen System der Gemeinde erscheint, kann jedoch eine Beziehung zur Koptisch-Orthodoxen Kirche implizieren. Soweit dieses implizite Merkmal als besondere Kategorie behandelt wird, stützt sich die Gemeinde auf:

- **Art. 9 Abs. 2 lit. d DSGVO** — Verarbeitung im Rahmen ihrer rechtmäßigen Tätigkeiten durch eine Gemeinschaft mit religiöser Zielsetzung, mit angemessenen Garantien, ausschließlich auf Mitglieder und Personen, die in regelmäßigem Kontakt zur Gemeinde stehen, und ohne Offenlegung an Dritte ohne Einwilligung.

Die Gemeinde ist eine koptisch-orthodoxe Gemeinschaft in Deutschland. Sie unterhält kein eigenes kirchliches Datenschutzregime (wie DSG-EKD oder KDG); DSGVO und BDSG finden unmittelbar Anwendung.

## 8. Zwecke

- Koordination der Seelsorge: Registrierung, Anwesenheit, Erkennung längerer Abwesenheit, Folgeaktionen.
- Kein Marketing, keine Werbung, keine Analytik, kein Profiling, **keine ausschließlich automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung** (Art. 22 DSGVO).

## 9. Empfänger und Auftragsverarbeiter

Personenbezogene Daten werden **nicht** zu Tracking-, Werbe- oder Analytikzwecken an Dritte weitergegeben. Auftragsverarbeiter:

- **Supabase, Inc.** — Datenbank, Authentifizierung, Edge Functions; Hosting in der EU/Frankfurt. Auftragsverarbeitungsvertrag (AVV) liegt vor (siehe `docs/legal/dpa.md`).
- **Google LLC (Google Calendar API)** — ausschließlich zum **Lesen** des veröffentlichten Veranstaltungskalenders der Gemeinde. **Es werden keine personenbezogenen Daten von Mitgliedern oder Dienern an Google übermittelt.** Es werden lediglich die Metadaten der Termine (Titel, Zeit) serverseitig abgerufen.

Innerhalb der Gemeinde sind Mitgliederdaten ausschließlich für den zugewiesenen Diener und Administrierende (Geistliche) zugänglich. Seelsorgliche Notizen (`comments`) sind durch Row-Level Security auf den zugewiesenen Diener und Administrierende beschränkt.

## 10. Internationale Übermittlungen

Daten werden in der EU (Frankfurt) gespeichert. **Es findet keine Übermittlung personenbezogener Daten in Drittstaaten außerhalb des EU/EWR statt.** Die Google-Calendar-Integration ist rein lesend und übermittelt keine personenbezogenen Daten von Mitgliedern oder Dienern an die Google-Infrastruktur.

## 11. Speicherdauer

| Daten                               | Dauer                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Aktive Diener                       | Solange der Account besteht                                                   |
| Aktive Mitglieder                   | Solange die Gemeinde sie begleiten möchte; Prüfung bei > 2 Jahren Inaktivität |
| Soft-gelöschte Mitglieder           | PII sofort entfernt; Zeile zur referentiellen Integrität erhalten             |
| Hart gelöschte Mitglieder (Art. 17) | Vollständig entfernt; Anwesenheit anonymisiert                                |
| Einwilligungsprotokoll              | Unbegrenzt, append-only (Historie der Zustimmungen)                           |
| Audit-Log                           | 5 Jahre                                                                       |
| Benachrichtigungen                  | 1 Jahr                                                                        |
| Betriebslogs (Supabase-Plattform)   | ≤ 30 Tage                                                                     |

Diese Fristen sind in `docs/legal/retention.md` festgehalten und werden dort beschrieben durchgesetzt.

## 12. Ihre Rechte (Art. 15–22 DSGVO)

Sie haben das Recht auf:

- **Auskunft** (Art. 15) — Einstellungen → Datenschutz → „Meine Daten herunterladen" liefert einen JSON-Export. Mitglieder wenden sich an privacy@stmina.de.
- **Berichtigung** (Art. 16) — der zugewiesene Diener kann Datensätze korrigieren; Diener bearbeiten ihre eigenen Daten in den Einstellungen.
- **Löschung** (Art. 17, „Recht auf Vergessenwerden") — Einstellungen → Datenschutz → „Mein Konto löschen" für Diener. Mitglieder wenden sich an die Gemeinde; ein/e Administrierende/r führt eine Hart-Löschung durch, die den Datensatz vollständig entfernt und zugehörige Anwesenheitseinträge anonymisiert.
- **Einschränkung der Verarbeitung** (Art. 18) — Antrag an privacy@stmina.de. Bearbeitung durch Administrierende.
- **Datenübertragbarkeit** (Art. 20) — der oben genannte JSON-Export liegt in einem maschinenlesbaren Format vor.
- **Widerspruch** (Art. 21) — gegen eine auf Art. 6 Abs. 1 lit. f gestützte Verarbeitung jederzeit per E-Mail an privacy@stmina.de. Die Gemeinde stellt die Verarbeitung ein, sofern sie keine zwingenden schutzwürdigen Gründe nachweist; ein Widerspruch eines Mitglieds gegen die seelsorgliche Nachverfolgung wird in jedem Fall respektiert.
- **Widerruf der Einwilligung** — soweit Verarbeitungen auf Einwilligung beruhen (z. B. Annahme dieser Erklärung als Voraussetzung der Nutzung), kann diese jederzeit widerrufen werden; die Rechtmäßigkeit bisheriger Verarbeitung bleibt unberührt.
- **Keine ausschließlich automatisierten Entscheidungen** (Art. 22) — finden in dieser App nicht statt.

Anträge werden innerhalb eines Monats beantwortet (Art. 12 Abs. 3 DSGVO), beim ersten Antrag unentgeltlich.

### Beschwerderecht (Art. 77 DSGVO)

Sie können sich bei der zuständigen Aufsichtsbehörde beschweren. Für die Gemeinde in München ist dies:

**Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)**
Promenade 18
91522 Ansbach, Deutschland
https://www.lda.bayern.de/

Sie können sich auch an die Aufsichtsbehörde Ihres gewöhnlichen Aufenthalts oder Arbeitsplatzes wenden.

## 13. Minderjährige

Die Gemeinde ist eine Gemeinschaftsorganisation; Kinder von Gemeindemitgliedern können von ihren Eltern oder mit deren Wissen durch einen Diener registriert werden und Gegenstand seelsorglicher Folgeaktionen sein. Soweit ein Mitglied minderjährig ist, stützt sich die Gemeinde auf das Wissen der Eltern und auf dieselbe Rechtsgrundlage des berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO) in Verbindung mit den Grundsätzen des Art. 8 DSGVO für einwilligungsbedürftige Verarbeitungen. Die App erhebt nicht direkt Daten von Kindern: Mitglieder melden sich nicht an, und sämtliche Daten zu Minderjährigen werden von einem volljährigen Diener stellvertretend eingegeben. Eltern oder Sorgeberechtigte können jederzeit Auskunft, Berichtigung oder Löschung des Datensatzes eines Minderjährigen über privacy@stmina.de anfordern.

## 14. Kein Tracking

Die App führt **keine Analytik, kein Tracking durch Dritte, keine Werbung und keine Telemetrie** durch, abgesehen von operativen Fehlerlogs, die Supabase ≤ 30 Tage vorhält und nicht für Tracking oder Profiling genutzt werden. Es sind keine Werbe- oder Analytik-SDKs eingebunden. Das iOS-Datenschutz-Label deklariert in jeder Kategorie „Verwendung für Tracking: Nein".

## 15. Sicherheit (Art. 32 DSGVO)

Technische und organisatorische Maßnahmen umfassen:

- Verschlüsselung im Ruhezustand durch Supabase (AES-256).
- Verschlüsselung in der Übertragung (HTTPS/TLS).
- Row-Level Security serverseitig; das Feld `comments` ist nur für die zugewiesenen Diener und Administrierende lesbar.
- Sämtliche Datenbankzugriffe des Clients erfolgen über RPC-Funktionen mit expliziter Berechtigungsprüfung.
- Authentifizierungstoken werden im sicheren OS-Speicher abgelegt (iOS-Schlüsselbund / Android EncryptedSharedPreferences).
- Datenminimierung: Erhebung ausschließlich der für die seelsorgliche Koordination notwendigen Felder; in v1 keine Mitgliederfotos.
- Rollenbasierte Zugriffe: Mitglieder sind nur dem zugewiesenen Diener und Administrierenden sichtbar; Administrierende sind Geistliche / Gemeindeleitung.
- Audit-Log sensibler Aktionen (Löschungen, Rollenänderungen, Datenexporte, Einwilligungsereignisse).
- Diener sind über die Nutzungsbedingungen zur Vertraulichkeit verpflichtet.

## 16. Änderungen

Die akzeptierte Version dieser Erklärung wird gespeichert. Bei Aktualisierungen werden Sie bei der nächsten Anmeldung um erneute Bestätigung gebeten. Frühere Fassungen werden auf Anfrage zur Verfügung gestellt.

## 17. Kontakt

privacy@stmina.de
