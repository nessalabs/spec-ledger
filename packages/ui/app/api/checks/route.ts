import { createLocalCheckBridge } from '@nessalabs/spec-ledger-client'
import { ledgerRootDir } from '@/lib/ledger'

export const dynamic = 'force-dynamic'
const checks = createLocalCheckBridge(ledgerRootDir())
export const GET = checks
export const POST = checks
