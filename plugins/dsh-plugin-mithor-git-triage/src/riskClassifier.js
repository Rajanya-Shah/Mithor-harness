import { normalizeRepoPath } from "../../../packages/shared/src/index.js";

const L2_FEP_PATTERNS = [
  /^apps\/FEP\/src\/utils\/exportValuationPdf\.js$/,
  /^apps\/FEP\/src\/utils\/exportProjectPdf\.js$/,
  /^apps\/FEP\/src\/utils\/formatters\.js$/,
  /^apps\/FEP\/src\/pages\/project\/sections\/valuation\//,
  /^apps\/FEP\/src\/pages\/project\/sections\/dealCheck\//,
  /^apps\/FEP\/src\/pages\/project\/sections\/DealCheckSection\.jsx$/,
  /^apps\/FEP\/src\/hooks\//
];

/**
 * Determines which CI lanes (FEP, AI, etc.) are touched by a list of relative file paths.
 */
export function detectTouchedLanes(touchedPaths = []) {
  const lanes = new Set();
  for (const raw of touchedPaths) {
    const rel = normalizeRepoPath(raw);
    const parts = rel.split("/");
    if (parts[0] === "apps" && parts[1]) {
      lanes.add(parts[1]);
    }
  }
  return [...lanes];
}

/**
 * Granular 4-level PR Risk Classifier (L1..L4) for Sarbu, Manish, and Ukarky.
 *
 * - L1 ([L1: PIXEL / COPY]): CSS, Tailwind classes, or locale JSON files in apps/FEP
 * - L2 ([L2: UI LOGIC / PDF]): React state/hooks, DealCheck/Valuation components, or exportValuationPdf.js
 * - L3 ([L3: IDE FORMULA]): Single-lane edits to apps/AI/app/modules/ide/*.py where function signatures & schemas are intact
 * - L4 ([L4: SCHEMA / HIGH RISK]): Python def/class signature changes, schema edits, or multi-lane (FEP + AI) PRs
 */
export function classifyDiffRisk({ touchedPaths = [], diffText = "" }) {
  const normPaths = touchedPaths.map((p) => normalizeRepoPath(p)).filter(Boolean);
  const lanes = detectTouchedLanes(normPaths);
  const reasons = [];

  // Check L4 triggers first
  const touchesSchemas = normPaths.some((p) => p.startsWith("apps/AI/app/modules/ide/schemas/"));
  const isMultiLane = lanes.length > 1;
  const mutatesPythonSignature =
    normPaths.some((p) => p.endsWith(".py")) &&
    (/^[+-]\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/m.test(diffText) ||
      /^[+-]\s*class\s+[a-zA-Z_][a-zA-Z0-9_]*\b/m.test(diffText));

  if (touchesSchemas || isMultiLane || mutatesPythonSignature) {
    if (touchesSchemas) reasons.push("Touches Pydantic schema definitions under apps/AI/app/modules/ide/schemas/");
    if (isMultiLane) reasons.push(`Spans multiple CI deployment lanes (${lanes.join(" + ")})`);
    if (mutatesPythonSignature) reasons.push("Modifies Python function or class signature in diff");

    return {
      level: "L4",
      tag: "[L4: SCHEMA / HIGH RISK]",
      lanes,
      reviewers: ["ukarky", "sarbu", "manish"],
      reasons
    };
  }

  // Check L3 triggers (IDE Python math/constants/rules)
  const touchesIdeMath = normPaths.some((p) => p.startsWith("apps/AI/app/modules/ide/") && p.endsWith(".py"));
  if (touchesIdeMath) {
    reasons.push("Modifies deterministic IDE valuation formulas, weights, constants, or rules (R-01..R-08)");
    return {
      level: "L3",
      tag: "[L3: IDE FORMULA]",
      lanes,
      reviewers: ["sarbu", "manish", "ukarky"],
      reasons
    };
  }

  // Check L2 triggers (FEP PDF export, DealCheck/Valuation tables, or React state/hook changes)
  const touchesL2Path = normPaths.some((p) => L2_FEP_PATTERNS.some((rx) => rx.test(p)));
  const mutatesReactLogic =
    /^[+-].*\b(?:useState|useEffect|useMemo|useCallback|handleRecalculate|exportValuationPdf)\b/m.test(diffText);

  if (touchesL2Path || mutatesReactLogic) {
    if (touchesL2Path) reasons.push("Touches DealCheck/Valuation views, formatters, or jsPDF exportValuationPdf.js");
    if (mutatesReactLogic) reasons.push("Modifies React component state, hooks, or event handlers");
    return {
      level: "L2",
      tag: "[L2: UI LOGIC / PDF]",
      lanes,
      reviewers: ["sarbu", "manish"],
      reasons
    };
  }

  // Default to L1 (Cosmetic / Pixel / Copy in apps/FEP)
  reasons.push("Cosmetic styling, Tailwind CSS classes, spacing, or static locale copy (de/en/fr)");
  return {
    level: "L1",
    tag: "[L1: PIXEL / COPY]",
    lanes: lanes.length > 0 ? lanes : ["FEP"],
    reviewers: ["sarbu"],
    reasons
  };
}
