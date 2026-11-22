import http from "node:http";
import {
  normalizeRepoPath,
  tryGetCordisService
} from "../../../packages/shared/src/index.js";
import {
  recordClickedElement,
  getLastClickedElement
} from "../../../mcp/mithor-code-map/src/dictionary.js";
import { buildInspectorClientScript } from "./clientOverlay.js";

export const name = "dsh-plugin-mithor-inspector";
export const inject = [];

/**
 * Injects the zero-footprint inspector script tag right before </body> in HTML responses.
 */
export function injectInspectorIntoHtml(htmlString) {
  const tag = '<script src="/__mithor_inspector.js"></script>';
  if (htmlString.includes("/__mithor_inspector.js")) return htmlString;
  if (htmlString.includes("</body>")) {
    return htmlString.replace("</body>", `${tag}</body>`);
  }
  return htmlString + tag;
}

/**
 * Normalizes a React Fiber _debugSource payload into a clean Mithor-Platforms context card.
 */
export function normalizeClickedElement(rawPayload, mithorRepoPath = "") {
  const relFile = rawPayload.fileName
    ? normalizeRepoPath(rawPayload.fileName, mithorRepoPath)
    : null;

  return {
    componentName: rawPayload.componentName || "Unbekannte Komponente",
    componentHierarchy: rawPayload.componentHierarchy || [],
    relFile,
    lineNumber: rawPayload.lineNumber || null,
    columnNumber: rawPayload.columnNumber || null,
    tagName: rawPayload.tagName || "div",
    textSnippet: rawPayload.textSnippet || "",
    className: rawPayload.className || "",
    routePath: rawPayload.routePath || "/",
    boundingBox: rawPayload.boundingBox || null,
    contextSummaryDe: relFile
      ? `Ausgewähltes Element: <${rawPayload.componentName || rawPayload.tagName}> in '${relFile}' (Zeile ${rawPayload.lineNumber || "?"}) mit Text "${rawPayload.textSnippet || ""}".`
      : `Ausgewähltes Element: <${rawPayload.tagName}> auf Route '${rawPayload.routePath || "/"}' mit Text "${rawPayload.textSnippet || ""}".`
  };
}

/**
 * Starts the local zero-footprint HTTP proxy server that wraps apps/FEP (Vite)
 * and captures React Fiber element clicks without modifying any file in Mithor-Platforms.
 */
export function createInspectorServer(options = {}) {
  const fepTargetUrl = new URL(options.fepTargetUrl || "http://127.0.0.1:5173");
  const harnessRoot = options.harnessRoot || process.env.HARNESS_ROOT || process.cwd();
  const mithorRepoPath = options.mithorRepoPath || process.env.MITHOR_REPO_PATH || "";
  const onElementSelected = options.onElementSelected || (() => { });

  const server = http.createServer((req, res) => {
    // 1. Serve the injected inspector script
    if (req.method === "GET" && req.url === "/__mithor_inspector.js") {
      const js = buildInspectorClientScript("/__mithor_inspector/select");
      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(js);
      return;
    }

    // 2. Receive clicked element payload from browser
    if (req.method === "POST" && req.url === "/__mithor_inspector/select") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const normalized = normalizeClickedElement(parsed, mithorRepoPath);
          const saved = recordClickedElement(normalized, harnessRoot);
          onElementSelected(saved);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          });
          res.end(JSON.stringify({ ok: true, selection: saved }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    // 3. Return latest selection via GET /__mithor_inspector/last
    if (req.method === "GET" && req.url === "/__mithor_inspector/last") {
      const last = getLastClickedElement(harnessRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(last));
      return;
    }

    // 4. Reverse-proxy to apps/FEP Vite dev server
    const proxyReq = http.request(
      {
        hostname: fepTargetUrl.hostname,
        port: fepTargetUrl.port || 80,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "accept-encoding": "identity" }
      },
      (proxyRes) => {
        const contentType = String(proxyRes.headers["content-type"] || "");
        if (contentType.includes("text/html")) {
          let rawHtml = "";
          proxyRes.setEncoding("utf8");
          proxyRes.on("data", (chunk) => {
            rawHtml += chunk;
          });
          proxyRes.on("end", () => {
            const modified = injectInspectorIntoHtml(rawHtml);
            const headers = { ...proxyRes.headers };
            delete headers["content-length"];
            res.writeHead(proxyRes.statusCode || 200, headers);
            res.end(modified);
          });
        } else {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        }
      }
    );

    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "FEP_DEV_SERVER_UNREACHABLE",
          messageDe: `Der Mithor-Frontend-Server (${fepTargetUrl.origin}) läuft noch nicht: ${err.message}`
        })
      );
    });

    req.pipe(proxyReq);
  });

  return server;
}

export function apply(ctx, config = {}) {
  const harnessRoot = config.harnessRoot || process.env.HARNESS_ROOT || process.cwd();
  const mithorRepoPath = config.mithorRepoPath || process.env.MITHOR_REPO_PATH || "";

  const shell = tryGetCordisService(ctx, "shell");
  if (shell?.overlay?.register) {
    shell.overlay.register({
      id: "mithor-inspector-hud",
      title: "Mithor UI-Inspektor",
      render: () => getLastClickedElement(harnessRoot)
    });
  }

  const tools = tryGetCordisService(ctx, "tools");
  if (tools?.register) {
    tools.register({
      name: "mithor_get_inspected_element",
      description: "Returns the latest React component, source file, and line number Philipp selected via Alt+Click in the Mithor preview.",
      parameters: { type: "object", properties: {} },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (out) => JSON.stringify(out, null, 2)
      },
      execute: async () => getLastClickedElement(harnessRoot)
    });
  }

  return {
    createInspectorServer: (opts) =>
      createInspectorServer({ ...config, harnessRoot, mithorRepoPath, ...opts })
  };
}
