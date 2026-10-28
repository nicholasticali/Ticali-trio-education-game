# Grade 1 math research: revised Maryland standards and Reveal Math (AACPS, 2026-27)

Pass date: 2026-10-22. Scope: first grade math, AACPS, 2026-27.

## Method and limits

- **No primary document was opened.**
  - WebFetch returned `getaddrinfo ENOTFOUND` for every host tried: marylandpublicschools.org, commonplanner.com, mheducation.com, amplify.com and gorockets.org. That includes the non-Maryland hosts.
  - curl through the egress proxy returned `CONNECT tunnel failed, response 403` for marylandpublicschools.org and commonplanner.com.
- All evidence comes from WebSearch result summaries that quote MSDE PDFs. Some of those summaries are garbled where a PDF table was flattened. Where that matters, it is flagged.
- 33 searches were used, over the budget of about 25. The extra eight went on the make-10/fluency-within-5 conflict (section 3) and on the Reveal unit order.
- Verdict scale (same as the October report):
  - **confirmed**: an MSDE document is quoted directly and nothing contradicts it, or two MSDE documents agree.
  - **partly**: the core of the claim holds but a detail does not, or a detail rests only on a draft or a third-party source.
  - **unverified**: the evidence is not enough either way.
  - **refuted**: the evidence contradicts the claim.

### Documents involved (all MSDE unless noted)

| Document | URL | Status seen |
|---|---|---|
| Grade 1 crosswalk, adopted | https://marylandpublicschools.org/about/documents/dcaa/math/revised/grade-1-mccrs-math-crosswalk-a.pdf (also indexed as `.../Grade-1-MCCRS-Math-Crosswalk-A.pdf`) | Header "Adopted: July 2025, Implementation: SY 2026-2027" |
| Grade 1 crosswalk, May 2025 draft | https://marylandpublicschools.org/about/Documents/DCAA/Math/revised/Grade_1_MCCRS_Math_Crosswalk_5.2.25-A.pdf | Draft. A June 2025 "DRAFT Grade 1 MCCRS Mathematics Crosswalk" is also indexed. |
| **Grade 1 Standard Companion Guide** | https://marylandpublicschools.org/about/Documents/DCAA/Math/revised/Grade-1-MCCRS-Math-Standard-Companion-Guide-A.pdf | Exists (found in this pass); version date not seen |
| State Board adoption packet, 29 July 2025 | https://www.marylandpublicschools.org/stateboard/Documents/2025/0729/Maryland-College-and-Career-Ready-Standards-for-Math-A.pdf | Bundles the crosswalks presented for adoption; summaries call its tables "draft" |
| K crosswalk (adopted) and K companion guide (V2, April 2026) | https://marylandpublicschools.org/about/documents/dcaa/math/revised/k-mccrs-math-crosswalk-a.pdf ; https://marylandpublicschools.org/about/documents/dcaa/math/revised/k-mccrs-math-standard-companion-guide-a.pdf | Used for the make-10 question |
| Old (2010-based) grade 1 standards and framework | https://marylandpublicschools.org/about/Documents/DCAA/Math/MCCRSM/MCCRSM-Grade1-A.pdf ; https://www.marylandpublicschools.org/about/Documents/DCAA/Math/MCCRSM/Maryland-Grade-1-Framework-A.pdf | Superseded for 2026-27; used only to see what changed |
| Revised-standards hub | https://marylandpublicschools.org/about/pages/dcaa/math/revised-standards.aspx | Links a crosswalk and a companion guide for each grade |

---

## 1. Status and structure

### 1.1 The revised standards govern grade 1 in 2026-27 — **confirmed**

- The grade 1 crosswalk header reads: "Grade 1 Maryland College and Career Ready Standards for Mathematics Standards Crosswalk Document, Mathematics Branch, **Adopted: July 2025, Implementation: SY 2026-2027**".
- The hub page says the standards are "presented in a crosswalk format, displaying the new standards alongside their previous versions to clearly highlight shifts in content and instructional focus."
- One search summary claimed "the older 1.OA.D.7 wording still governs current classrooms". That is the summarizer's own error: the implementation year is the current school year.

### 1.2 Grade 1 uses the four domains NOS, AT, GR and DS — **confirmed**

The adopted crosswalk and the companion guide both use these four domains.

| Domain | What it replaces in grade 1 |
|---|---|
| NOS | 1.NBT, most of 1.OA, and the 1.G.A equal-parts standard |
| AT | 1.OA.A word problems and 1.OA.D equations |
| GR | "Geometric Reasoning and Measurement (GR). Previously Measurement and Data (MD); Geometry (G)." |
| DS | 1.MD.C data |

### 1.3 Grade 1 cluster map as reconstructed

The standards are numbered straight through each domain. The numbers seen (NOS A.1 → F.14, GR A.1 → C.6) fit together without gaps or clashes, which supports the reconstruction.

| Cluster | Heading (as quoted where available) | Previously | Codes seen |
|---|---|---|---|
| 1.NOS.A | Counting sequence | 1.NBT.A | A.1, A.2 |
| 1.NOS.B | "UNDERSTAND PLACE VALUE AND REPRESENTATIONS OF NUMBERS" | 1.NBT.B (+ 2.MD.B.6) | B.3, B.4, B.5 |
| 1.NOS.C | Properties of operations and the relationship between addition and subtraction | 1.OA.B | (C.6-C.7 inferred) |
| 1.NOS.D | "Add and subtract within 20" | 1.OA.C | D.9 (D.8 inferred) |
| 1.NOS.E | Place value to add and subtract | 1.NBT.C | E.10, E.11 (E.12-13 inferred) |
| 1.NOS.F | "UNDERSTAND EQUAL PARTS OF A WHOLE" | 1.G.A | F.14 |
| 1.AT.A | Equations and word problems | 1.OA.D, 1.OA.A | A.1 (A.2-A.3 third-party only) |
| 1.GR.A | "MEASURE LENGTHS INDIRECTLY AND BY ITERATIVE LENGTH UNITS" | 1.MD.A | (A.1-A.2 inferred) |
| 1.GR.B | "REASON WITH SHAPES AND THEIR ATTRIBUTES" | 1.G.A | B.3, B.4 |
| 1.GR.C | "WORK WITH TIME AND MONEY" | 1.MD.B | C.5, C.6 |
| 1.DS.A | Represent and interpret data | 1.MD.C | A.1 |

---

## 2. Number and Operation Sense (NOS)

### 2.1 Counting within 120 — **confirmed, with a change: counting backward is added**

- The adopted crosswalk has "**1.NOS.A.1 Count forward and backward within 120.**" Its sub-parts cover counting by ones from any number and skip counting by tens.
- It maps to the old 1.NBT.A.1, which was forward counting to 120 "starting at any number less than 120".
- The crosswalk says the old standard was split. Reading and writing numerals within 120 is now its own standard, **1.NOS.A.2**.
- The May 2025 draft has the same structure.
- **What it means for the app:** backward counting within 120 is a grade 1 expectation now, not only forward counting.

### 2.2 Place value: tens and ones — **confirmed**

- Heading: "1.NOS.B UNDERSTAND PLACE VALUE AND REPRESENTATIONS OF NUMBERS. PREVIOUSLY 1.NBT.B".
- **1.NOS.B.3**: "Extend understanding of 10 as a group, collection, or bundle of ten ones, called a 'ten,' to compose and decompose two-digit numbers."
  - Sub-parts cover describing numbers as tens and ones ("14 is one ten and four ones; 38 is three tens and eight ones") and composing numbers in more than one way.
  - It maps to the old 1.NBT.B.2.
- The May draft heading omitted "and representations of numbers" and the "called a ten" wording, so the adopted text was revised.

### 2.3 Number line, moved down from grade 2 — **confirmed (new for grade 1)**

- **1.NOS.B.4**: represent whole numbers as lengths from 0 on a number line, horizontal and vertical, with equally spaced points for the whole numbers.
- The adopted crosswalk's note says this was "moved from Grade 2 (previously 2.MD.B.6) to begin building foundation for use of number lines."
- Common Core did not have this in grade 1. **This is genuinely new for first grade.**

### 2.4 Comparing two-digit numbers (1.NOS.B.5) — **partly**

- Commonplanner (third party) lists comparing two numbers within 100 using the >, = and < symbols as **1.NOS.B.5**, in the place value cluster.
- This fits the numbering and the old 1.NBT.B.3, but no MSDE snippet quoted the B.5 row.
- The content is almost certainly in grade 1. The code is not confirmed.

### 2.5 Properties and the addition-subtraction relationship (1.NOS.C) — **partly**

- The May 2025 draft: "1.NOS.C ... properties of operations and the relationship between addition and subtraction, previously 1.OA.B."
- Commonplanner lists the commutative and associative properties as strategies, and subtraction through the inverse relationship (the unknown addend).
- The individual codes were not retrieved.

### 2.6 Add and subtract within 20, including make ten (1.NOS.D.9) — **confirmed for content; the fluency wording is unverified**

- Companion guide cluster heading: "1.NOS.D Add and subtract within 20".
- **1.NOS.D.9** covers recalling or quickly deriving addition and subtraction facts. The sub-parts quoted are:
  - (a) count-on and count-back strategies, e.g. 4 + 1, 7 − 2;
  - (b) "use the **make ten strategy** to add and subtract with combinations of 10 (e.g., 7 + 3, 6 + 4, 10 – 3, 10 – 6, etc.)";
  - (c) ten-more and ten-less reasoning, including differences of 10.
- The adoption packet maps 1.NOS.D.9 to the old **1.OA.C.5 and 1.OA.C.6**.
- **Fluency within 10 is unverified.** The old 1.OA.C.6 said "Add and subtract within 20, demonstrating fluency for addition and subtraction within 10." No snippet quoted the exact fluency boundary in the new 1.NOS.D.9.
  - One summary says the guide frames D.9 as "developing mastery of addition and subtraction facts within 20". That is the summarizer's paraphrase, not a quotation.
- **Advice:** keep fluency within 10 as the target and fact strategies within 20 as the stretch. That is right under either reading.

### 2.7 Add within 100; 10 more and 10 less (1.NOS.E) — **confirmed for E.10 and E.11; the rest unverified**

- **1.NOS.E.10** maps to 1.NBT.C.4: add within 100, a two-digit number plus a one-digit number or plus a multiple of 10, using models and place-value strategies.
- **1.NOS.E.11** maps to 1.NBT.C.5: "mentally find 10 more or 10 less than the number, without having to count; explain the reasoning used."
- The new code for subtracting multiples of 10 (old 1.NBT.C.6, range 10-90) was not seen. It is probably E.12, but that is an inference.

### 2.8 Halves and fourths, moved from Geometry to NOS (1.NOS.F.14) — **confirmed**

- Crosswalk heading: "1.NOS.F UNDERSTAND EQUAL PARTS OF A WHOLE. PREVIOUSLY 1.G.A REASON WITH SHAPES AND THEIR ATTRIBUTES." 1.NOS.F.14 was previously 1.G.A.3.
- The companion guide says F.14 covers:
  - partitioning circles and rectangles into halves and fourths;
  - that more shares make smaller shares;
  - how many equal shares make a whole (two halves).
- The guide calls this the "first formal introduction" of equal parts. Children use the words one-half and one-fourth, but **fraction notation is not expected**.
- Suggested activity: use counterexamples to refute "any shape cut into two pieces is halves".
- The guide links halves and quarters to telling time on the half and quarter hour.
- **For the app:** the content is unchanged. Only the domain moved (Geometry → NOS). Use the words, not 1/2 notation.

---

## 3. Make 10 and fluency within 5: did they move from K to grade 1?

**Make 10 is in grade 1 at 1.NOS.D.9 — confirmed. "Removed from kindergarten" is only partly confirmed, and a new conflict turned up.**

What the snippets show:

1. **Make 10 is in grade 1.** The grade 1 companion guide's 1.NOS.D.9(b) "use the make ten strategy ... with combinations of 10" — **confirmed**.
2. **Kindergarten crosswalk note.** In the kindergarten crosswalk, the old K.OA.A.4 (find the number that makes 10) sits in a "Not applicable" column. A note nearby reads "**Content moved to Grade 1 (1.NOS.D.9)**".
3. **Kindergarten companion guide.** The guide (V2, April 2026) has **K.NOS.D.11** "Decompose numbers within 10 in more than one way ... (e.g., 10 = 4 + 6 and 10 = 4 + 5 + 1)". The search **surfaced no separate kindergarten "make 10" entry**. A draft maps the old K.OA.A.3 to K.NOS.D.12, and one garbled summary reads "Not content embedded in K.NOS.D.12". So make-10 thinking may survive inside K decomposition work.
4. **New conflict.** A summary of the 29 July 2025 adoption packet attaches the same note to the **fluency standard**: "Content moved to Grade 1 (1.NOS.D.9). Fluently add and subtract within 5."
   - That would mean K.OA.A.5 (fluency within 5) also left kindergarten.
   - It contradicts the October report and CURRICULUM-NOTES.md, which say "Fluency adding and subtracting within 5 stays" in K.
   - The table text is garbled, so the note may belong to K.OA.A.4, to K.OA.A.5, or to both.
   - 1.NOS.D.9 maps to both 1.OA.C.5 (counting on) and 1.OA.C.6. Count-on/count-back within small numbers in D.9(a) is consistent with fluency within 5 having moved up.
   - A follow-up search for a revised K standard reading "fluently add and subtract within 5" found nothing either way.

Verdicts:

| Claim | Verdict |
|---|---|
| Make 10 is a grade 1 standard (1.NOS.D.9) | **Confirmed** |
| Make 10 was moved out of K | **Partly** (draft and adoption-packet crosswalk notes; no K make-10 standard surfaced in the K guide; the adopted K crosswalk row was not seen cleanly) |
| Fluency within 5 stays in K (CURRICULUM-NOTES.md) | **Unverified**. It is now in doubt, and the parent should not repeat it as confirmed. |

**For the app:** a grade 1 pack on make 10 and facts within 10/20 is safe whichever way this resolves. For kindergarten, "Ways to Make 10" stays fine as enrichment.

---

## 4. Algebraic Thinking (AT)

### 4.1 Equal sign, true/false equations and unknowns (1.AT.A.1) — **confirmed (one MSDE snippet)**

- The adopted crosswalk puts "understand the meaning of the equal sign; determine if equations involving addition and subtraction (on one or both sides of the equal sign) are true or false" under **1.AT.A.1**, previously 1.OA.D.7.
- Examples quoted: "6 = 6, 7 = 8 − 1, 5 + 2 = 2 + 5, 4 + 1 = 5 + 2".
- Unknown-number examples quoted: "8 + ? = 11, 5 = ? − 3, 6 + 6 = ?" (old 1.OA.D.8).
- The K companion guide says to "avoid using [the equal sign] as symbol that signals the answer".

### 4.2 Word problems within 20 (adding to, taking from, putting together, taking apart, comparing; unknowns in all positions) — **partly**

- The content is the old 1.OA.A.1.
- Commonplanner (third party) lists it under 1.AT.A, numbered **1.AT.A.2 and 1.AT.A.3**. A.3 is probably the three-addend word problems (old 1.OA.A.2), but that is an inference.
- No MSDE snippet quoted these rows. A June 2025 draft is "organized under Algebraic Thinking, with entries that previously sat under 1.OA.A", which supports the domain.

### 4.3 Patterns in grade 1 AT — **unverified**

- K has K.AT.B "Understand repeating patterns" (October report).
- No grade 1 pattern standard surfaced.
- Do not build a grade 1 pack labelled as a state pattern standard.

---

## 5. Geometric Reasoning and Measurement (GR)

### 5.1 Length (1.GR.A) — **confirmed for the cluster; codes inferred**

- "1.GR.A MEASURE LENGTHS INDIRECTLY AND BY ITERATIVE LENGTH UNITS." Previously 1.MD.A.
- The content carried over:
  - order three objects by length, and compare two of them indirectly using a third;
  - express a length as a whole number of same-size units laid end to end, with no gaps or overlaps.
- Standard numbers A.1 and A.2 are inferred, because 1.GR.B starts at B.3.

### 5.2 Shapes (1.GR.B) — **confirmed**

Heading: "1.GR.B REASON WITH SHAPES AND THEIR ATTRIBUTES. PREVIOUSLY 1.G.A".

- **1.GR.B.3** (was 1.G.A.1): "Distinguish between defining attributes (e.g., triangles are closed and three-sided) versus non-defining attributes (e.g., color, orientation, overall size); build and draw shapes to possess defining attributes."
- **1.GR.B.4** (was 1.G.A.2): "Compose two-dimensional shapes (rectangles, squares, trapezoids, triangles, half-circles, and quarter-circles) or three-dimensional shapes (cubes, right rectangular prisms, right circular cones, and right circular cylinders) to create a composite shape, and compose new shapes from the composite shape."

The K guide once calls this "1.G.B.4", which looks like a typo in that guide.

### 5.3 Time: "hour and half hour" — **partly. The revised standard adds quarter hours.**

- Heading: "1.GR.C WORK WITH TIME AND MONEY. PREVIOUSLY 1.MD.B TELL AND WRITE TIME."
- "**1.GR.C.5 Tell time in hours, half hours, and quarter hours using a digital clock or analog clock.**" Old 1.MD.B.3 was hours and half-hours only.
- It is paired with **estimating time intervals (1 hour, 30 minutes, 15 minutes, 1 minute)** for activities.
- Two searches returned this, one citing the adopted July 2025 crosswalk and one the companion guide.
- **For the app:** the claim "time to the hour/half hour" understates grade 1. Include quarter past and quarter to (or :15 and :45), and "about how long" estimates.

### 5.4 Money, new to grade 1 (1.GR.C.6) — **partly (strong)**

- **1.GR.C.6**: identify and know the value of **coins (penny, nickel, dime, quarter) and bills ($1, $5, $10, $20)**.
- The crosswalk marks the 2010 column "Not applicable", meaning new. It is "added to build foundation for work with money in Grade 2".
- Counting mixed sets of coins to solve problems stays in grade 2 (**2.GR.C.9**).
- Companion guide ideas:
  - penny as 1 square unit, nickel as a 1×5 array, dime as a 1×10 array;
  - equal coin combinations written as equations (1 nickel = 5 pennies).
- **Why only partly:** the evidence names the companion guide and a draft crosswalk. The adopted crosswalk's own heading does say "WORK WITH TIME AND MONEY". The cluster heading is therefore confirmed in the adopted text; the C.6 wording rests on the guide and the draft.
- **For the app:** coin and bill names and values are a grade 1 topic now. Totals of mixed coins are grade 2.

---

## 6. Reasoning with Data and Statistics (DS)

### 6.1 Data with up to three categories (1.DS.A.1) — **partly (strong)**

- 1.DS.A "represent and interpret data", previously 1.MD.C.
- "**1.DS.A.1: Ask and answer questions by collecting, organizing and summarizing data.**" Sub-parts:
  - craft a question that can be answered with categorical data;
  - "Collect and organize categorical data (into up to three categories) using surveys or observations";
  - represent it with **tally charts and picture graphs**;
  - summarize using terms like "most" and "least".
- **What changed:** the three-category limit carries over from 1.MD.C.4. The new emphasis is on *posing* the question and on naming the chart types.
- **Why only partly:** the quotes come from the companion guide and a draft crosswalk, not from a row of the adopted crosswalk.

---

## 7. McGraw Hill Reveal Math, grade 1

### 7.1 AACPS uses Reveal Math for grade 1 in 2026-27 — **partly**

- The October report confirmed Reveal Math K-5 at AACPS up to 2025-26 (AACPS release; The Banner).
- This pass found no AACPS 2026-27 or grade 1 document.
- No AACPS pacing guide, and nothing on how AACPS maps Reveal onto the revised standards, was found.

### 7.2 Reveal Grade 1 unit sequence — **partly**

This is assembled from secondary correlation documents (Amplify crosswalk, ST Math correlation, McGraw Hill's 2022 Oregon correlation). No McGraw Hill table of contents was opened.

| Unit | Title / content | Source | Verdict |
|---|---|---|---|
| 1 | Not seen for grade 1. "Math Is…" is the K Unit 1 title, and ST Math groups grade 1 "Units 1 & 2: Numbers All Around Us & Patterns". | ST Math | unverified |
| 2 | Number Patterns | Amplify crosswalk | partly |
| 3 | Place Value (numbers 11-19, understanding tens, two-digit numbers) | Amplify; district map | partly |
| 4 | Addition within 20: Facts and Strategies (includes making a ten) | Amplify; ST Math "Units 4 & 5" | partly |
| 5 | Subtraction within 20: Facts and Strategies | Amplify; ST Math | partly |
| 6 | Unknown. One district map cites a "Unit 6, Shapes and Solids" performance task; possibly another edition. | district map | unverified |
| 7 | Meanings of Addition | Amplify. Conflict: another Amplify crosswalk page lists "Unit 7: Measure and Compare Lengths", probably a different grade. | partly |
| 8 | Meanings of Subtraction | Amplify | partly |
| 9-11 | Addition and Subtraction within 100 | ST Math | partly |
| 12 | Measurement/data, including telling time (lessons 12-5, 12-6) | ST Math; Oregon 2022 correlation | partly |
| 13 | Equal Shares (lessons 13-1 to 13-5) | Amplify; Oregon correlation | partly |
| 14? | Not seen | — | unverified |

Points to note:

- **Misattribution trap.** One summary of McGraw Hill's K-5 TOC/pacing PDF gave grade 1 "Unit 9 Numbers 11 to 15, Unit 10 Numbers 16 to 19, Unit 11 3-Dimensional Shapes, Unit 12 Count to 100". That is the **kindergarten** sequence, and it should not be used for grade 1.
- **Gaps against the revised standards.** Reveal's national grade 1 (2021/2022) is written to Common Core. It would not natively cover:
  - counting backward within 120;
  - number lines (1.NOS.B.4);
  - quarter hours;
  - time-interval estimation;
  - coin and bill values (1.GR.C.6).
- Whether AACPS supplements Reveal for these is not known. The app covering them is the safer choice.

Sources (secondary):

- https://amplify.com/amplify-classroom-crosswalk/reveal-math/
- https://play.stmath.com/raft/resources/help/correlations/2/reveal_1.pdf
- https://play.stmath.com/raft/resources/help/correlations/reveal_1_23.pdf
- https://www.mheducation.com/unitas/school/explore/sites/oregon/reveal-math-2022-correlations-g1.pdf
- https://www.mheducation.com/unitas/school/explore/sites/reveal-math/reveal-math-toc-pacing-guide-k-5.pdf (the summary was K-contaminated)
- https://www.mheducation.com/content/dam/mhe/prek12/documents/states/new-mexico/math/reveal-math-form-f-files-g1.pdf
- https://edreports.org/reports/detail/reveal-math-2023/first-grade

---

## 8. Suggested first grade math packs (from the evidence above)

| Pack | Content | Basis | Note |
|---|---|---|---|
| Count to 120 | Forward **and backward** from any number; skip count by 10s; read and write numerals | 1.NOS.A.1-A.2 | confirmed |
| Tens and Ones | Composing and decomposing two-digit numbers; more than one way (e.g. 34 = 2 tens 14 ones) | 1.NOS.B.3 | confirmed |
| Number Line | Locate whole numbers to 120 as lengths from 0, on horizontal and vertical lines | 1.NOS.B.4 | confirmed, **new to grade 1** |
| Compare Numbers | Within 100, using >, = and < | 1.NOS.B.5 | content safe; code partly |
| Fact Strategies | Count on and back; make ten; ten more and ten less; facts within 20; fluency within 10 | 1.NOS.D.9 | confirmed; fluency boundary unverified |
| Add within 100 / 10 More, 10 Less | Two-digit plus one-digit, two-digit plus a ten, mental ±10, multiples of 10 | 1.NOS.E.10-E.11 | confirmed |
| True or False? / Missing Number | Equal sign meaning; ? + 3 = 11 | 1.AT.A.1 | confirmed |
| Story Problems within 20 | All problem types, unknowns in all positions, three addends | old 1.OA.A; 1.AT.A | content safe; code partly |
| Measure It | Order three by length; measure with units end to end | 1.GR.A | confirmed |
| Shape Detectives | Defining vs non-defining attributes; composing shapes | 1.GR.B.3-B.4 | confirmed |
| Clock Time | Hour, half hour, **quarter hour**; estimate 1 hr / 30 min / 15 min / 1 min | 1.GR.C.5 | confirmed |
| Coins and Bills | Name and value of penny, nickel, dime, quarter, $1, $5, $10, $20; equal trades | 1.GR.C.6 | partly (strong); no mixed-coin totals, which is grade 2 |
| Halves and Fourths | Equal vs unequal shares; more shares, smaller shares; words, no notation | 1.NOS.F.14 | confirmed |
| Survey and Graph | Up to 3 categories; tally charts and picture graphs; most/least; how many more | 1.DS.A.1 | partly (strong) |

---

## 9. Corrections to carry into CURRICULUM-NOTES.md

1. **Make 10.** Its place in grade 1 (1.NOS.D.9) is confirmed. Its removal from K is still "per crosswalk notes", and the adopted K row was not seen cleanly.
2. **Fluency within 5.** "Fluency adding and subtracting within 5 stays [in K]" should be softened to unverified. One adoption-packet snippet attaches "Content moved to Grade 1 (1.NOS.D.9)" to "Fluently add and subtract within 5".
3. **New in grade 1** compared with Common Core:
   - backward counting within 120;
   - number lines (from grade 2);
   - quarter hours and time-interval estimates;
   - coin and bill values.
4. **Equal shares** now sit under NOS (1.NOS.F), not geometry.

## Search log (33 queries)

1. Grade-1 crosswalk lookup
2. 1.NOS count to 120
3. 1.NOS.B place value
4. 1.NOS.D.9 make 10
5. K.OA.A.4 moved
6. Grade 1 companion guide fluency
7. 2.MD.B.6 number line
8. Companion guide filename
9. 1.AT.A word problems
10. 1.NOS.C compare
11. 1.NOS.D fluency (off-topic results)
12. 1.NOS.E add within 100
13. 1.GR time (old codes only)
14. 1.GR partition (non-MD results)
15. GR domain (MSDE only)
16. 1.DS (MSDE only)
17. 1.NOS.F (MSDE only)
18. 1.GR.C time (MSDE only)
19. 1.GR.C money (MSDE only)
20. 1.GR.B shapes (MSDE only)
21. 1.AT equal sign (MSDE only)
22. 1.NOS.E (MSDE only)
23. 1.NOS.D strategies (MSDE only)
24. K make 10 (MSDE only)
25. 1.NOS.D.9 wording (no hits)
26. K.NOS.D decompose (MSDE only)
27. Reveal grade 1 TOC
28. AACPS grade 1 math
29. Reveal unit titles
30. Reveal units 4-7
31. Reveal units 9-14
32. 1.NOS.D.8/D.9 fluency (MSDE only)
33. K fluency within 5 (MSDE only)

---

## Verification

Adversarial pass, 2026-10-22. The verifier tried to refute every claim marked confirmed or partly, using searches worded differently from the researcher's and limited to marylandpublicschools.org where possible.

### Limits of this pass

- **No primary document was opened in this pass either.**
  - WebFetch returned `getaddrinfo ENOTFOUND` for marylandpublicschools.org (and for a reader proxy).
  - curl got `CONNECT tunnel failed, response 403`. The agent-proxy status page logs this as a policy denial for marylandpublicschools.org and www.aacps.org.
- About 50 searches ran before the session's search budget ran out. The last check, an MSDE-only search for the adopted 1.GR.C.6 row, could not run.
- Every verdict below still rests on search-engine summaries of MSDE PDFs. Some of those summaries are garbled or disagree with each other. "Confirmed" means the summaries of two MSDE documents agree, or one MSDE document was quoted the same way by searches worded differently, and nothing contradicted it.

### Errors found in the report

1. **The cluster map in section 1.3 is wrong in its inferred numbers.**
   - There is a **1.NOS.B.6**: "Estimate the location of numbers on a number line by reasoning about their relationship to benchmark numbers (e.g. 10, 50, 100)". The 2010 column reads "Not applicable" and the note says "added to support numeracy development".
     - Sources: the adoption-packet (draft) summary and Commonplanner. It was not seen in an excerpt of the adopted crosswalk.
   - Cluster 1.NOS.C is **C.7** (commutative and associative properties, previously 1.OA.B.3) and **C.8** (subtraction as an unknown-addend problem, previously 1.OA.B.4). There is no C.6.
   - Since D.9 directly follows C.8, **1.NOS.D.8 probably does not exist**. Cluster D appears to hold only D.9.
   - The claim that the numbers "fit together without gaps", which the report used as support, is refuted.
2. **The draft and adopted numbering differ.** The researcher treated the May 2025 draft and the adopted crosswalk as interchangeable. They are not.
   - In the May draft, "compare two numbers within 100" was **1.NOS.B.4**. In the adopted text it is **B.5**, and B.4 is the new number-line standard.
   - In the May draft, the make-ten/facts standard was **1.NOS.D.7**. In the adopted text it is **D.9**.
   - Any resource that cites 1.NOS.B.4 for comparing, or 1.NOS.D.7 for facts, is using the draft.
3. **Facts within 20 (section 2.6): the advice understates the standard.**
   - Two separate searches (crosswalk and companion guide) quote the stem of 1.NOS.D.9 as "**Recall or quickly derive addition and subtraction facts within 20**".
   - The companion guide says D.9 "focuses on developing mastery of addition and subtraction facts within 20".
   - The old Common Core boundary ("fluency within 10") was not seen in the new stem. The one summary that used it was reading the 2010 column.
   - **Corrected advice:** the grade 1 target is quick recall or derivation of every fact within 20. Automatic recall within 10 is the floor, not the ceiling.
4. **Wording of 1.NOS.E.11.** The companion guide reads: "Given a two-digit number, identify 10 more or 10 less than the given number, without having to count, and explain the reasoning used." The report's "mentally find…" is the old 1.NBT.C.5 wording.
5. **1.NOS.E.12 has now been seen.** It reads "Subtract a multiple of 10 from another multiple of 10 within 90" (companion guide; one search only). It is **partly**, no longer only an inference. E.13 did not turn up.
6. **1.NOS.A.1 sub-part (b)** reads "Skip count **forward and backwards** by tens", not just "skip count by tens". The Count to 120 pack should include counting back by tens.
7. **1.GR.A codes are no longer inferred.**
   - The adoption packet lists 1.GR.A.1 (previously 1.MD.A.1, order and compare indirectly) and 1.GR.A.2 (previously 1.MD.A.2, iterate units, no gaps or overlaps).
   - The K companion guide cross-references 1.GR.A.1.
8. **Cluster heading for 1.AT.A.** It is "Solve problems involving addition and subtraction" and absorbs both 1.OA.A and 1.OA.D. It is one cluster, not separate equation and word-problem clusters.
9. **Reveal Unit 6** is "Shapes and Solids", not unknown.
   - Four secondary sources agree: a Scribd copy of the grade 1 table of contents, ST Math's v2 correlation (as "Geometry"), a 2023-24 district curriculum map that maps Unit 6 to 1.G.A.1-2, and the EdReports 2023 grade 1 review.
   - The "Unit 7: Measure and Compare Lengths" conflict is still unexplained.
10. **Reveal Unit 1** is probably "Math Is…" for grade 1 as well. A pacing-guide summary lists Unit 1 "Math Is…" immediately before a Unit 2 "Number Patterns" whose lessons go to 120, which is grade 1 content. **Partly.**
11. **Reveal coverage gaps (section 7.2) are overstated for number lines.**
    - Reveal grade 1 Unit 2 includes a "Patterns on a Number Line" lesson.
    - Reveal grade 1 time is lessons 12-5 "Tell Time to the Hour" and 12-6 "Tell Time to the Half Hour". This **confirms** the quarter-hour gap.
12. **Make 10 "moved out of K" is downgraded to unverified.** The summaries disagree about which kindergarten row carries the note "Content moved to Grade 1 (1.NOS.D.9)":
    - one ties it to K.OA.A.4;
    - one ties it to K.OA.A.5, with K.OA.A.4 marked "content embedded in K.NOS.D.12";
    - one places K.OA.A.4 under K.NOS.D.
    - All three are draft documents.
    - The K numbering itself is unstable. K.NOS.D.11 is "represent addition and subtraction" in the crosswalk but "decompose numbers" in the V2 companion guide.

### Final verdicts

| # | Claim | Report | **Final** | Why |
|---|---|---|---|---|
| 1.1 | The revised MCCRS govern grade 1 in 2026-27 | confirmed | **confirmed** | The crosswalk header "Adopted: July 2025, Implementation: SY 2026-2027" was returned by several differently worded searches. The MSDE hub page gives the Board adoption as 29 July 2025, with 2025-26 used for professional learning. |
| 1.2 | Four grade 1 domains: NOS, AT, GR, DS | confirmed | **confirmed** | The crosswalk ("NOS, previously NBT; OA"), the companion guide and the IXL Maryland listing (secondary) all agree. |
| 1.3 | Reconstructed cluster and number map | (implied) | **partly** | The cluster letters and headings hold. The inferred C.6 and D.8 are refuted, and B.6, C.7, C.8 and E.12 exist (see errors 1 and 5). |
| 2.1 | 1.NOS.A.1 "Count forward and backward within 120"; numerals split out as A.2 | confirmed | **confirmed** | The adopted crosswalk and the May draft agree. A.2 reads "Read, write numerals, and represent a number of objects with a written numeral within 120." Skip counting goes backward too. |
| 2.2 | 1.NOS.B.3 tens and ones, "called a 'ten'" | confirmed | **confirmed** | The crosswalk and the adoption packet agree. The sub-parts add equations (10 + 4 = 14; 38 = 30 + 8), teen numbers as a ten and some ones, and decades as tens with 0 ones. |
| 2.3 | 1.NOS.B.4 number line, moved from 2.MD.B.6 | confirmed | **confirmed** | Two searches worded differently quote the adopted note "moved from Grade 2 (previously 2.MD.B.6)…". The grade 2 crosswalk shows the move on its side. The standard was **not** in the May draft as B.4. "To 120" in the pack is not part of the standard text. |
| 2.4 | 1.NOS.B.5 compare within 100 | partly | **confirmed** (symbols: partly) | The adopted crosswalk is quoted: "Compare two numbers within 100 by reasoning about values of tens and ones digits and the location of the numbers on a number line", previously 1.NBT.B.3. The >, = and < symbols rest on the adoption-packet summary, the K guide's look-ahead and Commonplanner. **New emphasis:** reasoning with the number line. |
| new | 1.NOS.B.6 estimate on a number line using benchmarks 10, 50, 100 | not in report | **partly** | Draft adoption packet and Commonplanner only. It is likely new to grade 1. |
| 2.5 | 1.NOS.C properties and the addition-subtraction relationship | partly | **confirmed** (C.7) / **partly** (C.8) | The cluster heading, previously 1.OA.B, appears in the May draft and in the adopted/June text. C.7 (previously 1.OA.B.3; e.g. 8 + 3 = 11 so 3 + 8 = 11; 2 + 6 + 4 by making ten) appears in two summaries. C.8 (previously 1.OA.B.4) rests on one crosswalk summary and Commonplanner. |
| 2.6a | 1.NOS.D.9 includes the make-ten strategy (7 + 3, 6 + 4, 10 − 3, 10 − 6) | confirmed | **confirmed** | The July crosswalk and the companion guide are quoted alike. The (a)-(c) sub-part lettering is only **partly**: one summary put the strategy list in the 2010 column. |
| 2.6b | The fluency boundary is unverified; target fluency within 10 | unverified | **partly; advice corrected** | The stem "Recall or quickly derive … facts within 20" is confirmed, so "within 10 only" understates it (error 3). Whether the word "fluency" appears in the new text is still unseen. |
| 2.7 | 1.NOS.E.10 and E.11 | confirmed | **confirmed** | The companion guide quotes both, and the crosswalk maps them to 1.NBT.C.4 and C.5. E.11 wording corrected (error 4). E.12 is partly (error 5). |
| 2.8 | 1.NOS.F.14 halves and fourths, moved from 1.G.A.3 | confirmed | **confirmed** | The companion guide ("first formal introduction") and the crosswalk heading agree. One summary added "one-third" to the vocabulary. That looks like a summarizer error and is not used. |
| 3a | Make 10 is grade 1 (1.NOS.D.9) | confirmed | **confirmed** | Same evidence as 2.6a. |
| 3b | Make 10 was removed from K | partly | **unverified** | The summaries disagree about which K row carries the "moved to Grade 1" note, and all are drafts (error 12). |
| 3c | Fluency within 5 stays in K | unverified | **unverified** | At least one K.OA.A row (4, 5 or both) is noted as moved to 1.NOS.D.9. Which one cannot be settled without opening the adopted K crosswalk. Do not state either way as fact. |
| 4.1 | 1.AT.A.1 equal sign, true/false on one or both sides (previously 1.OA.D.7) | confirmed | **confirmed** | The researcher's adopted-crosswalk snippet and a separate MSDE-only search of the adoption packet agree. Where the unknown-number examples (old 1.OA.D.8) now sit is only **partly** known. |
| 4.2 | Word problems within 20 are 1.AT.A.2-A.3 | partly | **partly** | The cluster (1.AT.A, previously 1.OA.A) is confirmed. The A.2 and A.3 codes are still Commonplanner only, and no search for those codes returned an MSDE hit. |
| 4.3 | No grade 1 pattern standard | unverified | **unverified** | No evidence either way. Not retested. |
| 5.1 | 1.GR.A length; A.1 and A.2 inferred | confirmed (codes inferred) | **confirmed** (codes now seen) | The adoption packet lists 1.GR.A.1 and A.2 with their 1.MD.A predecessors, and the K guide cites 1.GR.A.1. |
| 5.2 | 1.GR.B.3 and B.4 shapes | confirmed | **confirmed** | A separate MSDE-only search returns the same text and mappings (1.G.A.1, 1.G.A.2). The "1.G.B.4" typo in the K guide is seen again. |
| 5.3 | Time is hours, half hours **and quarter hours**, plus interval estimates (1.GR.C.5) | partly ("hour/half hour" understated) | **confirmed** | A separate MSDE-only search returns the companion guide and crosswalk with the same quarter-hour and interval (1 hour / 30 min / 15 min / 1 min) wording, previously 1.MD.B.3. One unrestricted search found nothing, which is a coverage gap rather than a contradiction. The original "hour and half hour" description is **refuted** as complete. |
| 5.4 | 1.GR.C.6 coin and bill names and values, new to grade 1; mixed totals in grade 2 (2.GR.C.9) | partly (strong) | **confirmed** | The companion guide (a final MSDE document, not a draft) and the crosswalk summary agree on the coins, the $1/$5/$10/$20 bills, the "foundation for Grade 2" note and 2.GR.C.9. The adopted crosswalk row itself was not seen because the search budget ran out. |
| 6.1 | 1.DS.A.1: pose a question, up to 3 categories, tally charts and picture graphs, most/least | partly (strong) | **confirmed** | A separate MSDE-only search quotes the companion guide: "Craft a question that can be answered by collecting categorical data"; "Represent data by creating tally charts and picture graphs"; compare with "most, least, greater than, less than, equal to". It maps to 1.MD.C.4. |
| 7.1 | AACPS uses Reveal Math for grade 1 in 2026-27 | partly | **partly** | AACPS's own Elementary Math page describes Reveal Math (McGraw Hill) and lists i-Ready fluency practice for grades 1-5. An AACPS article calls Reveal the elementary math curriculum. Neither is dated 2026-27, but no replacement adoption was found. The only AACPS K-5 procurement found (June 2026) is for science. |
| 7.2 | Reveal grade 1 unit sequence | partly | **partly** | Every source is secondary, and no McGraw Hill grade 1 table of contents was opened. Upgrades: Unit 6 Shapes and Solids, Unit 1 "Math Is…". Units 7 and 8 (Meanings of Addition and Subtraction) and Unit 12 (12-5/12-6 time to the hour and half hour, 12-7 to 12-9 organize, represent and interpret data) are consistent across the Scribd TOC, ST Math and Amplify. Unit 3 is "Place Value" (Amplify) or "Place Value Number Pairs and Making 10" (ST Math 2023). A Unit 14 is unverified: a Florida district guide lists "Reveal Unit 14", probably the Florida edition. Edition caveat: EdReports reviewed "Reveal Math 2023", McGraw Hill has a ©2025 update, and the AACPS edition is unknown. |
| 7.2b | Reveal (Common Core) misses the new MD content | partly | **partly** | Quarter hours are a gap (confirmed by the 12-5/12-6 titles). Number lines are **not** wholly missing (lesson "Patterns on a Number Line"). Backward counting, interval estimation and coin/bill values were not checked. |

### Changes for section 8 (packs) and section 9 (CURRICULUM-NOTES.md)

- **Fact Strategies:** target quick recall or derivation of all facts within 20. Fluency within 10 is the minimum.
- **Count to 120:** add skip counting backward by tens.
- **Number Line:** drop "to 120" as a standard requirement. Add an optional "estimate where it goes" round using 10, 50 and 100 as benchmarks (1.NOS.B.6, partly).
- **Compare Numbers:** code confirmed (1.NOS.B.5). Include number-line reasoning, not only digits.
- **Coins and Bills** and **Survey and Graph:** upgrade to confirmed.
- **Section 9, item 1:** make-10 removal from K is **unverified**, not "per crosswalk notes". Make 10 in grade 1 stays confirmed.
- **Do not cite draft codes** (1.NOS.B.4 for comparing, 1.NOS.D.7 for facts) anywhere in the app.

### Sources this pass relied on (via search summaries)

- https://marylandpublicschools.org/about/documents/dcaa/math/revised/grade-1-mccrs-math-crosswalk-a.pdf
- https://marylandpublicschools.org/about/Documents/DCAA/Math/revised/Grade-1-MCCRS-Math-Standard-Companion-Guide-A.pdf
- https://www.marylandpublicschools.org/stateboard/Documents/2025/0729/Maryland-College-and-Career-Ready-Standards-for-Math-A.pdf
- https://marylandpublicschools.org/about/Documents/DCAA/Math/revised/Grade_1_MCCRS_Math_Crosswalk_5.2.25-A.pdf
- https://marylandpublicschools.org/about/documents/dcaa/math/revised/k-mccrs-math-standard-companion-guide-a.pdf
- https://marylandpublicschools.org/about/documents/dcaa/math/revised/grade-2-mccrs-math-crosswalk-a.pdf
- https://marylandpublicschools.org/about/Pages/DCAA/Math/revised-standards.aspx
- https://www.commonplanner.com/standards/maryland-67d44409/mathematics/grade-1-098e8071 (third party)
- https://www.ixl.com/standards/maryland/math/grade-1 (third party)
- https://www.aacps.org/page/elementary-math ; https://www.aacps.org/article/1733322
- https://www.scribd.com/document/624276980/Reveal-Math ; https://play.stmath.com/raft/resources/help/correlations/2/reveal_1.pdf ; https://play.stmath.com/raft/resources/help/correlations/reveal_1_23.pdf ; https://amplify.com/amplify-classroom-crosswalk/reveal-math/ ; https://edreports.org/reports/detail/reveal-math-2023/first-grade/gateway-one ; https://www.btcs.org//Userfiles/DBFiles/server_525624/202308/111633885/1st_grade_curriculum_map_2023_2024_revised.pdf ; https://www.mheducation.com/unitas/school/explore/sites/oregon/reveal-math-2022-correlations-g1.pdf
