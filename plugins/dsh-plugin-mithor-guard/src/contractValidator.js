import fs from "node:fs";
import path from "node:path";

/**
 * Expected public function signatures and Pydantic class names in apps/AI/app/modules/ide/
 * that apps/BFF and internal report assembly depend on.
 * Any modification that removes or renames these symbols fails the bff_ai_contract_check gate.
 */
export const IDE_CONTRACT_SNAPSHOT = {
  "apps/AI/app/modules/ide/dcf.py": {
    classes: ["DCFAssumptions", "DCFInputs", "DCFYear", "DCFResult", "SensitivityCell"],
    functions: ["round_value", "run_dcf", "sensitivity"]
  },
  "apps/AI/app/modules/ide/residual.py": {
    classes: ["ResidualAssumptions", "ResidualInputs", "ResidualResult"],
    functions: ["run_residual"]
  },
  "apps/AI/app/modules/ide/pricing.py": {
    classes: ["PricingAssumptions", "Scenario", "PricingResult"],
    functions: ["price"]
  },
  "apps/AI/app/modules/ide/scoring.py": {
    classes: ["PillarScore", "ScoreResult"],
    functions: ["verdict_for", "score"]
  },
  "apps/AI/app/modules/ide/rules.py": {
    classes: ["RuleTrigger"],
    functions: ["r01", "r02", "r03", "r04", "r05", "r06", "r07", "r08", "evaluate_rules"]
  },
  "apps/AI/app/modules/ide/ratings.py": {
    classes: ["Ratings"],
    functions: ["grade", "derive_ratings"]
  },
  "apps/AI/app/modules/ide/audit.py": {
    classes: ["AuditFinding"],
    functions: ["run_audit"]
  },
  "apps/AI/app/modules/ide/report.py": {
    classes: ["AssumptionsInvalidError"],
    functions: ["build_missing_information", "build_report"]
  }
};

/**
 * Validates that touched Yellow-Zone IDE Python files still export all required contract classes
 * and functions expected by apps/BFF and report.py.
 */
export function validateIdeContracts(mithorRepoPath, touchedPaths = []) {
  const issues = [];
  const targets = touchedPaths.length > 0
    ? touchedPaths.filter((p) => p in IDE_CONTRACT_SNAPSHOT)
    : Object.keys(IDE_CONTRACT_SNAPSHOT);

  for (const relFile of targets) {
    const expected = IDE_CONTRACT_SNAPSHOT[relFile];
    if (!expected) continue;
    const fullPath = path.join(mithorRepoPath, relFile);
    if (!fs.existsSync(fullPath)) {
      issues.push(`${relFile}: File is missing`);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    for (const clsName of expected.classes) {
      const rx = new RegExp(`^class\\s+${clsName}\\b`, "m");
      if (!rx.test(content)) {
        issues.push(`${relFile}: Missing required contract class '${clsName}'`);
      }
    }
    for (const fnName of expected.functions) {
      const rx = new RegExp(`^def\\s+${fnName}\\s*\\(`, "m");
      if (!rx.test(content)) {
        issues.push(`${relFile}: Missing required contract function '${fnName}()'`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues
  };
}

/**
 * Validates i18n locale parity matching apps/FEP/src/__tests__/i18nParity.test.js:
 * - Full key parity between de.json and en.json
 * - Strict 3-way key parity (de, en, fr) for dealflow.dealCheckStart and project.dealCheck
 */
export function validateI18nParity(mithorRepoPath) {
  const locales = ["de", "en", "fr"];
  const parsedLocales = {};

  function collectKeys(obj, prefix = "") {
    const out = [];
    for (const [k, v] of Object.entries(obj || {})) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        out.push(...collectKeys(v, full));
      } else {
        out.push(full);
      }
    }
    return out.sort();
  }

  for (const loc of locales) {
    const file = path.join(mithorRepoPath, "apps", "FEP", "src", "locales", `${loc}.json`);
    if (!fs.existsSync(file)) {
      return { passed: false, issues: [`Missing locale file: apps/FEP/src/locales/${loc}.json`] };
    }
    try {
      parsedLocales[loc] = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      return { passed: false, issues: [`Invalid JSON in ${loc}.json: ${err.message}`] };
    }
  }

  const issues = [];
  // 1. Full parity between de.json and en.json
  const deAll = new Set(collectKeys(parsedLocales.de));
  const enAll = new Set(collectKeys(parsedLocales.en));
  for (const k of deAll) {
    if (!enAll.has(k)) issues.push(`Key '${k}' exists in de.json but is missing in en.json`);
  }
  for (const k of enAll) {
    if (!deAll.has(k)) issues.push(`Key '${k}' exists in en.json but is missing in de.json`);
  }

  // 2. Strict 3-way parity (en, de, fr) on dealflow.dealCheckStart and project.dealCheck
  const scopedSets = {};
  for (const loc of locales) {
    scopedSets[loc] = new Set([
      ...collectKeys(parsedLocales[loc]?.dealflow?.dealCheckStart, "dealflow.dealCheckStart"),
      ...collectKeys(parsedLocales[loc]?.project?.dealCheck, "project.dealCheck")
    ]);
  }
  for (const other of ["en", "fr"]) {
    for (const k of scopedSets.de) {
      if (!scopedSets[other].has(k)) {
        issues.push(`Key '${k}' exists in de.json but is missing in ${other}.json`);
      }
    }
    for (const k of scopedSets[other]) {
      if (!scopedSets.de.has(k)) {
        issues.push(`Key '${k}' exists in ${other}.json but is missing in de.json`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues
  };
}
