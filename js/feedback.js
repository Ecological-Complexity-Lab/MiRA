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
        const { mode, model } = getContext();
        return {
            appVersion: document.querySelector('.branding-version')?.textContent?.trim() ?? 'unknown',
            mode,
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
        try { name.value = localStorage.getItem('ggmira-feedback-name') ?? ''; } catch { name.value = ''; }
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
        try { localStorage.setItem('ggmira-feedback-name', sender); } catch {}
        let body = `**Topic:** MiRA (opened from ggmira)  \n**Type:** ${type.value}${sender ? `  \n**From:** ${sender}` : ''}\n\n${comment}`;
        if (includeDiagnostics.checked) {
            body += `\n\n<details><summary>Technical details</summary>\n\n\`\`\`json\n${JSON.stringify(diagnostics(), null, 2)}\n\`\`\`\n</details>`;
        }
        const query = new URLSearchParams({ title, body, labels: `feedback,${type.value}` });
        window.open(`https://github.com/Ecological-Complexity-Lab/ggmira/issues/new?${query}`, '_blank', 'noopener');
        close();
    });
}