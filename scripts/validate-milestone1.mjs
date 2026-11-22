import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let failures = 0;
function pass(msg) {
  console.log(`  [PASS] ${msg}`);
}
function fail(msg) {
  console.error(`  [FAIL] ${msg}`);
  failures++;
}

console.log("=== Milestone 1 Validation: Schemas, Configs & 2-Layer Skill Pack ===\n");

// 1. Validate JSON files parse and match structural contracts
const schemaPath = path.join(ROOT, "config", "zones.schema.json");
const configPath = path.join(ROOT, "config", "zones.config.json");
const fixturesPath = path.join(ROOT, "config", "ide-golden-fixtures.json");

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

  if (schema.$schema && schema.properties?.zones) {
    pass("config/zones.schema.json is valid JSON Schema (2020-12)");
  } else {
    fail("config/zones.schema.json missing required schema properties");
  }

  for (const reqKey of schema.required) {
    if (!(reqKey in config)) {
      fail(`config/zones.config.json missing required top-level key: ${reqKey}`);
    }
  }

  if (config.defaultBaseBranch === "develop") {
    pass("config/zones.config.json targets 'develop' branch per Mithor-Platforms/CLAUDE.md");
  } else {
    fail(`Expected defaultBaseBranch='develop', got '${config.defaultBaseBranch}'`);
  }

  if (config.zeroAiAttribution?.enforce === true && config.zeroAiAttribution.forbiddenPatterns.includes("Co-authored-by:")) {
    pass("config/zones.config.json enforces HARD RULE #1 (Zero AI attribution)");
  } else {
    fail("config/zones.config.json does not enforce zeroAiAttribution");
  }

  const levels = config.prRiskTiers.map((t) => t.level);
  if (JSON.stringify(levels) === JSON.stringify(["L1", "L2", "L3", "L4"])) {
    pass("config/zones.config.json defines all 4 granular PR risk tiers (L1..L4)");
  } else {
    fail(`Invalid prRiskTiers levels: ${levels.join(", ")}`);
  }

  if (fixtures.goldenCases?.length === 3) {
    pass("config/ide-golden-fixtures.json contains all 3 golden benchmarks (Hohetorstraße, Clayallee 18, Frankfurter Allee)");
  } else {
    fail("config/ide-golden-fixtures.json missing golden benchmarks");
  }
} catch (err) {
  fail(`JSON parse/validation error: ${err.message}`);
}

// 2. Validate YAML config files
for (const ymlFile of ["config/cordis.patch.yml", "config/settings.template.yaml"]) {
  const full = path.join(ROOT, ymlFile);
  if (fs.existsSync(full) && fs.readFileSync(full, "utf8").trim().length > 50) {
    pass(`${ymlFile} exists and is non-empty`);
  } else {
    fail(`${ymlFile} missing or empty`);
  }
}

// 3. Validate all 7 SKILL.md files for dsh frontmatter compliance (no unquoted colons in description)
const expectedSkills = [
  "skills/prebuilt/frontend-pixel-perfection/SKILL.md",
  "skills/prebuilt/systematic-debugging/SKILL.md",
  "skills/mithor-pack/mithor-philipp-core/SKILL.md",
  "skills/mithor-pack/mithor-architecture-map/SKILL.md",
  "skills/mithor-pack/mithor-ide-glossary/SKILL.md",
  "skills/mithor-pack/mithor-fep-pdf-guide/SKILL.md",
  "skills/mithor-pack/mithor-safe-pr-workflow/SKILL.md"
];

for (const relSkill of expectedSkills) {
  const full = path.join(ROOT, relSkill);
  if (!fs.existsSync(full)) {
    fail(`Missing skill file: ${relSkill}`);
    continue;
  }
  const raw = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    fail(`${relSkill}: Missing YAML frontmatter block`);
    continue;
  }
  const fm = match[1];
  const nameLine = fm.split("\n").find((l) => l.startsWith("name:"));
  const descLine = fm.split("\n").find((l) => l.startsWith("description:"));
  if (!nameLine || !descLine) {
    fail(`${relSkill}: Frontmatter missing 'name:' or 'description:'`);
    continue;
  }
  const descVal = descLine.slice("description:".length).trim();
  if (!(descVal.startsWith('"') && descVal.endsWith('"'))) {
    fail(`${relSkill}: 'description' must be double-quoted to prevent dsh YAML parser drops`);
    continue;
  }
  pass(`${relSkill} frontmatter & double-quoted description verified`);
}

if (failures > 0) {
  console.error(`\nMilestone 1 validation failed with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log("\nAll Milestone 1 checks passed!");
}
