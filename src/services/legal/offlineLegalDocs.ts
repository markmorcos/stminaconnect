/**
 * Bundled legal documents — the runtime source of truth for the consent
 * screen and the in-app legal reader (`app/(app)/legal/{privacy,terms}.tsx`).
 * The canonical authored copy is `docs/legal/<doc>.<lang>.md`; the
 * strings below are an abridged "key disclosures" snapshot reviewed for
 * legal substance (Art. 13/14: controller, privacy contact, lawful basis
 * incl. Art. 9(2)(d), recipients, retention summary, rights including
 * BayLDA, no-tracking, security, children).
 *
 * Update procedure when bumping a version:
 *   1. Edit `docs/legal/<doc>.<lang>.md` (the canonical authored source).
 *   2. Mirror the substantive disclosures into the matching constant
 *      below; escape any backticks as `\\\``.
 *   3. Bump the `version: YYYY-MM-DD` header in both the markdown and
 *      the TS constant.
 *   4. Bump `CURRENT_PRIVACY_VERSION` / `CURRENT_TERMS_VERSION` so the
 *      auth route guard re-prompts users for re-acceptance.
 *
 * Why a hand-maintained TypeScript module instead of Metro asset
 * bundling? Avoids a metro.config.js change registering `md` as a
 * source extension and an `expo-asset` round-trip at runtime. The
 * trade-off — manual sync — is acceptable because policy text changes
 * infrequently and review is by hand.
 */

export type LegalDocKind = 'privacy' | 'terms';
export type LegalLang = 'en' | 'ar' | 'de';

export const CURRENT_PRIVACY_VERSION = '2026-04-28';
export const CURRENT_TERMS_VERSION = '2026-04-28';

export const PRIVACY_EN = `version: 2026-04-28

# Privacy Policy — St. Mina Connect

## Data Controller

St. Mina Coptic Orthodox Church, Munich, Germany.
Privacy contact: privacy@stmina.de.
No formal Data Protection Officer is designated under Art. 37 GDPR / §38 BDSG; the email above is the parish privacy contact.

## What this app is

St. Mina Connect helps the church's volunteers ("servants") register newcomers, track attendance against church events, detect pastoral risk, and coordinate follow-ups. **Members do not log in.** Only servants and church admins use the app.

## Data subjects

- **Servants** (volunteers) and clergy who authenticate to use the app.
- **Members** of the parish, whose pastoral data is entered into the app by servants.

## Personal data we process

- Servant identity: email, display name, role.
- Member contact info: name, phone, region, language.
- Pastoral notes: free-text comments on a member.
- Attendance and follow-ups.
- Operational logs (Supabase platform, ≤30 days).

The app does not store special-category data (religion, health, ethnicity) as data fields.

## Lawful basis (Art. 6 and Art. 9 GDPR)

- **Servants**: Art. 6(1)(b) — performance of the volunteer agreement; supplemented by Art. 6(1)(f) for team coordination.
- **Members**: Art. 6(1)(f) — legitimate interest of the parish in pastoral care of its community. A balancing test has been documented internally.
- **Implicit religious affiliation**: Art. 9(2)(d) — processing in the legitimate activities of a not-for-profit body with a religious aim, on members and persons in regular contact with the parish, with appropriate safeguards and no disclosure to third parties without consent.

The parish does not operate under DSG-EKD or KDG; the GDPR and the BDSG apply directly.

## Purposes

Pastoral coordination only. **No marketing, no advertising, no analytics, no profiling, no automated decision-making with legal effect** (Art. 22).

## Recipients

- **Supabase, Inc.** — database, auth, edge functions; EU/Frankfurt; DPA on file.
- **Google LLC (Google Calendar API)** — read-only. No personal data of members or servants is sent to Google.

## International transfers

Data is stored in the EU (Frankfurt). **No transfers outside the EU/EEA take place.**

## Retention (summary)

- Active accounts: while the relationship lasts.
- Inactive members: reviewed after 2 years.
- Soft-deleted members: PII scrubbed; row retained for referential integrity.
- Hard-erased members: row removed; attendance anonymised.
- Audit log: 5 years. Notifications: 1 year. Operational logs: ≤30 days.
- Consent log: indefinite, append-only.

## Your rights (Art. 15–22 GDPR)

Access, rectification, erasure, restriction, portability, objection, withdrawal of consent, no automated decisions. Servants use Settings → Privacy. Members exercise these rights by emailing privacy@stmina.de. We respond within one month.

You can lodge a complaint with the **Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)**, Promenade 18, 91522 Ansbach, Germany — https://www.lda.bayern.de/ — or with the supervisory authority of your habitual residence or place of work.

## Children

Members may include minors registered by a servant with parental knowledge. The app does not collect data from children directly. Parents/guardians can request access, correction, or erasure via privacy@stmina.de.

## No tracking

This app performs **no analytics, no third-party trackers, no advertising, and no telemetry** beyond operational error logs (≤30-day retention, not used for tracking or profiling). The iOS App Privacy nutrition label declares "Used for tracking: No" for every category.

## Security (Art. 32 GDPR)

Encryption at rest (AES-256) and in transit (TLS); Row-Level Security; RPC-only client access; tokens in OS-secure storage; data minimisation (no member photos in v1); role-based access; audit log of sensitive actions; confidentiality obligation on servants via the Terms of Service.

## Contact

privacy@stmina.de
`;

export const PRIVACY_DE = `version: 2026-04-28

# Datenschutzerklärung — St. Mina Connect

## Verantwortliche Stelle

St. Mina Koptisch-Orthodoxe Kirche, München, Deutschland.
Datenschutzkontakt: privacy@stmina.de.
Ein formaler Datenschutzbeauftragter nach Art. 37 DSGVO / § 38 BDSG ist nicht bestellt; die o. g. Adresse ist die Datenschutzkontaktstelle der Gemeinde.

## Zweck der App

Die App unterstützt ehrenamtliche „Diener" bei der Registrierung neuer Mitglieder, der Anwesenheitsverfolgung, der Erkennung längerer Abwesenheiten und der seelsorglichen Nachverfolgung. **Mitglieder selbst melden sich nicht an.** Nur Diener und Administrierende nutzen die App.

## Betroffene Personen

- **Diener** (Ehrenamtliche) und Geistliche, die sich authentifizieren.
- **Mitglieder** der Gemeinde, deren seelsorgliche Daten von Dienern eingegeben werden.

## Verarbeitete Daten

- Identität der Diener: E-Mail, Anzeigename, Rolle.
- Kontaktdaten der Mitglieder: Name, Telefon, Region, Sprache.
- Seelsorgliche Notizen, Anwesenheit, Folgeaktionen.
- Betriebslogs (Supabase, ≤ 30 Tage).

Besondere Kategorien (Religion, Gesundheit, Ethnie) werden nicht als Datenfelder erfasst.

## Rechtsgrundlage (Art. 6 und Art. 9 DSGVO)

- **Diener**: Art. 6 Abs. 1 lit. b (ehrenamtliche Vereinbarung); ergänzend Art. 6 Abs. 1 lit. f (Teamkoordination).
- **Mitglieder**: Art. 6 Abs. 1 lit. f — berechtigtes Interesse an der seelsorglichen Begleitung. Eine Interessenabwägung ist intern dokumentiert.
- **Implizite Religionszugehörigkeit**: Art. 9 Abs. 2 lit. d — Verarbeitung im Rahmen der rechtmäßigen Tätigkeiten einer Gemeinschaft mit religiöser Zielsetzung, auf Mitglieder und Personen in regelmäßigem Kontakt zur Gemeinde, mit Garantien und ohne Drittweitergabe ohne Einwilligung.

Die Gemeinde unterliegt keinem eigenen kirchlichen Datenschutzregime (DSG-EKD/KDG); DSGVO und BDSG gelten unmittelbar.

## Zwecke

Ausschließlich seelsorgliche Koordination. **Kein Marketing, keine Werbung, keine Analytik, kein Profiling, keine ausschließlich automatisierten Entscheidungen mit rechtlicher Wirkung** (Art. 22).

## Empfänger

- **Supabase, Inc.** — Datenbank, Auth, Edge Functions; EU/Frankfurt; AVV vorhanden.
- **Google LLC (Google Calendar API)** — nur lesend. Keine Übermittlung von Mitglieder- oder Dienerdaten an Google.

## Internationale Übermittlungen

Speicherung in der EU (Frankfurt). **Keine Übermittlung außerhalb des EU/EWR.**

## Speicherdauer (Zusammenfassung)

- Aktive Accounts: solange die Beziehung besteht.
- Inaktive Mitglieder: Prüfung nach 2 Jahren.
- Soft-gelöschte Mitglieder: PII sofort entfernt; Zeile zur referentiellen Integrität.
- Hart gelöschte Mitglieder: Zeile entfernt; Anwesenheit anonymisiert.
- Audit-Log: 5 Jahre. Benachrichtigungen: 1 Jahr. Betriebslogs: ≤ 30 Tage.
- Einwilligungsprotokoll: unbegrenzt, append-only.

## Ihre Rechte (Art. 15–22 DSGVO)

Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Widerruf der Einwilligung, keine automatisierten Entscheidungen. Diener nutzen Einstellungen → Datenschutz. Mitglieder wenden sich an privacy@stmina.de. Antwort innerhalb eines Monats.

Beschwerderecht beim **Bayerischen Landesamt für Datenschutzaufsicht (BayLDA)**, Promenade 18, 91522 Ansbach — https://www.lda.bayern.de/ — oder bei der Aufsichtsbehörde des gewöhnlichen Aufenthalts oder Arbeitsplatzes.

## Minderjährige

Mitglieder können Minderjährige sein, die mit Wissen der Eltern von einem Diener registriert werden. Die App erhebt keine Daten direkt von Kindern. Eltern/Sorgeberechtigte können Auskunft, Berichtigung oder Löschung über privacy@stmina.de anfordern.

## Kein Tracking

Die App führt **keine Analytik, kein Tracking durch Dritte, keine Werbung und keine Telemetrie** durch, abgesehen von operativen Fehlerlogs (≤ 30 Tage, kein Tracking, kein Profiling). Das iOS-Datenschutz-Label deklariert „Verwendung für Tracking: Nein" in jeder Kategorie.

## Sicherheit (Art. 32 DSGVO)

Verschlüsselung im Ruhezustand (AES-256) und in der Übertragung (TLS); Row-Level Security; ausschließlich RPC-Zugriffe vom Client; Token im sicheren OS-Speicher; Datenminimierung (in v1 keine Mitgliederfotos); rollenbasierte Zugriffe; Audit-Log; Vertraulichkeitsverpflichtung der Diener über die Nutzungsbedingungen.

## Kontakt

privacy@stmina.de
`;

export const PRIVACY_AR = `version: 2026-04-28

# سياسة الخصوصية — St. Mina Connect

## المسؤول عن البيانات

كنيسة الشهيد مار مينا القبطية الأرثوذكسية، ميونخ، ألمانيا.
جهة الاتصال للخصوصيّة: privacy@stmina.de.
لم تُعيَّن مسؤول حماية بيانات رسمي بموجب المادة ٣٧ من اللائحة / § ٣٨ BDSG؛ العنوان أعلاه هو جهة الاتصال للخصوصيّة في الكنيسة.

## ما هذا التطبيق

يساعد التطبيق الخدّام (المتطوّعين) في تسجيل الوافدين الجدد، وتتبّع الحضور، والكشف عن الغياب الطويل، وتنسيق المتابعات الرعويّة. **لا يُسجِّل المخدومون الدخول.** يستخدمه الخدّام والمسؤولون فقط.

## فئات الأشخاص

- **الخدّام** (المتطوّعون) والإكليروس الذين يصادقون.
- **المخدومون** الذين تُدخَل بياناتهم الرعويّة بواسطة الخدّام.

## البيانات

- هويّة الخادم: البريد الإلكتروني، الاسم، الدور.
- بيانات الاتصال للأعضاء: الاسم، الهاتف، المنطقة، اللغة.
- ملاحظات رعويّة، حضور، متابعات.
- سجلّات تشغيليّة (Supabase، ≤ ٣٠ يوماً).

لا تُخزَّن الفئات الخاصّة (الدين، الصحّة، العرق) كحقول.

## الأساس القانوني (المادتان ٦ و ٩)

- **الخدّام**: المادة ٦(١)(ب) — اتفاقيّة المشاركة التطوّعيّة؛ مع تكميل بالمادة ٦(١)(و) لتنسيق الفريق.
- **المخدومون**: المادة ٦(١)(و) — المصلحة المشروعة في الرعاية الروحيّة. وُثِّقت موازنة المصالح داخليّاً.
- **الانتماء الديني الضمني**: المادة ٩(٢)(د) — معالجة في إطار الأنشطة المشروعة لجمعيّة غير ربحيّة ذات هدف ديني، تتعلّق بأعضائها وبأشخاص على اتصال منتظم بها، مع ضمانات وعدم الكشف للغير دون موافقة.

لا تخضع الكنيسة لنظام كنسي خاصّ (مثل DSG-EKD أو KDG)؛ تنطبق اللائحة وقانون BDSG مباشرة.

## الأهداف

تنسيق الرعاية الروحيّة فقط. **لا تسويق، لا إعلانات، لا تحليلات، لا تنميط، ولا قرارات آليّة بحتة ذات أثر قانوني** (المادة ٢٢).

## المستلمون

- **Supabase, Inc.** — قاعدة البيانات والمصادقة و Edge Functions؛ EU/فرانكفورت؛ DPA سارية.
- **Google LLC (Google Calendar API)** — للقراءة فقط. لا تُرسَل بيانات أعضاء أو خدّام إلى Google.

## النقل الدولي

التخزين في الاتحاد الأوروبي (فرانكفورت). **لا نقل خارج الاتحاد الأوروبي/المنطقة الاقتصاديّة الأوروبيّة.**

## مدّة الاحتفاظ (ملخّص)

- الحسابات النشطة: طوال العلاقة.
- المخدومون غير النشطين: مراجعة بعد عامَين.
- المحذوفون رخواً: تُحذَف PII فوراً؛ يُحتَفَظ بالصفّ للمرجعيّة.
- المحذوفون نهائيّاً: يُحذَف الصفّ؛ تُجهَّل سجلّات الحضور.
- سجلّ التدقيق: ٥ سنوات. الإشعارات: سنة. السجلّات التشغيليّة: ≤ ٣٠ يوماً.
- سجلّ الموافقات: غير محدّد، append-only.

## حقوقك (المواد ١٥–٢٢)

الاطّلاع، التصحيح، الحذف، التقييد، قابليّة النقل، الاعتراض، سحب الموافقة، عدم الخضوع لقرارات آليّة بحتة. الخدّام عبر الإعدادات → الخصوصيّة. المخدومون عبر privacy@stmina.de. الردّ خلال شهر.

الحقّ في الشكوى أمام **Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)**، Promenade 18, 91522 Ansbach — https://www.lda.bayern.de/ — أو لدى السلطة الإشرافيّة في مكان إقامتك المعتاد أو مكان عملك.

## الأطفال

قد يكون المخدومون قاصرين يُسجَّلون بمعرفة الوالدَين. لا يجمع التطبيق بياناتٍ من الأطفال مباشرةً. الوالدان أو الوصيّ يطلبون الاطّلاع أو التصحيح أو الحذف عبر privacy@stmina.de.

## لا تتبّع

لا يقوم التطبيق بأيّ **تحليلات، أو تتبّع من جهات خارجيّة، أو إعلانات، أو قياس عن بُعد** يتجاوز سجلّات الأخطاء التشغيليّة (≤ ٣٠ يوماً). تُعلن بطاقة iOS «الاستخدام للتتبّع: لا» في كلّ فئة.

## الأمان (المادة ٣٢)

تشفير في حالة السكون (AES-256) وفي الاتصال (TLS)؛ Row-Level Security؛ وصول العميل عبر RPC حصراً؛ التوكنات في تخزين النظام الآمن؛ تقليل البيانات (لا صور للمخدومين في v1)؛ وصول مبني على الأدوار؛ سجلّ تدقيق؛ التزام الخدّام بالسرّيّة عبر شروط الاستخدام.

## الاتصال

privacy@stmina.de
`;

export const TERMS_EN = `version: 2026-04-28

# Terms of Service — St. Mina Connect

## Operator

St. Mina Coptic Orthodox Church, Munich, Germany. Contact: privacy@stmina.de.

## Audience

Servants (volunteers) and clergy authorised by the parish leadership. Members do not log in. By signing in you confirm you are at least 18 (or have explicit parish authorisation) and have entered into a volunteer agreement with the parish.

## Volunteer code of conduct and confidentiality

- Treat all member data as strictly confidential — including after leaving the team.
- Use the app only for pastoral coordination on behalf of the parish — not for marketing, fundraising, political activity, or any commercial or personal purpose.
- Enter accurate information.
- Respect a member's request to be removed; forward such requests to the privacy contact.
- Do not export, copy, or photograph member data outside the app.
- Use a strong unique password; report any suspected unauthorised access.

## Acceptable use

No accessing data outside your assigned scope; no reverse engineering, decompilation, or scraping; no unlawful, defamatory, or harassing content; no use on jailbroken/rooted devices for parish data.

## Account suspension

The parish may revoke access at any time, especially when a servant leaves the team or breaches these Terms.

## Personal data

The Privacy Policy is part of these Terms by reference. By accepting these Terms you also confirm having read it.

## No warranty

Service provided "as is" and "as available" without warranty, subject to mandatory consumer law. Statutory consumer rights are unaffected.

## Limitation of liability

Unlimited liability for intent, gross negligence, life/body/health, and Product Liability Act claims. For simple negligence: only breach of essential ("cardinal") obligations and only up to foreseeable typical damage. Mandatory GDPR/BDSG liability is unaffected.

## Governing law and jurisdiction

German law applies (excluding conflict-of-laws and CISG). Place of jurisdiction: Munich, Germany, to the extent permitted by law. Mandatory consumer-protection rules of the servant's residence are unaffected.

## Severability

Invalid provisions are replaced by the legally permissible regulation closest to the parties' intent. The remaining Terms remain in force.

## Changes

Material changes require re-acceptance on next sign-in. The accepted version is logged.

## Contact

privacy@stmina.de
`;

export const TERMS_DE = `version: 2026-04-28

# Nutzungsbedingungen — St. Mina Connect

## Anbieter

St. Mina Koptisch-Orthodoxe Kirche, München, Deutschland. Kontakt: privacy@stmina.de.

## Nutzerkreis

Diener (Ehrenamtliche) und Geistliche, autorisiert durch die Gemeindeleitung. Mitglieder melden sich nicht an. Mit der Anmeldung bestätigen Sie, mindestens 18 Jahre alt zu sein (oder eine ausdrückliche Genehmigung der Gemeinde zu besitzen) und eine ehrenamtliche Vereinbarung mit der Gemeinde geschlossen zu haben.

## Verhaltenskodex und Vertraulichkeit

- Sämtliche Mitgliederdaten streng vertraulich — auch nach Ausscheiden aus dem Team.
- Nutzung nur zur seelsorglichen Koordination im Auftrag der Gemeinde — nicht für Werbung, Spendensammlung, politische Aktivitäten oder kommerzielle/private Zwecke.
- Wahrheitsgemäße Angaben.
- Löschwünsche von Mitgliedern respektieren und an die Datenschutzkontaktstelle weiterleiten.
- Keine Mitgliederdaten exportieren, kopieren oder fotografieren außerhalb der App.
- Starkes, einzigartiges Passwort; Verdacht auf unbefugten Zugriff sofort melden.

## Zulässige Nutzung

Keine Zugriffe außerhalb des eigenen Bereichs; kein Reverse Engineering, keine Dekompilierung, kein Scraping; keine rechtswidrigen, ehrverletzenden oder belästigenden Inhalte; keine Nutzung auf jailbroken/rooted Geräten für Gemeindedaten.

## Sperrung

Die Gemeinde kann den Zugang jederzeit entziehen, insbesondere bei Ausscheiden oder Verstoß gegen diese Bedingungen.

## Personenbezogene Daten

Die Datenschutzerklärung ist durch Verweis Bestandteil dieser Bedingungen. Mit der Annahme bestätigen Sie, sie gelesen zu haben.

## Keine Garantie

Bereitstellung „wie besehen" und „wie verfügbar" ohne Gewährleistung, vorbehaltlich zwingenden Verbraucherrechts. Gesetzliche Verbraucherrechte bleiben unberührt.

## Haftungsbegrenzung

Unbegrenzt bei Vorsatz, grober Fahrlässigkeit, Leben/Körper/Gesundheit und nach dem Produkthaftungsgesetz. Bei einfacher Fahrlässigkeit nur Verletzung wesentlicher Vertragspflichten („Kardinalpflichten") und nur bis zum vorhersehbaren typischen Schaden. Zwingende Haftung nach DSGVO/BDSG bleibt unberührt.

## Geltendes Recht und Gerichtsstand

Deutsches Recht (unter Ausschluss kollisionsrechtlicher Vorschriften und des UN-Kaufrechts). Gerichtsstand München, soweit zulässig. Zwingende verbraucherschützende Regelungen des Wohnsitzlands bleiben unberührt.

## Salvatorische Klausel

Unwirksame Bestimmungen werden durch die rechtlich zulässige Regelung ersetzt, die dem ursprünglichen Willen am nächsten kommt. Die übrigen Bedingungen bleiben in Kraft.

## Änderungen

Wesentliche Änderungen erfordern eine erneute Bestätigung bei der nächsten Anmeldung. Die akzeptierte Version wird protokolliert.

## Kontakt

privacy@stmina.de
`;

export const TERMS_AR = `version: 2026-04-28

# شروط الاستخدام — St. Mina Connect

## الجهة المُشَغِّلة

كنيسة الشهيد مار مينا القبطيّة الأرثوذكسيّة، ميونخ، ألمانيا. الاتصال: privacy@stmina.de.

## الفئة المستهدفة

الخدّام (المتطوّعون) والإكليروس الذين فُوِّضوا من قِبَل قيادة الكنيسة. المخدومون لا يُسجّلون الدخول. بتسجيل الدخول تُقرّ بأنّك في الثامنة عشرة على الأقل (أو لديك إذن صريح من الكنيسة) وأنّك أبرمت اتفاقيّة خدمة تطوّعيّة مع الكنيسة.

## ميثاق الخدمة والسرّيّة

- التعامل مع جميع بيانات المخدومين بسرّيّة تامّة — حتى بعد ترك الفريق.
- استخدام التطبيق فقط لتنسيق الرعاية الروحيّة بالنيابة عن الكنيسة — لا للتسويق أو جمع التبرّعات أو النشاط السياسي أو أيّ غرض تجاري/شخصي.
- إدخال بيانات صحيحة.
- احترام طلبات الحذف وإحالتها إلى جهة الاتصال للخصوصيّة.
- عدم تصدير بيانات المخدومين أو نسخها أو تصويرها خارج التطبيق.
- استخدام كلمة مرور قويّة فريدة والإبلاغ عن أيّ اشتباه بوصول غير مصرّح به.

## الاستخدام المقبول

لا وصول خارج النطاق المحدّد؛ لا هندسة عكسيّة أو فكّ ترميز أو Scraping؛ لا محتوى مخالف للقانون أو مُسيء أو مضايق؛ لا معالجة بيانات الكنيسة على أجهزة Jailbroken/Rooted.

## تعليق الحساب

يحقّ للكنيسة إنهاء الوصول في أيّ وقت، خاصّة عند ترك الفريق أو مخالفة هذه الشروط.

## البيانات الشخصيّة

تُعدّ سياسة الخصوصيّة جزءاً من هذه الشروط بالإحالة. بالقبول تُؤكّد أنّك قد قرأتها.

## لا ضمانات

تُقدَّم الخدمة «كما هي» و«حسب التوفّر» دون ضمان، مع مراعاة الأحكام الإلزاميّة لحماية المستهلك. حقوق المستهلك القانونيّة لا تتأثّر.

## حدود المسؤوليّة

مسؤوليّة غير محدودة عن العمد والإهمال الجسيم وأضرار الحياة/الجسد/الصحّة وموجب قانون مسؤوليّة المنتج. في حالات الإهمال البسيط: فقط الإخلال بالالتزامات التعاقديّة الأساسيّة («Kardinalpflichten») وضمن الضرر النموذجي المتوقَّع. المسؤوليّة الإلزاميّة بموجب DSGVO/BDSG لا تتأثّر.

## القانون الحاكم والاختصاص

ينطبق القانون الألماني (مع استبعاد قواعد تنازع القوانين واتفاقيّة CISG). الاختصاص لمحاكم ميونخ، إلى الحدّ الذي يسمح به القانون. قواعد حماية المستهلك الإلزاميّة في بلد إقامة الخادم لا تتأثّر.

## الفصل بين البنود

يُستبدَل البند اللاغي بالتنظيم القانوني الأقرب إلى المقصد الأصلي للأطراف. تبقى البنود الأخرى نافذة.

## التعديلات

التغييرات الجوهريّة تستلزم إعادة الموافقة عند تسجيل الدخول التالي. تُسجَّل النسخة المقبولة.

## الاتصال

privacy@stmina.de
`;

export function getOfflineLegalDoc(kind: LegalDocKind, lang: LegalLang): string {
  if (kind === 'privacy') {
    if (lang === 'ar') return PRIVACY_AR;
    if (lang === 'de') return PRIVACY_DE;
    return PRIVACY_EN;
  }
  if (lang === 'ar') return TERMS_AR;
  if (lang === 'de') return TERMS_DE;
  return TERMS_EN;
}
