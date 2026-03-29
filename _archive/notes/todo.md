# Feature TODO

Planned improvements and missing functionality.

---

## FEAT-01 — Pan (drag to move view) is missing

**Area:** `multilayer_viz/js/interaction.js`

**Problem:**
The user can zoom in/out and rotate the network, but cannot pan — there is no way
to drag the canvas to move the view horizontally or vertically. Once zoomed in,
parts of the network can go off-screen with no way to reach them.

**Expected behaviour:**
- Click and drag on empty canvas space → moves the entire view (pan)
- Should work alongside the existing zoom (scroll wheel) and rotation (drag on layer)
- Middle-mouse-button drag is a common alternative pan binding

**Notes:**
- The planned replacement for `interaction.js` is the `panzoom` library (see CLAUDE.md)
- Implementing pan manually is an option but investing in panzoom may be smarter
