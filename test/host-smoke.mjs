/**
 * Offline smoke test for the host half: boot the vendored move pipeline
 * against a fake Context and assert the route plus the captured closure.
 */
import assert from "node:assert/strict";

const registeredRoutes = [];
const fakeCtx = {
  get: () => undefined,
  on: () => () => {},
  effect: (fn) => {
    fn();
    return () => {};
  },
  emit: () => {},
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  webServer: {
    register: (route) => {
      registeredRoutes.push(route);
      return { dispose() {} };
    },
  },
  workspaceRegistry: {
    list: () => [],
    headers: new Map(),
    sessionPaths: new Map(),
    invalidSessionPaths: new Map(),
    enqueueOperation: async (fn) => fn(),
  },
  sessions: { get: () => undefined, flush: async () => {} },
  agents: { get: () => undefined },
  sessionPersistence: { locate: () => ({ path: "unused" }), list: async () => [] },
  agentPresets: {},
  connection: {},
};

const { apply, inject } = await import("../lib/index.js");
assert.ok(Array.isArray(inject) && inject.includes("workspaceRegistry"), "inject carries host services");
assert.equal(typeof apply, "function");

apply(fakeCtx);
assert.equal(registeredRoutes.length, 1, "one route registered");
assert.equal(registeredRoutes[0].path, "/dsh-drag-workspace/api");
assert.equal(registeredRoutes[0].kind, "prefix");
assert.equal(typeof registeredRoutes[0].handler, "function");

console.log("host smoke ok");
process.exit(0);
