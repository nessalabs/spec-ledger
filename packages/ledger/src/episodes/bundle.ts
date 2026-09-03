import { listAttachmentsForTurn, listDecisionsForTurn, listFlowsForTurn, listProbesForTurn, listSourcesForTurn } from "../episodes/load.js"
import { listReviewsForTurn } from "../reviews/load.js"
import type {
  EpisodeAttachment,
  EpisodeDecision,
  EpisodeFlow,
  EpisodeProbe,
  EpisodeSource,
  Review,
  Turn,
} from "../types.js"
import { loadLedger } from "../fs/load.js"

export interface TurnEpisode {
  turn: Turn
  decisions: EpisodeDecision[]
  sources: EpisodeSource[]
  attachments: EpisodeAttachment[]
  probes: EpisodeProbe[]
  flows: EpisodeFlow[]
  reviews: Review[]
}

export function getTurnEpisode(repoRootInput: string, turnId: string): TurnEpisode {
  const ledger = loadLedger(repoRootInput)
  const turn = ledger.turns.find((t) => t.id === turnId)
  if (!turn) throw new Error(`turn not found: ${turnId}`)
  return {
    turn,
    decisions: listDecisionsForTurn(repoRootInput, turnId),
    sources: listSourcesForTurn(repoRootInput, turnId),
    attachments: listAttachmentsForTurn(repoRootInput, turnId),
    probes: listProbesForTurn(repoRootInput, turnId),
    flows: listFlowsForTurn(repoRootInput, turnId),
    reviews: listReviewsForTurn(repoRootInput, turnId),
  }
}
