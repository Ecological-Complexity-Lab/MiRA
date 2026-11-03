/**
 * cameraReadout.js — The network-mode camera, in ggmira's mira_camera() terms.
 *
 * Shown only when MiRA is opened from R (started by rBridge), as a small box
 * right of the menu panels, before the alerts: rotate and tilt in degrees, zoom relative to MiRA's fitted view,
 * pan as fractions of the window. "Copy for R" copies the mira_camera() call
 * that gives the current view, so a view set with the mouse can go into an
 * R script.
 *
 * Zoom and pan are measured against the fit at the current angles, which is
 * how rBridge applies them (fit, zoom about the canvas center, then pan), so
 * the values round-trip. Per-layer drags (Cmd+drag) are not part of the
 * camera. The readout polls the renderer instead of hooking the mouse and
 * button handlers, so no existing code changes.
 */

const DEGREES = Math.PI / 180;
const POLL_MS = 250;
const READOUT_ID = 'cameraReadout';
const OVERLAYS_ID = 'canvasOverlays'; // index.html: the row under the bar, right of the menu panels
const NETWORK_MODE = 'network';
const COPIED_MS = 1500;
// mira_camera() limits: the copied call is clamped to them (the mouse can
// tilt a little past 45°)
const TILT_MAX = 45;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;
const PAN_MAX = 1;
// Digits in the copied call: enough that the view comes back within a pixel
// (0.01 of pan is 14 px on a 1400 px window; 1° of rotation moves the far
// layers by several pixels). The line on screen stays rounded.
const ANGLE_DIGITS = 1;
const VIEW_DIGITS = 3;

/**
 * The camera of `renderer` as mira_camera() values.
 * Calls renderer.centerView() to find the fit and puts the view back, without
 * rendering in between.
 * @returns {{ rotate: number, tilt: number, zoom: number, pan: [number, number] }}
 */
export function cameraValues(renderer) {
    const { scale, offsetX, offsetY } = renderer;
    renderer.centerView();
    const fit = { scale: renderer.scale, offsetX: renderer.offsetX, offsetY: renderer.offsetY };
    Object.assign(renderer, { scale, offsetX, offsetY });

    const dpr = renderer.dpr || 1;
    const width = renderer.canvas.width / dpr;
    const height = renderer.canvas.height / dpr;
    const zoom = scale / fit.scale;
    // Where the fitted view lands after zooming about the center (rBridge applyCameraView)
    const zoomedX = width / 2 - (width / 2 - fit.offsetX) * zoom;
    const zoomedY = height / 2 - (height / 2 - fit.offsetY) * zoom;
    return {
        rotate: normalizeDegrees(renderer.skewX / DEGREES),
        tilt: renderer.skewY / DEGREES,
        zoom,
        pan: [(offsetX - zoomedX) / width, -(offsetY - zoomedY) / height], // positive y = up
    };
}

/** The mira_camera() call for `values`, within mira_camera()'s limits. */
export function cameraCode({ rotate, tilt, zoom, pan }) {
    const clamp = (v, max) => Math.max(-max, Math.min(max, v));
    const zoomed = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    const [x, y] = pan.map(v => round(clamp(v, PAN_MAX), VIEW_DIGITS));
    return `mira_camera(rotate = ${round(rotate, ANGLE_DIGITS)}, tilt = ${round(clamp(tilt, TILT_MAX), ANGLE_DIGITS)}, ` +
        `zoom = ${round(zoomed, VIEW_DIGITS)}, pan = c(${x}, ${y}))`;
}

/** The line shown on screen for `values`: rounded, never "-0". */
export function cameraLine({ rotate, tilt, zoom, pan }) {
    return `rotate ${fixed(rotate, 0)}°  tilt ${fixed(tilt, 0)}°  ` +
        `zoom ${fixed(zoom, 2)}  pan ${pan.map(v => fixed(v, 2)).join(', ')}`;
}

/** The readout's rows for `values`, rounded as cameraLine: [[label, value], ...]. */
export function cameraRows({ rotate, tilt, zoom, pan }) {
    return [
        ['rotate', `${fixed(rotate, 0)}°`],
        ['tilt', `${fixed(tilt, 0)}°`],
        ['zoom', fixed(zoom, 2)],
        ['pan', pan.map(v => fixed(v, 2)).join(', ')],
    ];
}

/** Show the readout and keep it current. @param getAppMode () => MiRA's mode */
export function startCameraReadout(renderer, getAppMode) {
    if (document.getElementById(READOUT_ID)) return;
    const box = document.createElement('div');
    box.id = READOUT_ID;
    box.style.cssText = 'display: none; grid-template-columns: auto auto; gap: 1px 8px; ' +
        'padding: 6px 8px; font: 11px Inter, system-ui, sans-serif; color: #4b5563; ' +
        'background: rgba(255,255,255,0.92); border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; ' +
        'font-variant-numeric: tabular-nums;';
    const text = document.createElement('div');
    text.style.cssText = 'display: contents;';
    const copy = document.createElement('button');
    copy.textContent = 'Copy for R';
    copy.title = 'Copy the mira_camera() call for this view';
    copy.style.cssText = 'font: inherit; font-weight: 600; padding: 1px 6px; cursor: pointer; ' +
        'border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; background: #f9fafb; color: #374151; ' +
        'grid-column: 1 / -1; margin-top: 4px;';
    box.append(text, copy);
    const overlays = document.getElementById(OVERLAYS_ID);
    if (overlays) overlays.prepend(box);
    else document.body.appendChild(box);

    let code = '';
    copy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            copy.textContent = 'Copied';
        } catch {
            copy.textContent = 'Copy failed';
        }
        setTimeout(() => { copy.textContent = 'Copy for R'; }, COPIED_MS);
    });

    let shown = '';
    setInterval(() => {
        const visible = getAppMode() === NETWORK_MODE && renderer.model;
        box.style.display = visible ? 'grid' : 'none';
        if (!visible) return;
        const values = cameraValues(renderer);
        code = cameraCode(values); // every tick: a change too small for the line still copies
        const line = cameraLine(values);
        if (line === shown) return;
        shown = line;
        text.replaceChildren(...cameraRows(values).flatMap(([label, value]) => {
            const name = document.createElement('span');
            name.textContent = label;
            name.style.color = '#9ca3af';
            const num = document.createElement('span');
            num.textContent = value;
            num.style.textAlign = 'right';
            return [name, num];
        }));
        box.title = line;
    }, POLL_MS);
}

const round = (v, digits) => Number(v.toFixed(digits));

// toFixed without "-0" / "-0.00"
function fixed(v, digits) {
    const s = v.toFixed(digits);
    return Number(s) === 0 ? (0).toFixed(digits) : s;
}

// (-180, 180]
function normalizeDegrees(deg) {
    const d = ((deg % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
}
