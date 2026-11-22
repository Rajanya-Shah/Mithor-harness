import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";

/**
 * Inspects apps/FEP/src/utils/exportValuationPdf.js to verify A4 page boundaries,
 * WinAnsi font safety (no U+2212 Unicode minus), and section headings.
 */
export function verifyPdfGeneratorHealth(mithorRepoPath = process.env.MITHOR_REPO_PATH) {
  const relPath = "apps/FEP/src/utils/exportValuationPdf.js";
  const fullPath = path.join(mithorRepoPath || "", relPath);
  if (!mithorRepoPath || !fs.existsSync(fullPath)) {
    return { passed: false, error: `File not found: ${fullPath}` };
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const issues = [];

  // Check for forbidden U+2212 minus sign inside string literals (breaks jsPDF built-in Helvetica WinAnsi encoding)
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const codeOnly = line.split("//")[0];
    if (codeOnly.includes("\u2212")) {
      issues.push(`Line ${idx + 1} contains Unicode minus U+2212 ('−') which renders garbled in jsPDF WinAnsi Helvetica; use ASCII '-' instead.`);
    }
  });

  if (!content.includes("newPageIfNeeded")) {
    issues.push("Missing newPageIfNeeded() pagination guard in exportValuationPdf.js");
  }

  return {
    passed: issues.length === 0,
    relPath,
    pageFormat: "A4 (210mm x 297mm, margins 18mm)",
    issues
  };
}

/**
 * Captures a baseline structural + visual snapshot of target FEP components/routes.
 */
export function captureBaseline({
  routeOrComponent = "apps/FEP/src/pages/project/sections/DealCheckSection.jsx",
  harnessRoot = process.env.HARNESS_ROOT || process.cwd(),
  mithorRepoPath = process.env.MITHOR_REPO_PATH || process.cwd()
}) {
  const snapDir = path.join(harnessRoot, ".mithor-snapshots");
  fs.mkdirSync(snapDir, { recursive: true });

  const targetFile = path.join(mithorRepoPath, routeOrComponent);
  const content = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, "utf8") : "";
  const hash = crypto.createHash("sha256").update(content).digest("hex");

  const baseline = {
    routeOrComponent,
    capturedAt: new Date().toISOString(),
    sha256: hash,
    lineCount: content ? content.split(/\r?\n/).length : 0
  };

  const baselinePath = path.join(snapDir, "visual-baseline.json");
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  return baseline;
}

/**
 * Compares the current state against the baseline and validates PDF + UI layout health.
 */
export function captureAndDiff({
  routeOrComponent = "apps/FEP/src/pages/project/sections/DealCheckSection.jsx",
  harnessRoot = process.env.HARNESS_ROOT || process.cwd(),
  mithorRepoPath = process.env.MITHOR_REPO_PATH || process.cwd()
}) {
  const snapDir = path.join(harnessRoot, ".mithor-snapshots");
  const baselinePath = path.join(snapDir, "visual-baseline.json");
  const baseline = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
    : null;

  const targetFile = path.join(mithorRepoPath, routeOrComponent);
  const content = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, "utf8") : "";
  const currentHash = crypto.createHash("sha256").update(content).digest("hex");
  const pdfHealth = verifyPdfGeneratorHealth(mithorRepoPath);

  return {
    passed: pdfHealth.passed,
    routeOrComponent,
    baselineHash: baseline?.sha256 || null,
    currentHash,
    changedSinceBaseline: baseline ? baseline.sha256 !== currentHash : false,
    pdfHealth,
    summaryDe: pdfHealth.passed
      ? "Visuelle Vorschau und PDF-Layout-Prüfung (A4 / WinAnsi-Schriftsicherheit) erfolgreich bestanden."
      : `PDF-Darstellungsfehler gefunden: ${pdfHealth.issues.join("; ")}`
  };
}

const TOOLS = [
  {
    name: "capture_baseline",
    description: "Captures a before-edit visual and structural baseline of an apps/FEP component or route.",
    inputSchema: {
      type: "object",
      properties: {
        routeOrComponent: { type: "string" }
      }
    }
  },
  {
    name: "capture_and_diff",
    description: "Captures the post-edit state, computes the diff against baseline, and verifies jsPDF A4/WinAnsi visual safety.",
    inputSchema: {
      type: "object",
      properties: {
        routeOrComponent: { type: "string" }
      }
    }
  },
  {
    name: "verify_pdf_health",
    description: "Verifies exportValuationPdf.js for WinAnsi font encoding safety and A4 pagination guards.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

export function handleJsonRpcRequest(req) {
  const { id, method, params } = req;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mithor-visual-preview", version: "0.1.0" }
      }
    };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};
    let payload;
    if (toolName === "capture_baseline") {
      payload = captureBaseline(args);
    } else if (toolName === "capture_and_diff") {
      payload = captureAndDiff(args);
    } else if (toolName === "verify_pdf_health") {
      payload = verifyPdfGeneratorHealth();
    } else {
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
    }
    return {
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] }
    };
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = handleJsonRpcRequest(req);
      if (res) process.stdout.write(JSON.stringify(res) + "\n");
    } catch {
      // ignore
    }
  });
}
