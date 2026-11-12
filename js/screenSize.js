/**
 * screenSize.js — a warning when the window is too small for MiRA.
 *
 * Below MIN_WIDTH × MIN_HEIGHT CSS pixels (browser zoom counts) the toolbar
 * squeezes its buttons and the menu panels run off the screen. A small
 * notice says so, on the website and when opened from R; it goes away when
 * the window is large enough, and once closed it stays closed for the
 * browser session. Not shown in ggmira's mira_save() (?save=true), which
 * draws in a headless window.
 *
 * ggmira adds ?pane=rstudio when it opens MiRA in RStudio's Viewer pane, for
 * a hint about the pane.
 *
 * Exports:
 *   - initScreenSizeWarning()   call once during app init
 *   - isTooSmall(width, height)
 */

export const MIN_WIDTH = 1024;
export const MIN_HEIGHT = 600;
const NOTICE_ID = 'screenSizeNotice';
const DISMISSED_KEY = 'mira_screenSizeNoticeDismissed';
const RESIZE_DELAY_MS = 250;

export const isTooSmall = (width, height) => width < MIN_WIDTH || height < MIN_HEIGHT;

const storage = {
    dismissed: () => { try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; } },
    dismiss: () => { try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage blocked */ } },
};

export function initScreenSizeWarning() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('save') === 'true') return;
    const inRStudioPane = params.get('pane') === 'rstudio';

    let closed = storage.dismissed();
    const update = () => {
        const tooSmall = isTooSmall(window.innerWidth, window.innerHeight);
        const notice = document.getElementById(NOTICE_ID);
        if (!tooSmall || closed) {
            notice?.remove();
            return;
        }
        (notice ?? showNotice(inRStudioPane, () => {
            closed = true;
            storage.dismiss();
        })).querySelector('.screen-size-notice-size').textContent =
            `${window.innerWidth} × ${window.innerHeight}`;
    };

    let timer = null;
    window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(update, RESIZE_DELAY_MS);
    });
    update();
}

function showNotice(inRStudioPane, onClose) {
    const box = document.createElement('div');
    box.id = NOTICE_ID;
    box.className = 'screen-size-notice';
    box.setAttribute('role', 'status');

    const close = document.createElement('button');
    close.className = 'screen-size-notice-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => {
        box.remove();
        onClose();
    });

    const heading = document.createElement('strong');
    heading.textContent = 'This window is small for MiRA';

    const text = document.createElement('p');
    const size = document.createElement('span');
    size.className = 'screen-size-notice-size';
    const fix = inRStudioPane
        ? ' Maximize the Viewer pane, or open MiRA in the browser with the pane\'s "Show in new window" button.'
        : ' Enlarge the window, or zoom out (Ctrl or ⌘ and −).';
    text.append(`MiRA needs at least ${MIN_WIDTH} × ${MIN_HEIGHT} pixels; this window is `, size,
        '. Some buttons and panels may be cut off.' + fix);

    box.append(close, heading, text);
    document.body.appendChild(box);
    return box;
}
