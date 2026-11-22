import fs from "node:fs";
import path from "node:path";

/**
 * Curated high-precision German CRE & UI dictionary mapping Philipp's natural German terms
 * to exact Mithor-Platforms files, Python symbols, and React components.
 */
export const GERMAN_CODE_DICTIONARY = [
  {
    termsDe: ["bruttorendite", "bruttoanfangsrendite", "giy", "gross initial yield"],
    category: "IDE Valuation & UI",
    ideFile: "apps/AI/app/modules/ide/dcf.py",
    ideSymbols: ["DCFResult.giy_current", "Scenario.gross_yield", "_one(yield_vs_market)"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/PricingTable.jsx",
      "apps/FEP/src/pages/project/sections/valuation/OverviewTable.jsx",
      "apps/FEP/src/utils/exportValuationPdf.js"
    ],
    formulaSummaryDe: "Bruttoanfangsrendite (GIY) = Jahresnettokaltmiete (current_rent_pa) ÷ Marktwert bzw. Kaufpreis."
  },
  {
    termsDe: ["nettorendite", "nettoanfangsrendite", "niy", "net initial yield"],
    category: "IDE Valuation & UI",
    ideFile: "apps/AI/app/modules/ide/dcf.py",
    ideSymbols: ["DCFResult.niy_current", "DCFResult.niy_market", "Scenario.net_initial_yield", "_niy_percent"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/PricingTable.jsx",
      "apps/FEP/src/pages/project/sections/valuation/OverviewTable.jsx",
      "apps/FEP/src/utils/exportValuationPdf.js"
    ],
    formulaSummaryDe: "Nettoanfangsrendite (NIY) = Net Operating Income (NOI Jahr 0) ÷ Gesamtinvestitionskosten inkl. Erwerbsnebenkosten (gross_cost)."
  },
  {
    termsDe: ["faktor", "ankaufsfaktor", "mietmultiplikator", "multiplikator", "vervielfältiger", "multiple"],
    category: "IDE Valuation & UI",
    ideFile: "apps/AI/app/modules/ide/dcf.py",
    ideSymbols: ["DCFResult.multiplier_current", "DCFResult.multiplier_market", "Scenario.multiple"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/PricingTable.jsx",
      "apps/FEP/src/pages/project/sections/valuation/OverviewTable.jsx",
      "apps/FEP/src/utils/exportValuationPdf.js"
    ],
    formulaSummaryDe: "Mietmultiplikator (Faktor) = Marktwert bzw. Kaufpreis ÷ Jahresnettokaltmiete (Ist oder Markt)."
  },
  {
    termsDe: ["dcf", "ertragswert", "cashflow", "10-jahres", "diskontierungszins", "liegenschaftszins", "cap rate"],
    category: "IDE Valuation (Yellow Zone)",
    ideFile: "apps/AI/app/modules/ide/dcf.py",
    ideSymbols: ["DCFAssumptions", "run_dcf", "_year_row", "sensitivity"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/valuation/DcfTable.jsx",
      "apps/FEP/src/pages/project/sections/dealCheck/AssumptionsEditor.jsx"
    ],
    formulaSummaryDe: "10-Jahres-DCF (Knight-Frank-Methodik): Barwert der Netto-Cashflows (Jahre 1–10) + abgezinster Exit-Wert im Jahr 10 (NOI Jahr 11 ÷ Cap Rate), abzüglich Erwerbsnebenkosten (Standard 9,0%). Diskontierungszins = Cap Rate + 1,0%-Punkt."
  },
  {
    termsDe: ["restwert", "residualwert", "restwertverfahren", "projektentwicklung", "baukosten", "bauträgergewinn", "gdv"],
    category: "IDE Valuation (Yellow Zone)",
    ideFile: "apps/AI/app/modules/ide/residual.py",
    ideSymbols: ["ResidualAssumptions", "ResidualInputs", "run_residual"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/valuation/ParametersAndSensitivity.jsx",
      "apps/FEP/src/pages/project/sections/dealCheck/AssumptionsEditor.jsx"
    ],
    formulaSummaryDe: "Residualwertverfahren: GDV (aus DCF-Marktwert) abzgl. Baukosten (BGF × €/m²), Außenanlagen (5%), Baunebenkosten (18%), Baurisiko (7,5%), Bauträgergewinn (10% vom GDV), Vermietungsgebühr und Bauzeitfinanzierung (5% p.a. über halbe Bauzeit), geteilt durch Grundstücks-Erwerbs- und Finanzierungsfaktor."
  },
  {
    termsDe: ["sensitivität", "sensitivitätsmatrix", "zinsänderung", "mietänderung", "sensitivity"],
    category: "IDE Valuation & UI",
    ideFile: "apps/AI/app/modules/ide/dcf.py",
    ideSymbols: ["sensitivity", "SensitivityCell"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/valuation/ParametersAndSensitivity.jsx",
      "apps/FEP/src/utils/exportValuationPdf.js"
    ],
    formulaSummaryDe: "3×3 Sensitivitätsmatrix: Miete (-10% / 0% / +10%) gegen Cap Rate & Diskontierungszins (+100 bps / 0 bps / -100 bps)."
  },
  {
    termsDe: ["gebot", "ide gebot", "kaufpreisangebot", "szenarien", "value-add", "pricing", "preis-skala"],
    category: "IDE Pricing & UI",
    ideFile: "apps/AI/app/modules/ide/pricing.py",
    ideSymbols: ["PricingAssumptions", "price", "_scenario", "Scenario"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/PriceScale.jsx",
      "apps/FEP/src/pages/project/sections/dealCheck/PricingTable.jsx"
    ],
    formulaSummaryDe: "IDE-Gebot (bid_price) = Angebotspreis (asking_price) abzüglich aller aktiven Regel-Abzüge (R-04 CapEx-Rückstau, R-08 überhöhte Maklercourtage). Value-Add-Szenario rechnet mit ERV-Miete + R-06 Zusatzerträgen (6.000 € p.a.)."
  },
  {
    termsDe: ["regeln", "r-01", "r-02", "r-03", "r-04", "r-05", "r-06", "r-07", "r-08", "capex-rückstau", "maklercourtage", "geg", "dachgeschoss", "mikro-apartment"],
    category: "IDE Rules Engine (Yellow Zone)",
    ideFile: "apps/AI/app/modules/ide/rules.py",
    ideSymbols: ["evaluate_rules", "r01", "r02", "r03", "r04", "r05", "r06", "r07", "r08"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/RulesList.jsx"
    ],
    formulaSummaryDe: "Deterministische Regeln R-01 bis R-08: R-01 Flächenabgleich (>2% Abweichung), R-02 Mikro-Apartment (<40 m² & Miete <85% ERV), R-03 Teilung ohne Genehmigung, R-04 CapEx-Rückstau (150 €/m² bei >30J Baujahr & >20J Sanierung), R-05 GEG/ESG (Klasse E-H oder Heizung >=15J), R-06 Stellplätze/Antenne (+6.000 € p.a.), R-07 Dachgeschoss-Potenzial, R-08 Maklercourtage (>5,95% -> Abzug auf 3,57%)."
  },
  {
    termsDe: ["grunderwerbsteuer", "erwerbsnebenkosten", "notar", "makler", "ltv", "beleihungsauslauf", "bewirtschaftungskosten", "instandhaltung"],
    category: "IDE Constants (Yellow Zone)",
    ideFile: "apps/AI/app/modules/ide/constants.py",
    ideSymbols: ["NON_RECOVERABLE_COST_RATE", "LTV", "DEBT_SERVICE_RATE", "NOTARY_RATE", "BROKER_MARKET_RATE", "CAPEX_RESERVE_PER_SQM", "_LTT", "land_transfer_tax", "acquisition_cost_rate"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/AssumptionsEditor.jsx"
    ],
    formulaSummaryDe: "Globale Konstanten: Nicht umlagefähige Kosten = 15%, LTV = 75%, Kapitaldienst = 5,1% (3,6% Zins + 1,5% Tilgung), Notar = 2,0%, Ziel-Courtage = 3,57%, CapEx-Reserve = 150 €/m², Grunderwerbsteuer nach Bundesland (3,5% Bayern bis 6,5% NRW/Brandenburg/SH/Saarland)."
  },
  {
    termsDe: ["scoring", "gewichtung", "säulen", "pillars", "go", "conditional go", "no go", "verdict", "urteil", "noten", "ratings"],
    category: "IDE Scoring & Ratings",
    ideFile: "apps/AI/app/modules/ide/scoring.py",
    ideSymbols: ["PILLAR_WEIGHTS", "CATALOGUE", "score", "verdict_for", "derive_ratings"],
    fepFiles: [
      "apps/FEP/src/pages/project/sections/dealCheck/ScoreCard.jsx",
      "apps/FEP/src/pages/project/sections/dealCheck/RatingsStrip.jsx",
      "apps/FEP/src/pages/project/sections/DealCheckSection.jsx"
    ],
    formulaSummaryDe: "4 Säulen: Asset (35%), Market Evidence (35%), Market Structure (15%), Macro (15%). Verdict: GO >= 0,80, CONDITIONAL_GO >= 0,65, NO_GO < 0,65 (unter 50% Datenabdeckung: INSUFFICIENT_DATA)."
  },
  {
    termsDe: ["pdf", "pdf-bericht", "deckblatt", "export", "drucken", "ausdruck"],
    category: "FEP PDF Export (Green Zone)",
    ideFile: "apps/AI/app/modules/ide/report.py",
    ideSymbols: ["build_report"],
    fepFiles: [
      "apps/FEP/src/utils/exportValuationPdf.js",
      "apps/FEP/src/__tests__/exportValuationPdf.test.js"
    ],
    formulaSummaryDe: "Client-seitiger A4-PDF-Generator mit jsPDF (exportValuationPdf.js): Deckblatt, Preispositionierung, Qualitätsnoten, Fehlende Unterlagen, Objektübersicht, Annahmen, 3×3 Sensitivität, Berichtstexte, 10-Jahres-DCF, Mieterspiegel und Vergleichsobjekte."
  }
];

export function lookupGermanTerm({ query = "" }) {
  const q = String(query).toLowerCase().trim();
  if (!q) {
    return {
      query,
      matches: GERMAN_CODE_DICTIONARY
    };
  }

  const tokens = q.split(/[\s,/+-]+/).filter((t) => t.length >= 2);
  const scored = GERMAN_CODE_DICTIONARY.map((entry) => {
    let score = 0;
    for (const term of entry.termsDe) {
      if (term.includes(q) || q.includes(term)) score += 10;
      for (const tok of tokens) {
        if (term.includes(tok)) score += 3;
      }
    }
    if (entry.formulaSummaryDe.toLowerCase().includes(q)) score += 4;
    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);

  return {
    query,
    matchCount: scored.length,
    matches: scored.length > 0 ? scored : GERMAN_CODE_DICTIONARY.slice(0, 4)
  };
}

/**
 * Reads an IDE Python module from Mithor-Platforms and extracts functions, classes, and constants.
 */
export function inspectIdeFormula({
  moduleName,
  symbol = "",
  mithorRepoPath = process.env.MITHOR_REPO_PATH
}) {
  const cleanMod = String(moduleName || "dcf").replace(/\.py$/, "");
  const relPath = `apps/AI/app/modules/ide/${cleanMod}.py`;
  const fullPath = path.join(mithorRepoPath || "", relPath);

  if (!mithorRepoPath || !fs.existsSync(fullPath)) {
    return {
      found: false,
      relPath,
      error: `Module not found at ${fullPath}`
    };
  }

  const source = fs.readFileSync(fullPath, "utf8");
  const lines = source.split(/\r?\n/);

  if (!symbol) {
    return {
      found: true,
      relPath,
      lineCount: lines.length,
      sourcePreview: lines.slice(0, 120).join("\n")
    };
  }

  // Locate class, def, or constant matching `symbol`
  const targetRx = new RegExp(`^(?:def|class)\\s+${symbol}\\b|^${symbol}\\s*=`, "m");
  let startIdx = lines.findIndex((l) => targetRx.test(l));
  if (startIdx === -1) {
    startIdx = lines.findIndex((l) => l.toLowerCase().includes(symbol.toLowerCase()));
  }
  if (startIdx === -1) {
    return {
      found: false,
      relPath,
      symbol,
      error: `Symbol '${symbol}' not found in ${relPath}`
    };
  }

  const endIdx = Math.min(lines.length, startIdx + 65);
  return {
    found: true,
    relPath,
    symbol,
    startLine: startIdx + 1,
    endLine: endIdx,
    snippet: lines.slice(startIdx, endIdx).join("\n")
  };
}

export function getLastClickedElement(harnessRoot = process.cwd()) {
  const snapFile = path.join(harnessRoot, ".mithor-snapshots", "last-clicked-element.json");
  if (!fs.existsSync(snapFile)) {
    return {
      hasSelection: false,
      messageDe: "Noch kein UI-Element über Alt+Klick im Vorschaufenster ausgewählt."
    };
  }
  return {
    hasSelection: true,
    selection: JSON.parse(fs.readFileSync(snapFile, "utf8"))
  };
}

export function recordClickedElement(payload, harnessRoot = process.cwd()) {
  const dir = path.join(harnessRoot, ".mithor-snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const snapFile = path.join(dir, "last-clicked-element.json");
  const enriched = {
    ...payload,
    recordedAt: new Date().toISOString()
  };
  fs.writeFileSync(snapFile, JSON.stringify(enriched, null, 2), "utf8");
  return enriched;
}
