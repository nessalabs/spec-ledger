---- MODULE MutationRetry ----
EXTENDS Naturals
VARIABLES started, finished, runs, offered, accepted
vars == <<started,finished,runs,offered,accepted>>
Init == /\ started = FALSE /\ finished = FALSE /\ runs = 0 /\ offered \in {1,2} /\ accepted = 0
Execute == /\ ~started /\ started' = TRUE /\ runs' = 1 /\ UNCHANGED <<finished,offered,accepted>>
Finish == /\ started /\ ~finished /\ finished' = TRUE /\ UNCHANGED <<started,runs,offered,accepted>>
Replay == /\ started /\ finished /\ offered = 1 /\ accepted' = offered /\ UNCHANGED <<started,finished,runs,offered>>
Next == Execute \/ Finish \/ Replay
NoRepeatedEffect == runs <= 1
MatchingReplay == accepted # 0 => accepted = 1
====
