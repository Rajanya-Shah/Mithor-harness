---
name: "mithor-ide-glossary"
description: "Complete German commercial real estate (CRE) terminology to Python IDE variable, constant, rule (R-01..R-08), and formula mapping in apps/AI/app/modules/ide/."
triggers:
  - "rendite"
  - "faktor"
  - "multiplikator"
  - "dcf"
  - "restwert"
  - "residual"
  - "regel"
  - "scoring"
  - "capex"
  - "grunderwerbsteuer"
  - "makler"
  - "wault"
  - "leerkosten"
  - "instandhaltung"
---

# Mithor IDE Glossary — German CRE Terms to Python Variables

Use this reference (alongside `mithor-code-map` MCP tools) whenever Philipp discusses valuation math, scoring weights, rules, or DCF/Residual assumptions in German.

## 1. Constants (`apps/AI/app/modules/ide/constants.py`)

| German CRE Term | Python Symbol | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Nicht umlagefähige Bewirtschaftungskosten (Quote) | `NON_RECOVERABLE_COST_RATE` | `0.15` (15%) | Share of net rent lost to management, maintenance & void in quick NIY/pricing |
| Beleihungsauslauf (LTV) | `LTV` | `0.75` (75%) | Default loan-to-value ratio |
| Kapitaldienstsatz (Zins + Tilgung) | `DEBT_SERVICE_RATE` | `0.051` (5.1%) | Fallback debt service (`3.6%` interest + `1.5%` amortisation) |
| Zinsmarge über 10J-Swap | `DEBT_MARGIN_OVER_SWAP` | `1.5` (%-pts) | Margin added to `macro.swap_10y` |
| Tilgungssatz | `AMORTISATION_RATE` | `1.5` (%-pts) | Annual principal amortisation rate |
| Notar- und Grundbuchkosten | `NOTARY_RATE` | `0.02` (2.0%) | Notary & land registry fee fraction |
| Marktübliche Käuferprovision (Maklercourtage) | `BROKER_MARKET_RATE` | `0.0357` (3.57%) | Target negotiated buyer broker fee (incl. 19% VAT) |
| Schwellenwert überhöhte Maklercourtage (R-08) | `BROKER_FEE_THRESHOLD` | `0.0595` (5.95%) | Above this, Rule `R-08` triggers a price deduction |
| Pauschaler CapEx-Rückstau pro m² (R-04) | `CAPEX_RESERVE_PER_SQM` | `150.0` (€/m²) | Applied by Rule `R-04` to unrenovated buildings >30 yrs |
| Initialer Value-Add CapEx | `VALUE_ADD_INITIAL_CAPEX` | `80_000.0` (€) | Initial CapEx added to `ide_bid` total investment |
| Zusatzertrag Stellplätze / Dachantenne (R-06) | `ANCILLARY_INCOME_UPSIDE` | `6_000.0` (€ p.a.) | Annual income upside added in `value_add` scenario |
| Grunderwerbsteuer nach Bundesland | `_LTT` / `land_transfer_tax(state)` | `0.035`–`0.065` | Federal state transfer tax (e.g. Bayern `3.5%`, Berlin `6.0%`, NRW/Brandenburg `6.5%`) |
| Erwerbsnebenkosten (Gesamtquote) | `acquisition_cost_rate(state, broker)` | `LTT + 0.02 + broker` | Sum of Grunderwerbsteuer, notary (`2%`), and gross broker fee |

## 2. 10-Year DCF Engine (`apps/AI/app/modules/ide/dcf.py`)

| German CRE Term | Python Symbol (`DCFAssumptions` / `DCFResult`) | Default / Formula |
| :--- | :--- | :--- |
| Liegenschaftszins / Exit Cap Rate | `cap_rate_pct` | Researched market cap rate or gross yield midpoint × `(1 - 0.15)` |
| Diskontierungszinssatz | `discount_rate_pct` | `None` -> defaults to `cap_rate_pct + 1.0` (%-pt) |
| Instandhaltungskosten (€/m² p.a.) | `maintenance_per_sqm` | `10.0` €/m² p.a. (indexed with `inflation_pct` from Year 2) |
| Verwaltungskosten Wohnen (€/Einheit p.a.) | `management_per_unit` | `320.0` €/unit p.a. (when `use == "residential"`) |
| Verwaltungskosten Gewerbe (% der Marktmiete) | `management_pct` | `0.5`% of market rent |
| Sonstige nicht umlagefähige Kosten | `other_pct` | `0.5`% of market rent |
| Leerstandskosten (€/m² Leerfläche p.a.) | `vacancy_cost_per_sqm` | `36.0` €/m² vacant area p.a. |
| Vermietungsleerstand (Monate) | `void_months` | `6` months |
| Mietfreie Zeit / Incentives (Monate) | `rent_free_months` | `3` months |
| Maklerprovision Neuvermietung (Monatsmieten) | `agent_fee_months` | `3` months of rent |
| Kosteninflation (% p.a.) | `inflation_pct` | `3.0`% p.a. |
| Mietwachstum Marktmiete (% p.a.) | `rental_growth_pct` | `2.5`% p.a. |
| Standard-Restlaufzeit Mietverträge (WAULT) | `default_wault_years` | `3.0` years |
| Erwerbsnebenkosten im DCF (%) | `acquisition_costs_pct` | `9.0`% (`market_value = gross_pv / (1 + acquisition_costs_pct/100)`) |
| Marktwert (gerundet) | `market_value_rounded` | Rounded via `round_value`: nearest `100,000 €` if `>= 2 M€`, else `10,000 €` |
| Nettoanfangsrendite (NIY Ist / Markt) | `niy_current` / `niy_market` | `y0.noi / gross_cost` and `noi_market_y0 / gross_cost` |
| Bruttoanfangsrendite (GIY Ist) | `giy_current` | `current_rent_pa / market_value` |
| Mietmultiplikator / Faktor (Ist / Markt) | `multiplier_current` / `multiplier_market` | `market_value / current_rent_pa` and `market_value / market_rent_pa` |

## 3. Residual Value Engine (`apps/AI/app/modules/ide/residual.py`)

| German CRE Term | Python Symbol (`ResidualAssumptions` / `ResidualResult`) | Default / Formula |
| :--- | :--- | :--- |
| Verkaufserlös nach Fertigstellung (GDV) | `gdv` (`ResidualInputs`) | Taken from `dcf.market_value` |
| Bruttogeschossfläche (BGF) | `gfa_sqm` (`ResidualInputs`) | Gross floor area in m² |
| Baukosten (€/m² BGF) | `construction_cost_per_sqm` | Pure construction cost per m² GFA |
| Außenanlagen (% der Baukosten) | `outdoor_pct` | `5.0`% of construction cost |
| Baunebenkosten (% der Baukosten inkl. Außenanlagen & FF&E) | `ancillary_pct` | `18.0`% of `construction_total` |
| Unvorhergesehenes / Baurisiko (%) | `risk_pct` | `7.5`% of `(construction_total + ancillary)` |
| Bauträgergewinn / Developer Profit (% vom GDV) | `developer_profit_pct_gdv` | `10.0`% of `gdv` |
| Finanzierungszins Bauzeit (% p.a.) | `finance_rate_pct` | `5.0`% p.a. (drawn over half of `construction_months = 18`) |
| Vorbereitungs- / Planungszeit & Bauzeit | `preparation_months` / `construction_months` | `6` months preparation + `18` months construction |
| Erwerbsnebenkosten Grundstück (%) | `land_acquisition_pct` | `8.0`% |
| Tragfähiger Grundstückswert (Residualwert) | `residual_value` | `(residuum - demolition) / (1 + land_acq + finance_rate * land_months / 12)` |

## 4. Pillar Scoring (`parameters.py`, `normalize.py`, `scoring.py`) & Rules (`rules.py`)
- **4 Pillars (`PILLAR_WEIGHTS`):**
  1. `asset` (**35%**): `asset_type_match` (10%), `ownership` (10%), `micro_location` (15%), `age_mix` (10%), `energy_class` (15%), `vacancy` (10%), `unit_size` (5%), `parking` (5%), `heating_age` (10%), `legal_status` (10%).
  2. `market_evidence` (**35%**): `price_vs_median` (30%), `rent_vs_erv` (30%), `yield_vs_market` (25%), `vacancy_vs_market` (15%).
  3. `market_structure` (**15%**): `demographics` (40%), `liquidity` (30%), `stability` (30%).
  4. `macro` (**15%**): `rate_environment` (40%), `credit_availability` (30%), `inflation_rent_growth` (30%).
- **Verdict Thresholds (`scoring.py`):** `GO >= 0.80`, `CONDITIONAL_GO >= 0.65`, `NO_GO < 0.65`, `INSUFFICIENT_DATA` if completeness `< 0.50`.
- **Deterministic Rules (`rules.py`):**
  - `R-01`: Flächenabgleich NGF / Mietfläche (>2% discrepancy -> confidence penalty `0.15`).
  - `R-02`: Mikro-Apartment / Möblierungs-Upside (`rent_sqm < 0.85 * ERV` and `avg_unit_size < 40 m²`).
  - `R-03`: Teilung / Umbau ohne Genehmigungsnachweis (`subdivision_flag` without `permit_verified` -> caps legal score at `0.3`).
  - `R-04`: CapEx-Rückstau unrenovierter Gebäudeteile (building `> 30` yrs, last refurbishment `> 20` yrs or `None` -> deducts `area * 150 €/m²` from `ide_bid`).
  - `R-05`: GEG / ESG-Prüfung (energy class `E`/`F`/`G`/`H` or heating age `>= 15` yrs).
  - `R-06`: Stellplätze / Dachantenne (`parking_spaces > 0` or `rooftop_antenna` -> adds `+6,000 € p.a.` in `value_add` scenario).
  - `R-07`: Dachgeschoss-Potenzial (`attic_converted == False` and `floors >= 2`).
  - `R-08`: Überhöhte Maklercourtage (`broker_fee_gross > 5.95%` -> deducts `(fee - 3.57%) * asking_price` from `ide_bid`).
