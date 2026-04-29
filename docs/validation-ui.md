# UI Validation Checklist (from test-cases.md)

Date: 2026-01-30

## Inspector
1. Auto-focus on selected node on startup (first root selected; inspector shows name/description).
2. Edit Name (L3) → PATCH `/nodes/{id}`; name updates after reload in tree + canvas.
3. Edit Description → inspector text updates.
4. Regular toggle → PATCH; Regular label updates in tree.

## Attributes
5. Change AS-IS (L3), enable Override if needed → PATCH `/nodes/{id}/attributes` 204; tile color updates after reload.
6. Change TO-BE аналогично п.5.
7. Roll-up: set AS-IS=RED on L3 with no parent override → after reload parents become RED.

## Navigation / Canvas
8. L0 only on start in Canvas.
9. Drill-down via Canvas (HR → Talent → Learning) shows only children of selected node.
10. Sync tree and breadcrumbs; clicking breadcrumb changes selection appropriately.
11. Home shows all L0; first root selected.
12. Ellipsis indicator visible for tiles with children.
13. Tile widths: L0 — 1=100%, 2=50%, 3=33%; inside tiles with odd count: last child full width.
14. Colors/themes readable in Light/Dark; L0 transparent with black text in light theme; readable indicator.
