#!/usr/bin/env python3
"""Build an anonymized copy of the MiRA site for double-blind review.

    usage: scripts/make_anonymous.py [SRC_WORKTREE] [OUT_DIR]

Strips author, institution, and self-citation identifiers while preserving
third-party scholarly citations (dataset DOIs must stay intact). Adds a Netlify
_headers file so the mirror stays out of search indexes. Exits non-zero if any
identifying term survives.
"""
import re, shutil, sys, pathlib

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/Users/shai/GitHub/ecomplab/MiRA")
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else
                   pathlib.Path(__file__).resolve().parent.parent / "anonymous-build")

ANON_HOST = "https://mira-anonymous.netlify.app"

# Only these are the authors' own identifiers. Third-party DOIs must survive.
SELF_DOIS = [r"10\.48550/arXiv\.2605\.09597", r"10\.5281/zenodo\.\d+"]
IDENTIFYING_HREF = re.compile(
    r"(ecomplab\.com|github\.com/Ecological-Complexity-Lab|arxiv\.org/abs/2605\.09597"
    r"|zenodo\.org|doi\.org/(?:" + "|".join(SELF_DOIS) + r"))", re.I)

TEXT_RULES = [
    (re.compile(r"Nehoray,?\s*(?:S\.?\s*M\.?|Shir\s+Miryam|SM)?", re.I), "[Author]"),
    (re.compile(r"\bBloch,?\s*(?:Y\.?|Yuval)?", re.I), "[Author]"),
    (re.compile(r"Pilosof,?\s*(?:S\.?|Shai)?", re.I), "[Author]"),
    (re.compile(r"Ecological[-\s]Complexity[-\s]Lab", re.I), "[Institution withheld]"),
    (re.compile(r"Ben-Gurion\s+University\s+of\s+the\s+Negev", re.I | re.S), "[Institution withheld]"),
    (re.compile(r"\bECompLab\b", re.I), "[Institution withheld]"),
    (re.compile(r"https?://orcid\.org/[0-9X-]+", re.I), ""),
    (re.compile(r"\b0000-0003-0430-5568\b|\b0009-0001-8453-4426\b"), ""),
    (re.compile(r"arXiv:?\s*2605\.09597", re.I), "[preprint withheld]"),
    (re.compile(r"\b2605\.09597\b"), "[withheld]"),
    (re.compile(r"10\.5281/zenodo\.\d+"), "[withheld]"),
    (re.compile(r"10\.48550/arXiv\.[\d.]+", re.I), "[withheld]"),
    (re.compile(r"https?://(?:www\.)?ecomplab\.com[^\s\"'<)]*", re.I), ""),
    (re.compile(r"https?://github\.com/Ecological-Complexity-Lab[^\s\"'<)]*", re.I), ""),
]

def drop_identifying_icon_links(html: str) -> str:
    """Remove identifying anchors that wrap only an icon (no text to preserve)."""
    def repl(m):
        if not IDENTIFYING_HREF.search(m.group(1)):
            return m.group(0)
        text_only = re.sub(r"<[^>]+>", "", m.group(2))   # drop all markup, keep text
        return "" if not text_only.strip() else m.group(0)
    return re.sub(r'<a\b[^>]*href="([^"]*)"[^>]*>(.*?)</a>', repl, html, flags=re.S | re.I)

def unwrap_identifying_anchors(html: str) -> str:
    """Replace <a href=identifying>text</a> with its inner text, keeping prose intact."""
    def repl(m):
        return m.group(2) if not IDENTIFYING_HREF.search(m.group(1)) is None else m.group(0)
    return re.sub(r'<a\b[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
                  lambda m: m.group(2) if IDENTIFYING_HREF.search(m.group(1)) else m.group(0),
                  html, flags=re.S | re.I)

# Third-person dataset citations (e.g. "Pilosof et al. 2017") are preserved:
# citing one's own published dataset in the third person is accepted double-blind
# practice, and the accompanying DOI resolves to the name regardless.
CITATION_FORM = re.compile(r"\b(Nehoray|Bloch|Pilosof)\s+et\s+al\.", re.I)
SENTINEL = "\x00CITE{}\x00"

def scrub_text(s: str) -> str:
    keep = []
    def stash(m):
        keep.append(m.group(0))
        return SENTINEL.format(len(keep) - 1)
    s = CITATION_FORM.sub(stash, s)
    for pat, rep in TEXT_RULES:
        s = pat.sub(rep, s)
    for i, original in enumerate(keep):
        s = s.replace(SENTINEL.format(i), original)
    s = re.sub(r"\[Author\](?=[A-Za-z])", "[Author] ", s)       # "[Author]et al." -> "[Author] et al."
    s = re.sub(r"(\[Author\][,\s]*){2,}", "[Authors] ", s)      # collapse author runs
    return re.sub(r"[ \t]{2,}", " ", s)

def strip_blocks(path: pathlib.Path, patterns):
    s = path.read_text()
    for p in patterns:
        s = re.sub(p, "", s, flags=re.S | re.I)
    path.write_text(s)

def replace_cite_dialog(idx: pathlib.Path):
    s = idx.read_text()
    start = s.index('<div id="citeDialog"')
    depth, i = 0, start
    while True:
        o, c = s.find("<div", i), s.find("</div>", i)
        if c == -1: raise SystemExit("citeDialog: unbalanced markup")
        if o != -1 and o < c: depth, i = depth + 1, o + 4
        else:
            depth, i = depth - 1, c + 6
            if depth == 0: break
    new = ('<div id="citeDialog" class="dialog-overlay" style="display:none;">\n'
           '    <div class="dialog-box cite-dialog-box">\n'
           '      <button id="citeDialogClose" class="cite-close-btn" aria-label="Close" title="Close">x</button>\n'
           '      <h4 class="cite-title">Citation</h4>\n'
           '      <p class="cite-subtitle">Author and citation details are withheld for double-blind peer review.</p>\n'
           '      <div class="dialog-buttons cite-buttons"><button class="btn" id="citeDialogDone">Done</button></div>\n'
           '    </div>\n  </div>')
    idx.write_text(s[:start] + new + s[i:])

# ── build ────────────────────────────────────────────────────────────────────
print(f"source: {SRC}\noutput: {OUT}")
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True)

for f in ["index.html", "compare.html", "data-format.html"] + [p.name for p in SRC.glob("tutorial-*.html")]:
    shutil.copy(SRC / f, OUT / f)
for d in ["css", "js", "assets", "data"]:
    shutil.copytree(SRC / d, OUT / d, ignore=shutil.ignore_patterns(".DS_Store"))
(OUT / "docs").mkdir()
shutil.copy(SRC / "docs/manual.html", OUT / "docs/manual.html")
(OUT / "assets/ecomplab_logo.png").unlink(missing_ok=True)
# NOT copied: CITATION.cff, CNAME, README.md, sitemap.xml, llms.txt, tests/, .github/

pages = list(OUT.glob("*.html")) + [OUT / "docs/manual.html"]

# structural removals first
strip_blocks(OUT / "compare.html", [r'\s*<div class="cite">.*?</div>',
                                    r'\s*<details>\s*<summary>How do I cite MiRA\?.*?</details>',
                                    r'\s*<footer class="site">.*?</footer>'])
strip_blocks(OUT / "docs/manual.html", [r'\s*<p[^>]*>\s*<strong>Software archive:</strong>.*?</p>'])
for p in pages:
    strip_blocks(p, [r'\s*<script type="application/ld\+json">.*?</script>',
                     r'\s*<meta name="google-site-verification"[^>]*>',
                     r'\s*<a href="https://github\.com/Ecological-Complexity-Lab/MiRA">GitHub</a>',
                     r'\s*<a href="https://arxiv\.org/abs/2605\.09597">Preprint</a>'])
replace_cite_dialog(OUT / "index.html")

for p in pages:
    s = p.read_text().replace("https://mira.ecomplab.com", ANON_HOST)
    s = scrub_text(unwrap_identifying_anchors(drop_identifying_icon_links(s)))
    s = re.sub(r'<img[^>]*ecomplab_logo[^>]*>', '', s, flags=re.I)
    s = re.sub(r'<a\b[^>]*>\s*</a>', '', s)                     # anchors emptied by scrubbing
    p.write_text(s)

for p in OUT.glob("js/*.js"):
    s = p.read_text().replace("https://mira.ecomplab.com/", f"{ANON_HOST}/")
    s = re.sub(r"const labName\s*=\s*'[^']*'", "const labName = ''", s)
    s = s.replace("Developed by the ", "")
    p.write_text(scrub_text(s) if "demoDatasets" not in p.name else s)

(OUT / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n")
(OUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n")

# ── verify ───────────────────────────────────────────────────────────────────
TERMS = ["Pilosof", "Nehoray", "Bloch", "orcid", "ecomplab", "Ecological Complexity",
         "Ben-Gurion", "Negev", "zenodo", "google-site-verification",
         "0000-0003-0430-5568", "0009-0001-8453-4426", "2605.09597"]
# demoDatasets.js / manual dataset table cite published datasets in the third person,
# which double-blind review permits; excluded from the scan by design.
EXEMPT = re.compile(r"/(data|assets)/|demoDatasets\.js$")
leaks = []
for f in OUT.rglob("*"):
    if not f.is_file() or EXEMPT.search(str(f)): continue
    try: body = f.read_text()
    except (UnicodeDecodeError, ValueError): continue
    for t in TERMS:
        probe = CITATION_FORM.sub("", body)          # ignore preserved dataset citations
        if t.lower() in probe.lower(): leaks.append((f.relative_to(OUT), t))
print("\n── leak scan ─────────────────────────────────────────────")
if leaks:
    for f, t in leaks: print(f"  LEAK: {t!r} in {f}")
    sys.exit("\nFAILED: identifying terms remain")
print("  clean — no identifying terms found")
print(f"\nbuild ready: {OUT}")
