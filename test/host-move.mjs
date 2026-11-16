/**
 * End-to-end move test on a throwaway DSH_HOME: real vendored pipeline, real
 * files, fake services. Proves the shadow-context wiring can actually move a
 * cold session artifact and swap workspace accounting.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = await mkdtemp(join(tmpdir(), "dsh-drag-home-"));
process.env.DSH_HOME = home;

const { encodeFsSessionSegment, encodeProjectSegment } = await import(
  "../lib/vendor/session-manager/session-files.js"
);

const projectOld = join(home, "proj-old");
const projectNew = join(home, "proj-new");
const sessionsRoot = join(home, "sessions");
const sessionId = "sess-drag-test-1";
const oldDir = join(sessionsRoot, encodeProjectSegment(projectOld), encodeFsSessionSegment(sessionId));
const newDir = join(sessionsRoot, encodeProjectSegment(projectNew), encodeFsSessionSegment(sessionId));

await mkdir(projectOld, { recursive: true });
await mkdir(projectNew, { recursive: true });
await mkdir(oldDir, { recursive: true });

const header = {
  id: sessionId,
  version: 0,
  cwd: projectOld,
  createdAt: "2026-11-16T00:00:00.000Z",
};
await writeFile(join(oldDir, "session.jsonl"), `${JSON.stringify(header)}\n`, "utf8");

const oldEntity = {
  id: "ws-old",
  title: "old",
  path: projectOld,
  record: { sessionIds: [sessionId] },
  async attachSession(id) {
    if (!this.record.sessionIds.includes(id)) this.record.sessionIds.push(id);
  },
  async detachSession(id) {
    this.record.sessionIds = this.record.sessionIds.filter((entry) => entry !== id);
  },
};
const newEntity = {
  id: "ws-new",
  title: "new",
  path: projectNew,
  record: { sessionIds: [] },
  async attachSession(id) {
    if (!this.record.sessionIds.includes(id)) this.record.sessionIds.push(id);
  },
  async detachSession(id) {
    this.record.sessionIds = this.record.sessionIds.filter((entry) => entry !== id);
  },
};

const registry = {
  headers: new Map(),
  sessionPaths: new Map(),
  invalidSessionPaths: new Map(),
  list: () => [oldEntity, newEntity],
  enqueueOperation: async (fn) => fn(),
};

const persistence = {
  locate: (value) => ({
    path: join(
      sessionsRoot,
      encodeProjectSegment(value.cwd),
      encodeFsSessionSegment(value.id),
      "session.jsonl",
    ),
  }),
  list: async () => [header],
};

const services = {
  workspaceRegistry: registry,
  sessions: { get: () => undefined, flush: async () => {} },
  agents: { get: () => undefined },
  sessionPersistence: persistence,
  agentPresets: {},
  connection: { admit: () => ({ peer: { principal: { kind: "owner" } } }) },
};

const routes = [];
const ctx = {
  get: (name) => services[name],
  effect: (fn) => {
    fn();
    return () => {};
  },
  on: () => () => {},
  emit: () => {},
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  webServer: {
    register: (route) => {
      routes.push(route);
      return { dispose() {} };
    },
  },
};

const { apply } = await import("../lib/index.js");
apply(ctx);

assert.equal(routes.length, 1);
const route = routes[0];

function makeReq(body) {
  return {
    method: "POST",
    url: `${route.path}/move`,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body, "utf8");
    },
  };
}

const res = {
  status: 0,
  body: "",
  writeHead(status) {
    this.status = status;
  },
  end(body) {
    this.body = body;
  },
};

await route.handler(
  makeReq(JSON.stringify({ sessionId, targetWorkspaceId: "ws-new" })),
  res,
);

const payload = JSON.parse(res.body);
assert.equal(res.status, 200, `unexpected status: ${res.status} ${res.body}`);
assert.equal(payload.ok, true);
assert.equal(payload.result.moved, true);

const moved = await readFile(join(newDir, "session.jsonl"), "utf8");
const movedHeader = JSON.parse(moved.slice(0, moved.indexOf("\n")));
assert.equal(movedHeader.cwd, projectNew);
assert.equal(movedHeader.id, sessionId);

assert.equal(existsSync(join(oldDir, "session.jsonl")), false, "old artifact removed");
assert.deepEqual(newEntity.record.sessionIds, [sessionId]);
assert.deepEqual(oldEntity.record.sessionIds, []);
assert.equal(registry.sessionPaths.get(sessionId), projectNew);

await assert.doesNotReject(() => access(home));
await rm(home, { recursive: true, force: true });
console.log("host move ok");
process.exit(0);
