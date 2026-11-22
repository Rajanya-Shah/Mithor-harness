import fs from "node:fs";
import path from "node:path";

/**
 * Normalizes a file path to forward-slash relative path inside Mithor-Platforms.
 */
export function normalizeRepoPath(targetPath, repoRoot = "") {
  if (!targetPath) return "";
  let cleaned = String(targetPath).replace(/\\/g, "/").trim();
  if (repoRoot) {
    const normRoot = String(repoRoot).replace(/\\/g, "/").replace(/\/+$/, "");
    if (cleaned.startsWith(normRoot + "/")) {
      cleaned = cleaned.slice(normRoot.length + 1);
    } else if (cleaned === normRoot) {
      cleaned = "";
    }
  }
  cleaned = cleaned.replace(/^\.\/+/, "").replace(/^\/+/, "");
  return cleaned;
}

/**
 * Converts a glob pattern (supporting **, *, ?) into an anchored RegExp.
 */
export function globToRegExp(glob) {
  const norm = String(glob).replace(/\\/g, "/").replace(/^\.\/+/, "");
  let regexStr = "^";
  let i = 0;
  while (i < norm.length) {
    const c = norm[i];
    if (c === "*" && norm[i + 1] === "*") {
      if (norm[i + 2] === "/") {
        regexStr += "(?:.+/)?";
        i += 3;
      } else {
        regexStr += ".*";
        i += 2;
      }
    } else if (c === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (c === "?") {
      regexStr += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(c)) {
      regexStr += "\\" + c;
      i++;
    } else {
      regexStr += c;
      i++;
    }
  }
  regexStr += "$";
  return new RegExp(regexStr);
}

export function matchesAnyGlob(relPath, patterns = []) {
  const norm = normalizeRepoPath(relPath);
  if (!norm) return false;
  return patterns.some((pattern) => globToRegExp(pattern).test(norm));
}

/**
 * Loads and parses zones.config.json from disk.
 */
export function loadZonesConfig(configPath) {
  const resolved = path.resolve(configPath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

/**
 * Classifies a repository-relative path into red_locked, yellow_ide_math, or green_ui.
 * Priority order (fail-closed):
 * 1. Path traversal (..) or empty -> red_locked
 * 2. Matches red_locked.paths -> red_locked
 * 3. Matches yellow_ide_math.paths (and not in yellow_ide_math.excludedPaths) -> yellow_ide_math
 * 4. Matches green_ui.paths (and not in green_ui.excludedPaths) -> green_ui
 * 5. Any unknown/unmatched path -> red_locked (fail-closed default)
 */
export function classifyPathZone(targetPath, zonesConfig, repoRoot = "") {
  const relPath = normalizeRepoPath(targetPath, repoRoot);
  const redRule = zonesConfig.zones.red_locked;
  const yellowRule = zonesConfig.zones.yellow_ide_math;
  const greenRule = zonesConfig.zones.green_ui;

  if (!relPath || relPath.split("/").includes("..")) {
    return {
      zone: "red_locked",
      access: "blocked",
      relPath,
      reason: "Path traversal or outside-repository path is blocked",
      rule: redRule
    };
  }

  if (matchesAnyGlob(relPath, redRule.paths)) {
    return {
      zone: "red_locked",
      access: "blocked",
      relPath,
      reason: `Matched red_locked policy for '${relPath}'`,
      rule: redRule
    };
  }

  if (
    matchesAnyGlob(relPath, yellowRule.paths) &&
    !matchesAnyGlob(relPath, yellowRule.excludedPaths || [])
  ) {
    return {
      zone: "yellow_ide_math",
      access: "guarded_write",
      relPath,
      reason: `Matched yellow_ide_math policy for '${relPath}'`,
      rule: yellowRule
    };
  }

  if (
    matchesAnyGlob(relPath, greenRule.paths) &&
    !matchesAnyGlob(relPath, greenRule.excludedPaths || [])
  ) {
    return {
      zone: "green_ui",
      access: "read_write",
      relPath,
      reason: `Matched green_ui policy for '${relPath}'`,
      rule: greenRule
    };
  }

  return {
    zone: "red_locked",
    access: "blocked",
    relPath,
    reason: `Unlisted or excluded path '${relPath}' defaults to red_locked (fail-closed)`,
    rule: redRule
  };
}
