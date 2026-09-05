/**
 * Next's client-boundary transform rejects star exports. The Nessa UI bundle
 * includes two compatibility re-exports that this app does not consume, so
 * remove only those declarations while preserving its named component API.
 */
module.exports = function nessaUiClientEntry(source) {
  return source.replace(
    /^export \* from ['"]@nessalabs\/agent-stream(?:\/transcript)?['"];?\r?\n/gm,
    "",
  )
}
