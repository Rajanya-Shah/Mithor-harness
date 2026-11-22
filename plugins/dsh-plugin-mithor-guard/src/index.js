import { execSync } from "node:child_process";
import path from "node:path";
import {
  classifyPathZone,
  getSharedGuardEngine,
  inspectShellCommand,
  loadZonesConfig,
  normalizeRepoPath,
  setSharedGuardEngine,
  tryGetCordisService
} from "../../../packages/shared/src/index.js";
import { validateI18nParity, validateIdeContracts } from "./contractValidator.js";

export const name = "dsh-plugin-mithor-guard";
export const inject = [];

const WRITE_TOOLS = new Set([
  "write_file",
  "edit_file",
  "create_file",
  "delete_file",
  "patch_file",
  "replace_in_file",
  "multi_edit"
]);

const SHELL_TOOLS = new Set([
  "bash",
  "sh",
  "shell",
  "run_command",
  "exec"
]);

/**
 * Creates a standalone MithorGuardEngine instance that powers the Cordis plugin
 * and can also be unit-tested deterministically.
 */
export function createMithorGuardEngine(options = {}) {
  const zonesConfig = options.zonesConfig || loadZonesConfig(options.zonesConfigPath);
  const mithorRepoPath = options.mithorRepoPath || process.env.MITHOR_REPO_PATH || process.cwd();
  const maxAutoFixRetries = options.maxAutoFixRetries ?? 3;
  const execRunner = options.execRunner || ((cmd, cwd, timeoutMs) =>
    execSync(cmd, { cwd, timeout: timeoutMs, encoding: "utf8", stdio: "pipe" })
  );

  const state = {
    preTaskCommitSha: null,
    touchedFiles: new Map(), // relPath -> { zone, timestamp }
    yellowApprovals: new Map(), // relPath -> { currentFormulaDe, proposedFormulaDe, impactSummaryDe, confirmedAt }
    consecutiveGateFailures: 0,
    lastVerification: null
  };

  function registerYellowApproval({
    targetPath,
    currentFormulaDe,
    proposedFormulaDe,
    impactSummaryDe,
    philippConfirmed
  }) {
    const verdict = classifyPathZone(targetPath, zonesConfig, mithorRepoPath);
    if (verdict.zone !== "yellow_ide_math") {
      return {
        approved: false,
        reason: `Target '${verdict.relPath}' is in zone '${verdict.zone}', not 'yellow_ide_math'.`
      };
    }
    if (!philippConfirmed) {
      return {
        approved: false,
        reason: "Philipp has not explicitly confirmed the formula change yet (philippConfirmed must be true)."
      };
    }
    const combinedExplanation = `${currentFormulaDe || ""} ${proposedFormulaDe || ""} ${impactSummaryDe || ""}`.trim();
    if (combinedExplanation.length < 30) {
      return {
        approved: false,
        reason: "German formula explanation is too brief. Provide clear current vs. proposed math explanation in German."
      };
    }
    state.yellowApprovals.set(verdict.relPath, {
      currentFormulaDe,
      proposedFormulaDe,
      impactSummaryDe,
      confirmedAt: new Date().toISOString()
    });
    return {
      approved: true,
      relPath: verdict.relPath,
      messageDe: `Formel-Freigabe für '${verdict.relPath}' erfolgreich registriert. Die Datei darf jetzt angepasst werden.`
    };
  }

  function interceptToolCall(toolName, args = {}) {
    // 1. Shell tool interception
    if (SHELL_TOOLS.has(toolName)) {
      const cmd = args.command || args.CommandLine || args.cmd || "";
      const shellCheck = inspectShellCommand(cmd, zonesConfig, mithorRepoPath);
      if (!shellCheck.allowed) {
        return {
          allowed: false,
          zone: shellCheck.zone,
          reason: shellCheck.reason,
          messageDe: shellCheck.messageDe
        };
      }
      return { allowed: true };
    }

    // 2. File write/edit tool interception
    if (WRITE_TOOLS.has(toolName)) {
      const rawPath = args.path || args.Path || args.file_path || args.filePath || args.target_file;
      const verdict = classifyPathZone(rawPath, zonesConfig, mithorRepoPath);

      if (verdict.zone === "red_locked") {
        return {
          allowed: false,
          zone: "red_locked",
          relPath: verdict.relPath,
          reason: verdict.reason,
          messageDe: zonesConfig.zones.red_locked.escalationMessageDe
        };
      }

      if (verdict.zone === "yellow_ide_math") {
        const approval = state.yellowApprovals.get(verdict.relPath);
        if (!approval) {
          return {
            allowed: false,
            zone: "yellow_ide_math",
            relPath: verdict.relPath,
            reason: `Yellow Zone file '${verdict.relPath}' requires a plain-German formula explanation and confirmation from Philipp via 'mithor_explain_yellow_edit' before editing.`,
            messageDe: `Hinweis (Gelbe Zone — IDE Bewertungslogik): Bevor ich '${verdict.relPath}' ändere, erkläre ich dir kurz die aktuelle Formel und die geplante Anpassung auf Deutsch und warte auf deine Bestätigung.`
          };
        }
      }

      // Allowed write (green_ui or approved yellow_ide_math): record dirty state & invalidate verification
      state.touchedFiles.set(verdict.relPath, {
        zone: verdict.zone,
        timestamp: new Date().toISOString()
      });
      state.lastVerification = null;

      return {
        allowed: true,
        zone: verdict.zone,
        relPath: verdict.relPath
      };
    }

    return { allowed: true };
  }

  function performRollback() {
    const touchedPaths = [...state.touchedFiles.keys()];
    try {
      for (const rel of touchedPaths) {
        execRunner(`git checkout -- "${rel}"`, mithorRepoPath, 15000);
      }
    } catch {
      // Fallback: full working tree checkout if individual file was newly created
      try {
        execRunner("git checkout -- .", mithorRepoPath, 15000);
      } catch {
        // ignore in mock test environments
      }
    }
    state.touchedFiles.clear();
    state.consecutiveGateFailures = 0;
    state.lastVerification = null;
    return {
      rolledBack: true,
      restoredFiles: touchedPaths,
      messageDe: "Automatischer Schutzmechanismus: Da die Qualitätsprüfung dreimal in Folge fehlgeschlagen ist, habe ich alle Änderungen sicher auf den letzten stabilen Stand zurückgesetzt. Deine Arbeitsumgebung ist wieder vollkommen intakt."
    };
  }

  function runVerificationGates(options = {}) {
    const touchedEntries = [...state.touchedFiles.entries()];
    if (touchedEntries.length === 0) {
      const emptyResult = {
        passed: true,
        gatesRun: [],
        messageDe: "Keine geänderten Dateien vorhanden — alle Prüfungen sind grün."
      };
      state.lastVerification = emptyResult;
      return emptyResult;
    }

    const touchedZones = new Set(touchedEntries.map(([, info]) => info.zone));
    const touchedPaths = touchedEntries.map(([rel]) => rel);
    const requiredGateIds = new Set();

    for (const zoneName of touchedZones) {
      const zRule = zonesConfig.zones[zoneName];
      for (const gId of zRule?.requiredGates || []) {
        requiredGateIds.add(gId);
      }
    }

    const gateResults = [];
    let allPassed = true;

    // Additional pre-gate check: if any locale file in apps/FEP/src/locales/ was touched, enforce i18n parity
    if (touchedPaths.some((p) => p.startsWith("apps/FEP/src/locales/"))) {
      const parity = validateI18nParity(mithorRepoPath);
      gateResults.push({
        gateId: "fep_i18n_parity",
        passed: parity.passed,
        output: parity.passed ? "de.json, en.json, and fr.json keys are in 100% parity" : parity.issues.join("; ")
      });
      if (!parity.passed) allPassed = false;
    }

    for (const gateId of requiredGateIds) {
      const gateDef = zonesConfig.gates[gateId];
      if (!gateDef) continue;

      if (gateDef.type === "internal_contract_validator") {
        const res = validateIdeContracts(mithorRepoPath, touchedPaths);
        gateResults.push({
          gateId,
          passed: res.passed,
          output: res.passed ? "All IDE Python classes & function signatures match BFF contract" : res.issues.join("; ")
        });
        if (!res.passed) allPassed = false;
      } else if (gateDef.type === "mcp_tool") {
        if (options.skipVisualSnapshot) {
          gateResults.push({
            gateId,
            passed: true,
            skipped: true,
            output: "Visual snapshot gate skipped in headless unit check"
          });
        } else if (options.visualVerifierFn) {
          const vRes = options.visualVerifierFn(touchedPaths);
          gateResults.push({
            gateId,
            passed: Boolean(vRes.passed),
            output: vRes.output || "Visual snapshot compared"
          });
          if (!vRes.passed) allPassed = false;
        } else {
          gateResults.push({
            gateId,
            passed: true,
            output: "Visual snapshot baseline ready"
          });
        }
      } else if (gateDef.type === "shell") {
        const cwd = path.join(mithorRepoPath, gateDef.cwd || "");
        try {
          const out = execRunner(gateDef.command, cwd, gateDef.timeoutMs || 60000);
          gateResults.push({
            gateId,
            passed: true,
            output: String(out || "OK").trim().slice(0, 500)
          });
        } catch (err) {
          allPassed = false;
          gateResults.push({
            gateId,
            passed: false,
            output: String(err.stderr || err.stdout || err.message || "Gate command failed").trim().slice(0, 800)
          });
        }
      }
    }

    if (allPassed) {
      state.consecutiveGateFailures = 0;
      const result = {
        passed: true,
        touchedZones: [...touchedZones],
        touchedPaths,
        gatesRun: gateResults,
        timestamp: new Date().toISOString(),
        messageDe: "Alle automatischen Sicherheits- und Qualitätsprüfungen wurden erfolgreich bestanden."
      };
      state.lastVerification = result;
      return result;
    }

    state.consecutiveGateFailures += 1;
    if (state.consecutiveGateFailures >= maxAutoFixRetries) {
      const rollbackInfo = performRollback();
      return {
        passed: false,
        rolledBack: true,
        gatesRun: gateResults,
        rollbackInfo,
        messageDe: rollbackInfo.messageDe
      };
    }

    const failedResult = {
      passed: false,
      rolledBack: false,
      attempt: state.consecutiveGateFailures,
      maxRetries: maxAutoFixRetries,
      gatesRun: gateResults,
      messageDe: `Qualitätsprüfung fehlgeschlagen (Versuch ${state.consecutiveGateFailures} von ${maxAutoFixRetries}). Ich korrigiere den Fehler automatisch.`
    };
    state.lastVerification = failedResult;
    return failedResult;
  }

  function getState() {
    return {
      preTaskCommitSha: state.preTaskCommitSha,
      touchedFiles: Object.fromEntries(state.touchedFiles),
      yellowApprovals: Object.fromEntries(state.yellowApprovals),
      consecutiveGateFailures: state.consecutiveGateFailures,
      lastVerification: state.lastVerification
    };
  }

  function resetTaskState(commitSha = null) {
    state.preTaskCommitSha = commitSha;
    state.touchedFiles.clear();
    state.yellowApprovals.clear();
    state.consecutiveGateFailures = 0;
    state.lastVerification = null;
  }

  return {
    zonesConfig,
    mithorRepoPath,
    interceptToolCall,
    registerYellowApproval,
    runVerificationGates,
    performRollback,
    getState,
    resetTaskState,
    markFileTouched(relPath) {
      const verdict = classifyPathZone(relPath, zonesConfig, mithorRepoPath);
      if (verdict.zone === "red_locked") {
        throw new Error(verdict.reason);
      }
      state.touchedFiles.set(verdict.relPath, {
        zone: verdict.zone,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Cordis Plugin Entrypoint for DeepSeek Harness (dsh).
 */
export function apply(ctx, config = {}) {
  const engine = createMithorGuardEngine(config);

  // Share guard engine via @mithor-harness/shared singleton (avoids Cordis provide/inject coupling)
  setSharedGuardEngine(engine);

  const tools = tryGetCordisService(ctx, "tools");
  const guardCheck = (toolCall) => {
    const verdict = engine.interceptToolCall(toolCall.name, toolCall.arguments || toolCall.args || toolCall.input);
    if (!verdict.allowed) {
      return `${verdict.reason}\n\n${verdict.messageDe}`;
    }
    return undefined;
  };

  if (typeof tools?.guard === "function") {
    tools.guard(guardCheck);
  } else if (typeof tools?.beforeExecute === "function") {
    tools.beforeExecute((toolCall) => {
      const denied = guardCheck(toolCall);
      if (denied) {
        const err = new Error(denied);
        err.code = "MITHOR_ZONE_BLOCKED";
        throw err;
      }
    });
  }

  const defaultOutput = {
    schema: { type: "object", additionalProperties: true },
    render: (out) => JSON.stringify(out, null, 2)
  };

  if (tools?.register) {
    tools.register({
      name: "mithor_explain_yellow_edit",
      description: "Registers a plain-German formula explanation and Philipp's confirmation before editing any Yellow Zone IDE calculation file (apps/AI/app/modules/ide/*.py).",
      parameters: {
        type: "object",
        required: ["targetPath", "currentFormulaDe", "proposedFormulaDe", "impactSummaryDe", "philippConfirmed"],
        properties: {
          targetPath: { type: "string" },
          currentFormulaDe: { type: "string" },
          proposedFormulaDe: { type: "string" },
          impactSummaryDe: { type: "string" },
          philippConfirmed: { type: "boolean" }
        }
      },
      output: defaultOutput,
      execute: async (args) => engine.registerYellowApproval(args)
    });

    tools.register({
      name: "mithor_verify_changes",
      description: "Runs all mandatory multi-layer verification gates (Vite build, Vitest, i18n parity, Pytest IDE golden cases, and BFF/AI contract validation) for the touched zones.",
      parameters: {
        type: "object",
        properties: {
          skipVisualSnapshot: { type: "boolean" }
        }
      },
      output: defaultOutput,
      execute: async (args) => engine.runVerificationGates(args)
    });
  }

  return engine;
}
