# Saved workflow browser verification

Verified during T-044 against an agent-created disposable repository served by the local UI bridge. The normal workspace was used only for viewing the builder.

- Saved a named workflow and selected it as normal.
- Selected that workflow independently for two specs through their in-page Workflow tabs.
- Opened the dedicated editor from the library. Renamed the workflow in its settings drawer, selected the coding stage on the canvas, changed its title in the stage drawer, closed the drawer, previewed and saved with a reason.
- Read both adopted workflow projections before and after the edit: their complete preserved projections were identical.
- Deleted the disposable library record through the shared mutation operation. Both projections remained identical; the normal pointer fell back to the bundled workflow.
- The spec's Workflow tab showed its original workflow name, original version, “Deleted from library,” and the explanation that the spec still uses its preserved copy.
- Inspected the full-view canvas and stage drawer at desktop and 390 × 844. The drawer remained usable without horizontal clipping, and closing it returned to the full canvas. No browser errors were reported.

The builder uses the Nessa UI workflow canvas and drawer components. Connections show linear execution order; stage settings control steps and required results. Validation and writes go through the shared local operations.
