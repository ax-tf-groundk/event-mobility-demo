import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogPath = join(root, "config", "public-data-apis.json");
const outputDir = join(root, "public-data");
const serviceKey = process.env.PUBLIC_DATA_SERVICE_KEY;

const now = new Date();

if (!serviceKey) {
  console.log(
    JSON.stringify(
      {
        status: "skipped",
        reason: "PUBLIC_DATA_SERVICE_KEY is not configured. No snapshot was written.",
      },
      null,
      2
    )
  );
  process.exit(0);
}

function kstDate(offsetDays = 0) {
  const date = new Date(now.getTime() + (9 * 60 * 60 + offsetDays * 24 * 60 * 60) * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function runtimeDefaults(operationId) {
  const defaults = {};

  if (operationId === "get_station_passenger_counts") {
    defaults.pasngYmd = kstDate(-1);
    defaults.stnNm = "삼성";
  }

  if (operationId === "get_passenger_arrivals" || operationId === "get_passenger_departures") {
    defaults.searchday = kstDate(0);
    defaults.from_time = "0000";
    defaults.to_time = "2359";
  }

  return defaults;
}

function buildParams(operation) {
  const params = {
    ...(operation.defaultParams || {}),
    ...runtimeDefaults(operation.id),
  };

  if (serviceKey) {
    params.serviceKey = serviceKey;
  }

  const missing = operation.requiredParams.filter((name) => {
    const value = params[name];
    return value == null || value === "";
  });

  return { params, missing };
}

function buildUrl(baseUrl, path, params) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function redactUrl(url) {
  const redacted = new URL(url);
  if (redacted.searchParams.has("serviceKey")) {
    redacted.searchParams.set("serviceKey", "[REDACTED]");
  }
  return redacted.toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      return { format: "json", data: JSON.parse(text) };
    } catch {
      return { format: "text", data: text.slice(0, 5000) };
    }
  }

  return { format: "text", data: text.slice(0, 5000) };
}

function summarizePayload(parsed) {
  if (parsed.format !== "json" || parsed.data == null) {
    return { itemCount: null, totalCount: null, resultCode: null, resultMsg: null };
  }

  const header = parsed.data.response?.header || parsed.data.header || {};
  const body = parsed.data.response?.body || parsed.data.body || {};
  const items = body.items?.item || body.items || [];
  const normalizedItems = Array.isArray(items) ? items : items ? [items] : [];

  return {
    itemCount: normalizedItems.length,
    totalCount: body.totalCount ?? null,
    resultCode: header.resultCode ?? null,
    resultMsg: header.resultMsg ?? null,
  };
}

function payloadItems(parsed) {
  if (parsed.format !== "json" || parsed.data == null) return [];
  const body = parsed.data.response?.body || parsed.data.body || {};
  const items = body.items?.item || body.items || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function replacePayloadItems(parsed, items) {
  const body = parsed.data.response?.body || parsed.data.body;
  if (!body) return;
  if (body.items && !Array.isArray(body.items) && Object.prototype.hasOwnProperty.call(body.items, "item")) {
    body.items.item = items;
  } else {
    body.items = items;
  }
}

async function collectOperation(dataset, operation) {
  const { params, missing } = buildParams(operation);

  if (missing.length > 0) {
    return {
      datasetId: dataset.id,
      operationId: operation.id,
      status: "skipped",
      reason: `Missing required params: ${missing.join(", ")}`,
    };
  }

  const url = buildUrl(dataset.baseUrl, operation.path, params);
  const startedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      },
    });
    const parsed = await parseResponse(response);
    const firstSummary = summarizePayload(parsed);

    if (response.ok && operation.paginate && parsed.format === "json") {
      const pageSize = Math.max(1, Number(params.numOfRows) || firstSummary.itemCount || 100);
      const totalPages = Math.min(
        Number(operation.maxPages) || 1,
        Math.ceil((Number(firstSummary.totalCount) || firstSummary.itemCount || 0) / pageSize)
      );
      const combinedItems = payloadItems(parsed);

      for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
        const pageUrl = buildUrl(dataset.baseUrl, operation.path, { ...params, pageNo: String(pageNo) });
        const pageResponse = await fetch(pageUrl, {
          headers: {
            accept: "application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          },
        });
        if (!pageResponse.ok) break;
        const pageParsed = await parseResponse(pageResponse);
        combinedItems.push(...payloadItems(pageParsed));
      }

      replacePayloadItems(parsed, combinedItems);
    }

    return {
      datasetId: dataset.id,
      operationId: operation.id,
      status: response.ok ? "ok" : "http_error",
      httpStatus: response.status,
      requestedAt: startedAt,
      source: redactUrl(url),
      summary: summarizePayload(parsed),
      payload: parsed,
    };
  } catch (error) {
    return {
      datasetId: dataset.id,
      operationId: operation.id,
      status: "fetch_error",
      requestedAt: startedAt,
      source: redactUrl(url),
      error: error.message,
    };
  }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const results = [];

for (const dataset of catalog.datasets) {
  for (const operation of dataset.operations) {
    results.push(await collectOperation(dataset, operation));
  }
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  serviceKeyConfigured: Boolean(serviceKey),
  results,
};

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const summary = results.reduce(
  (acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  },
  {}
);

console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, summary }, null, 2));
