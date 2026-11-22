import readline from "node:readline";
import {
  lookupGermanTerm,
  inspectIdeFormula,
  getLastClickedElement,
  recordClickedElement
} from "./dictionary.js";

export {
  lookupGermanTerm,
  inspectIdeFormula,
  getLastClickedElement,
  recordClickedElement
};

const TOOLS = [
  {
    name: "lookup_german_term",
    description: "Maps German commercial real estate (CRE) and UI terms to exact Mithor-Platforms files, Python IDE symbols, and React components.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "German CRE or UI term (e.g. 'Ankaufsfaktor', 'Restwertverfahren', 'Deckblatt PDF')" }
      }
    }
  },
  {
    name: "inspect_ide_formula",
    description: "Reads the exact Python formula implementation from apps/AI/app/modules/ide/<module>.py.",
    inputSchema: {
      type: "object",
      required: ["moduleName"],
      properties: {
        moduleName: {
          type: "string",
          enum: ["constants", "parameters", "normalize", "audit", "scoring", "rules", "pricing", "dcf", "residual", "ratings", "report"]
        },
        symbol: { type: "string", description: "Optional function, class, or constant name (e.g. 'run_dcf', 'r04', 'CAPEX_RESERVE_PER_SQM')" }
      }
    }
  },
  {
    name: "get_last_clicked_element",
    description: "Returns the exact React component, source file, line number, and styles of the UI element Philipp clicked in the inspector preview.",
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
        serverInfo: { name: "mithor-code-map", version: "0.1.0" }
      }
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS }
    };
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};
    let payload;

    if (toolName === "lookup_german_term") {
      payload = lookupGermanTerm(args);
    } else if (toolName === "inspect_ide_formula") {
      payload = inspectIdeFormula({
        ...args,
        mithorRepoPath: process.env.MITHOR_REPO_PATH
      });
    } else if (toolName === "get_last_clicked_element") {
      payload = getLastClickedElement(process.env.HARNESS_ROOT || process.cwd());
    } else {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` }
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
      }
    };
  }

  return null;
}

// Start stdio loop when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = handleJsonRpcRequest(req);
      if (res) {
        process.stdout.write(JSON.stringify(res) + "\n");
      }
    } catch {
      // ignore malformed notifications
    }
  });
}
