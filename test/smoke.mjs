/**
 * Offline smoke test for the client bundle: no browser, no DSH.
 *
 * It stubs just enough DOM to import lib/client.js, hand it a fake Context,
 * and drive synthetic drag events through the document listeners the plugin
 * installs.
 */
import assert from "node:assert/strict";

/** @param {string} kind @param {Record<string, string>} [attrs] */
function makeNode(kind, attrs = {}) {
  const node = {
    kind,
    parent: null,
    children: [],
    attrs,
    classList: {
      set: new Set(),
      add(name) {
        this.set.add(name);
      },
      remove(name) {
        this.set.delete(name);
      },
      contains(name) {
        return this.set.has(name);
      },
    },
    style: {},
    textContent: "",
    getAttribute(name) {
      return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
    },
    contains(other) {
      return other === this;
    },
    closest(selector) {
      const match = /\[data-row-key\^="([^"]+)"\]/.exec(selector);
      if (!match) return null;
      const prefix = match[1];
      for (let cursor = this; cursor; cursor = cursor.parent) {
        const key = cursor.getAttribute?.("data-row-key");
        if (typeof key === "string" && key.startsWith(prefix)) return cursor;
      }
      return null;
    },
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    remove() {},
  };
  return node;
}

const appendedToBody = [];
const documentStub = {
  head: makeNode("head"),
  body: makeNode("body"),
  getElementById: () => null,
  createElement: () => makeNode("created"),
  addEventListener: (type, handler, capture) => listeners.push({ type, handler, capture }),
  removeEventListener: () => {},
};

for (const node of [documentStub.head, documentStub.body]) node.appendChild = (child) => {
  child.parent = node;
  node.children.push(child);
  if (node === documentStub.body) appendedToBody.push(child);
  return child;
};

const listeners = [];
let factory = null;
let registeredId = null;

globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory: make }) {
      registeredId = id;
      factory = make;
    },
  },
};
globalThis.document = documentStub;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.setTimeout = () => 0;

const fetchCalls = [];
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url, init });
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result: { sessionId: "s1" } }),
  };
};

await import("../lib/client.js");
assert.equal(registeredId, "dsh-drag-workspace", "module registers under its package id");

let workspaceList = [{ workspaceId: "w1", sessionIds: ["s1"] }];
const ctx = {
  workspaces: { list: () => workspaceList },
  effect: (fn) => fn(),
};
const exported = factory(() => {
  throw new Error("client bundle must not require anything");
});
assert.equal(typeof exported.apply, "function");
assert.deepEqual(exported.inject, ["workspaces"]);
exported.apply(ctx);

const handler = (type) => {
  const hit = listeners.find((entry) => entry.type === type);
  assert.ok(hit, `listener for ${type}`);
  return hit.handler;
};

const group = makeNode("group");
const header = makeNode("workspace", { "data-row-key": "workspace:w2" });
header.parent = group;
const headerChild = makeNode("span");
headerChild.parent = header; // closest() walks parents, so parent chain is enough
const row = makeNode("session", { "data-row-key": "session:s1" });

// 1. drag a session row: the plugin records it, no request yet.
handler("dragstart")({ target: row });
assert.equal(fetchCalls.length, 0);

// 2. hover the workspace header: highlight + preventDefault + dropEffect.
let prevented = 0;
const dataTransfer = { dropEffect: "none" };
handler("dragover")({
  target: headerChild,
  dataTransfer,
  preventDefault: () => {
    prevented += 1;
  },
});
assert.equal(prevented, 1);
assert.equal(dataTransfer.dropEffect, "move");
assert.ok(header.classList.contains("dsh-drag-ws-over"), "header highlighted");

// 3. drop on the header: one move request with the right body.
handler("drop")({
  target: headerChild,
  preventDefault: () => {},
  stopPropagation: () => {},
});
await new Promise((resolve) => setImmediate(resolve));
assert.equal(fetchCalls.length, 1);
assert.equal(fetchCalls[0].url, "/dsh-drag-workspace/api/move");
assert.deepEqual(JSON.parse(fetchCalls[0].init.body), {
  sessionId: "s1",
  targetWorkspaceId: "w2",
});

// 4. same workspace: no request, a "already there" toast instead.
fetchCalls.length = 0;
workspaceList = [{ workspaceId: "w2", sessionIds: ["s1"] }];
appendToastCountReset();
handler("dragstart")({ target: row });
handler("drop")({ target: headerChild, preventDefault: () => {}, stopPropagation: () => {} });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(fetchCalls.length, 0, "same workspace must not call the API");

// 5. drop on a session row must not move anything (native reorder owns it).
appendToastCountReset();
handler("dragstart")({ target: row });
handler("drop")({ target: row, preventDefault: () => {}, stopPropagation: () => {} });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(fetchCalls.length, 0, "drops on rows stay native");

function appendToastCountReset() {
  appendedToBody.length = 0;
}

console.log("smoke ok");
process.exit(0);
