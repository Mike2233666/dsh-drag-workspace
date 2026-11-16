/**
 * dsh-drag-workspace — client half.
 *
 * Native DSH already supports dragging a session row, but only to reorder it
 * *inside* its own workspace group: the workspace header carries a
 * `dragover`/`drop` handler only while a workspace row is being dragged. This
 * plugin adds the missing drop target: dragging a session row onto another
 * workspace header moves that session there.
 *
 * The move itself is delegated to this plugin's own host endpoint
 * (`POST /dsh-drag-workspace/api/move`), which rewrites the session's `cwd`,
 * re-homes the artifact and updates the workspace registry. The client never
 * touches the session file itself.
 *
 * No React, no slots: the plugin patches drag behaviour with document-level
 * listeners, so it does not replace or re-render the native sidebar.
 */
window.__ModuleLoader__.load({
  id: "dsh-drag-workspace",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const MOVE_API = "/dsh-drag-workspace/api/move";
    const SESSION_PREFIX = "session:";
    const WORKSPACE_PREFIX = "workspace:";
    const OVER_CLASS = "dsh-drag-ws-over";
    const STYLE_ID = "dsh-drag-workspace-style";

    /** @type {{ sessionId: string } | null} */
    let dragging = null;
    /** @type {Element | null} */
    let overHeader = null;
    /** @type {{ list?: () => unknown } | undefined} */
    let workspaces = undefined;

    /**
     * Read the session/workspace id out of the row key the native sidebar
     * already writes (`session:<id>` / `workspace:<id>`).
     * @param {Element | null} element
     * @param {string} prefix
     * @returns {string | null}
     */
    function idOf(element, prefix) {
      if (!element || typeof element.getAttribute !== "function") return null;
      const key = element.getAttribute("data-row-key");
      if (typeof key !== "string" || !key.startsWith(prefix)) return null;
      const id = key.slice(prefix.length);
      return id === "" ? null : id;
    }

    /**
     * @param {EventTarget | null} target
     * @param {string} prefix
     * @returns {Element | null}
     */
    function rowUnder(target, prefix) {
      if (target === null || typeof target !== "object") return null;
      const element = /** @type {Element} */ (target);
      if (typeof element.closest !== "function") return null;
      return element.closest(`[data-row-key^="${prefix}"]`);
    }

    /** @param {Element | null} header */
    function highlight(header) {
      if (overHeader === header) return;
      if (overHeader) overHeader.classList.remove(OVER_CLASS);
      overHeader = header;
      if (overHeader) overHeader.classList.add(OVER_CLASS);
    }

    /**
     * @param {string} message
     * @param {boolean} [isError]
     */
    function toast(message, isError) {
      if (typeof document === "undefined" || !document.body) return;
      const node = document.createElement("div");
      node.textContent = message;
      node.style.cssText = [
        "position:fixed",
        "right:20px",
        "bottom:20px",
        "z-index:2147483000",
        "max-width:min(380px, 60vw)",
        "padding:10px 14px",
        "border-radius:8px",
        "font:13px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif",
        "color:#fff",
        `background:${isError ? "#b4362c" : "#2d6a4f"}`,
        "box-shadow:0 6px 24px rgba(0,0,0,.28)",
        "pointer-events:none",
        "opacity:0",
        "transition:opacity .18s ease",
      ].join(";");
      document.body.appendChild(node);
      requestAnimationFrame(() => {
        node.style.opacity = "1";
      });
      setTimeout(
        () => {
          node.style.opacity = "0";
          setTimeout(() => node.remove(), 220);
        },
        isError ? 4200 : 2200,
      );
    }

    /**
     * @param {string} sessionId
     * @returns {string | undefined}
     */
    function sourceWorkspaceOf(sessionId) {
      try {
        const list = workspaces && typeof workspaces.list === "function" ? workspaces.list() : [];
        if (!Array.isArray(list)) return undefined;
        const owner = list.find(
          (entry) =>
            entry &&
            Array.isArray(entry.sessionIds) &&
            entry.sessionIds.includes(sessionId),
        );
        if (!owner) return undefined;
        return owner.workspaceId ?? owner.id;
      } catch {
        return undefined;
      }
    }

    /**
     * @param {string} sessionId
     * @param {string} targetWorkspaceId
     * @param {string | undefined} sourceWorkspaceId
     */
    async function moveSession(sessionId, targetWorkspaceId, sourceWorkspaceId) {
      if (sourceWorkspaceId !== undefined && sourceWorkspaceId === targetWorkspaceId) {
        toast("已经在这个工作区里了");
        return;
      }
      let response;
      try {
        response = await fetch(MOVE_API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, targetWorkspaceId }),
        });
      } catch (error) {
        toast(`移动失败：网络错误${error && error.message ? `（${error.message}）` : ""}`, true);
        return;
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok !== true) {
        const reason = payload && typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
        toast(`移动失败：${reason}`, true);
        return;
      }
      toast("已移动到目标工作区");
    }

    /** @param {DragEvent} event */
    function onDragStart(event) {
      const row = rowUnder(event.target, SESSION_PREFIX);
      const sessionId = row === null ? null : idOf(row, SESSION_PREFIX);
      dragging = sessionId === null ? null : { sessionId };
    }

    /** @param {DragEvent} event */
    function onDragOver(event) {
      if (dragging === null) return;
      const header = rowUnder(event.target, WORKSPACE_PREFIX);
      if (header === null) {
        highlight(null);
        return;
      }
      // Only a real workspace is a move target; the "ungrouped" pseudo row
      // carries `workspace:` with an empty key.
      if (idOf(header, WORKSPACE_PREFIX) === null) {
        highlight(null);
        return;
      }
      if (!event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      highlight(header);
    }

    /** @param {DragEvent} event */
    function onDragLeave(event) {
      if (overHeader === null) return;
      const next = /** @type {Node | null} */ (event.relatedTarget);
      if (next && overHeader.contains(next)) return;
      highlight(null);
    }

    /** @param {DragEvent} event */
    function onDrop(event) {
      if (dragging === null) return;
      const header = rowUnder(event.target, WORKSPACE_PREFIX);
      if (header === null) return;
      const targetWorkspaceId = idOf(header, WORKSPACE_PREFIX);
      const sessionId = dragging.sessionId;
      dragging = null;
      highlight(null);
      if (targetWorkspaceId === null) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceWorkspaceId = sourceWorkspaceOf(sessionId);
      void moveSession(sessionId, targetWorkspaceId, sourceWorkspaceId);
    }

    function onDragEnd() {
      dragging = null;
      highlight(null);
    }

    /** @param {import('@deepseek-ai/cordis').Context} ctx */
    function apply(ctx) {
      try {
        workspaces = ctx.workspaces;
      } catch {
        workspaces = undefined;
      }

      ctx.effect(() => {
        if (typeof document === "undefined") return () => {};
        if (document.getElementById(STYLE_ID) === null) {
          const style = document.createElement("style");
          style.id = STYLE_ID;
          style.textContent = `.${OVER_CLASS}{outline:2px solid #4c8dff !important;outline-offset:-2px !important;border-radius:6px !important;background:rgba(76,141,255,.14) !important}`;
          document.head.appendChild(style);
        }

        const bindings = [
          ["dragstart", onDragStart, true],
          ["dragover", onDragOver, false],
          ["dragleave", onDragLeave, false],
          ["drop", onDrop, false],
          ["dragend", onDragEnd, true],
        ];
        for (const [type, handler, capture] of bindings) {
          document.addEventListener(type, handler, capture);
        }
        return () => {
          for (const [type, handler, capture] of bindings) {
            document.removeEventListener(type, handler, capture);
          }
          highlight(null);
          dragging = null;
          const style = document.getElementById(STYLE_ID);
          if (style) style.remove();
        };
      }, "drag-workspace: drag and drop");
    }

    exports.apply = apply;
    exports.inject = ["workspaces"];
    return module.exports;
  },
});
