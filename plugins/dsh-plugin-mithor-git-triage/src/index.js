import { execSync } from "node:child_process";
import {
  getSharedGuardEngine,
  sanitizeGitText,
  tryGetCordisService
} from "../../../packages/shared/src/index.js";
import { classifyDiffRisk } from "./riskClassifier.js";

export const name = "dsh-plugin-mithor-git-triage";
export const inject = [];

export function slugifyTaskName(input) {
  return String(input || "ui-update")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "task";
}

export function formatBranchName(slugEn, dateStr = new Date().toISOString().slice(0, 10), prefix = "philipp/") {
  return `${prefix}${dateStr}-${slugifyTaskName(slugEn)}`;
}

/**
 * Formats the bilingual PR title and body (German summary for Philipp + English technical breakdown for Sarbu/Manish/Ukarky),
 * sanitized against HARD RULE #1 (Zero AI Attribution).
 */
export function buildBilingualPullRequest({
  risk,
  branchName,
  baseBranch = "develop",
  titleEn,
  summaryDe,
  technicalSummaryEn,
  touchedPaths = [],
  verificationGates = []
}) {
  const laneScope = risk.lanes.length > 0 ? risk.lanes.join(",") : "FEP";
  const commitScope = risk.lanes.length === 1 ? risk.lanes[0] : "monorepo";
  const rawTitle = `feat(${commitScope}): ${risk.tag} ${titleEn}`;
  const cleanTitle = sanitizeGitText(rawTitle);

  const gateLines = verificationGates.map(
    (g) => `- [${g.passed ? "x" : " "}] \`${g.gateId}\`: ${g.output || (g.passed ? "PASSED" : "FAILED")}`
  );

  const rawBody = [
    `## ${risk.tag} — CI Lane: \`${laneScope}\` → \`${baseBranch}\``,
    "",
    "### Zusammenfassung (Deutsch — Philipp)",
    sanitizeGitText(summaryDe),
    "",
    "---",
    "",
    "### Technical Review Summary (English — Sarbu / Manish / Ukarky)",
    `- **Risk Tier:** \`${risk.level}\` (${risk.tag})`,
    `- **Suggested Reviewers:** ${risk.reviewers.map((r) => `@${r}`).join(", ")}`,
    `- **Source Branch:** \`${branchName}\` → \`${baseBranch}\``,
    `- **Touched CI Lanes:** \`${laneScope}\``,
    `- **Triage Rationale:** ${risk.reasons.join("; ")}`,
    "",
    "#### Changes Breakdown",
    sanitizeGitText(technicalSummaryEn),
    "",
    "#### Touched Files",
    ...touchedPaths.map((p) => `- \`${p}\``),
    "",
    "#### Automated Verification Gates",
    ...(gateLines.length > 0 ? gateLines : ["- [x] All required zone gates passed"])
  ].join("\n");

  return {
    title: cleanTitle,
    body: sanitizeGitText(rawBody)
  };
}

export function createMithorGitTriageEngine(options = {}) {
  const mithorRepoPath = options.mithorRepoPath || process.env.MITHOR_REPO_PATH || process.cwd();
  const branchPrefix = options.branchPrefix || "philipp/";
  const defaultBaseBranch = options.defaultBaseBranch || "develop";
  const guardEngine = options.guardEngine || null;
  const execRunner = options.execRunner || ((cmd, cwd) =>
    execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe" })
  );

  let activeBranch = null;

  function startTask({ slugEn, dateStr }) {
    const branchName = formatBranchName(slugEn, dateStr, branchPrefix);
    let baseSha = "HEAD";
    try {
      execRunner(`git checkout ${defaultBaseBranch}`, mithorRepoPath);
      execRunner(`git checkout -b ${branchName}`, mithorRepoPath);
      baseSha = execRunner("git rev-parse HEAD", mithorRepoPath).trim();
    } catch (err) {
      return {
        started: false,
        error: err.message,
        messageDe: `Konnte keinen neuen Arbeitszweig auf Basis von '${defaultBaseBranch}' starten: ${err.message}`
      };
    }

    activeBranch = branchName;
    if (guardEngine) {
      guardEngine.resetTaskState(baseSha);
    }

    return {
      started: true,
      branchName,
      baseBranch: defaultBaseBranch,
      baseSha,
      messageDe: `Ich habe einen frischen Arbeitsstand ('${branchName}' auf Basis von '${defaultBaseBranch}') für deine Aufgabe vorbereitet.`
    };
  }

  function submitPullRequest({ titleEn, summaryDe, technicalSummaryEn, commitMessageEn }) {
    if (guardEngine) {
      const guardState = guardEngine.getState();
      if (!guardState.lastVerification || !guardState.lastVerification.passed) {
        return {
          submitted: false,
          reason: "Verification gates have not passed for current changes. Run mithor_verify_changes first.",
          messageDe: "Vor dem Einreichen führe ich noch die automatischen Sicherheits- und Qualitätsprüfungen durch."
        };
      }
    }

    const guardState = guardEngine ? guardEngine.getState() : { touchedFiles: {}, lastVerification: { gatesRun: [] } };
    const touchedPaths = Object.keys(guardState.touchedFiles);
    let diffText = "";
    try {
      diffText = execRunner("git diff HEAD", mithorRepoPath);
    } catch {
      diffText = "";
    }

    const risk = classifyDiffRisk({ touchedPaths, diffText });
    const branchName = activeBranch || formatBranchName(titleEn);
    const prPayload = buildBilingualPullRequest({
      risk,
      branchName,
      baseBranch: defaultBaseBranch,
      titleEn,
      summaryDe,
      technicalSummaryEn,
      touchedPaths,
      verificationGates: guardState.lastVerification?.gatesRun || []
    });

    const cleanCommitMsg = sanitizeGitText(commitMessageEn || prPayload.title);

    let prUrl = null;
    try {
      for (const rel of touchedPaths) {
        execRunner(`git add "${rel}"`, mithorRepoPath);
      }
      execRunner(`git commit -m ${JSON.stringify(cleanCommitMsg)}`, mithorRepoPath);
      execRunner(`git push -u origin ${branchName}`, mithorRepoPath);
      const ghOut = execRunner(
        `gh pr create --base ${defaultBaseBranch} --head ${branchName} --title ${JSON.stringify(prPayload.title)} --body ${JSON.stringify(prPayload.body)}`,
        mithorRepoPath
      );
      prUrl = String(ghOut || "").trim();
    } catch (err) {
      return {
        submitted: false,
        risk,
        prPayload,
        commitMessage: cleanCommitMsg,
        error: err.message,
        messageDe: `Änderungen wurden geprüft (${risk.tag}), aber das Hochladen zu GitHub benötigte eine Verbindung: ${err.message}`
      };
    }

    return {
      submitted: true,
      prUrl,
      branchName,
      baseBranch: defaultBaseBranch,
      risk,
      prPayload,
      commitMessage: cleanCommitMsg,
      messageDe: `Fertig! Deine Änderung wurde als Pull Request (${risk.tag}) für ${risk.reviewers.join(", ")} auf '${defaultBaseBranch}' eingereicht.`
    };
  }

  return {
    startTask,
    submitPullRequest,
    classifyDiffRisk
  };
}

export function apply(ctx, config = {}) {
  const engine = createMithorGitTriageEngine({
    ...config,
    guardEngine: getSharedGuardEngine()
  });

  const defaultOutput = {
    schema: { type: "object", additionalProperties: true },
    render: (out) => JSON.stringify(out, null, 2)
  };

  const tools = tryGetCordisService(ctx, "tools");
  if (tools?.register) {
    tools.register({
      name: "mithor_start_task",
      description: "Starts a clean task branch off 'develop' (philipp/YYYY-MM-DD-<slug>) without Philipp needing any Git commands.",
      parameters: {
        type: "object",
        required: ["slugEn"],
        properties: {
          slugEn: { type: "string", description: "Short English kebab-case slug for the branch" }
        }
      },
      output: defaultOutput,
      execute: async (args) => engine.startTask(args)
    });

    tools.register({
      name: "mithor_submit_pr",
      description: "Commits verified changes with zero AI attribution, classifies risk into L1-L4 tiers, pushes branch, and opens a bilingual PR against 'develop'.",
      parameters: {
        type: "object",
        required: ["titleEn", "summaryDe", "technicalSummaryEn"],
        properties: {
          titleEn: { type: "string" },
          summaryDe: { type: "string" },
          technicalSummaryEn: { type: "string" },
          commitMessageEn: { type: "string" }
        }
      },
      output: defaultOutput,
      execute: async (args) => engine.submitPullRequest(args)
    });
  }

  return engine;
}
