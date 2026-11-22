import { classifyPathZone } from "./zoneMatcher.js";

const DESTRUCTIVE_SHELL_PATTERNS = [
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+push\s+-f\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\brm\s+-rf\b/i,
  /\bssh\s+/i,
  /\brsync\s+/i,
  /\bapache2?(?:ctl)?\b/i,
  /\bsystemctl\b/i
];

const WRITE_SHELL_PATTERNS = [
  /(?:^|[\s;|&])(?:sed|awk)\s+-i\b/,
  /(?:^|[^<])>{1,2}\s*([^\s;|&]+)/,
  /\btee\s+(?:-a\s+)?([^\s;|&]+)/,
  /\b(?:cp|mv|rm|touch|truncate)\s+([^\s;|&]+)/
];

/**
 * Inspects a shell command string to prevent bypassing Red/Yellow zone guardrails via bash.
 */
export function inspectShellCommand(command, zonesConfig, repoRoot = "") {
  const cmd = String(command || "").trim();
  if (!cmd) {
    return { allowed: true };
  }

  for (const rx of DESTRUCTIVE_SHELL_PATTERNS) {
    if (rx.test(cmd)) {
      return {
        allowed: false,
        zone: "red_locked",
        reason: `Destructive or infrastructure shell command blocked by pattern: ${rx.source}`,
        messageDe: zonesConfig.zones.red_locked.escalationMessageDe
      };
    }
  }

  // Check if command attempts to write or redirect into a file path
  const candidatePaths = [];
  for (const rx of WRITE_SHELL_PATTERNS) {
    const m = cmd.match(rx);
    if (m) {
      if (m[1]) {
        candidatePaths.push(m[1].replace(/^['"]|['"]$/g, ""));
      } else {
        // e.g. sed -i: extract last token that looks like a file path
        const tokens = cmd.split(/\s+/).filter((t) => !t.startsWith("-") && t !== "sed" && t !== "awk");
        if (tokens.length > 0) {
          candidatePaths.push(tokens[tokens.length - 1].replace(/^['"]|['"]$/g, ""));
        }
      }
    }
  }

  for (const target of candidatePaths) {
    if (target.startsWith("/dev/null")) continue;
    const verdict = classifyPathZone(target, zonesConfig, repoRoot);
    if (verdict.zone === "red_locked") {
      return {
        allowed: false,
        zone: "red_locked",
        targetPath: verdict.relPath,
        reason: `Shell write to Red Zone path '${verdict.relPath}' is blocked`,
        messageDe: zonesConfig.zones.red_locked.escalationMessageDe
      };
    }
    if (verdict.zone === "yellow_ide_math") {
      return {
        allowed: false,
        zone: "yellow_ide_math",
        targetPath: verdict.relPath,
        reason: `Direct shell mutation of Yellow Zone file '${verdict.relPath}' is disallowed; use structured file edit tools after German formula confirmation.`,
        messageDe: "Bitte bearbeite Berechnungsdateien im IDE-Modul nicht über Shell-Skripte, sondern über das geprüfte Editor-Werkzeug nach deutscher Formel-Freigabe."
      };
    }
  }

  return { allowed: true };
}
