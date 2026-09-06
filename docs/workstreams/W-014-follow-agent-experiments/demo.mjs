// Synthetic demonstration only. Prints a temporary ledger root; never writes the real ledger.
import { optimizationFixture } from '../../../packages/ledger/dist/optimization/optimization.fixture.js'
const f = optimizationFixture()
const goal = { id: 'G-demo-speed', workstreamId: 'W-001', turnId: 'T-001', title: 'Demo · Make evaluation faster', objective: 'Find a faster evaluation path while preserving every output. Keep only candidates that pass the separate output comparison.', stopWhen: 'A safe candidate is below 100 ms, or after eight experiments.', maxExperiments: 8, metric: { name: 'Evaluation time', unit: 'ms', direction: 'minimize', protocol: 'Synthetic example: median of 20 runs on the same 100 cases and worker. Output equivalence is evaluated separately.', baseline: 240, target: 100 } }
f.call('create_goal', { goal })
const attempts = [
  ['parse', 'Repeated parsing dominates the runtime.', 'Reuse parsed inputs within one evaluation.', 182, 'kept', '28% faster. All outputs matched; keep the local parsing cache.'],
  ['batch', 'Batching small operations reduces overhead.', 'Evaluate inputs in groups of 16.', 146, 'kept', 'Batching improves throughput without output changes.'],
  ['workers', 'More workers will improve latency.', 'Try four workers instead of one.', null, 'inconclusive', 'Worker startup exceeded the time budget. No valid measurement.'],
  ['skip', 'Skipping repeated validation removes redundant work.', 'Reuse validation across all input variants.', 78, 'discarded', 'Fastest candidate, but two output mismatches. Discard this change.'],
  ['scoped', 'A narrower cache can preserve the speedup safely.', 'Key the cache by the full input variant.', 112, 'kept', 'Safe improvement: every output matched. Target is still unmet by a kept candidate.'],
  ['reuse', 'Reusing buffers can remove the remaining allocations.', 'Pool temporary buffers within a single evaluation.', undefined, undefined, undefined],
]
for (let i=0; i<attempts.length; i++) {
 const [id,hypothesis,change,measurement,decision,findings]=attempts[i]
 f.call('start_experiment', { experiment: {id:`X-${id}`,goalId:goal.id,turnId:'T-001',hypothesis,change,...(id==='scoped'?{parentExperimentId:'X-skip'}:{})} })
 if (decision) f.call('record_experiment_result', { result: {goalId:goal.id,experimentId:`X-${id}`,turnId:'T-001',status:measurement===null?'failed':'completed',decision,findings,...(typeof measurement==='number'?{measurement}:{}),evidenceRefs:[`demo/evaluation/${id}.json (synthetic)`]} })
}
f.call('create_goal', {goal: {id:'G-demo-qualitative',workstreamId:'W-001',turnId:'T-001',title:'Demo · Make instructions clearer',objective:'Find wording that helps readers finish without guessing.',stopWhen:'Three readers can follow the instructions unaided.',maxExperiments:5}})
f.call('start_experiment',{experiment:{id:'X-rewrite',goalId:'G-demo-qualitative',turnId:'T-001',hypothesis:'An example will clarify the expected input.',change:'Add a concrete input and output pair.'}})
f.call('record_experiment_result',{result:{goalId:'G-demo-qualitative',experimentId:'X-rewrite',turnId:'T-001',status:'completed',decision:'kept',findings:'Synthetic observation: readers understood the input format; the error recovery section still needs work.'}})
f.call('create_goal', {goal: {id:'G-demo-empty',workstreamId:'W-001',turnId:'T-001',title:'Demo · Improve retrieval quality',objective:'Explore retrieval strategies on a fixed test set.',stopWhen:'Recall reaches 0.9 or after five attempts.',maxExperiments:5,metric:{name:'Recall',unit:'',direction:'maximize',protocol:'Synthetic fixed test set.',target:0.9}}})
console.log(f.root)
