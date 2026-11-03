---- MODULE WorkflowCopy ----
EXTENDS Naturals
VARIABLES version, expected, adopted, snapshot, captured, edited, acceptedExpected, acceptedCurrent
vars == <<version,expected,adopted,snapshot,captured,edited,acceptedExpected,acceptedCurrent>>
Init == /\ version = 1 /\ expected \in {1,2} /\ adopted = FALSE /\ snapshot = 0 /\ captured = 0
        /\ edited = FALSE /\ acceptedExpected = 0 /\ acceptedCurrent = 0
Adopt == /\ ~adopted /\ adopted' = TRUE /\ snapshot' = version /\ captured' = version
         /\ UNCHANGED <<version,expected,edited,acceptedExpected,acceptedCurrent>>
OtherEdit == /\ version = 1 /\ version' = 2
             /\ UNCHANGED <<expected,adopted,snapshot,captured,edited,acceptedExpected,acceptedCurrent>>
Update == /\ ~edited /\ expected = version /\ edited' = TRUE /\ version' = 2
          /\ acceptedExpected' = expected /\ acceptedCurrent' = version
          /\ UNCHANGED <<expected,adopted,snapshot,captured>>
Next == Adopt \/ OtherEdit \/ Update
AdoptedCopyStable == adopted => snapshot = captured
VersionChecked == edited => acceptedExpected = acceptedCurrent
====
