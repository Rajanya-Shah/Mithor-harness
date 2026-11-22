---
name: "systematic-debugging"
description: "Pre-built systematic root-cause analysis and non-destructive verification skill for UI rendering issues and valuation calculation discrepancies."
triggers:
  - "fehler"
  - "stimmt nicht"
  - "falsch"
  - "warum"
  - "bug"
  - "rechnet falsch"
---

# Systematic Root-Cause Debugging

Follow this four-step protocol whenever Philipp reports that a number, chart, PDF export, or UI component looks wrong.

## Step 1: Isolate the Layer (Frontend Display vs. IDE Engine Math)
Never guess whether a discrepancy is a formatting bug or a formula bug. Check both possibilities systematically:
1. **Frontend Display / Formatting Layer (`apps/FEP/src/**`):**
   - Does the backend return the right value in `report.results` / `dealCheck.pricing`, while the React component or `exportValuationPdf.js` formats, rounds, or maps the wrong key?
   - Check unit scaling: e.g., fraction (`0.055`) vs. percentage (`5.5%`), monthly rent per m² vs. annual net rent (`annual_net_rent / 12 / area`).
2. **IDE Calculation Layer (`apps/AI/app/modules/ide/*.py`):**
   - Call `inspect_ide_formula` (`mithor-code-map`) on the relevant module (`dcf`, `residual`, `pricing`, `scoring`, `rules`, `normalize`, `audit`, `report`).
   - Trace the exact inputs, default assumptions (`DCFAssumptions`, `ResidualAssumptions`, `PricingAssumptions`), and clamping/interpolation bounds (`interp(...)`).

## Step 2: Explain Before Touching Code
- Translate the root cause into clear, non-technical German for Philipp.
- If the fix requires editing `apps/AI/app/modules/ide/*.py` (Yellow Zone), present the current formula vs. the proposed formula in plain German and wait for Philipp's confirmation.

## Step 3: Minimal, Targeted Fix
- Change only the exact lines required to resolve the discrepancy.
- Do not refactor surrounding code, rename public functions, or alter API payload keys.

## Step 4: Multi-Gate Verification
- Run the automated verification gates (`npm run build` + `npm test` for `apps/FEP`; `poetry run pytest tests/unit/ide -q` for `apps/AI`).
- If a test fails, inspect the assertion failure and either fix the regression or inform Philipp if a golden test benchmark (`Hohetorstraße`, `Clayallee 18`, `Frankfurter Allee`) shifted intentionally.
