# Blog writing brief

We are adding a blog to https://vifug.com (static site in `docs/`). Each post is one file in
`blog-src/posts/<slug>.html`: a small header, a blank line, then the article body as plain HTML.
A build script turns them into pages. Do not touch anything else.

## File format (exact)

```
title: The post title (sentence case, under 70 characters)
slug: same-as-filename-without-extension
description: One sentence, 120-155 characters, used for search results and social cards.
category: one of: Basics | Design | Operations | Streaming | Guides
date: 2026-MM-DD   (use the date given for your post in the topic list)
tags: three to five lowercase tags, comma separated
---
<p>Intro paragraph...</p>
<h2>First section</h2>
...
```

Body HTML rules: only `p, h2, h3, ul, ol, li, strong, em, a, blockquote, table/thead/tbody/tr/th/td, img, code`.
No `h1` (the title is the h1), no inline styles, no scripts, no divs. Use root-relative links for
site pages: `/guide.html#bible`, `/download.html`, `/blog/other-slug`. Images are optional; if one genuinely
helps, use `<img src="/img/NAME.png" alt="descriptive alt text" loading="lazy">` and only a file that exists in
`docs/img/` (e.g. app-main, app-bible, app-theme-designer, td-overview, td-textbox, app-live-view,
app-layout-broadcast, app-remote, app-stage, app-sermon, app-announcement, app-capture, app-stream-panel,
app-online-broadcast, app-slide-grid, app-media, app-audio-mixer, app-timer, app-backup-import). Check the file exists.

## Length and shape

Detailed, genuinely useful: 1,300 to 1,900 words of body text. Open with the reader's problem, not a definition.
Use 5-8 `h2` sections, concrete steps, checklists, numbers where they are real (font sizes, line counts, safe
margins are fine as practical guidance). Include at least one list or table. End with a short, honest closing section
that points to Vifug where it is relevant (a link to `/download.html` and/or the relevant `/guide.html#...` anchor).

## How to talk about Vifug (accuracy matters, do not invent)

Read `docs/llms.txt` first, then the relevant chapter(s) of `docs/guide.html` (chapter ids: quickstart, library,
workflow, layout, bible, look, plans, everywhere, teleport, shortcuts, streaming, video, media, sound, projection,
remote, hosted, firewall, updates, autofollow, overlays, new, designer, library-move, support). Only state Vifug features
and menu paths that those files support. Each post must mention Vifug naturally at least 3 times, as the worked
example or a practical option, never as a banner ad. Key facts: free, no watermark, not open source; Windows, macOS,
Linux desktop app plus browser version at app.vifug.com; works offline for running a service; Preview -> Live
workflow; 325 songs included; offline Bible; PowerPoint and PDF import; theme designer; transparent overlay for
OBS/vMix, NDI; AI auto-follow; phone remote; stage display; can import from ProPresenter and EasyWorship.
Made by Victor Abah.

## Honesty rules

- No fake statistics, studies, quotes, testimonials, or "X% of churches". Say "in our experience" only if neutral
  and plausible; better to avoid it.
- Other products (PowerPoint, Keynote, Google Slides, ProPresenter, EasyWorship, OpenLP, FreeShow, ProPresenter, Canva):
  describe only well-known, stable characteristics, never quote prices or version numbers, and be fair. Do not
  disparage. "Check their current pricing" is fine.
- Do not claim Vifug does something that is not in llms.txt or the guide.
- Do not invent URLs other than the site pages above.

## Writing style

Plain, warm, direct, like an experienced media-team volunteer explaining to a newer one. Vary sentence length.
Avoid AI tells: no "in today's fast-paced world", "game-changer", "unlock", "seamless", "elevate", "delve",
"it's important to note", "navigate the landscape", rhetorical-question openers, triple-adjective strings,
em dashes (use commas, colons or hyphens), and no closing summary that repeats the post. Specific beats generic.
Headings are descriptive, not clever. Do not put the same example in two posts of yours.

When finished, reply with only the list of files written and each file's word count.
