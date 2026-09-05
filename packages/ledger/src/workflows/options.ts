import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { loadLedger } from '../fs/load.js'
import { sourceFingerprint } from '../evidence/fingerprint.js'
import { permissionStatus } from '../permission/authority.js'
import { resolveWorkflow, selectedWorkflow } from './index.js'
import type { WorkflowProfile, WorkflowSnapshot } from './types.js'

function editable(snapshot: Pick<WorkflowSnapshot, 'stages' | 'profile'>): WorkflowProfile {
  return { id: snapshot.profile.source === 'default' ? 'my-workflow' : snapshot.profile.id, title: snapshot.profile.source === 'default' ? 'My workflow' : snapshot.profile.title,
    stages: snapshot.stages.map(stage => ({ ...stage, steps: stage.steps.map(step => ({ ...step, skill: step.skill.source === 'bundled' ? `spec-ledger/${step.skill.id}` : { path: step.skill.path!, ...(step.skill.capabilities.length ? { capabilities: step.skill.capabilities } : { acknowledgeUncertain: step.skill.uncertaintyAcknowledged }) } })) })) }
}

/** Path inventory only. Never follow symlinks or read arbitrary skill contents during discovery. */
export function workflowOptions(root: string, workstreamId: string) {
  const checkout = realpathSync(root), skills: string[] = []
  let visited = 0, truncated = false
  function walk(relative: string, depth: number) {
    const path = join(checkout, relative)
    if (!existsSync(path) || lstatSync(path).isSymbolicLink()) return
    if (++visited > 1000 || depth > 6 || skills.length >= 200) { truncated = true; return }
    if (lstatSync(path).isFile()) { if (relative.endsWith('/SKILL.md')) skills.push(relative); return }
    if (!lstatSync(path).isDirectory()) return
    for (const name of readdirSync(path).sort()) {
      if (visited >= 1000 || skills.length >= 200) { truncated = true; break }
      if (!name.startsWith('.')) walk(`${relative}/${name}`, depth + 1)
    }
  }
  // Check every ancestor before descent; a symlinked .agents directory must not escape discovery.
  for (const dir of ['skills', '.agents/skills', '.claude/skills']) {
    if (dir.split('/').some((_, i, parts) => { const p = join(checkout, ...parts.slice(0, i + 1)); return existsSync(p) && lstatSync(p).isSymbolicLink() })) continue
    walk(dir, 0)
  }
  const defaults = resolveWorkflow(root, workstreamId), selected = selectedWorkflow(root, workstreamId), permission = permissionStatus(root, workstreamId)
  return { workstreamId, profile: editable(selected ?? defaults), defaultProfile: editable(defaults), localSkills: skills, truncated,
    expectedRevisionDigest: permission.revisionDigest, expectedSourceDigest: sourceFingerprint(checkout, loadLedger(root).config.generatedArtifactPaths),
    expectedSnapshotDigest: selected?.snapshotDigest, permission }
}
export type WorkflowOptions = ReturnType<typeof workflowOptions>
