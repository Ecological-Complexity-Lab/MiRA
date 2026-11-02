/**
 * Fit a Leaflet map to the layers' coordinates, clear of the panels drawn
 * over it (toolbar, side panels, legends, map controls), so no location is
 * hidden under them.
 */

// The panels over the map, and the side of the map each one covers
const COVERING_PANELS = [
    ['bottomBar', 'top'],
    ['controlPanels', 'left'],
    ['mapControlsFloat', 'bottom'],
    ['legendPanel', 'right'],
    ['mapLayerPanel', 'right'],
];
const MIN_FREE = 120; // px: below this free width or height, ignore the panels
const SAME_PLACE = 3; // decimals of a degree (~100 m): coordinates closer are one place

/** Distinct places among [lat, lng] pairs (numbers or numeric strings; others skipped). */
export function distinctPlaces(coords) {
    const places = new Map();
    for (const pair of coords) {
        if (pair.some(v => v == null || v === '')) continue;
        const [lat, lng] = pair.map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const key = `${lat.toFixed(SAME_PLACE)},${lng.toFixed(SAME_PLACE)}`;
        if (!places.has(key)) places.set(key, [lat, lng]);
    }
    return [...places.values()];
}

/**
 * Padding (px) per side of the map, from the panels' rectangles.
 * @param {{left, top, right, bottom, width, height}} mapRect
 * @param {{side: string, rect: {left, top, right, bottom, width, height}}[]} panels
 * @param {number} margin  px added on every side (e.g. the bubbles' extent)
 */
export function coveredPadding(mapRect, panels, margin) {
    const pad = { top: 0, left: 0, bottom: 0, right: 0 };
    for (const { side, rect } of panels) {
        if (!rect.width || !rect.height) continue; // hidden or empty
        if (side === 'top')    pad.top    = Math.max(pad.top,    rect.bottom - mapRect.top);
        if (side === 'left')   pad.left   = Math.max(pad.left,   rect.right - mapRect.left);
        if (side === 'bottom') pad.bottom = Math.max(pad.bottom, mapRect.bottom - rect.top);
        if (side === 'right')  pad.right  = Math.max(pad.right,  mapRect.right - rect.left);
    }
    const freeW = mapRect.width - pad.left - pad.right - 2 * margin;
    const freeH = mapRect.height - pad.top - pad.bottom - 2 * margin;
    if (freeW < MIN_FREE || freeH < MIN_FREE) return { top: margin, left: margin, bottom: margin, right: margin };
    for (const side of Object.keys(pad)) pad[side] = Math.max(0, pad[side]) + margin;
    return pad;
}

/**
 * One place: center on it at `singleZoom`. Several: fit them inside the part
 * of the map the panels leave free, `margin` px in from its edges.
 * @param {L.Map} map
 * @param {[number, number][]} coords  [lat, lng] per layer
 */
export function fitMapToCoords(map, coords, { margin = 30, singleZoom = 10 } = {}) {
    const places = distinctPlaces(coords);
    if (places.length === 0) return;
    if (places.length === 1) {
        map.setView(places[0], singleZoom);
        return;
    }
    const panels = [];
    for (const [id, side] of COVERING_PANELS) {
        const el = document.getElementById(id);
        if (el && getComputedStyle(el).display !== 'none') panels.push({ side, rect: el.getBoundingClientRect() });
    }
    const pad = coveredPadding(map.getContainer().getBoundingClientRect(), panels, margin);
    map.fitBounds(places, { paddingTopLeft: [pad.left, pad.top], paddingBottomRight: [pad.right, pad.bottom] });
}
