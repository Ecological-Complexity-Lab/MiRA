# Intro movie: MiRA and ggmira (ideas, 2026-11-15)

A short video that presents MiRA and ggmira with their basic functionality,
with real moving networks. Not started; pick up from here.

## What Claude can make

- **Real MiRA footage, scripted.** Drive MiRA in a headless browser and record
  it (Playwright's video recording, installed with MiRA's tests): the stack
  rotating and zooming, a node highlighted, switching between views, the
  meta-network's force layout settling, the map. These are the app's own
  animations, not mockups.
- **ggmira as a split screen.** A page with R code typed in on the left and
  MiRA on the right, updating as each component is added: `mira(net)`, then
  layout, node colors, interlayer links, layers, a view. MiRA is real; the
  code panel is staged (not a recording of RStudio). End with `mira_save()`
  writing a file and the R button copying the view back as code.
- **Titles and captions** on screen; an end card with the install line, the
  URLs and the citation.

## Limits

- **Narration:** the macOS `say` voice is robotic. Captions, or Shai records
  a voiceover afterwards.
- **A real RStudio recording:** only Shai can make one (QuickTime screen
  recording).
- **Pacing:** Claude checks a video from frames taken from it, not by
  watching it play; Shai watches the draft.
- **MP4:** needs ffmpeg (not installed on 2026-11-15; `brew install ffmpeg`,
  ask Shai first). Without it, separate WebM clips only (browsers and
  YouTube play them; PowerPoint on a Mac may not).

## Possible outline (2–3 minutes)

1. Title card (5 s).
2. MiRA (about 75 s): load an example network, rotate and zoom the stack,
   color nodes by an attribute, highlight a node, then a tour of the views:
   grid, map, layer view, meta-network, dashboard.
3. ggmira (about 60 s): the plot built up step by step in code, a view
   change, `mira_save()`, the R button round trip.
4. End card: install, links, citation.

Networks that look good (see the beta testing guide, ggmira
`vignettes/articles/beta-testing.Rmd`): emln 17 (bipartite, interlayer links,
Galápagos map), 23 (12 layers on a map of Canada), 13 (dense food web;
the meta-network's force layout).

## To decide before starting

1. Where it will be used (website, a talk, social media, the ggmira site),
   and its length.
2. Captions only, or Shai's voiceover.
3. Install ffmpeg, so the result is one MP4.
