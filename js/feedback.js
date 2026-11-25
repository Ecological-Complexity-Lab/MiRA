/**
 * feedback.js — "Feedback" dialog: a GitHub issue, or an email to copy.
 *
 * The form (type, comment, optional name, optional technical details) is
 * turned into a report that the user sends themselves; nothing is sent
 * from MiRA itself. Two ways:
 *   - "Open on GitHub" opens a pre-filled new issue in a new tab, where the
 *     user reviews and submits it (a GitHub account is needed). Issues go
 *     to the MiRA repository from the website, and to the ggmira repository
 *     when MiRA was opened from R (ggmira serves it with ?autoload=true).
 *   - "Send us an email" shows the address, subject and message, each with
 *     a Copy button, to paste into a new email (and a mailto: link).
 *
 * Exports:
 *   - initFeedback(getContext)
 *       Wires the button and dialog. Call once during app init.
 *       `getContext` returns live app state for the technical details:
 *         () => ({ mode, model, datasetName })
 */

import { MIRA_VERSION } from './version.js';

const FROM_R = new URLSearchParams(window.location.search).get('autoload') === 'true';
const ISSUES_URL = FROM_R
    ? 'https://github.com/Ecological-Complexity-Lab/ggmira/issues/new'
    : 'https://github.com/Ecological-Complexity-Lab/MiRA/issues/new';
const TOPIC = FROM_R ? 'MiRA (opened from ggmira)' : 'MiRA (website)';
const FEEDBACK_EMAIL = 'geutg@post.bgu.ac.il';
const NAME_KEY = 'mira-feedback-name';

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
    }
}

export function initFeedback(getContext) {
    const button = document.getElementById('feedbackBtn');
    const dialog = document.getElementById('feedbackDialog');
    const form = document.getElementById('feedbackForm');
    const type = document.getElementById('feedbackType');
    const message = document.getElementById('feedbackMessage');
    const name = document.getElementById('feedbackName');
    const includeDiagnostics = document.getElementById('feedbackIncludeDiag');
    const preview = document.getElementById('feedbackDiagPreview');
    const emailPanel = document.getElementById('feedbackEmailPanel');
    const emailFields = {
        To: document.getElementById('feedbackEmailTo'),
        Subject: document.getElementById('feedbackEmailSubject'),
        Body: document.getElementById('feedbackEmailBody'),
    };
    const mailtoLink = document.getElementById('feedbackMailtoLink');

    function diagnostics() {
        const { mode, model, datasetName } = getContext();
        return {
            appVersion: MIRA_VERSION,
            mode,
            dataset: datasetName ?? '(user-loaded or none)',
            network: model ? `${model.layers.length} layers, ${model.nodes.length} nodes, ${model.extended.length} links` : 'none loaded',
            userAgent: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`,
        };
    }

    // The report from the form, or null (with the comment focused) when the
    // comment is empty. Remembers the name for next time.
    function report() {
        const comment = message.value.trim();
        if (!comment) {
            message.focus();
            form.reportValidity();
            return null;
        }
        const short = comment.replace(/\s+/g, ' ');
        const sender = name.value.trim();
        try { localStorage.setItem(NAME_KEY, sender); } catch {}
        return {
            title: `[MiRA] ${short.length > 60 ? `${short.slice(0, 60)}...` : short}`,
            type: type.value,
            sender,
            comment,
            details: includeDiagnostics.checked ? JSON.stringify(diagnostics(), null, 2) : null,
        };
    }

    function showForm() {
        form.style.display = '';
        emailPanel.style.display = 'none';
    }

    function close() {
        dialog.style.display = 'none';
        showForm();
        button.focus();
    }

    button.addEventListener('click', () => {
        try { name.value = localStorage.getItem(NAME_KEY) ?? ''; } catch { name.value = ''; }
        preview.textContent = JSON.stringify(diagnostics(), null, 2);
        showForm();
        dialog.style.display = 'flex';
        message.focus();
    });
    document.getElementById('feedbackDialogClose').addEventListener('click', close);
    document.getElementById('feedbackCancelBtn').addEventListener('click', close);
    document.getElementById('feedbackEmailDoneBtn').addEventListener('click', close);
    document.getElementById('feedbackEmailBackBtn').addEventListener('click', () => {
        showForm();
        message.focus();
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.style.display !== 'none') close();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        const r = report();
        if (!r) return;
        let body = `**Topic:** ${TOPIC}  \n**Type:** ${r.type}${r.sender ? `  \n**From:** ${r.sender}` : ''}\n\n${r.comment}`;
        if (r.details) {
            body += `\n\n<details><summary>Technical details</summary>\n\n\`\`\`json\n${r.details}\n\`\`\`\n</details>`;
        }
        const query = new URLSearchParams({ title: r.title, body, labels: `feedback,${r.type}` });
        window.open(`${ISSUES_URL}?${query}`, '_blank', 'noopener');
        close();
    });

    document.getElementById('feedbackEmailBtn').addEventListener('click', () => {
        const r = report();
        if (!r) return;
        let body = `Topic: ${TOPIC}\nType: ${r.type}${r.sender ? `\nFrom: ${r.sender}` : ''}\n\n${r.comment}`;
        if (r.details) body += `\n\nTechnical details:\n${r.details}`;
        emailFields.To.textContent = FEEDBACK_EMAIL;
        emailFields.Subject.textContent = r.title;
        emailFields.Body.textContent = body;
        mailtoLink.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(r.title)}&body=${encodeURIComponent(body)}`;
        form.style.display = 'none';
        emailPanel.style.display = '';
    });

    emailPanel.querySelectorAll('[data-feedback-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await copyText(emailFields[btn.dataset.feedbackCopy].textContent);
            const label = btn.querySelector('.cite-copy-label');
            btn.classList.add('copied');
            label.textContent = 'Copied!';
            setTimeout(() => {
                btn.classList.remove('copied');
                label.textContent = 'Copy';
            }, 1500);
        });
    });
}
