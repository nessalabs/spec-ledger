#!/usr/bin/env node
import { resolve } from "node:path"
import { createLedgerServer } from "./routes.js"

const root = resolve(process.argv[2] ?? process.cwd())
const port = Number(process.env.PORT ?? 8787)
const server = createLedgerServer(root, port)
await server.listen()
console.log(`spec-ledger-serve (read-only) on http://127.0.0.1:${port} root=${root}`)
