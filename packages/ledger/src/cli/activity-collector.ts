#!/usr/bin/env node
import { resolve } from "node:path"
import { findRepoRoot, loadLedger, recordExecutionActivity } from "../index.js"

const MAX_FRAME_BYTES = 16 * 1024
function configuredRoot(args:string[]):string {
  if(args.length!==2||args[0]!=="--root"||!args[1])throw new Error("usage: spec-ledger-activity --root /absolute/checkout")
  return findRepoRoot(resolve(args[1]))
}

try {
  const root=configuredRoot(process.argv.slice(2));loadLedger(root);let pending=Buffer.alloc(0);let discarding=false;let diagnostics=0
  process.stdin.on("data",(chunk:Buffer)=>{
    pending=Buffer.concat([pending,chunk])
    for(;;){
      const newline=pending.indexOf(10)
      if(newline<0){if(pending.byteLength>MAX_FRAME_BYTES){pending=Buffer.alloc(0);discarding=true}break}
      const frame=pending.subarray(0,newline);pending=pending.subarray(newline+1)
      if(discarding){discarding=false;continue}
      if(!frame.byteLength||frame.byteLength>MAX_FRAME_BYTES)continue
      try{const input=JSON.parse(frame.toString("utf8"));recordExecutionActivity(root,input)}catch{if(diagnostics<5){diagnostics+=1;process.stderr.write("Activity frame rejected; delivery remains best effort.\n")}}
    }
  })
} catch(error) {
  process.stderr.write(`${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1
}
