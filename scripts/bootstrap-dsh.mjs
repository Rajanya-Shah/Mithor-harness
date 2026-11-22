import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_ROOT = path.resolve(__dirname, "..");

/**
 * Bootstraps the DeepSeek Harness profile directory (~/.dsh/profiles/philipp)
 * by rendering cordis.patch.yml and settings.yaml with resolved paths and linking
 * the out-of-tree Cordis plugins. Zero files are written inside Mithor-Platforms.
 */
export function bootstrapDshProfile(options = {}) {
  const dshHome = options.dshHome || process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
  const profileName = options.profileName || "philipp";
  const mithorRepoPath =
    options.mithorRepoPath ||
    process.env.MITHOR_REPO_PATH ||
    path.resolve(HARNESS_ROOT, "..", "Mithor-Platforms");

  const profileDir = path.join(dshHome, "profiles", profileName);
  fs.mkdirSync(profileDir, { recursive: true });

  const normHarness = HARNESS_ROOT.replace(/\\/g, "/");
  const normMithor = mithorRepoPath.replace(/\\/g, "/");

  const replaceVars = (templateStr) =>
    templateStr
      .replace(/\$\{HARNESS_ROOT\}/g, normHarness)
      .replace(/\$\{MITHOR_REPO_PATH\}/g, normMithor);

  const patchTemplate = fs.readFileSync(path.join(HARNESS_ROOT, "config", "cordis.patch.yml"), "utf8");
  const settingsTemplate = fs.readFileSync(path.join(HARNESS_ROOT, "config", "settings.template.yaml"), "utf8");

  const patchOutPath = path.join(profileDir, "cordis.patch.yml");
  const settingsOutPath = path.join(profileDir, "settings.yaml");
  const pkgOutPath = path.join(profileDir, "package.json");

  fs.writeFileSync(patchOutPath, replaceVars(patchTemplate), "utf8");
  fs.writeFileSync(settingsOutPath, replaceVars(settingsTemplate), "utf8");

  const profilePkg = {
    name: `dsh-profile-${profileName}`,
    private: true,
    type: "module",
    dependencies: {
      "dsh-plugin-mithor-guard": `file:${normHarness}/plugins/dsh-plugin-mithor-guard`,
      "dsh-plugin-mithor-git-triage": `file:${normHarness}/plugins/dsh-plugin-mithor-git-triage`,
      "dsh-plugin-mithor-inspector": `file:${normHarness}/plugins/dsh-plugin-mithor-inspector`
    },
    dsh: {
      profile: {
        bundles: [
          "@deepseek-ai/dsh-base",
          "@deepseek-ai/dsh-web-app"
        ],
        patchReload: "live"
      }
    }
  };
  fs.writeFileSync(pkgOutPath, JSON.stringify(profilePkg, null, 2), "utf8");

  // Symlink our out-of-tree plugins into ~/.dsh/profiles/<name>/node_modules/ so Node ESM resolves them immediately
  const nodeModulesDir = path.join(profileDir, "node_modules");
  fs.mkdirSync(nodeModulesDir, { recursive: true });
  const pluginLinks = [
    ["dsh-plugin-mithor-guard", path.join(HARNESS_ROOT, "plugins", "dsh-plugin-mithor-guard")],
    ["dsh-plugin-mithor-git-triage", path.join(HARNESS_ROOT, "plugins", "dsh-plugin-mithor-git-triage")],
    ["dsh-plugin-mithor-inspector", path.join(HARNESS_ROOT, "plugins", "dsh-plugin-mithor-inspector")]
  ];
  for (const [pkgName, targetDir] of pluginLinks) {
    const linkPath = path.join(nodeModulesDir, pkgName);
    try {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
    } catch {
      // does not exist yet
    }
    fs.symlinkSync(targetDir, linkPath, "junction");
  }

  return {
    profileDir,
    patchOutPath,
    settingsOutPath,
    pkgOutPath,
    harnessRoot: normHarness,
    mithorRepoPath: normMithor
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = bootstrapDshProfile();
  console.log("=== Mithor Philipp Harness — DSH Profile Bootstrapped ===");
  console.log(`  Profile Directory : ${res.profileDir}`);
  console.log(`  Cordis Patch      : ${res.patchOutPath}`);
  console.log(`  Mithor Repo Target: ${res.mithorRepoPath} (100% Untouched)`);
}
