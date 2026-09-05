import { createLocalWorkflowBridge } from '@nessalabs/spec-ledger-client'
import { ledgerRootDir } from '@/lib/ledger'
export const dynamic = 'force-dynamic'
const workflows = createLocalWorkflowBridge(ledgerRootDir())
export const GET = workflows
export const POST = workflows
