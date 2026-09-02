/**
 * SL-003: read-only routes only. No POST/PUT/PATCH/DELETE that mutate the ledger.
 * Git is the write path.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import {
  loadLedger,
  verifyLedger,
  blastRadius,
  layerViolations,
  snapshotLedger,
  listSchemaFiles,
  readSchemaFile,
  HTTP_CONTRACT,
} from "@nessa/spec-ledger"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>

export interface Route {
  method: "GET"
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(data)
}

export function buildRoutes(rootDir: string): Route[] {
  return [
    {
      method: "GET",
      pattern: /^\/v1\/health$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, { ok: true }),
    },
    {
      method: "GET",
      pattern: /^\/v1\/contract$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, { routes: HTTP_CONTRACT }),
    },
    {
      method: "GET",
      pattern: /^\/v1\/snapshot$/,
      paramNames: [],
      handler: (_req, res) => {
        const snap = snapshotLedger(loadLedger(rootDir))
        sendJson(res, snap.report.ok ? 200 : 409, snap)
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/config$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, loadLedger(rootDir).config),
    },
    {
      method: "GET",
      pattern: /^\/v1\/claims$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, loadLedger(rootDir).claims),
    },
    {
      method: "GET",
      pattern: /^\/v1\/bindings$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, loadLedger(rootDir).bindings),
    },
    {
      method: "GET",
      pattern: /^\/v1\/turns$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, loadLedger(rootDir).turns),
    },
    {
      method: "GET",
      pattern: /^\/v1\/turns\/([^/]+)$/,
      paramNames: ["id"],
      handler: (_req, res, params) => {
        const turn = loadLedger(rootDir).turns.find((t) => t.id === params.id)
        if (!turn) {
          sendJson(res, 404, { error: "turn not found" })
          return
        }
        sendJson(res, 200, turn)
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/policy$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, loadLedger(rootDir).policy),
    },
    {
      method: "GET",
      pattern: /^\/v1\/graph$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, loadLedger(rootDir).graph),
    },
    {
      method: "GET",
      pattern: /^\/v1\/verify$/,
      paramNames: [],
      handler: (_req, res) => {
        const report = verifyLedger(loadLedger(rootDir))
        sendJson(res, report.ok ? 200 : 409, report)
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/report$/,
      paramNames: [],
      handler: (_req, res) => {
        const ledger = loadLedger(rootDir)
        const path = join(ledger.rootDir, ledger.config.reportPath ?? "results/report.json")
        if (!existsSync(path)) {
          sendJson(res, 404, { error: "no report; run GET /v1/verify first" })
          return
        }
        sendJson(res, 200, JSON.parse(readFileSync(path, "utf8")))
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/impact\/([^/]+)$/,
      paramNames: ["nodeId"],
      handler: (_req, res, params) => {
        const ledger = loadLedger(rootDir)
        if (!ledger.graph) {
          sendJson(res, 404, { error: "no graph" })
          return
        }
        sendJson(res, 200, {
          nodeId: params.nodeId,
          ...blastRadius(ledger.graph, params.nodeId),
        })
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/layers\/violations$/,
      paramNames: [],
      handler: (_req, res) => {
        const ledger = loadLedger(rootDir)
        if (!ledger.graph || !ledger.policy) {
          sendJson(res, 200, [])
          return
        }
        sendJson(res, 200, layerViolations(ledger.graph, ledger.policy.allow))
      },
    },
    {
      method: "GET",
      pattern: /^\/v1\/schemas$/,
      paramNames: [],
      handler: (_req, res) => sendJson(res, 200, listSchemaFiles(rootDir)),
    },
    {
      method: "GET",
      pattern: /^\/v1\/schemas\/([^/]+)$/,
      paramNames: ["name"],
      handler: (_req, res, params) => {
        try {
          sendJson(res, 200, readSchemaFile(rootDir, params.name))
        } catch (e) {
          sendJson(res, 404, { error: e instanceof Error ? e.message : "not found" })
        }
      },
    },
  ]
}

/** Only GET is registered. Anything else → 405. */
export function createLedgerServer(rootDir: string, port = 8787) {
  const routes = buildRoutes(rootDir)
  const server = createServer(async (req, res) => {
    const method = req.method ?? "GET"
    if (method !== "GET") {
      sendJson(res, 405, {
        error: "read-only server (SL-003): no write endpoints",
      })
      return
    }
    const url = new URL(req.url ?? "/", `http://127.0.0.1`)
    for (const route of routes) {
      const m = url.pathname.match(route.pattern)
      if (!m) continue
      const params: Record<string, string> = {}
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1] ?? "")
      })
      await route.handler(req, res, params)
      return
    }
    sendJson(res, 404, { error: "not found" })
  })
  return {
    listen: () =>
      new Promise<void>((resolve) => {
        server.listen(port, "127.0.0.1", () => resolve())
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
    port,
  }
}
