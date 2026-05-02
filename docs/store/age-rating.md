# Age Rating — Apple App Store and Google Play

Target ratings:

- **Apple App Store**: 4+
- **Google Play (IARC)**: Everyone

## Apple App Store — App Privacy & Age Rating questionnaire

For every category in App Store Connect → App Information → Age Rating, the answer is **None**.

| Category                                         | Answer | Rationale                                                                                                                                                                                    |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cartoon or Fantasy Violence                      | None   | No violence content of any kind.                                                                                                                                                             |
| Realistic Violence                               | None   | Same.                                                                                                                                                                                        |
| Prolonged Graphic or Sadistic Realistic Violence | None   | Same.                                                                                                                                                                                        |
| Profanity or Crude Humor                         | None   | Server-side validation rejects nothing; user-entered content is restricted to pastoral notes from servants on themselves and their members; not user-generated content shown to other users. |
| Mature/Suggestive Themes                         | None   | None.                                                                                                                                                                                        |
| Horror/Fear Themes                               | None   | None.                                                                                                                                                                                        |
| Medical/Treatment Information                    | None   | None.                                                                                                                                                                                        |
| Alcohol, Tobacco, or Drug Use or References      | None   | None.                                                                                                                                                                                        |
| Simulated Gambling                               | None   | None.                                                                                                                                                                                        |
| Sexual Content or Nudity                         | None   | None.                                                                                                                                                                                        |
| Graphic Sexual Content and Nudity                | None   | None.                                                                                                                                                                                        |
| Contests                                         | No     | None.                                                                                                                                                                                        |
| Unrestricted Web Access                          | No     | The only external links are to the Privacy Policy / Terms / support email — opened via `expo-web-browser`.                                                                                   |
| Gambling                                         | No     | None.                                                                                                                                                                                        |

Resulting rating: **4+**.

## Google Play — IARC questionnaire

Pass through the IARC tool's questionnaire ("Communication / Reference / Education" category). Answers:

| Topic                                                     | Answer                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Violence (any form)                                       | No                                                                                       |
| Sexual content or nudity                                  | No                                                                                       |
| Profanity, slurs, crude humor                             | No                                                                                       |
| Controlled substances (alcohol, tobacco, drugs, gambling) | No                                                                                       |
| Horror or fear themes                                     | No                                                                                       |
| User-generated content shared with other users            | No (pastoral notes are visible only to the assigned servant + admins; no public sharing) |
| Real-time interaction with other users                    | No (no chat / messaging / forum)                                                         |
| Sharing of users' physical location                       | No                                                                                       |
| Sharing of users' personal information with other users   | No (only servants + admins of the same parish see member contact info, by design)        |
| In-app digital purchases                                  | No (free app, no purchases)                                                              |
| Native ads / third-party ads                              | No                                                                                       |

Resulting rating: **Everyone**.

## Religious iconography rationale

The app icon incorporates a stylized cross derived from the Coptic Orthodox tradition. This is **not** a content trigger for either store:

- The cross is a brand identity mark (analogous to a national flag or monogram), not violent imagery, religious instruction, or a depiction of religious practice.
- The Apple App Store Review Guidelines (§ 1.1.6) restrict apps that "include defamatory, discriminatory, or mean-spirited content"; a community-care app with a denominational identity does not match that bar.
- Google Play's "Sensitive Events" and "Hate Speech" policies explicitly distinguish religious community apps from religious-extremism content.

If either reviewer raises the cross during review:

1. Reply via App Store Connect / Play Console messaging with: "St. Mina Connect is a pastoral-care companion for Coptic Orthodox parishes. The app icon is a brand identity mark referencing the parish's name. The app contains no instructional or proselytizing content; its function is attendance tracking and member follow-up for volunteer servants." Link the listing's full description.
2. If iOS rejects under Guideline 1.1.6, file an appeal via App Review Board with the same statement.
3. Ratings ≠ guideline rejections; ratings are answered exclusively from the questionnaire above and should remain 4+ / Everyone in either case.
