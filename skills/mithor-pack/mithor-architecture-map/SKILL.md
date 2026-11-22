---
name: "mithor-architecture-map"
description: "Mithor-Platforms monorepo architecture map, 3-zone path policy (Green/Yellow/Red), CI lane rules, and zero-math-in-frontend boundary."
triggers:
  - "architektur"
  - "wo liegt"
  - "welche datei"
  - "fep"
  - "bff"
  - "ide"
---

# Mithor-Platforms Architecture & Zone Map

`Mithor-Platforms` is a modular monorepo where each application lives under `apps/<TOKEN>/` with **zero cross-app imports**.

## 1. The Three Core Applications in Philipp's Scope

### A. `apps/FEP` — Web Frontend (GREEN ZONE: Read/Write)
- **Stack:** Vite 6 + React 18 + Tailwind 3, `react-router-dom` v6, `jspdf`, `recharts`.
- **Architectural Rule:** **Zero valuation math runs in `apps/FEP`.** The frontend displays the report returned by `apps/BFF` -> `apps/AI`, renders interactive charts/tables, exports the client-side PDF (`src/utils/exportValuationPdf.js`), and sends assumption overrides (`AssumptionsEditor.jsx`) to `POST /api/projects/:id/valuation/recalculate`.
- **Protected Red Subpaths inside FEP:** `src/api/**`, `src/lib/firebase.js`, `src/context/AuthContext.jsx`, `src/repositories/**`, and `src/admin/**` are locked to prevent breaking authentication or API transport.

### B. `apps/AI` — Investment Decision Engine (YELLOW ZONE: Guarded Write)
- **Stack:** Python 3.12, FastAPI, Pydantic v2, Poetry (`poetry run pytest tests/unit/ide -q`).
- **Guarded Yellow Files (`apps/AI/app/modules/ide/`):**
  - `constants.py` — Global constants (`NON_RECOVERABLE_COST_RATE`, `LTV`, `DEBT_SERVICE_RATE`, `NOTARY_RATE`, `BROKER_MARKET_RATE`, `CAPEX_RESERVE_PER_SQM`, `_LTT` Grunderwerbsteuer table).
  - `parameters.py` — 4 pillar weights (`35/35/15/15`) and the 20-parameter `CATALOGUE`.
  - `normalize.py` — `[0, 1]` normalization transforms (`interp`, `ENERGY_CLASSES`, `MICRO_LOCATION`, `_unit_size`, `_age_mix`, `_niy_percent`).
  - `audit.py` — Plausibility cross-checks (`run_audit`, area/rent tolerances).
  - `scoring.py` — Pillar aggregation & verdict thresholds (`GO >= 0.80`, `CONDITIONAL_GO >= 0.65`, `MIN_COMPLETENESS = 0.50`).
  - `rules.py` — Deterministic rule triggers `R-01` through `R-08` (`r01`..`r08`).
  - `pricing.py` — 3-scenario pricing simulation (`ask`, `ide_bid`, `value_add`).
  - `dcf.py` — 10-year DCF valuation & 3x3 sensitivity matrix (`DCFAssumptions`, `run_dcf`, `sensitivity`).
  - `residual.py` — Development residual valuation (`ResidualAssumptions`, `run_residual`).
  - `ratings.py` — 5 report overview grades (`macro_location`, `micro_location`, `building`, `leasing`, `overall`).
  - `report.py` — Valuation report assembly & missing information builder (`build_report`, `build_missing_information`).
- **Yellow Zone Protocol:** Before editing any Yellow Zone file, you MUST explain the current math and the proposed formula change in clear German and wait for Philipp's confirmation.

### C. `apps/BFF`, `apps/Mobile`, `apps/Jobs` & Infra (RED ZONE: Hard Blocked)
- `apps/BFF/**` (FastAPI + MongoDB orchestrator), `apps/Mobile/**` (Kotlin Multiplatform), `apps/Jobs/**`, `apps/AI/app/modules/ide/schemas/**`, `routes.py`, `service.py`, `extraction.py`, `market.py`, `servers/**`, `docs/**`, and all dependency manifests (`package.json`, `pyproject.toml`) are strictly read-only.

## 2. CI Lanes & Single-App Branch Discipline
- GitHub Actions CI and staging auto-deploys (`develop` branch) trigger based on the first two path segments (`apps/FEP/**` vs. `apps/AI/**`).
- Keep UI tweaks (`apps/FEP`) and backend math tweaks (`apps/AI`) in separate tasks/branches whenever possible so each PR triggers a single clean CI lane.
