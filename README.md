# HSK 1 Practice & Tests — Platform (Prototype Build)

> ## 🎓 CURRICULUM COMPLETE — 15 / 15 lessons imported & validated (2026-10-21)
> All educational content originates exclusively from the instructor-supplied files
> (`《新HSK教程1》第1–15课.pdf` + dialogue screenshots). Final totals: **331 vocabulary items,
> 1,081 source sentences, 1,424 validated bank questions** across 15 chapters
> (14 Ready + ch14 "Needs Review" by design: same-POS twin 上, 4 questions excluded per §16).
> No further chapters are expected; the pipeline remains open for corrections or future volumes.

A functional, self-contained practice/quiz/analytics platform for HSK 1 (3.0).
**All educational content comes exclusively from instructor-supplied material.**
The app never invents vocabulary, sentences, pinyin, or grammar content. Real chapters
display **Content Pending** until their source material is imported and validated.

---

## 1. Quick start

1. Open `index.html` (student site) in any modern browser — no server or build step.
2. **One-time owner setup:** open `admin.html` (staff console) — if no account exists on that
   domain yet, it offers "Create owner account" (first account receives the `admin` role
   automatically). Self-registration for students does not exist anywhere in the platform.
3. Admin content management lives in a **separate page: `admin.html`** (link appears in the
   sidebar for admin accounts only; students are blocked). There you can load the
   **⚙ technical test fixture** (placeholder tokens, NOT curriculum) or import a processed
   chapter JSON (§4).
4. **Students sign in with Sheet credentials only** (name or StudentID + access code from the
   `Students` tab — the same credentials as the lecture site). There is no student
   registration form and no local-password fallback: if the Google Sheet is unreachable or
   not yet configured on that domain, student sign-in is blocked with a clear message.
   Every sign-in and answered question is tracked to the student's `StudentID`.
5. The sidebar can be **collapsed to icons** via the « button (persisted per user; full
   drawer behavior is kept on mobile).

Run automated tests: `./tests/run.sh` (requires Node + python3; 21 suites incl. registration-policy checks).

## 2. What is implemented (Phases 1–4 + engine core)

| Area | Status |
|---|---|
| Design system (dark charcoal + coral accent, Material-inspired, responsive, light theme) | ✅ |
| Navigation: Dashboard, Chapters, Vocabulary, Sentences, Listening, Wrong Answers, My Progress, Profile, Settings, Admin, Logout | ✅ |
| Global header controls: **pinyin toggle**, **timed-practice toggle**, theme, wrong-answer badge, avatar | ✅ (all functional, persisted, instant) |
| Local accounts, per-user data isolation, generated Student IDs, data export/reset | ✅ (prototype-grade, §6) |
| **9 activities** (Sentence Builder removed on instructor request, 2026-10-21): Words C→E, Words E→C, Word Matching (click-to-match, rounds), Listening (real Web Speech TTS, 0.75/1/1.25×, honest fallback), Flashcards (self-report tracked separately from scored mastery), Triple Match, Sentences E→C, Sentences C→E, Complete the Sentence | ✅ |
| Chapter Exam: configurable count, question palette, timed/untimed, **no reveals until graded**, auto-grade, results + review, exam history | ✅ |
| Question engine: stable IDs, source-item traceability, randomized order/positions, Complete vs Quick practice, keyboard support (1–4, Enter) | ✅ |
| Statistics: attempts vs unique questions, accuracy (skipped excluded), per-chapter/per-activity breakdowns, mastery states (Not Practiced / Learning / Needs Revision / Mastered), practice time by day, exam history — **all computed from real records; empty states shown otherwise** | ✅ |
| Wrong Answers: full history kept after improvement, filters (chapter/type/status), retry-one, targeted revision sessions, resolved/unresolved tracking | ✅ |
| Content pipeline: JSON import → extraction inventory → question generation → validation report → status gating (Pending → Processing → Needs Review → Ready) | ✅ |
| Admin console in a **separate page** (`admin.html`): chapter table, inline validation reports, re-validate/regenerate/delete, fixture management, JSON import, role management | ✅ |
| Collapsible sidebar (icons-only mode, persisted) | ✅ |
| Real Mandarin audio files / cloud TTS | ⏳ Phase 6 (browser TTS now; swap-in point documented) |
| Supabase Auth + PostgreSQL multi-device sync | ⏳ §6 migration plan |
| Teacher dashboard / Google Sheets | ⏳ data model kept independent; not faked |

### Pinyin integrity rules (implemented)
- Global toggle applies everywhere: cards, questions, options, flashcards, builder, reviews, chapter vocab tables.
- **Listening**: target hanzi/pinyin are hidden until submission; only revealed in feedback.
- **Cloze**: full-sentence pinyin is hidden while answering (it would leak the blank).
- Missing pinyin is **never generated** — items show a ⚠ flag and validation warnings; unverified pinyin on generated distractors is labeled `(pinyin unverified)`.

### Missing-content policy (implemented)
- Distractors come only from same-chapter source items or controlled structural variations of source sentences.
- If <3 reliable distractors exist, the question is still generated **with fewer options and flagged `review`** — it is excluded from exams until a human approves. Chapters with flagged questions get status **Needs Review**.
- Activities with insufficient source items show an explicit shortfall message instead of inventing content.

## 3. Architecture & data model

Single-page app, hash router, zero dependencies. All state lives in one JSON document
(`localStorage["hsk1_db_v1"]`) whose collections mirror the target relational schema:

| Collection (→ future table) | Fields (stable IDs, FKs) |
|---|---|
| `users` → Users/Profiles | id, studentId, name, role, createdAt, color |
| `settings` → UserSettings | per-user: pinyin, timed, theme, timePerQ, masteryCorrect, masteryDays |
| `chapters` → Chapters | id, num, title, status, sourceFile, importedAt, validation report, representative sentence |
| `vocab` → VocabularyItems | id, chapterId, hanzi, pinyin, english, sourceItemId, sourcePage, pinyinVerified |
| `sentences` → SourceSentences | id, chapterId, hanzi, pinyin, english, segments[], altOrders[], sourceItemId, sourcePage |
| `questions` → QuestionBank | id, chapterId, type, sourceItemId (+wordId/sentenceId), options, explanation, validation status |
| `attempts` → QuestionResponses | id, userId, chapterId, questionId, type, submitted, correct, skipped, ts, runId, ms |
| `vocabProgress` → VocabularyProgress | per user/word: correct, incorrect, distinct days, state, selfKnown, lastTs |
| `chapterProgress` → ChapterProgress | per user/chapter: startedAt, lastPracticedAt, per-activity stats |
| `exams` → ExamAttempts | id, userId, chapterId, ts, score, total, timed, durationSec, responses[] |
| `timeLog` → PracticeSessions | userId, date, seconds |

Separation kept per §17: source content ⟂ question presentation ⟂ student progress ⟂
historical attempts vs aggregates. Adding a chapter never touches component code.

### Twin-hanzi disambiguation (posHint)
When the source lists the same hanzi twice with different senses, C→E/Listening prompts show a small
chip with the source part-of-speech (e.g. 天 (n.) vs 天 (m.)) and the other sense becomes a legitimate
distractor — questions validate normally. If both senses share one POS (上 v./v.), the chip cannot
disambiguate: those questions are flagged `review` and excluded until an instructor decision.

### Cloze cap (instructor setting, 2026-10-21)
`CLOZE_PER_CHAPTER = 15` (core constant in `index.html`): Complete-the-Sentence generates at
most 15 questions per chapter, chosen round-robin over distinct source sentences (widest
coverage first, max 3 blanks per sentence). Change the constant and re-import (bump rev) to adjust.

### Mastery rule (configurable in Settings)
`Mastered` ⇔ ≥ N correct scored answers (default 3) across ≥ D distinct days (default 2).
Any wrong answer → `Needs Revision` (history preserved). Flashcard Known/Needs-Practice
self-reports are stored **separately** from scored mastery.

## 4. Content import contract (how YOUR materials enter the app)

Workflow when you send a chapter file (PDF/Word/scans/images):
1. The assistant reads **only your file**, extracts actual content (no inference from titles/levels).
2. You receive a **source inventory report** (counts, missing pinyin/translations, duplicates, unreadable sections).
3. Content is converted to the JSON below and imported via Admin → validated → status set to **Ready** or **Needs Review**.

```jsonc
{
  "chapter": {
    "num": 1,
    "title": "…exact title from the source…",
    "sourceFile": "chapter01.pdf",
    "representative": { "hanzi": "…", "pinyin": "…", "english": "…" }   // optional, from source
  },
  "vocab": [
    { "hanzi": "…", "pinyin": "…", "english": "…",
      "sourcePage": 12, "sourceItemId": "W1", "pinyinVerified": true }
    // pinyinVerified=true ONLY if pinyin came from the source or you confirmed it
  ],
  "sentences": [
    { "hanzi": "…", "pinyin": "…", "english": "…",
      "segments": ["word", "units", "…", "。"],   // segments.join("") MUST equal hanzi exactly
      "altOrders": [["…","…"]],                    // optional other accepted builder orders
      "sourcePage": 13, "sourceItemId": "S1" }
  ]
}
```

Import rules enforced by the validator: exactly one correct option per MCQ; distinct
options; full vocabulary coverage for C→E/E→C/Listening; builder segments must
reconstruct the source sentence; anything ambiguous → flagged `review`, never auto-published.

## 4b. Chapter 1 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第1课.pdf` (all 36 pages read) + instructor screenshots of the
textbook dialogue pages P1–P3. Bundle file: `content/chapter01.json` (auto-imported on
first launch through the same validated pipeline; status set by validation only).

**Extracted (nothing else):**
| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 1-2/1-4/1-6) | 14 | all with source pinyin + English + part of speech |
| Unique sentences | 35 | 6 vocab-card example groups (23), 10 dialogue lines, lesson title, 3 text intros, 2 tongue-twister lines (duplicates merged) |
| Sentences WITH source translation | 6 | title (p2), text intros (p4/10/24), tongue twister (p34) |
| Sentences WITH source pinyin | 12 | dialogue lines (screenshots), tongue twister, title |
| Dialogues | 3 texts / 10 lines | speakers preserved (王一飞 / 小语 / 学生们) |

**Current bank (69):** C→E 14 · E→C 14 · listening 14 · sentences E→C 6 · sentences C→E 6 · cloze 15 (cap).
Validation: 0 blocking issues, 0 flagged questions → chapter status **Ready**.

**Reported shortfalls (policy §2 — never invented):**
- 29 sentences have **no English translation in the source** → excluded from
  E→C/C→E/builder prompts (those activities show the real count: 6). They ARE used for
  cloze, distractor pools and flashcards (shown exactly as supplied, labeled
  "no translation in source"). Send translations whenever you wish and those activities
  grow automatically on re-import.
- 23 sentences have **no pinyin in the source** → pinyin stays hidden for them and each
  is listed as a validation warning (never auto-generated).
- Word matching / triple match / flashcards run on the 14 source words only.

## 4c. Chapter 2 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第2课.pdf` (all 39 pages read) + instructor screenshots of dialogue
pages P6–P8. Bundle: `content/chapter02.json` (auto-imported on launch; status set by validation).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 2-2/2-4/2-6) | 15 | all with source pinyin + English + part of speech |
| Unique sentences | 44 | 26 vocab-card examples, 10 dialogue lines, title, 3 text intros, 2 grammar examples, 2 tongue-twister lines, 2 read-aloud lines (duplicates merged) |
| Sentences WITH source translation | 8 | title (p2), intros (p4/17/27), grammar (p26 ×2), tongue twister (p37 ×2) |
| Sentences WITH source pinyin | 13 | dialogue lines (screenshots), tongue twister, title |
| Dialogues | 3 texts / 10 lines | speakers preserved (王一飞 / 陈天中 / 白家月 / 李文) |
| Deliberately skipped | — | drill frame 我叫…… (p16), label 贝拉 (p10), word-extension chips |

**Current bank (76):** C→E 15 · E→C 15 · listening 15 · sentences E→C 8 · sentences C→E 8 · cloze 15 (cap). Validation: 0 blocking issues, 0 flagged → **Ready**.
Shortfalls (reported, not invented): 36 sentences lack source translations (excluded from
translation-based prompts); 31 lack source pinyin (flagged warnings).

## 4d. Chapter 3 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第3课.pdf` (all 58 pages read) + instructor screenshots of dialogue
pages P10/P12/P14. Bundle: `content/chapter03.json`.

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 3-2/3-4/3-6) | 22 | incl. proper nouns 中国/法国/中文/泰国; all with source pinyin + English |
| Unique sentences | 78 | 44 vocab-card examples, 15 dialogue lines (multi-sentence lines split), 11 grammar-page read-aloud strings, title, 3 intros, 2 grammar explanations ×…, 2 tongue-twister lines (duplicates merged) |
| Sentences WITH source translation | 11 | title (p2), intros (p4/18/32), grammar explanations (p15/16/17/53), tongue twister (p56 ×2) |
| Sentences WITH source pinyin | 18 | dialogue lines (screenshots), tongue twister, title |
| Dialogues | 3 texts / 14 lines | speakers preserved (李文/白家月/安妮/陈天中/王一雪/王一飞) |
| Normalizations (reported) | 2 | inline glosses stripped: 你有（yǒu, have）姐姐吗？→ 你有姐姐吗？; 我妈妈（māma, mother）→ 我妈妈 |
| Deliberately skipped | — | teacher-picture placeholders (p31), extension chips |

**Generated bank (323):** C→E 22 · E→C 22 · listening 22 · sentences E→C 11 · sentences C→E 11 ·
**Current bank (103):** C→E 22 · E→C 22 · listening 22 · sentences E→C 11 · sentences C→E 11 · cloze 15 (cap). Validation: 0 blocking issues, 0 flagged → **Ready**.
Shortfalls (reported, not invented): 67 sentences lack source translations; 60 lack source pinyin.

## 4e. Chapter 4 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第4课.pdf` (all 60 pages read) + instructor screenshots of dialogue
pages P19/P22/P24. Bundle: `content/chapter04.json`.

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 4-2/4-4/4-6) | 21 | all with source pinyin + English + part of speech |
| Unique sentences | 75 | 44 vocab-card examples, 15 dialogue lines (one duplicate merged), grammar read-aloud strings, title, 3 intros, 4 grammar explanations |
| Sentences WITH source translation | 8 | title (p2), intros (p5/15/39), grammar explanations (p13/14/37/38) |
| Pinyin provenance | 15 source / 59 instructor-requested / 1 conflict-corrected | see flag below |
| Dialogues | 3 texts / 15 lines | speakers preserved (刘明 / 王一雪 / 杨同乐) |
| Skipped (reported) | — | p14 numbered sub-items (garbled extraction), p38 measure-formula chips (unreliable English alignment), p4 warm-up items, p16/p40 listening-MCQ stems, extension chips |

**✅ Conflict RESOLVED (instructor decision 2026-10-21):** the dialogue line originally extracted as 她今年十二。 (screenshot pinyin conflicted with the PDF p40 answer key) was confirmed by the instructor to read **她今年十四。 / Tā jīnnián shí'sì.** in the printed book. Hanzi, segments and pinyin updated; provenance set to source; bundle rev bumped to 5 so all devices re-import the corrected line. No open content flags remain.

**Generated bank (298):** C→E 21 · E→C 21 · listening 21 · sentences E→C 8 · sentences C→E 8 ·
**Current bank (94):** C→E 21 · E→C 21 · listening 21 · sentences E→C 8 · sentences C→E 8 · cloze 15 (cap). Validation: 0 blocking issues, 0 flagged → **Ready**.
Shortfall: 67 sentences lack source translations (excluded from translation-based prompts).

## 4f. Chapter 5 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第5课.pdf` (all 58 pages read) + instructor screenshots of dialogue
pages P28/P30/P32. Bundle: `content/chapter05.json`.

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 5-2/5-4/5-6) | 22 | all with source pinyin + English; note 星期日 & 星期天 both = "Sunday" in source |
| Unique sentences | 71 | 44 vocab-card examples, 15 dialogue lines, read-aloud strings, title, 3 intros, 3 grammar explanations; p13 slash variants expanded (reported) |
| Sentences WITH source translation | 7 | title (p2), intros (p5/24/40), grammar explanations (p22/23/39) |
| Pinyin provenance | 17 source / 54 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 15 lines | speakers 王一雪 / 刘明 / 杨同乐 |
| Skipped (reported) | — | p4 warm-up items, p22 arrow formula, p23 annotation, p25/p41 listening stems, extension chips |

**Current bank (95):** C→E 22 · E→C 22 · listening 22 · sentences E→C 7 · sentences C→E 7 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.
Engine fix shipped with this chapter: MCQ distractor selection now excludes options whose
text/hanzi equals the correct answer (caught by validation on 星期日/星期天 "Sunday" twins);
all bundles bumped to rev 3 so every device regenerates banks with the fix.

## 4g. Chapter 6 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第6课.pdf` (all 62 pages read) + instructor screenshots of dialogue
pages P36/P37/P39. Bundle: `content/chapter06.json` (built from `content/ch06.tsv` extraction table).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 6-2/6-4/6-6) | 23 | incl. proper noun 西安饭店; all with source pinyin + English |
| Unique sentences | 69 | 44 vocab-card examples, 14 dialogue lines (好的。 merged across texts), read-aloud/grammar examples, title, 3 intros, 3 grammar explanations |
| Sentences WITH source translation | 7 | title (p2), intros (p5/13/34), grammar explanations (p33/56/58) |
| Pinyin provenance | 15 source / 54 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 14 lines | speakers 李文 / 白家月 / 陈天中 / 王一雪 / 刘明 / 刘小雪 / 刘小明 |
| Normalizations (reported) | 2 | grammar glosses stripped: 想+动词（verb）→ 想+动词; 怎么+动词(verb）→ 怎么+动词; source typo kept verbatim in intro3 English |
| Skipped (reported) | — | p4 warm-up items, p14/p35 listening stems, p56/57 annotation labels, extension chips |

**Current bank (98):** C→E 23 · E→C 23 · listening 23 · sentences E→C 7 · sentences C→E 7 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4h. Chapter 7 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第7课.pdf` (all 70 pages read) + instructor screenshots of dialogue
pages P46/P48/P51. Bundle: `content/chapter07.json` (built from `content/ch07.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 7-2/7-4/7-6) | 27 | all with source pinyin + English |
| Unique sentences | 81 | 54 vocab-card examples, 15 dialogue lines (好的。明天呢？ split), 6 read-aloud, title, 3 intros, 2 grammar explanations |
| Sentences WITH source translation | 6 | title (p2), intros (p5/26/46), grammar explanations (p44/45) |
| Pinyin provenance | 16 source / 65 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 15 lines | speakers 白家月 / 安妮 / 李文 / 王一雪 / 刘明 |
| Skipped (reported) | — | p4 warm-up times, p23/24 time-formula fragments, p27/p47 listening stems, extension chips |

**Current bank (108):** C→E 27 · E→C 27 · listening 27 · sentences E→C 6 · sentences C→E 6 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.
Engine hardening shipped here: distractor selection now dedupes among distractors themselves
(caught a double-"Sunday" option from 星期日/星期天 in ch5); all bundles bumped to rev 4.

## 4i. Chapter 8 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第8课.pdf` (all 62 pages read) + instructor screenshots of dialogue
pages P55/P56/P59. Bundle: `content/chapter08.json` (built from `content/ch08.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 8-2/8-4/8-6) | 24 | incl. proper noun 胡医生; all with source pinyin + English |
| Unique sentences | 78 | 48 vocab-card examples, 17 dialogue lines (multi-sentence lines split, read-aloud merges), 7 read-aloud, title, 3 intros, 2 grammar explanations |
| Sentences WITH source translation | 6 | title (p2), intros (p5/27/45), grammar explanations (p43/44) |
| Pinyin provenance | 18 source / 60 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 16 lines | speakers 白家月 / 陈天中 / 李文 / 刘明 / 胡医生 |
| Normalizations (reported) | 2 | grammar glosses stripped (在+…词语（…）+动词(verb） / 能+动词（verb)) |
| Skipped (reported) | — | p4 warm-up items, p26 position-word list, p28/p46 listening stems, extension chips |

**Current bank (99):** C→E 24 · E→C 24 · listening 24 · sentences E→C 6 · sentences C→E 6 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4j. Chapter 9 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第9课.pdf` (all 59 pages read) + instructor screenshots of dialogue
pages P62/P64/P65. Bundle: `content/chapter09.json` (built from `content/ch09.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 9-2/9-4/9-6) | 23 | all with source pinyin + English |
| Unique sentences | 80 | 46 vocab-card examples, 19 dialogue lines (multi-sentence lines split), 8 read-aloud/ordinal strings, title, 3 intros, 3 grammar explanations |
| Sentences WITH source translation | 7 | title (p2), intros (p5/18/34), grammar explanations (p16/17/33) |
| Pinyin provenance | 20 source / 60 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 19 lines | speakers 李文 / 白家月 / 陈天中 / 王一雪 / 杨同乐 |
| Skipped (reported) | — | p4 warm-up items, p9 measure chips (两家人/一家公司/一家水果店), p17 adverbial labels, p19/p35 listening stems, extension chips |

**Current bank (98):** C→E 23 · E→C 23 · listening 23 · sentences E→C 7 · sentences C→E 7 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4k. Chapter 10 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第10课.pdf` (all 62 pages read) + instructor screenshots of dialogue
pages P71/P73/P75. Bundle: `content/chapter10.json` (built from `content/ch10.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 10-2/10-4/10-6) | 23 | all with source pinyin + English |
| Unique sentences | 81 | 47 vocab-card examples, 19 dialogue lines (multi-sentence lines split; 苹果三块五一斤。 merged card/dialogue), 9 read-aloud + money-equation line, title, 3 intros, 3 grammar explanations |
| Sentences WITH source translation | 7 | title (p2), intros (p5/21/36), grammar explanations (p19/35/58) |
| Pinyin provenance | 20 source / 61 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 19 lines | speakers 王一雪 / 刘明 / 售货员 |
| Skipped (reported) | — | p4 warm-up items, p22/p37 listening stems, annotation labels (p20/35/58), extension chips |

**Current bank (98):** C→E 23 · E→C 23 · listening 23 · sentences E→C 7 · sentences C→E 7 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4l. Chapter 11 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第11课.pdf` (all 64 pages read) + instructor screenshots of dialogue
pages P79/P81/P83. Bundle: `content/chapter11.json` (built from `content/ch11.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 11-2/11-4/11-6) | 25 | all with source pinyin + English |
| Unique sentences | 82 | 52 vocab-card examples, 17 dialogue lines (multi-sentence lines split), 7 read-aloud/affirmative-negative strings, title, 3 intros, 2 grammar explanations |
| Sentences WITH source translation | 6 | title (p2), intros (p5/20/36), grammar explanations (p34/61) |
| Pinyin provenance | 18 source / 64 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 17 lines | speakers 王一飞 / 李文 / 刘明 / 刘小雪 |
| Skipped (reported) | — | p4 warm-up items, p21/p37 listening stems, annotation labels, extension chips |

**Generated bank (102):** C→E 25 · E→C 25 · listening 25 · sentences E→C 6 · sentences C→E 6 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4m. Chapter 12 — source inventory & coverage (APPROVED with one policy flag)

Source: `《新HSK教程1》第12课.pdf` (all 65 pages read) + instructor screenshots of dialogue
pages P87/P89/P91. Bundle: `content/chapter12.json` (built from `content/ch12.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 12-2/12-4/12-6) | 24 | 天 appears TWICE in source with distinct senses (n. weather / m. day) — both kept as separate source items |
| Unique sentences | 87 | 53 vocab-card examples (incl. p48 equality pairs as 4 source sentences), 15 dialogue lines, 13 read-aloud strings, title, 3 intros, 3 grammar explanations |
| Sentences WITH source translation | 7 | title (p2), intros (p5/27/42), grammar explanations (p25/26/41) |
| Pinyin provenance | 16 source / 71 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 15 lines | speakers 王一雪 / 王一飞 / 杨同乐 / 胡医生 |
| Skipped (reported) | — | p4 warm-up items, p6/p28/p43 listening stems, garbled chip 小王，你来一下 (p32), extension chips |

**✅ Twin-hanzi RESOLVED (instructor decision 2026-10-21: keep both senses):** the engine now
disambiguates same-hanzi vocab on-screen with a **source part-of-speech chip** (posHint: n. vs m.) on
C→E and Listening prompts, and the other sense becomes a legitimate distractor — all questions
validated, 0 flagged → chapter **Ready**. Matching/Triple still skip duplicate-hanzi words.

**Generated bank (101, all practicable):** C→E 24 · E→C 24 · listening 24 · sentences E→C 7 ·
sentences C→E 7 · cloze 15 (cap) — minus the 4 review-flagged from practice/exams.

## 4n. Chapter 13 — source inventory & coverage (APPROVED; dialogues reported MISSING)

Source: `《新HSK教程1》第13课.pdf` (all 57 pages read) + instructor screenshots of dialogue
pages P96/P98/P100 (received 2026-10-21, imported as **rev 2**). Bundle: `content/chapter13.json`.

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 13-2/13-4/13-6) | 20 | all with source pinyin + English |
| Unique sentences | 74 | 41 vocab-card examples, 19 dialogue lines (multi-sentence lines split; read-aloud merges), 8 read-aloud strings, title, 3 intros, 1 grammar explanation |
| Sentences WITH source translation | 5 | title (p2), intros (p5/21/45), grammar (p44) |
| Pinyin provenance | 20 source / 54 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 19 lines | speakers 白家月 / 王一飞 / 陈天中 / 服务员 / 刘明 (added rev 2 from screenshots) |
| Skipped (reported) | — | p4 warm-up items, p6/p22/p46 listening stems, p20 annotation labels, extension chips |

**Generated bank (85):** C→E 20 · E→C 20 · listening 20 · sentences E→C 5 · sentences C→E 5 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4o. Chapter 14 — source inventory & coverage (APPROVED with one policy flag)

Source: `《新HSK教程1》第14课.pdf` (all 70 pages read) + instructor screenshots of dialogue
pages P104/P107/P109. Bundle: `content/chapter14.json` (built from `content/ch14.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 14-2/14-4/14-6) | 28 | incl. proper nouns 汉语/汉字; 上 appears twice with distinct senses (go up / begin at fixed time) |
| Unique sentences | 86 | 58 vocab-card examples, 17 dialogue lines (multi-sentence lines split; 我们都会写了。 merged read-aloud/dialogue), 5 read-aloud, title, 3 intros, 3 grammar explanations |
| Sentences WITH source translation | 7 | title (p2), intros (p5/23/45), grammar (p20/21/44); source typo kept verbatim in intro2 English (porcess) |
| Pinyin provenance | 18 source / 68 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 17 lines | speakers 白家月 / 陈天中 / 王一飞 / 刘明 / 王一雪 |
| Skipped (reported) | — | p4 warm-up items, p6/p24/p46 listening stems, annotation labels, extension chips |

**⚑ Policy flag (instructor decision 2026-10-21: keep both senses):** unlike ch12, the twin senses
of 上 share the SAME part of speech (v. / v.), so a POS chip cannot disambiguate the C→E/Listening
prompt. Per §16 those 4 questions stay flagged `review` (excluded from practice and exams), E→C stays
validated, Matching/Triple skip duplicate-hanzi words, and the chapter shows **Needs Review** while
remaining fully practicable. To make it Ready: drop one sense, or accept the permanent exclusion.

**Generated bank (113; 109 practicable):** C→E 28 · E→C 28 · listening 28 · sentences E→C 7 ·
sentences C→E 7 · cloze 15 (cap).

## 4p. Chapter 15 — source inventory & coverage (APPROVED, imported from YOUR files)

Source: `《新HSK教程1》第15课.pdf` (all 50 pages read) + instructor screenshots of dialogue
pages P113/P115/P117. Bundle: `content/chapter15.json` (built from `content/ch15.tsv`).

| Item | Count | Notes |
|---|---|---|
| Vocabulary (生词 15-2/15-4/15-6) | 20 | incl. proper nouns 西安 / 北京 / 大兴机场; all with source pinyin + English |
| Unique sentences | 60 | 37 vocab-card examples, 16 dialogue lines (multi-sentence lines split), 2 read-aloud, title, 3 intros, 1 grammar explanation |
| Sentences WITH source translation | 5 | title (p2), intros (p5/14/26), grammar (p13); source typo kept verbatim in intro1 English |
| Pinyin provenance | 17 source / 43 instructor-requested | no missing pinyin |
| Dialogues | 3 texts / 16 lines | speakers 李文 / 白家月 / 陈天中 / 安妮 / 王一飞 |
| Skipped (reported) | — | p4 warm-up items, p6/p15/p27 listening stems, p13 annotation labels, extension chips |

**Generated bank (85):** C→E 20 · E→C 20 · listening 20 · sentences E→C 5 · sentences C→E 5 · cloze 15 (cap).
Validation: 0 issues, 0 flagged → **Ready**.

## 4q. Final acceptance map (Master Prompt §23) — 2026-10-21

| Acceptance criterion | Status |
|---|---|
| Website functional & responsive (desktop/tablet/mobile, collapsible sidebar) | ✅ tested + responsive rules |
| Every chapter based exclusively on instructor material | ✅ 15 bundles with per-item provenance (source file + page + item id) |
| No unauthorized educational content published | ✅ translations never invented; pinyin completion only under explicit instructor request, tagged `instructor-requested`; conflicts tagged & reported (ch4 resolved by instructor) |
| Each chapter has its own dashboard | ✅ chapter view with per-activity stats, word table, mastery |
| All practice activities work | ✅ 9 activities + chapter exam (Sentence Builder removed on instructor request 2026-10-21) |
| Vocabulary coverage verifiable | ✅ per-chapter tests assert every word appears in C→E/E→C/Listening |
| Sentence MCQs contain valid answer keys | ✅ single-correct + distinct-options invariants tested per chapter |
| Complete-the-Sentence uses source sentences | ✅ blanks only on source segments; key = removed segment (tested) |
| Sentence Builder checks valid constructions | ➖ activity removed by instructor decision (was implemented & tested before removal) |
| Global pinyin visibility everywhere, instant, non-destructive | ✅ CSS-class driven; regression-tested; integrity rules for listening/cloze kept |
| Student accounts & profiles with configured auth | ✅ prototype-grade local auth (documented limitation; Supabase migration path in §6) |
| Progress persists with configured storage | ✅ localStorage per user (single-device prototype, clearly labeled; not claimed as multi-user DB) |
| Attempts vs unique questions counted correctly | ✅ tested (skipped excluded from accuracy; unique-wrong ≠ wrong-attempts) |
| Incorrect answers remain available for revision | ✅ wrong-answer history kept after improvement; revision sessions |
| Statistics computed from real records only | ✅ empty states otherwise; no fabricated numbers |
| Audio works where configured | ✅ browser Mandarin TTS with speed control + honest fallback (never simulated); MP3/cloud-TTS swap point documented |
| Question bank validated before publication | ✅ validation gates status (Ready / Needs Review); flagged items excluded from practice & exams |
| No fake statistics or nonfunctional controls | ✅ every header control functional & regression-tested |
| New chapters addable without rebuilding | ✅ content/*.json → inject_bundle.py → validated import (15 iterations proven) |
| Setup instructions & documentation | ✅ this README + per-chapter inventories 4b–4p |

## 4r. Google Sheets integration (lecture-site Sheet) — shipped 2026-10-21

The practice site now shares the lecture site's **login** and pushes **comprehensive
per-student tracking** into the same spreadsheet ("HSK 1 3.0"), via a real Google Apps
Script bridge (`tools/sheets_bridge.gs`). Since 2026-10-22 the deployed build ships with the
bridge credentials **baked in** (`SYNC_DEFAULTS`), so student sign-in and tracking work on any
domain with zero per-browser setup; the staff console can override or disable them per browser
(Sheets Sync card), and until the bridge is reachable tracking stays local (the app never claims
a connection it doesn't have).

### Deploy (once, ~3 minutes) — SEPARATE standalone Apps Script project!
Your spreadsheet already hosts the lecture site's own Apps Script project (Code.gs with its
own doPost/doGet). **Never paste the bridge into that project** — duplicate `doPost`
definitions would collide and break the lecture site. Instead:
1. https://script.google.com → **New project** (standalone) → paste `tools/sheets_bridge.gs`.
2. Set `SPREADSHEET_ID` (from the sheet URL `/d/<id>/edit`) and `TOKEN` (a secret string).
3. **Deploy → New deployment → Web app** (Execute as: *Me*, Access: *Anyone*) → copy the `/exec` URL.
4. **Admin site** (`admin.html` — separate from the student site) → *Google Sheets sync* card: the shipped build already contains the `/exec` URL + token as `SYNC_DEFAULTS` (Config source: *build default*), pre-filled in the card — press *Test connection* (lists the tabs it sees). Only press *Save* if you re-deployed the bridge with a new URL/token (the save overrides for that browser; *Restore build default* reverts).
5. Optional: *Push lessons catalog* writes/updates the `Lessons` tab from the validated bundles.

### Admin site redesign — "Mission Control" (2026-10-22)
`admin.html` was rebuilt from scratch as a dark ops-console: left sidebar navigation
(Overview / Teacher Analytics / Content Pipeline / Sheets Sync / Accounts), topbar with live
status LEDs (SYNC LIVE·OFF·ERR, outbound queue depth, flagged count, staff chip), monospace
metrics, KPI tiles with accent rails, dense data tables with sticky headers, and the full
teacher analytics suite (cohort KPIs, throughput-by-day chart, per-activity accuracy,
per-lesson coverage, most-missed with miss-rate bars, student roster → individual dossier).
**The sync URL & token are stored under the same keys (`hsk1_sync_cfg`) and are pre-filled
in the Sync tab — your existing connection settings survive the redesign untouched.**

### Separation of sites (owner decision 2026-10-21)
- `index.html` = **students only**: practice, exams, personal stats, wrong answers, settings.
  The admin console and teacher dashboard are NOT here (their routes redirect out).
- `admin.html` = **staff only**: content import/validation, Sheets sync management, and the
  **Teacher Dashboard** tab (cohort + per-student analytics, from the Sheet when connected).

### Behaviour
- **Unified login (sheet-only, registration disabled by owner decision):** the student login page authenticates exclusively against the `Students` tab (StudentID or name + `Code`, `AccountStatus=active`). On success a local profile is created/linked (`sheetId`) so all progress maps to the Sheet student; the header chip shows `⬆ stu-XXXX` when linked. There is no self-registration and no local-password fallback for students — if the Sheet is disabled/unreachable on that browser, sign-in is refused with guidance to contact the teacher. Every successful login writes a `LoginLog` row (Site=practice). Staff/owner accounts are created once via the `admin.html` gate (first-time owner setup) and never appear in the Sheet.
- **Baked-in deployment default (owner-approved 2026-10-22):** the bridge web-app URL + token (`SYNC_DEFAULTS`) are compiled into `index.html`/`admin.html`, so **every student browser on any deployed domain (Vercel / GitHub Pages / local) can sign in via the Sheet with zero per-device setup** — previously the connection lived only in each browser's localStorage, which blocked every fresh device (the "Sheet sign-in is not configured on this browser" notice). The staff console's Sheets Sync card can still override the values per browser (Save), disable sync on that device (save empty values), or revert (Restore build default); the `Config source` row shows which is active. The token remains a light classroom gate, not a security boundary.
- **Tracking pushed (batched every 2 s, queued offline, retried, upserted — no duplicates):**
  | Event | Sheet tab | Key |
  |---|---|---|
  | each submitted/skipped attempt | `LearningEvents` (append) + `StudentQuizStats` + `QuizStats` (upsert/bump) | StudentID+QuestionID / QuestionID |
  | practice session (runner open→close) | `Sessions` | SessionID |
  | per-lesson aggregate at session end | `StudentLessonProgress` | StudentID+LessonID |
  | vocabulary mastery changes | `StudentVocabularyProgress` | StudentID+WordID |
  | exam results | `LearningEvents` (EventType `exam_result`, JSON note) | — |
- **Stable cross-device IDs:** `LessonID = lesson-<num>`; `WordID = sourceItemId`; `QuestionID = <type>:<sourceItemId>[:blankIndex]` (semantic, not local random ids), so aggregates merge correctly across devices.
- **Schema-tolerant:** existing tabs/columns are never overwritten; missing headers are appended; `Students` is read-only for login.
- Failures are silent to students (queue retained, last status visible in Settings/Admin).

## 4s. Teacher Dashboard (cohort + per-student analytics) — shipped 2026-10-21

Route `#/teacher` (admin role only; nav item 🎓). Students can never open it (role-guarded,
and their own views only ever query their own records).

- **Data source:** when Sheet sync is configured → `analytics` action of `sheets_bridge.gs`
  returns the raw tabs (Students, Sessions, StudentLessonProgress, StudentVocabularyProgress,
  StudentQuizStats, QuizStats, LearningEvents) and the app aggregates them → **all students on
  all devices**. Without sync → identical UI from local device data, explicitly labeled
  "LOCAL DEVICE DATA ONLY".
- **Cohort view:** KPI tiles (students + active-7d, correct/incorrect/skipped, accuracy, total
  time + sessions + exams), per-day attempts/time chart (bar colour = accuracy), accuracy by
  activity type, per-lesson started/completed/accuracy, cohort most-missed questions.
- **Per-chapter analysis:** a chapter table (students, attempts, accuracy bar, time on chapter,
  words mastered/learning/revision, exam results); clicking a chapter opens its **dossier**:
  KPI tiles + by-activity accuracy + by-student breakdown + most-missed questions inside that
  chapter. Aggregated by `aggregateAnalytics().lessons` (unit-tested).
- **Per-student drill-down:** click any row → attempts/correct/incorrect/skipped, accuracy,
  time & sessions, lessons started/completed, words mastered/needs-revision, per-lesson and
  per-activity tables, personal most-missed list, recent activity feed, exam count.
- **Pure aggregation:** `aggregateAnalytics(raw)` is a pure function, unit-tested
  (`tests/analytics.test.js`, 17 assertions) against synthetic sheet-shaped data; skipped
  attempts excluded from accuracy everywhere, unique-question logic preserved.

## 5. Testing

`tests/logic.test.js` (40 assertions) covers: question generation & coverage, single
correct-answer invariant, shuffle→answer-key mapping (50 runs), builder/cloze fidelity to
source, attempt vs unique-question counting, skipped exclusion from accuracy, wrong-answer
history & resolution, mastery state machine (incl. demotion with history kept), multi-user
data isolation, auth failures, import validation, missing-content flagging, and the in-app
`selfCheck()`.

## 6. Known limitations & migration plan (honest status)

- **Persistence is browser-local (localStorage).** Prototype only: single device, not a
  secure multi-user database, passwords are obfuscated **not** hashed. No cross-device sync
  is claimed. → Replace the `loadDB/saveDB` + auth layer with **Supabase (Auth + PostgreSQL)**;
  the collection shapes above map 1:1 to tables; `recordAttempt` and stats become SQL/RLS-backed.
- **Answer keys live client-side** in the prototype — fine for self-study, not tamper-proof.
  → With a backend, the exam runner fetches questions without keys and posts responses for
  server-side grading (already structured: keys are separate fields on bank records).
- **Audio uses the browser's built-in zh-CN speech synthesis.** Voice quality/availability
  varies; the app never simulates playback (explicit fallback notices). → Phase 6: pre-generate
  MP3s per source item (allowed: audio for existing source text) and store URLs on vocab/sentences.
- Frontend is dependency-free vanilla JS in one file for portability. → A React+TypeScript+Tailwind
  port can lift the same modules (engine, runners, stats) with components replacing the `h()` helper.

## 7. File map

```
hsk1-platform/
├── index.html             # STUDENT SITE (design system + engine + views + collapsible sidebar)
├── admin.html             # ADMIN CONSOLE — separate page; BUILT FILE, do not edit directly
├── README.md
├── tools/
│   ├── admin.template.html  # admin UI template (@@STYLE@@/@@CORE@@ placeholders)
│   └── build_admin.py       # injects shared CSS + core JS from index.html into admin.html
└── tests/
    ├── run.sh             # syntax checks + both test suites
    ├── logic.test.js      # 40 automated logic assertions (engine/stats/isolation/policy)
    ├── admin.smoke.js     # admin console smoke tests (gate, roles, chapter pipeline)
    └── domstub.js         # minimal DOM/localStorage stub for Node
```

### Shared-core build rule
The core engine (store, auth, generator, validator, import) exists **once**, inside
`index.html` between `@@CORE-START@@` / `@@CORE-END@@` markers. After ANY core change run:

```bash
python3 tools/build_admin.py    # regenerates admin.html
./tests/run.sh                  # 44 checks across both pages
```