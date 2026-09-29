// Smoke test for the Qwertystock MCP server against the live public API.
// Run from the repository root:  node tests/smoke-test.mjs
// It makes free requests only: search and preview lookups. It never buys anything.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "qwertystock-mcp.mjs");
const server = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, QWERTYSTOCK_PLUGIN_API_KEY: "" }
});

const pending = new Map();
let nextId = 1;
createInterface({ input: server.stdout }).on("line", line => {
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (waiter) {
        pending.delete(message.id);
        waiter(message);
    }
});

function request(method, params) {
    const id = nextId++;
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 90000);
        pending.set(id, message => {
            clearTimeout(timer);
            resolve(message);
        });
    });
}

function text(result) {
    return result.content.filter(block => block.type === "text").map(block => block.text).join("\n");
}

async function main() {
    const init = await request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "1.0.0" }
    });
    assert.equal(init.result.protocolVersion, "2025-06-18");
    assert.equal(init.result.serverInfo.name, "qwertystock");
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

    const list = await request("tools/list", {});
    const names = list.result.tools.map(tool => tool.name).sort();
    assert.deepEqual(names, ["get_item", "purchase_download", "search_media"]);
    console.log("ok  tools/list:", names.join(", "));

    const search = await request("tools/call", {
        name: "search_media",
        arguments: { query: "red convertible", type: "photo", limit: 3, thumbnails: 2 }
    });
    assert.ok(!search.result.isError, text(search.result));
    const idMatch = text(search.result).match(/#(\d+) · photo/);
    assert.ok(idMatch, "search returned no photo items");
    const images = search.result.content.filter(block => block.type === "image");
    assert.ok(images.length >= 1, "no thumbnails attached");
    console.log(`ok  search_media: first item #${idMatch[1]}, ${images.length} thumbnail(s)`);

    const video = await request("tools/call", {
        name: "search_media",
        arguments: { query: "городской автобус", type: "video", limit: 2, thumbnails: 0, mode: "semantic" }
    });
    assert.ok(!video.result.isError, text(video.result));
    assert.match(text(video.result), /· video ·/);
    assert.match(text(video.result), /Formats and prices \(USD\): .*\$\d/);
    console.log("ok  search_media: semantic video search in Russian, with prices");

    const item = await request("tools/call", { name: "get_item", arguments: { item_id: Number(idMatch[1]) } });
    assert.ok(!item.result.isError, text(item.result));
    assert.match(text(item.result), /Item page: https:\/\/qwertystock\.com\/item\?id=/);
    console.log("ok  get_item");

    const missing = await request("tools/call", { name: "get_item", arguments: { item_id: 999999999 } });
    assert.ok(missing.result.isError);
    console.log("ok  get_item: unknown ID reported as an error");

    const purchase = await request("tools/call", {
        name: "purchase_download",
        arguments: { item_id: Number(idMatch[1]), format: "HD", max_price_usd: 2 }
    });
    assert.ok(purchase.result.isError);
    assert.match(text(purchase.result), /No Qwertystock API key is configured/);
    console.log("ok  purchase_download: refuses without an API key");

    const bad = await request("tools/call", { name: "search_media", arguments: { query: "cat", type: "gif" } });
    assert.ok(bad.result.isError);
    console.log("ok  search_media: invalid type reported as an error");

    const unknown = await request("tools/call", { name: "nope", arguments: {} });
    assert.equal(unknown.error.code, -32602);
    console.log("ok  unknown tool rejected");

    console.log("All smoke tests passed.");
}

main()
    .then(() => server.kill())
    .catch(error => {
        console.error("FAILED:", error.message);
        server.kill();
        process.exit(1);
    });
