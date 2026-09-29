#!/usr/bin/env node
// Qwertystock MCP server for the Qwertystock Claude plugin.
//
// Zero dependencies: Node.js 18+ built-ins only (global fetch, readline).
// Transport: MCP stdio, newline-delimited JSON-RPC 2.0 on stdin/stdout.
// Diagnostics go to stderr only, because stdout carries the protocol.
//
// Read-only. The server never buys anything, needs no account or key, and
// sends no credentials. Network access, all over HTTPS:
//   - https://qwertystock.com/api/v1/...  the public Qwertystock REST API
//   - thumbnail image URLs that the API itself returns for its items

import { createInterface } from "node:readline";

const SERVER_NAME = "qwertystock";
const SERVER_TITLE = "Qwertystock";
const SERVER_VERSION = "1.0.0";
const API_ORIGIN = "https://qwertystock.com";
const USER_AGENT = `qwertystock-claude-plugin/${SERVER_VERSION} (+https://github.com/eschota/qwertystock-claude-plugin)`;
const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const CONTENT_TYPES = ["photo", "illustration", "vector", "video"];

const REQUEST_TIMEOUT_MS = 30000;
const THUMBNAIL_TIMEOUT_MS = 10000;
const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
const THUMBNAIL_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SEARCH_DEFAULT_LIMIT = 12;
const SEARCH_MAX_LIMIT = 80;
const MAX_THUMBNAILS = 8;
const PRICE_LOOKUP_LIMIT = 12;
const PRICE_LOOKUP_CONCURRENCY = 4;
const RESOLUTION_ORDER = ["240P", "SD", "HD", "FHD", "4K", "8K"];

const INSTRUCTIONS = [
    "Qwertystock is a royalty-free stock marketplace with photos, illustrations, vectors and videos.",
    "Search with search_media and look up one item by its ID with get_item.",
    "Previews are free and carry a watermark.",
    "These tools never buy anything: to get a full-resolution file, the user buys it themselves on the item page at qwertystock.com."
].join(" ");

// ---------------------------------------------------------------------------
// Tool definitions

const READ_ONLY = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
};

const TOOLS = [
    {
        name: "search_media",
        title: "Search Qwertystock",
        description: [
            "Search the Qwertystock catalog of royalty-free stock photos, illustrations, vectors and videos.",
            "Describe what should be in the picture or clip in any language: subject, action, setting, mood, style.",
            "Returns item IDs, titles, sizes, durations, formats with prices in USD, item page links and free watermarked",
            "preview links, plus small thumbnails of the first results so you can check them visually. Free and read-only."
        ].join(" "),
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "What to find, for example \"red convertible driving along the coast at sunset\". Any language."
                },
                type: {
                    type: "string",
                    enum: CONTENT_TYPES,
                    description: "Optional content type: photo, illustration, vector or video. Omit to search every type."
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: SEARCH_MAX_LIMIT,
                    description: `Number of results, 1-${SEARCH_MAX_LIMIT}. Default ${SEARCH_DEFAULT_LIMIT}.`
                },
                page: {
                    type: "integer",
                    minimum: 1,
                    description: "One-based result page for more results. Default 1."
                },
                mode: {
                    type: "string",
                    enum: ["standard", "semantic"],
                    description: "standard (default) matches titles, keywords and meaning; semantic ranks purely by visual and conceptual meaning, which helps for moods and abstract ideas."
                },
                thumbnails: {
                    type: "integer",
                    minimum: 0,
                    maximum: MAX_THUMBNAILS,
                    description: `How many thumbnails of the top results to attach as images, 0-${MAX_THUMBNAILS}. Default 4.`
                }
            },
            required: ["query"],
            additionalProperties: false
        },
        annotations: { title: "Search Qwertystock", ...READ_ONLY }
    },
    {
        name: "get_item",
        title: "Get a Qwertystock item",
        description: [
            "Look up one Qwertystock item by its numeric ID: title, description, keywords, size, duration,",
            "available formats with prices in USD, item page link, free watermarked preview link and a thumbnail.",
            "Free and read-only."
        ].join(" "),
        inputSchema: {
            type: "object",
            properties: {
                item_id: {
                    type: "integer",
                    minimum: 1,
                    description: "Qwertystock item ID, for example 3011233 from https://qwertystock.com/item?id=3011233."
                },
                thumbnail: {
                    type: "boolean",
                    description: "Attach the item's thumbnail as an image. Default true."
                }
            },
            required: ["item_id"],
            additionalProperties: false
        },
        annotations: { title: "Get a Qwertystock item", ...READ_ONLY }
    }
];

// ---------------------------------------------------------------------------
// Helpers

class ToolInputError extends Error {}

function log(...parts) {
    process.stderr.write(`[qwertystock] ${parts.join(" ")}\n`);
}

function oneLine(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value, max) {
    const text = oneLine(value);
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function formatUsd(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return Number.isInteger(number) ? `$${number}` : `$${number.toFixed(2)}`;
}

function toInteger(value, name, { min, max, fallback } = {}) {
    if (value === undefined || value === null || value === "") {
        if (fallback !== undefined) return fallback;
        throw new ToolInputError(`${name} is required.`);
    }
    const number = typeof value === "string" ? Number(value.trim()) : Number(value);
    if (!Number.isFinite(number) || !Number.isInteger(number)) throw new ToolInputError(`${name} must be a whole number.`);
    if (min !== undefined && number < min) throw new ToolInputError(`${name} must be at least ${min}.`);
    if (max !== undefined && number > max) throw new ToolInputError(`${name} must be at most ${max}.`);
    return number;
}

function linkedSignal(parent, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
    const onAbort = () => controller.abort(parent.reason);
    if (parent) {
        if (parent.aborted) controller.abort(parent.reason);
        else parent.addEventListener("abort", onAbort, { once: true });
    }
    return {
        signal: controller.signal,
        dispose() {
            clearTimeout(timer);
            if (parent) parent.removeEventListener("abort", onAbort);
        }
    };
}

async function apiRequest(method, path, { query, body, signal } = {}) {
    const url = new URL(path, API_ORIGIN);
    for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const headers = { "Accept": "application/json", "User-Agent": USER_AGENT };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const timeout = linkedSignal(signal, REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            redirect: "error",
            signal: timeout.signal
        });
        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        return { status: response.status, data };
    } catch (error) {
        if (signal?.aborted) throw error;
        throw new Error(`Could not reach Qwertystock (${error?.message || error}). Check the internet connection and try again.`);
    } finally {
        timeout.dispose();
    }
}

function describeApiFailure(result) {
    const data = result.data || {};
    if (result.status === 429) return "Qwertystock rate limit reached. Wait about a minute, then try again.";
    const detail = oneLine(data.error || data.message || data.status || "");
    return `Qwertystock API returned HTTP ${result.status}${detail ? `: ${detail}` : ""}.`;
}

function itemPageUrl(id) {
    return `${API_ORIGIN}/item?id=${encodeURIComponent(id)}`;
}

function previewUrl(item) {
    return item.type === "video"
        ? (item.video_preview_url || item.preview_url || item.thumbnail_url)
        : (item.preview_url || item.thumbnail_url);
}

function priceFor(item, format) {
    if (typeof item.prices === "number") return item.prices;
    if (item.prices && typeof item.prices === "object") {
        const value = item.prices[format];
        return typeof value === "number" ? value : undefined;
    }
    return undefined;
}

function formatsLine(item) {
    const formats = Array.isArray(item.formats) ? item.formats.slice() : [];
    if (formats.length === 0) return "";
    const rank = format => {
        const index = RESOLUTION_ORDER.indexOf(String(format).toUpperCase());
        return index === -1 ? RESOLUTION_ORDER.length : index;
    };
    const ordered = formats.map(format => ({ format, price: priceFor(item, format) }));
    ordered.sort((a, b) => ((a.price ?? Infinity) - (b.price ?? Infinity)) || (rank(a.format) - rank(b.format)));
    return ordered
        .map(({ format, price }) => (price === undefined ? format : `${format} ${formatUsd(price)}`))
        .join(" · ");
}

function describeItem(item, index) {
    const size = item.width && item.height ? `${item.width}×${item.height}` : "";
    const duration = item.duration ? `${Math.round(item.duration * 10) / 10} s` : "";
    const head = [`#${item.id}`, item.type, size, duration].filter(Boolean).join(" · ");
    const lines = [`${index === undefined ? "" : `${index}. `}${head} — ${truncate(item.title, 160)}`];

    const title = oneLine(item.title);
    const description = oneLine(item.description);
    if (description && description !== title) lines.push(`   ${truncate(description, 240)}`);

    const formats = formatsLine(item);
    if (item.metadata_only || item.is_on_sale === false) {
        lines.push("   Not available for purchase right now.");
    } else if (formats) {
        lines.push(`   Formats and prices (USD): ${formats}`);
    }
    lines.push(`   Item page (buy here): ${itemPageUrl(item.id)}`);
    const preview = previewUrl(item);
    if (preview) lines.push(`   Watermarked preview (free): ${preview}`);
    const keywords = Array.isArray(item.keywords) ? item.keywords.filter(Boolean).slice(0, 12) : [];
    if (keywords.length) lines.push(`   Keywords: ${keywords.map(oneLine).join(", ")}`);
    return lines.join("\n");
}

async function fetchThumbnail(url, signal) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== "https:") return null;

    const timeout = linkedSignal(signal, THUMBNAIL_TIMEOUT_MS);
    try {
        const response = await fetch(parsed, {
            headers: { "User-Agent": USER_AGENT, "Accept": "image/*" },
            signal: timeout.signal
        });
        if (!response.ok) return null;
        const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!THUMBNAIL_TYPES.has(mimeType)) return null;
        const declared = Number(response.headers.get("content-length") || 0);
        if (declared > THUMBNAIL_MAX_BYTES) return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > THUMBNAIL_MAX_BYTES) return null;
        return { mimeType, data: bytes.toString("base64") };
    } catch (error) {
        log(`thumbnail skipped: ${error?.message || error}`);
        return null;
    } finally {
        timeout.dispose();
    }
}

async function thumbnailBlocks(items, count, signal) {
    const picked = items.filter(item => item.thumbnail_url).slice(0, count);
    const images = await Promise.all(picked.map(item => fetchThumbnail(item.thumbnail_url, signal)));
    const blocks = [];
    picked.forEach((item, i) => {
        if (!images[i]) return;
        blocks.push({ type: "text", text: `Thumbnail of #${item.id}:` });
        blocks.push({ type: "image", data: images[i].data, mimeType: images[i].mimeType });
    });
    return blocks;
}

function textResult(text, extra = [], isError = false) {
    return { content: [{ type: "text", text }, ...extra], ...(isError ? { isError: true } : {}) };
}

// The free preview delivery also returns the item's public details and prices.
// It never charges anything and is called without credentials.
async function lookUpItem(itemId, signal) {
    const result = await apiRequest("POST", "/api/v1/download", {
        body: { item_id: itemId, format: "preview" },
        signal
    });
    const data = result.data || {};
    if (result.status === 200 && data.ok && data.item) return { item: data.item };
    if (result.status === 200 && data.status === "no_match") return { missing: true };
    throw new Error(describeApiFailure(result));
}

// Search results for some items, videos in particular, come without prices;
// the free item lookup has them. Fill in the first few, a handful at a time.
async function fillMissingPrices(items, signal) {
    const queue = items
        .filter(item => item.prices === undefined && !item.metadata_only && Array.isArray(item.formats) && item.formats.length > 0)
        .slice(0, PRICE_LOOKUP_LIMIT);
    const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
            try {
                const found = await lookUpItem(item.id, signal);
                if (found.item && found.item.prices !== undefined) item.prices = found.item.prices;
            } catch (error) {
                if (signal?.aborted) return;
                log(`price lookup for #${item.id} skipped: ${error?.message || error}`);
            }
        }
    };
    await Promise.all(Array.from({ length: PRICE_LOOKUP_CONCURRENCY }, worker));
}

// ---------------------------------------------------------------------------
// Tool implementations

async function searchMedia(args, signal) {
    const query = oneLine(args.query);
    if (!query) throw new ToolInputError("query is required: describe what the picture or clip should show.");
    if (query.length > 300) throw new ToolInputError("query is too long; keep it under 300 characters.");
    const type = args.type === undefined || args.type === null || args.type === "" ? undefined : String(args.type).toLowerCase();
    if (type !== undefined && !CONTENT_TYPES.includes(type)) {
        throw new ToolInputError(`type must be one of: ${CONTENT_TYPES.join(", ")}.`);
    }
    const limit = toInteger(args.limit, "limit", { min: 1, max: SEARCH_MAX_LIMIT, fallback: SEARCH_DEFAULT_LIMIT });
    const page = toInteger(args.page, "page", { min: 1, fallback: 1 });
    const thumbnails = toInteger(args.thumbnails, "thumbnails", { min: 0, max: MAX_THUMBNAILS, fallback: 4 });
    const mode = args.mode === undefined || args.mode === null || args.mode === "" ? "standard" : String(args.mode);
    if (mode !== "standard" && mode !== "semantic") throw new ToolInputError("mode must be standard or semantic.");

    const path = mode === "semantic" ? "/api/v1/search/semantic" : "/api/v1/search";
    const result = await apiRequest("GET", path, { query: { q: query, type, limit, page }, signal });
    const data = result.data || {};
    if (result.status !== 200 || !data.ok) return textResult(describeApiFailure(result), [], true);

    const items = Array.isArray(data.items) ? data.items : [];
    const scope = type ? ` among ${type}s` : "";
    if (items.length === 0) {
        return textResult(
            `No Qwertystock results for "${query}"${scope} on page ${page}. ` +
            "Try broader or different words, a more concrete scene, no type filter, or mode \"semantic\"."
        );
    }

    const [images] = await Promise.all([
        thumbnails > 0 ? thumbnailBlocks(items, thumbnails, signal) : Promise.resolve([]),
        fillMissingPrices(items, signal)
    ]);
    const header = `Qwertystock: ${items.length} result${items.length === 1 ? "" : "s"} for "${query}"${scope}, page ${page}. ` +
        "Prices are per download in USD; previews carry a watermark.";
    const body = items.map((item, i) => describeItem(item, (page - 1) * limit + i + 1)).join("\n\n");
    const unpriced = items.some(item => item.prices === undefined && Array.isArray(item.formats) && item.formats.length > 0);
    const note = unpriced ? "\n\nFor items listed without prices, get_item shows them." : "";
    const more = items.length >= limit ? `\n\nMore results: call search_media again with page ${page + 1}.` : "";
    return textResult(`${header}\n\n${body}${note}${more}`, images);
}

async function getItem(args, signal) {
    const itemId = toInteger(args.item_id, "item_id", { min: 1 });
    const wantThumbnail = args.thumbnail === undefined ? true : Boolean(args.thumbnail);
    const found = await lookUpItem(itemId, signal);
    if (found.missing) return textResult(`Qwertystock item #${itemId} was not found or is not available.`, [], true);
    const images = wantThumbnail ? await thumbnailBlocks([found.item], 1, signal) : [];
    return textResult(describeItem(found.item), images);
}

const HANDLERS = {
    search_media: searchMedia,
    get_item: getItem
};

// ---------------------------------------------------------------------------
// JSON-RPC over stdio

const inFlight = new Map();

function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
    send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
    send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function callTool(id, params) {
    const name = params?.name;
    const handler = Object.prototype.hasOwnProperty.call(HANDLERS, name) ? HANDLERS[name] : undefined;
    if (!handler) {
        replyError(id, -32602, `Unknown tool: ${name}`);
        return;
    }
    const controller = new AbortController();
    inFlight.set(id, controller);
    try {
        const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
        reply(id, await handler(args, controller.signal));
    } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof ToolInputError ? `Invalid input: ${error.message}` : (error?.message || String(error));
        if (!(error instanceof ToolInputError)) log(`${name} failed: ${message}`);
        reply(id, textResult(message, [], true));
    } finally {
        inFlight.delete(id);
    }
}

function handleMessage(message) {
    if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") return;
    if (typeof message.method !== "string") return;
    const isRequest = Object.prototype.hasOwnProperty.call(message, "id") && message.id !== null;
    const { id, method, params } = message;

    switch (method) {
        case "initialize": {
            const requested = params?.protocolVersion;
            const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0];
            reply(id, {
                protocolVersion,
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: SERVER_NAME, title: SERVER_TITLE, version: SERVER_VERSION },
                instructions: INSTRUCTIONS
            });
            return;
        }
        case "ping":
            if (isRequest) reply(id, {});
            return;
        case "tools/list":
            reply(id, { tools: TOOLS });
            return;
        case "tools/call":
            callTool(id, params);
            return;
        case "notifications/cancelled": {
            const controller = inFlight.get(params?.requestId);
            if (controller) controller.abort(new Error("cancelled"));
            return;
        }
        default:
            if (isRequest) replyError(id, -32601, `Method not found: ${method}`);
    }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", line => {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
        message = JSON.parse(text);
    } catch {
        send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        return;
    }
    for (const entry of Array.isArray(message) ? message : [message]) handleMessage(entry);
});
lines.on("close", () => process.exit(0));
process.on("unhandledRejection", error => log(`unhandled: ${error?.message || error}`));
