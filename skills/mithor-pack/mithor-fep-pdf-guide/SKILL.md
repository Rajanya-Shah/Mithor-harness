---
name: "mithor-fep-pdf-guide"
description: "Guide to apps/FEP React components, DealCheck and Valuation views, jsPDF exportValuationPdf.js rules, and i18n de/en/fr parity enforcement."
triggers:
  - "pdf"
  - "export"
  - "deal check"
  - "bewertung"
  - "übersicht"
  - "tabelle"
  - "übersetzung"
  - "text ändern"
---

# Mithor FEP & PDF Export Engineering Guide

Use this skill when modifying any UI component, valuation table, translation string, or PDF report layout in `apps/FEP/src/**`.

## 1. Key Component Map for Valuation & Deal Check
All Deal Check and Valuation UI components live under `apps/FEP/src/pages/project/sections/`:
- **Entry Container:** `DealCheckSection.jsx` — orchestrates polling, status progress bar, Verdict badge, "Download PDF" button, and all report cards.
- **Deal Check Subcomponents (`sections/dealCheck/`):**
  - `PriceScale.jsx` — Visual horizontal comparison of `Suggested Bid` (`IDE-Gebot`), `Market Value` (`Marktwert`), and `Asking Price` (`Kaufpreis / Angebotspreis`).
  - `RatingsStrip.jsx` — 5 quality grade badges (`Makrolage`, `Mikrolage`, `Gebäude`, `Vermietung`, `Gesamt`).
  - `MissingInformation.jsx` — "Was nicht in den Unterlagen stand" (missing/unverified/assumed parameters).
  - `AssumptionsEditor.jsx` — Interactive form allowing the user to override DCF/Residual/Pricing assumptions and trigger `POST /ide/recalculate`.
  - `ScoreCard.jsx` — 4-pillar score breakdown (`Asset`, `Market Evidence`, `Market Structure`, `Macro`).
  - `RulesList.jsx` — Triggered & checked rules (`R-01`..`R-08`) with Euro pricing deductions and income upsides.
  - `PricingTable.jsx` — 3-column scenario comparison (`Exposé / Ask`, `IDE Bid`, `Value-Add`).
  - `AuditTable.jsx` — Plausibility check findings (`ok`, `warning`, `discrepancy`, `red_flag`, `opportunity`).
  - `SwotGrid.jsx` — 2x2 grid for Strengths, Weaknesses, Opportunities, Threats.
- **Valuation Report Subcomponents (`sections/valuation/`):**
  - `OverviewTable.jsx` — Property & valuation overview grid.
  - `DcfTable.jsx` — Year 0..10 cash-flow table (`PGR`, `Vacancy loss`, `OpEx`, `NOI`, `Net Cash Flow`, `PV`).
  - `ParametersAndSensitivity.jsx` — `SensitivityGrid` (3x3 rent `±10%` vs. rates `±100 bps`) and `ResidualTable`.
  - `ReportTables.jsx` — `RentRollTable`, `ComparablesTable`, and `NarrativeBlocks`.
  - `format.js` — Currency, percentage, multiplier, and number formatters for valuation tables.

## 2. Client-Side PDF Generator (`apps/FEP/src/utils/exportValuationPdf.js`)
When Philipp asks to change the PDF report layout, headings, spacing, or columns:
1. **jsPDF Coordinate System:** A4 portrait (`PW = 210` mm, `PH = 297` mm, left/right margins `ML = 18`, `MR = 18`, content width `CW = 174` mm).
2. **WinAnsi / Helvetica Font Constraint (CRITICAL):**
   - Built-in jsPDF `helvetica` uses WinAnsi encoding and **cannot render Unicode minus `U+2212` (`−`)** or exotic symbols (they render as garbled characters). Always use standard ASCII hyphen `-` (e.g., `-10%`, `-100 bps`) or `±` / `€` / `·`.
3. **Page Break Safety:** Always call `newPageIfNeeded(neededMm)` before drawing custom blocks so rows never clip across the bottom margin (`PH - 16`).
4. **Unit Test Verification:** `apps/FEP/src/__tests__/exportValuationPdf.test.js` tests the PDF generator. Always run `npm test` after editing `exportValuationPdf.js`.

## 3. Mandatory i18n Locale Parity (`de.json`, `en.json`, `fr.json`)
- Translations live in `apps/FEP/src/locales/de.json`, `en.json`, and `fr.json`.
- **CRITICAL TEST GATE:** `apps/FEP/src/__tests__/i18nParity.test.js` asserts that `de.json`, `en.json`, and `fr.json` have the **exact same nested key structure**.
- Whenever you add or rename a translation key in `de.json` for Philipp, you **MUST** add the corresponding English key in `en.json` and French key in `fr.json` in the exact same turn, or `npm test` will fail!
