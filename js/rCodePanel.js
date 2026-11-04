/**
 * rCodePanel.js — The "Copy as R code" panel: the ggmira code for the
 * current view (rCode.js specToR), colored by element as ggmira's
 * mira_options() colors them, with what R cannot set as comments below,
 * and a Copy button. Opened by the R button (rBridge, MiRA opened from R).
 */

const PANEL_ID = 'rCodePanel';
const COPIED_MS = 1500;
const COPY_LABEL = 'Copy';
// ggmira mira_options() ELEMENT_COLORS: amber, light blue, blue, MiRA's layer purple
const ELEMENT_COLORS = {
    node: '#d97706',
    intralayer: '#0ea5e9',
    interlayer: '#1e40af',
    layer: '#8b5cf6',
};

/** The text that is copied: the code, then the notes as R comments. */
export function rCodeText(lines, notes) {
    const code = lines.map(line => line.text).join('\n');
    if (!notes.length) return code;
    return `${code}\n\n# Not in this code (R cannot set it):\n${notes.map(note => `# - ${note}`).join('\n')}`;
}

/**
 * @param {{ element: string|null, text: string }[]} lines
 * @param {string[]} notes
 */
export function showRCodePanel(lines, notes) {
    document.getElementById(PANEL_ID)?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = PANEL_ID;
    backdrop.className = 'r-code-backdrop';
    backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });

    const panel = document.createElement('div');
    panel.className = 'r-code-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'R code for this view');

    const header = document.createElement('div');
    header.className = 'r-code-header';
    const title = document.createElement('strong');
    title.textContent = 'R code for this view';
    const close = document.createElement('button');
    close.className = 'r-code-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => backdrop.remove());
    header.append(title, close);

    const pre = document.createElement('pre');
    pre.className = 'r-code';
    lines.forEach((line, i) => {
        if (i > 0) pre.append('\n');
        const span = document.createElement('span');
        span.textContent = line.text; // names and values come from the data: never innerHTML
        if (ELEMENT_COLORS[line.element]) span.style.color = ELEMENT_COLORS[line.element];
        span.dataset.element = line.element ?? '';
        pre.append(span);
    });
    if (notes.length) {
        const comment = document.createElement('span');
        comment.className = 'r-code-comment';
        comment.textContent = `\n\n# Not in this code (R cannot set it):\n${notes.map(note => `# - ${note}`).join('\n')}`;
        pre.append(comment);
    }

    const copy = document.createElement('button');
    copy.className = 'btn r-code-copy';
    copy.textContent = COPY_LABEL;
    copy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(rCodeText(lines, notes));
            copy.textContent = 'Copied';
        } catch {
            copy.textContent = 'Copy failed';
        }
        setTimeout(() => { copy.textContent = COPY_LABEL; }, COPIED_MS);
    });

    panel.append(header, pre, copy);
    backdrop.append(panel);
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', function onKey(event) {
        if (event.key !== 'Escape') return;
        backdrop.remove();
        document.removeEventListener('keydown', onKey);
    });
}
