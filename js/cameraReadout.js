/**
 * cameraReadout.js — The network-mode camera, in ggmira's mira_camera() terms.
 *
 * Shown only when MiRA is opened from R (started by rBridge), under the zoom
 * buttons: rotate and tilt in degrees, zoom relative to MiRA's fitted view,
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
const ANCHOR_ID = 'zoomInBtn';
const NETWORK_MODE = 'network';
const COPIED_MS = 1500;
// mira_camera() limits: the copied call is clamped to them
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
    return `mira_camera(rotate = ${round(rotate, ANGLE_DIGITS)}, tilt = ${round(tilt, ANGLE_DIGITS)}, ` +
        `zoom = ${round(zoomed, VIEW_DIGITS)}, pan = c(${x}, ${y}))`;
}

/** Show the readout and keep it current. @param getAppMode () => MiRA's mode */
export function startCameraReadout(renderer, getAppMode) {
    if (document.getElementById(READOUT_ID)) return;
    const box = document.createElement('div');
    box.id = READOUT_ID;
    box.style.cssText = 'position: absolute; z-index: 20; display: none; align-items: center; gap: 8px; ' +
        'padding: 3px 8px; font: 11px Inter, system-ui, sans-serif; color: #4b5563; ' +
        'background: rgba(255,255,255,0.92); border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; ' +
        'font-variant-numeric: tabular-nums;';
    const text = document.createElement('span');
    const copy = document.createElement('button');
    copy.textContent = 'Copy for R';
    copy.title = 'Copy the mira_camera() call for this view';
    copy.style.cssText = 'font: inherit; font-weight: 600; padding: 1px 6px; cursor: pointer; ' +
        'border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; background: #f9fafb; color: #374151;';
    box.append(text, copy);
    document.body.appendChild(box);

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
        box.style.display = visible ? 'flex' : 'none';
        if (!visible) return;
        const anchor = document.getElementById(ANCHOR_ID)?.getBoundingClientRect();
        if (anchor) {
            box.style.left = `${anchor.left}px`;
            box.style.top = `${anchor.bottom + 8}px`;
        }
        const values = cameraValues(renderer);
        const line = `rotate ${Math.round(values.rotate)}°  tilt ${Math.round(values.tilt)}°  ` +
            `zoom ${values.zoom.toFixed(2)}  pan ${values.pan.map(v => v.toFixed(2)).join(', ')}`;
        if (line === shown) return;
        shown = line;
        text.textContent = line;
        code = cameraCode(values);
        box.dataset.code = code;
    }, POLL_MS);
}

const round = (v, digits) => Number(v.toFixed(digits));

// (-180, 180]
function normalizeDegrees(deg) {
    const d = ((deg % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
}
