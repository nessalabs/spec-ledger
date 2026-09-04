import { createLocalApprovalBridge } from "@nessalabs/spec-ledger-client"
import { ledgerRootDir } from "@/lib/ledger"

export const dynamic = "force-dynamic"
const approval = createLocalApprovalBridge(ledgerRootDir())
export const GET = approval
export const POST = approval
