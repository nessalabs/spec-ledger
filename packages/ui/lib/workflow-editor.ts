import type { WorkflowProfile } from '@nessalabs/spec-ledger-client'
const roles = ['plan', 'spec-review', 'implement', 'verify', 'code-review']
const kinds = ['spec-revision', 'spec-review', 'implementation-report', 'check-results', 'code-review', 'attestation']
const text = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000
/** Rendering validation only; shared operations still own semantic validation. */
export function parseWorkflowDraft(contents: string): WorkflowProfile {
  if (contents.length > 131072) throw Error('Workflow file is too large.')
  const p = JSON.parse(contents)
  if (!p || !text(p.id) || !text(p.title) || !Array.isArray(p.stages) || p.stages.length < 1 || p.stages.length > 20 || p.stages.some((stage: any) =>
    !stage || !text(stage.id) || !text(stage.title) || !roles.includes(stage.role) || !Array.isArray(stage.steps) || stage.steps.length < 1 || stage.steps.length > 20 || stage.steps.some((step: any) =>
      !step || !text(step.id) || !text(step.title) || !(text(step.skill) || (step.skill && text(step.skill.path) && (step.skill.capabilities === undefined || (Array.isArray(step.skill.capabilities) && step.skill.capabilities.every((kind: unknown) => kinds.includes(kind as string)))))) || !Array.isArray(step.outputs) || step.outputs.length < 1 || step.outputs.length > 6 || step.outputs.some((output: any) => !output || !kinds.includes(output.kind) || (output.criterionIds !== undefined && (!Array.isArray(output.criterionIds) || !output.criterionIds.every(text))))))) throw Error('Import a full workflow with valid stages, steps, skills and required results.')
  return p
}
