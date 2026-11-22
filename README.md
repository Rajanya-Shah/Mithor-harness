# Mithor Philipp Harness (`mithor-philipp-harness`)

A zero-footprint, bilingual (German $\leftrightarrow$ English) external agent harness built on **DeepSeek Harness (`dsh` / `@deepseek-ai/cordis`)** for Mithor co-founder **user**.

It enables Philipp to inspect UI elements visually, adjust layout/copy/PDF styling in `apps/FEP`, and fine-tune commercial real estate valuation formulas in `apps/AI/app/modules/ide/` using natural German—while enforcing hard path sandboxing, multi-gate automated verification (`vitest`, `vite build`, `pytest` golden fixtures, Playwright visual diffs), zero-Git branching, and `L1`–`L4` PR risk triage against `Mithor-Platforms` (`develop` branch).

---

## Architecture Overview

```text
mithor-philipp-harness/
├── ANTIGRAVITY_CONTEXT.md             # Master architectural blueprint & ground-truth rules
├── config/
│   ├── cordis.patch.yml               # Mounts plugins, MCP servers & external skills into dsh
│   ├── settings.template.yaml         # DeepSeek model route & profile template
│   ├── zones.schema.json              # JSON Schema for 3-zone policy & L1-L4 PR tiers
│   ├── zones.config.json              # Active Green/Yellow/Red rules (CTO drop-in ready)
│   └── ide-golden-fixtures.json       # Golden reference targets (Hohetorstraße, Clayallee 18, Frankfurter Allee)
├── packages/
│   └── shared/                        # Zone matcher, zero-AI-attribution sanitizer, types
├── plugins/
│   ├── dsh-plugin-mithor-guard/       # Tool interceptor, Yellow-zone German gate, test runner, auto-rollback
│   ├── dsh-plugin-mithor-git-triage/  # Zero-Git branching (-> develop) & L1-L4 bilingual PR engine
│   └── dsh-plugin-mithor-inspector/   # Zero-footprint React Fiber click-to-source proxy & HUD
├── mcp/
│   ├── mithor-code-map/               # Stdio MCP: German CRE/UI terms -> Mithor files & IDE AST reader
│   └── mithor-visual-preview/         # Stdio MCP: Playwright before/after screenshots & pixel diff
├── skills/
│   ├── prebuilt/                      # Layer 1: Generic UI pixel-pushing & systematic debugging
│   └── mithor-pack/                   # Layer 2: 5 Mithor-specific bilingual & domain skills
└── scripts/
    ├── validate-milestone1.mjs        # Validates schemas, config, and dsh SKILL.md frontmatter
    ├── bootstrap-dsh.mjs              # Links profile & skills into ~/.dsh/profiles/philipp
    └── launch-philipp.mjs             # One-click launcher for Philipp
```

## Quick Validation & Test

```bash
pnpm install
pnpm test
pnpm validate:m1
```

## Launch DeepSeek Harness Web UI for Philipp

```bash
# Terminal 1: Start inspector proxy & bootstrap ~/.dsh/profiles/philipp
npm run harness:launch

# Terminal 2: Boot DeepSeek Harness Web UI with the philipp profile
dsh --profile philipp
```
