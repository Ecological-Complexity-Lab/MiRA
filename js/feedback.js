/**
 * feedback.js — "Feedback" dialog: opens a pre-filled GitHub issue.
 *
 * The form (type, comment, optional name, optional technical details) is
 * turned into a new-issue URL and opened in a new tab, where the user
 * reviews and submits it (a GitHub account is needed). Nothing is sent
 * from MiRA itself.
 *
 * Issues go to the MiRA repository from the website, and to the ggmira
 * repository when MiRA was opened from R (ggmira serves it with
 * ?autoload=true), so each report lands where it can be fixed.
 *
 * Exports:
 *   - initFeedback(getContext)
 *       Wires the button and dialog. Call once during app init.
 *       `getContext` returns live app state for the technical details:
 *         () => ({ mode, model, datasetName })
 */

const FROM_R = new URLSearchParams(window.location.search).get('autoload') === 'true';
const ISSUES_URL = FROM_R
    ? 'https://github.com/Ecological-Complexity-Lab/ggmira/issues/new'
    : 'https://github.com/Ecological-Complexity-Lab/MiRA/issues/new';
const TOPIC = FROM_R ? 'MiRA (opened from ggmira)' : 'MiRA (website)';
const NAME_KEY = 'mira-feedback-name';

export function initFeedback(getContext) {
    const button = document.getElementById('feedbackBtn');
    const dialog = document.getElementById('feedbackDialog');
    const form = document.getElementById('feedbackForm');
    const type = document.getElementById('feedbackType');
    const message = document.getElementById('feedbackMessage');
    const name = document.getElementById('feedbackName');
    const includeDiagnostics = document.getElementById('feedbackIncludeDiag');
    const preview = document.getElementById('feedbackDiagPreview');

    function diagnostics() {
        const { mode, model, datasetName } = getContext();
        return {
            appVersion: document.querySelector('.branding-version')?.textContent?.trim() ?? 'unknown',
            mode,
            dataset: datasetName ?? '(user-loaded or none)',
            network: model ? `${model.layers.length} layers, ${model.nodes.length} nodes, ${model.extended.length} links` : 'none loaded',
            userAgent: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`,
        };
    }

    function close() {
        dialog.style.display = 'none';
        button.focus();
    }

    button.addEventListener('click', () => {
        try { name.value = localStorage.getItem(NAME_KEY) ?? ''; } catch { name.value = ''; }
        preview.textContent = JSON.stringify(diagnostics(), null, 2);
        dialog.style.display = 'flex';
        message.focus();
    });
    document.getElementById('feedbackDialogClose').addEventListener('click', close);
    document.getElementById('feedbackCancelBtn').addEventListener('click', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.style.display !== 'none') close();
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const comment = message.value.trim();
        if (!comment) {
            message.focus();
            return;
        }
        const short = comment.replace(/\s+/g, ' ');
        const title = `[MiRA] ${short.length > 60 ? `${short.slice(0, 60)}...` : short}`;
        const sender = name.value.trim();
        try { localStorage.setItem(NAME_KEY, sender); } catch {}
        let body = `**Topic:** ${TOPIC}  \n**Type:** ${type.value}${sender ? `  \n**From:** ${sender}` : ''}\n\n${comment}`;
        if (includeDiagnostics.checked) {
            body += `\n\n<details><summary>Technical details</summary>\n\n\`\`\`json\n${JSON.stringify(diagnostics(), null, 2)}\n\`\`\`\n</details>`;
        }
        const query = new URLSearchParams({ title, body, labels: `feedback,${type.value}` });
        window.open(`${ISSUES_URL}?${query}`, '_blank', 'noopener');
        close();
    });
}
