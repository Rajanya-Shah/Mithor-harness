export {
  normalizeRepoPath,
  globToRegExp,
  matchesAnyGlob,
  loadZonesConfig,
  classifyPathZone
} from "./zoneMatcher.js";

export {
  hasForbiddenAiAttribution,
  sanitizeGitText
} from "./attributionSanitizer.js";

export {
  inspectShellCommand
} from "./shellGuard.js";

let _sharedGuardEngine = null;

export function setSharedGuardEngine(engine) {
  _sharedGuardEngine = engine;
}

export function getSharedGuardEngine() {
  return _sharedGuardEngine;
}

export function tryGetCordisService(ctx, serviceName) {
  if (!ctx) return null;
  try {
    if (typeof ctx.get === "function") {
      return ctx.get(serviceName) || null;
    }
    return ctx[serviceName] || null;
  } catch {
    return null;
  }
}
