/**
 * dsh-drag-workspace — host half.
 *
 * Exposes one endpoint, `POST /dsh-drag-workspace/api/move`, that performs a
 * real cross-workspace session move: it rewrites the session artifact's `cwd`,
 * re-homes the artifact, updates the workspace registry accounting, and
 * rebinds the live persistence writer when the session is running.
 *
 * The move pipeline itself is vendored from `dsh-session-manager` v0.7.8
 * (MIT, see ./vendor/session-manager/LICENSE). We instantiate its plugin
 * against a shadow context whose `effect`/`on` hooks are inert: that gives us
 * its `moveSession` closure without starting its HTTP API, boot reconciliation
 * or update checks. Only the `move` entry point of the vendored copy is used.
 *
 * @typedef {import('@deepseek-ai/cordis').Context} Context
 */

import {
  apply as applyVendored,
  inject as vendoredInject,
  __dragHost,
} from "./vendor/session-manager/index.js";

export const name = "dsh-drag-workspace";

/** The vendored pipeline needs the same host services session-manager needs. */
export const inject = vendoredInject;

const API_PREFIX = "/dsh-drag-workspace/api";
const MAX_BODY_BYTES = 64 * 1024;

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** @param {import('node:http').IncomingMessage} req */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("请求体超过 64 KiB"), { code: "body-too-large" });
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Owner-only admission, mirroring the upstream API gate.
 * @param {Context} ctx
 * @param {import('node:http').IncomingMessage} req
 */
function authenticate(ctx, req) {
  const connection = typeof ctx.get === "function" ? ctx.get("connection") : ctx.connection;
  if (!connection || typeof connection.admit !== "function") {
    return { ok: false, status: 503, code: "auth-unavailable", error: "DSH 认证服务未就绪，已拒绝请求" };
  }
  try {
    const admission = connection.admit(req);
    if (!admission || typeof admission !== "object") {
      return { ok: false, status: 401, code: "unauthorized", error: "未授权：需要有效的 DSH 会话凭证" };
    }
    if ("rejection" in admission) {
      const status = typeof admission.rejection === "number" ? admission.rejection : 401;
      return {
        ok: false,
        status,
        code: status === 403 ? "forbidden" : "unauthorized",
        error: status === 403 ? "禁止访问：请求未通过 DSH 信任检查" : "未授权：需要有效的 DSH 会话凭证",
      };
    }
    const principalKind = admission.peer?.principal?.kind;
    if (principalKind !== "owner") {
      return { ok: false, status: 403, code: "forbidden", error: "禁止访问：移动会话需要 owner 权限" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      status: 403,
      code: "auth-error",
      error: `认证检查失败：${error && error.message ? error.message : String(error)}`,
    };
  }
}

/** @param {Context} ctx */
export function apply(ctx) {
  // The vendored apply() defines moveSession in its own closure. Inert hooks
  // keep its side effects (HTTP routes, boot reconciliation, update checks)
  // off, while every service access still resolves against the real host.
  const shadow = new Proxy(Object.create(null), {
    get(_target, property) {
      if (property === "effect") return () => {};
      if (property === "on") return () => () => {};
      if (property === "get") return (name) => ctx.get(name);
      let value;
      try {
        value = ctx[property];
      } catch {
        value = undefined;
      }
      if (value === undefined && typeof ctx.get === "function") {
        try {
          value = ctx.get(property);
        } catch {
          value = undefined;
        }
      }
      return typeof value === "function" ? value.bind(ctx) : value;
    },
    set() {
      return true;
    },
    has() {
      return true;
    },
  });

  applyVendored(shadow);
  const moveSession = __dragHost.move;
  if (typeof moveSession !== "function") {
    throw new Error("dsh-drag-workspace: vendored move pipeline did not initialise");
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: API_PREFIX,
        handler: async (req, res) => {
          const auth = authenticate(ctx, req);
          if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code, error: auth.error });

          const url = new URL(req.url ?? "/", "http://localhost");
          const path = url.pathname.startsWith(API_PREFIX) ? url.pathname.slice(API_PREFIX.length) || "/" : "/";
          if (req.method !== "POST" || path !== "/move") {
            return send(res, 404, { ok: false, code: "not-found", error: "unknown endpoint" });
          }

          let body;
          try {
            body = JSON.parse(await readBody(req));
          } catch (error) {
            return send(res, 400, { ok: false, code: "bad-request", error: "请求体不是合法 JSON" });
          }
          if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return send(res, 400, { ok: false, code: "bad-request", error: "请求体必须是 JSON 对象" });
          }
          const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
          const targetWorkspaceId = typeof body.targetWorkspaceId === "string" ? body.targetWorkspaceId.trim() : "";
          if (sessionId === "" || targetWorkspaceId === "") {
            return send(res, 400, { ok: false, code: "bad-request", error: "sessionId 与 targetWorkspaceId 必填" });
          }

          try {
            const result = await moveSession(sessionId, targetWorkspaceId);
            return send(res, 200, { ok: true, result });
          } catch (error) {
            const status =
              error?.code === "bad-request" || error?.code === "subagent-unsupported"
                ? 400
                : error?.code === "session-not-found" || error?.code === "workspace-not-found"
                  ? 404
                  : ["working-directory-sync-unsafe", "worktree-move-unsupported", "worktree-state-unavailable", "session-active", "workspace-membership-conflict"].includes(error?.code)
                    ? 409
                    : error?.code === "workspace-attach-unavailable"
                      ? 501
                      : 500;
            return send(res, status, {
              ok: false,
              code: typeof error?.code === "string" ? error.code : "move-failed",
              error: error && error.message ? error.message : String(error),
            });
          }
        },
      }),
    "drag-workspace: move api",
  );
}
