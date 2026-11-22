/**
 * Generates the zero-footprint browser client script injected on-the-fly by the inspector proxy.
 * Uses React 18 Fiber debug metadata (__reactFiber$... -> _debugSource / _debugOwner)
 * from Vite's dev build so Philipp can Alt+Click any element in apps/FEP and map it directly
 * to the exact .jsx file and line number without modifying Mithor-Platforms source files.
 */
export function buildInspectorClientScript(endpoint = "/__mithor_inspector/select") {
  return `(function() {
  if (window.__MITHOR_INSPECTOR_ACTIVE__) return;
  window.__MITHOR_INSPECTOR_ACTIVE__ = true;

  let inspectMode = false;

  const badge = document.createElement("button");
  badge.type = "button";
  badge.textContent = "Element auswählen (Alt+Klick)";
  Object.assign(badge.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483647",
    padding: "8px 14px",
    borderRadius: "9999px",
    background: "#1A1A1A",
    color: "#FFFFFF",
    fontSize: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: "600",
    border: "1px solid #333333",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
    cursor: "pointer"
  });

  const highlight = document.createElement("div");
  Object.assign(highlight.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483646",
    border: "2px solid #10B981",
    background: "rgba(16, 185, 129, 0.10)",
    borderRadius: "6px",
    display: "none"
  });

  function setMode(next) {
    inspectMode = next;
    badge.style.background = inspectMode ? "#059669" : "#1A1A1A";
    badge.textContent = inspectMode ? "Klicke auf ein Element..." : "Element auswählen (Alt+Klick)";
    if (!inspectMode) highlight.style.display = "none";
  }

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    setMode(!inspectMode);
  });

  function extractReactFiberSource(el) {
    let curr = el;
    const hierarchy = [];
    let debugSource = null;

    while (curr) {
      const fiberKey = Object.keys(curr).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
      if (fiberKey) {
        let fiber = curr[fiberKey];
        while (fiber) {
          const name = fiber.type && (fiber.type.displayName || fiber.type.name);
          if (name && !hierarchy.includes(name)) {
            hierarchy.push(name);
          }
          if (!debugSource && fiber._debugSource) {
            debugSource = {
              fileName: fiber._debugSource.fileName,
              lineNumber: fiber._debugSource.lineNumber,
              columnNumber: fiber._debugSource.columnNumber || 1
            };
          }
          fiber = fiber._debugOwner || fiber.return;
        }
        break;
      }
      curr = curr.parentElement;
    }

    return { debugSource, componentHierarchy: hierarchy.slice(0, 6) };
  }

  document.addEventListener("mousemove", (e) => {
    if (!inspectMode && !e.altKey) {
      highlight.style.display = "none";
      return;
    }
    const target = e.target;
    if (!target || target === badge || !(target instanceof HTMLElement)) return;
    const r = target.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: "block",
      top: r.top + "px",
      left: r.left + "px",
      width: r.width + "px",
      height: r.height + "px"
    });
  }, true);

  document.addEventListener("click", (e) => {
    if (!inspectMode && !e.altKey) return;
    if (e.target === badge) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    const rect = el.getBoundingClientRect();
    const { debugSource, componentHierarchy } = extractReactFiberSource(el);
    const payload = {
      tagName: el.tagName.toLowerCase(),
      textSnippet: (el.innerText || el.textContent || "").trim().slice(0, 120),
      className: typeof el.className === "string" ? el.className : "",
      componentName: componentHierarchy[0] || null,
      componentHierarchy,
      fileName: debugSource ? debugSource.fileName : null,
      lineNumber: debugSource ? debugSource.lineNumber : null,
      columnNumber: debugSource ? debugSource.columnNumber : null,
      routePath: window.location.pathname,
      boundingBox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };

    fetch(${JSON.stringify(endpoint)}, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {});

    setMode(false);
  }, true);

  window.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(highlight);
    document.body.appendChild(badge);
  });
  if (document.body) {
    document.body.appendChild(highlight);
    document.body.appendChild(badge);
  }
})();`;
}
