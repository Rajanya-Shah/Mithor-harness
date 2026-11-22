import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapDshProfile } from "./bootstrap-dsh.mjs";
import { createInspectorServer } from "../plugins/dsh-plugin-mithor-inspector/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_ROOT = path.resolve(__dirname, "..");

const isDryRun = process.argv.includes("--dry-run");

const profileInfo = bootstrapDshProfile();

console.log("==================================================================");
console.log("  Mithor Philipp Harness — Starter (Deutsch / English Bridge)");
console.log("==================================================================");
console.log(`  [1/3] DSH Profil geladen    : ${profileInfo.profileDir}`);
console.log(`  [2/3] Mithor-Repository     : ${profileInfo.mithorRepoPath}`);
console.log("  [3/3] Klick-Inspektor-Proxy : http://127.0.0.1:5174 -> http://127.0.0.1:5173");
console.log("------------------------------------------------------------------");
console.log("  Startbefehl für DeepSeek Harness Web UI:");
console.log("    dsh --profile philipp");
console.log("==================================================================");

if (!isDryRun) {
  const server = createInspectorServer({
    fepTargetUrl: "http://127.0.0.1:5173",
    harnessRoot: HARNESS_ROOT,
    mithorRepoPath: profileInfo.mithorRepoPath,
    onElementSelected: (sel) => {
      console.log(`\n[Mithor-Inspektor] ${sel.contextSummaryDe}`);
    }
  });
  server.listen(5174, "127.0.0.1", () => {
    console.log("Inspektor-Proxy aktiv auf http://127.0.0.1:5174 (Alt+Klick im Browser zum Auswählen).");
  });
}
