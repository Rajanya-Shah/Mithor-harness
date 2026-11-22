import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  handleJsonRpcRequest as handleCodeMapRpc,
  lookupGermanTerm,
  inspectIdeFormula
} from "../mcp/mithor-code-map/src/index.js";
import {
  handleJsonRpcRequest as handleVisualRpc,
  verifyPdfGeneratorHealth,
  captureBaseline,
  captureAndDiff
} from "../mcp/mithor-visual-preview/src/index.js";
import {
  createInspectorServer,
  injectInspectorIntoHtml,
  normalizeClickedElement
} from "../plugins/dsh-plugin-mithor-inspector/src/index.js";
import {
  bootstrapDshProfile
} from "./bootstrap-dsh.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MITHOR_PLATFORMS_PATH = path.resolve(ROOT, "..", "Mithor-Platforms");

test("1. Milestone 3: mithor-code-map MCP resolves German CRE terms & inspects real Python IDE formulas", () => {
  // Test German CRE term resolution
  const factorRes = lookupGermanTerm({ query: "Ankaufsfaktor Mietmultiplikator" });
  assert.ok(factorRes.matchCount > 0);
  assert.equal(factorRes.matches[0].ideFile, "apps/AI/app/modules/ide/dcf.py");

  const residualRes = lookupGermanTerm({ query: "Restwertverfahren Baukosten Bauträgergewinn" });
  assert.ok(residualRes.matchCount > 0);
  assert.equal(residualRes.matches[0].ideFile, "apps/AI/app/modules/ide/residual.py");

  const ruleRes = lookupGermanTerm({ query: "CapEx-Rückstau R-04" });
  assert.ok(ruleRes.matchCount > 0);
  assert.equal(ruleRes.matches[0].ideFile, "apps/AI/app/modules/ide/rules.py");

  // Test live Python formula inspection against real Mithor-Platforms repository
  const dcfFormula = inspectIdeFormula({
    moduleName: "dcf",
    symbol: "run_dcf",
    mithorRepoPath: MITHOR_PLATFORMS_PATH
  });
  assert.equal(dcfFormula.found, true);
  assert.ok(dcfFormula.snippet.includes("def run_dcf(inputs: DCFInputs, a: DCFAssumptions) -> DCFResult:"));

  const r04Formula = inspectIdeFormula({
    moduleName: "rules",
    symbol: "r04",
    mithorRepoPath: MITHOR_PLATFORMS_PATH
  });
  assert.equal(r04Formula.found, true);
  assert.ok(r04Formula.snippet.includes("CAPEX-HINWEIS"));

  // Test JSON-RPC 2.0 MCP protocol compliance
  const rpcInit = handleCodeMapRpc({ jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.equal(rpcInit.result.serverInfo.name, "mithor-code-map");

  const rpcList = handleCodeMapRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(rpcList.result.tools.length, 3);
});

test("2. Milestone 3: mithor-visual-preview MCP verifies real exportValuationPdf.js & captures diffs", () => {
  const pdfHealth = verifyPdfGeneratorHealth(MITHOR_PLATFORMS_PATH);
  assert.equal(pdfHealth.passed, true, `PDF issues: ${pdfHealth.issues?.join(", ")}`);

  const tmpHarnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "mithor-vis-"));
  const base = captureBaseline({
    routeOrComponent: "apps/FEP/src/pages/project/sections/DealCheckSection.jsx",
    harnessRoot: tmpHarnessDir,
    mithorRepoPath: MITHOR_PLATFORMS_PATH
  });
  assert.ok(base.sha256.length === 64);
  assert.ok(base.lineCount > 200);

  const diff = captureAndDiff({
    routeOrComponent: "apps/FEP/src/pages/project/sections/DealCheckSection.jsx",
    harnessRoot: tmpHarnessDir,
    mithorRepoPath: MITHOR_PLATFORMS_PATH
  });
  assert.equal(diff.passed, true);
  assert.equal(diff.changedSinceBaseline, false);

  const rpcList = handleVisualRpc({ jsonrpc: "2.0", id: 10, method: "tools/list" });
  assert.equal(rpcList.result.tools.length, 3);
});

test("3. Milestone 4: Zero-Footprint Click-to-Inspect Proxy injects React Fiber overlay & captures clicks", async () => {
  const html = "<html><head></head><body><div id=\"root\">Mithor</div></body></html>";
  const injected = injectInspectorIntoHtml(html);
  assert.ok(injected.includes('<script src="/__mithor_inspector.js"></script></body>'));

  const tmpHarnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "mithor-insp-"));

  // Spin up mock Vite target server and our zero-footprint inspector proxy on ephemeral ports
  const mockVite = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><body><h1>Deal Check</h1></body></html>");
  });

  await new Promise((resolve) => mockVite.listen(0, "127.0.0.1", resolve));
  const vitePort = mockVite.address().port;

  let capturedEvent = null;
  const proxyServer = createInspectorServer({
    fepTargetUrl: `http://127.0.0.1:${vitePort}`,
    harnessRoot: tmpHarnessDir,
    mithorRepoPath: MITHOR_PLATFORMS_PATH,
    onElementSelected: (sel) => {
      capturedEvent = sel;
    }
  });

  await new Promise((resolve) => proxyServer.listen(0, "127.0.0.1", resolve));
  const proxyPort = proxyServer.address().port;

  try {
    // 3a. Verify HTML response gets inspector script injected automatically
    const htmlRes = await fetch(`http://127.0.0.1:${proxyPort}/projects/123`);
    const htmlBody = await htmlRes.text();
    assert.ok(htmlBody.includes("/__mithor_inspector.js"));

    // 3b. Verify client script endpoint serves React Fiber extractor
    const jsRes = await fetch(`http://127.0.0.1:${proxyPort}/__mithor_inspector.js`);
    const jsBody = await jsRes.text();
    assert.ok(jsBody.includes("__reactFiber$"));
    assert.ok(jsBody.includes("_debugSource"));

    // 3c. Simulate Philipp Alt+Clicking on PriceScale.jsx in browser
    const clickPayload = {
      tagName: "span",
      textSnippet: "IDE-Gebot: €2.280.000",
      className: "text-base font-bold tabular-nums",
      componentName: "PriceScale",
      componentHierarchy: ["PriceScale", "DealCheckSection", "ProjectPage"],
      fileName: `${MITHOR_PLATFORMS_PATH}/apps/FEP/src/pages/project/sections/dealCheck/PriceScale.jsx`,
      lineNumber: 48,
      columnNumber: 12,
      routePath: "/projects/hohetorstrasse",
      boundingBox: { x: 120, y: 240, width: 180, height: 28 }
    };

    const postRes = await fetch(`http://127.0.0.1:${proxyPort}/__mithor_inspector/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clickPayload)
    });
    const postJson = await postRes.json();
    assert.equal(postJson.ok, true);
    assert.equal(postJson.selection.relFile, "apps/FEP/src/pages/project/sections/dealCheck/PriceScale.jsx");
    assert.equal(postJson.selection.lineNumber, 48);
    assert.ok(capturedEvent.contextSummaryDe.includes("PriceScale"));
  } finally {
    proxyServer.close();
    mockVite.close();
  }
});

test("4. Milestone 4: DSH Profile Bootstrap & Zero Footprint on Mithor-Platforms Git Tree", () => {
  const tmpDshHome = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-home-"));
  const res = bootstrapDshProfile({
    dshHome: tmpDshHome,
    profileName: "philipp",
    mithorRepoPath: MITHOR_PLATFORMS_PATH
  });

  assert.ok(fs.existsSync(res.patchOutPath));
  assert.ok(fs.existsSync(res.settingsOutPath));
  assert.ok(fs.existsSync(res.pkgOutPath));

  const patchContent = fs.readFileSync(res.patchOutPath, "utf8");
  assert.ok(!patchContent.includes("${HARNESS_ROOT}"));
  assert.ok(!patchContent.includes("${MITHOR_REPO_PATH}"));
  assert.ok(patchContent.includes("dsh-plugin-mithor-guard"));
  assert.ok(patchContent.includes("dsh-plugin-mithor-git-triage"));
  assert.ok(patchContent.includes("dsh-plugin-mithor-inspector"));
});
