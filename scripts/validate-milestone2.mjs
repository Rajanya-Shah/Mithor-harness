import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyPathZone,
  loadZonesConfig,
  sanitizeGitText,
  hasForbiddenAiAttribution,
  inspectShellCommand
} from "../packages/shared/src/index.js";
import {
  createMithorGuardEngine
} from "../plugins/dsh-plugin-mithor-guard/src/index.js";
import {
  validateIdeContracts,
  validateI18nParity
} from "../plugins/dsh-plugin-mithor-guard/src/contractValidator.js";
import {
  createMithorGitTriageEngine,
  formatBranchName,
  buildBilingualPullRequest
} from "../plugins/dsh-plugin-mithor-git-triage/src/index.js";
import {
  classifyDiffRisk
} from "../plugins/dsh-plugin-mithor-git-triage/src/riskClassifier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ZONES_CONFIG_PATH = path.join(ROOT, "config", "zones.config.json");
const MITHOR_PLATFORMS_PATH = path.resolve(ROOT, "..", "Mithor-Platforms");
const zonesConfig = loadZonesConfig(ZONES_CONFIG_PATH);

test("1. Three-Zone Path Classification (Green / Yellow / Red & Excluded Subpaths)", () => {
  // Green Zone
  assert.equal(classifyPathZone("apps/FEP/src/pages/project/sections/DealCheckSection.jsx", zonesConfig).zone, "green_ui");
  assert.equal(classifyPathZone("apps/FEP/src/utils/exportValuationPdf.js", zonesConfig).zone, "green_ui");
  assert.equal(classifyPathZone("apps/FEP/src/locales/de.json", zonesConfig).zone, "green_ui");

  // Excluded inside FEP -> must be Red Zone!
  assert.equal(classifyPathZone("apps/FEP/src/api/request.js", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("apps/FEP/src/lib/firebase.js", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("apps/FEP/src/repositories/projectRepository.js", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("apps/FEP/package.json", zonesConfig).zone, "red_locked");

  // Yellow Zone (deterministic IDE math)
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/dcf.py", zonesConfig).zone, "yellow_ide_math");
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/residual.py", zonesConfig).zone, "yellow_ide_math");
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/pricing.py", zonesConfig).zone, "yellow_ide_math");
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/rules.py", zonesConfig).zone, "yellow_ide_math");
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/constants.py", zonesConfig).zone, "yellow_ide_math");

  // Excluded inside AI/ide -> must be Red Zone!
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/service.py", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/routes.py", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("apps/AI/app/modules/ide/schemas/report.py", zonesConfig).zone, "red_locked");

  // Red Zone apps & infra
  assert.equal(classifyPathZone("apps/BFF/app/main.py", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("apps/Mobile/shared/build.gradle.kts", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("servers/deploy/deploy.sh", zonesConfig).zone, "red_locked");
  assert.equal(classifyPathZone("../outside/secret.txt", zonesConfig).zone, "red_locked");
});

test("2. Shell Guard blocks Red/Yellow Zone write bypasses & destructive commands", () => {
  assert.equal(inspectShellCommand("npm test", zonesConfig).allowed, true);
  assert.equal(inspectShellCommand("git push --force origin develop", zonesConfig).allowed, false);
  assert.equal(inspectShellCommand("echo 'HACK=1' >> apps/BFF/.env", zonesConfig).allowed, false);
  assert.equal(inspectShellCommand("sed -i 's/0.15/0.20/g' apps/AI/app/modules/ide/constants.py", zonesConfig).allowed, false);
  assert.equal(inspectShellCommand("ssh root@199.247.4.55 systemctl restart apache2", zonesConfig).allowed, false);
});

test("3. MithorGuardEngine enforces Yellow Zone German formula confirmation and 3-strike auto-rollback", () => {
  const executedCommands = [];
  let shouldFailGate = false;

  const guard = createMithorGuardEngine({
    zonesConfig,
    mithorRepoPath: MITHOR_PLATFORMS_PATH,
    maxAutoFixRetries: 3,
    execRunner: (cmd) => {
      executedCommands.push(cmd);
      if (shouldFailGate && (cmd.includes("pytest") || cmd.includes("npm"))) {
        const err = new Error("Test assertion failed");
        err.stderr = "AssertionError: expected 0.7475";
        throw err;
      }
      return "PASSED";
    }
  });

  // 3a. Red Zone edit is blocked with German escalation message
  const redAttempt = guard.interceptToolCall("edit_file", { path: "apps/BFF/worker.py" });
  assert.equal(redAttempt.allowed, false);
  assert.equal(redAttempt.zone, "red_locked");
  assert.ok(redAttempt.messageDe.includes("Sarbu oder Manish"));

  // 3b. Yellow Zone edit is blocked BEFORE German explanation & confirmation
  const yellowUnapproved = guard.interceptToolCall("edit_file", { path: "apps/AI/app/modules/ide/dcf.py" });
  assert.equal(yellowUnapproved.allowed, false);
  assert.equal(yellowUnapproved.zone, "yellow_ide_math");

  // 3c. Register German formula explanation & Philipp's confirmation
  const approval = guard.registerYellowApproval({
    targetPath: "apps/AI/app/modules/ide/dcf.py",
    currentFormulaDe: "Aktuell beträgt die Standard-Instandhaltung (maintenance_per_sqm) 10,00 €/m² p.a.",
    proposedFormulaDe: "Wir erhöhen den Standardwert auf 12,00 €/m² p.a. für Altbauten.",
    impactSummaryDe: "Der Marktwert im 10-Jahres-DCF sinkt dadurch leicht um ca. 1,2%.",
    philippConfirmed: true
  });
  assert.equal(approval.approved, true);

  // Now Yellow Zone edit succeeds
  const yellowApproved = guard.interceptToolCall("edit_file", { path: "apps/AI/app/modules/ide/dcf.py" });
  assert.equal(yellowApproved.allowed, true);

  // 3d. Simulate 3 consecutive verification failures -> must trigger automatic rollback
  shouldFailGate = true;
  const fail1 = guard.runVerificationGates({ skipVisualSnapshot: true });
  assert.equal(fail1.passed, false);
  assert.equal(fail1.rolledBack, false);
  assert.equal(fail1.attempt, 1);

  const fail2 = guard.runVerificationGates({ skipVisualSnapshot: true });
  assert.equal(fail2.passed, false);
  assert.equal(fail2.rolledBack, false);
  assert.equal(fail2.attempt, 2);

  const fail3 = guard.runVerificationGates({ skipVisualSnapshot: true });
  assert.equal(fail3.passed, false);
  assert.equal(fail3.rolledBack, true);
  assert.ok(fail3.messageDe.includes("zurückgesetzt"));
  assert.equal(Object.keys(guard.getState().touchedFiles).length, 0);
});

test("4. Real Mithor-Platforms Contract & i18n Parity Validation (Read-Only)", () => {
  const ideContractRes = validateIdeContracts(MITHOR_PLATFORMS_PATH);
  assert.equal(ideContractRes.passed, true, `IDE contract check issues: ${ideContractRes.issues.join(", ")}`);

  const i18nRes = validateI18nParity(MITHOR_PLATFORMS_PATH);
  assert.equal(i18nRes.passed, true, `i18n parity issues: ${i18nRes.issues.join(", ")}`);
});

test("5. Granular L1-L4 PR Risk Classifier & Zero-AI-Attribution Sanitizer", () => {
  // L1: CSS / copy change
  const l1 = classifyDiffRisk({
    touchedPaths: ["apps/FEP/src/pages/project/ProjectHeader.jsx"],
    diffText: "- <h1 className=\"text-sm\">Title</h1>\n+ <h1 className=\"text-base font-bold\">Title</h1>"
  });
  assert.equal(l1.level, "L1");
  assert.equal(l1.tag, "[L1: PIXEL / COPY]");
  assert.deepEqual(l1.reviewers, ["sarbu"]);

  // L2: PDF export or DealCheck table logic
  const l2 = classifyDiffRisk({
    touchedPaths: ["apps/FEP/src/utils/exportValuationPdf.js"],
    diffText: "- const ML = 18\n+ const ML = 20"
  });
  assert.equal(l2.level, "L2");
  assert.equal(l2.tag, "[L2: UI LOGIC / PDF]");
  assert.deepEqual(l2.reviewers, ["sarbu", "manish"]);

  // L3: IDE formula constant/rule tweak
  const l3 = classifyDiffRisk({
    touchedPaths: ["apps/AI/app/modules/ide/constants.py"],
    diffText: "- CAPEX_RESERVE_PER_SQM = 150.0\n+ CAPEX_RESERVE_PER_SQM = 165.0"
  });
  assert.equal(l3.level, "L3");
  assert.equal(l3.tag, "[L3: IDE FORMULA]");
  assert.deepEqual(l3.reviewers, ["sarbu", "manish", "ukarky"]);

  // L4: Multi-lane or Python function signature change
  const l4 = classifyDiffRisk({
    touchedPaths: ["apps/FEP/src/utils/exportValuationPdf.js", "apps/AI/app/modules/ide/dcf.py"],
    diffText: "- def run_dcf(inputs: DCFInputs, a: DCFAssumptions) -> DCFResult:\n+ def run_dcf(inputs: DCFInputs, a: DCFAssumptions, extra: bool = False) -> DCFResult:"
  });
  assert.equal(l4.level, "L4");
  assert.equal(l4.tag, "[L4: SCHEMA / HIGH RISK]");
  assert.deepEqual(l4.reviewers, ["ukarky", "sarbu", "manish"]);

  // Zero AI Attribution Sanitizer (HARD RULE #1)
  const dirtyText = "feat(FEP): update yield card\n\nGenerated by Claude Code and DeepSeek\nCo-authored-by: Claude <noreply@anthropic.com>\n🤖 Generated with Antigravity";
  const cleaned = sanitizeGitText(dirtyText);
  assert.equal(hasForbiddenAiAttribution(cleaned).hasViolation, false);
  assert.ok(!cleaned.includes("Co-authored-by"));
  assert.ok(!cleaned.includes("Claude"));
  assert.ok(!cleaned.includes("DeepSeek"));

  // Bilingual PR generation & Git Triage flow
  const branchName = formatBranchName("Ankaufsfaktor Spalte PDF", "2026-11-22");
  assert.equal(branchName, "philipp/2026-11-22-ankaufsfaktor-spalte-pdf");

  const pr = buildBilingualPullRequest({
    risk: l2,
    branchName,
    baseBranch: "develop",
    titleEn: "adjust multiplier column width in PDF export",
    summaryDe: "Die Spaltenbreite für den Mietmultiplikator im PDF-Bericht wurde verbreitert.",
    technicalSummaryEn: "Adjusted column widths array in exportValuationPdf.js sensitivity section.",
    touchedPaths: ["apps/FEP/src/utils/exportValuationPdf.js"],
    verificationGates: [{ gateId: "fep_test", passed: true, output: "98 passed" }]
  });
  assert.ok(pr.title.startsWith("feat(FEP): [L2: UI LOGIC / PDF]"));
  assert.ok(pr.body.includes("Zusammenfassung (Deutsch — Philipp)"));
  assert.ok(pr.body.includes("Technical Review Summary (English — Sarbu / Manish / Ukarky)"));
  assert.ok(pr.body.includes("@sarbu, @manish"));
});
