---- MODULE EvidenceFreshness ----
EXTENDS Naturals
VARIABLES source, check, artifact, evaluated, passed, atSource, atCheck, atArtifact
vars == <<source,check,artifact,evaluated,passed,atSource,atCheck,atArtifact>>
Init == /\ source \in {1,2} /\ check \in {1,2} /\ artifact \in BOOLEAN
        /\ evaluated = FALSE /\ passed = FALSE /\ atSource = 0 /\ atCheck = 0 /\ atArtifact = FALSE
Evaluate == /\ ~evaluated /\ evaluated' = TRUE
            /\ passed' = (source = 1 /\ check = 1 /\ artifact)
            /\ atSource' = source /\ atCheck' = check /\ atArtifact' = artifact
            /\ UNCHANGED <<source,check,artifact>>
Next == Evaluate
CurrentSource == passed => atSource = 1
CurrentCheck == passed => atCheck = 1
ArtifactIntact == passed => atArtifact
====
