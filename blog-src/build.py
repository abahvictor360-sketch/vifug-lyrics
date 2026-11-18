#!/usr/bin/env python3
"""Build the Vifug blog from blog-src/posts/*.html into docs/blog/.

Usage: python3 blog-src/build.py
Each post: header lines (title, slug, description, category, date, tags), a line
containing only '---', then the article body as HTML.
"""
import html, json, re, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "blog-src" / "posts"
OUT = ROOT / "docs" / "blog"
DOCS = ROOT / "docs"
SITE = "https://vifug.com"
CATS = ["Basics", "Design", "Operations", "Streaming", "Guides"]

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23a3e635'/%3E%3Cg fill='none' stroke='%23080a0f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' transform='translate(3.4 3.4) scale(0.72)'%3E%3Cpath d='M9 18V5l12-2v13'/%3E%3Cpath d='m9 9 12-2'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Ccircle cx='18' cy='16' r='3'/%3E%3C/g%3E%3C/svg%3E")
GTAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J4HYT937CV"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-J4HYT937CV');
</script>"""

e = html.escape


def load():
    posts = []
    for f in sorted(SRC.glob("*.html")):
        raw = f.read_text(encoding="utf-8")
        head, sep, body = raw.partition("\n---\n")
        if not sep:
            sys.exit(f"{f.name}: missing '---' separator")
        meta = {}
        for line in head.strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip().lower()] = v.strip()
        for k in ("title", "slug", "description", "category", "date", "tags"):
            if not meta.get(k):
                sys.exit(f"{f.name}: missing {k}")
        if meta["slug"] != f.stem:
            sys.exit(f"{f.name}: slug mismatch {meta['slug']}")
        if meta["category"] not in CATS:
            sys.exit(f"{f.name}: bad category {meta['category']}")
        body = body.strip()
        if re.search(r"<(script|style|h1|iframe)\b", body, re.I):
            sys.exit(f"{f.name}: disallowed tag in body")
        text = re.sub(r"<[^>]+>", " ", body)
        meta["words"] = len(text.split())
        meta["minutes"] = max(1, round(meta["words"] / 220))
        meta["tags"] = [t.strip() for t in meta["tags"].split(",") if t.strip()]
        meta["body"] = body
        meta["d"] = date.fromisoformat(meta["date"])
        posts.append(meta)
    posts.sort(key=lambda p: p["d"], reverse=True)
    return posts



def slugify(t):
    t = re.sub(r"<[^>]+>", "", html.unescape(t)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60] or "section"


def add_ids(body):
    """Give every h2/h3 an id and return (body, toc entries for h2)."""
    seen, toc = set(), []
    def rep(m):
        tag, inner = m.group(1), m.group(3)
        base = slugify(inner); i, sid = 2, base
        while sid in seen:
            sid = f"{base}-{i}"; i += 1
        seen.add(sid)
        if tag == "h2":
            toc.append((sid, re.sub(r"<[^>]+>", "", inner)))
        return f'<{tag} id="{sid}">{inner}</{tag}>'
    return re.sub(r"<(h[23])(\s[^>]*)?>(.*?)</\1>", rep, body, flags=re.S), toc


def audit(p):
    w = []
    tt = len(p["title"]) + len(" | Vifug")
    if tt > 62: w.append(f"title tag {tt} chars (>62)")
    if not 110 <= len(p["description"]) <= 160: w.append(f"description {len(p['description'])} chars (want 110-160)")
    if p["words"] < 1200: w.append(f"only {p['words']} words")
    b = p["body"]
    if len(re.findall(r"<h2", b)) < 4: w.append("fewer than 4 h2")
    if "/guide.html" not in b: w.append("no link to /guide.html")
    if "/download.html" not in b: w.append("no link to /download.html")
    if len(re.findall(r'href="/blog/', b)) < 1: w.append("no internal link to another post")
    if "vifug" not in b.lower(): w.append("never mentions Vifug")
    for m in re.finditer(r"<img\b[^>]*>", b):
        if 'alt="' not in m.group(0): w.append("img without alt")
    if not re.search(r"<p>", b[:400]): w.append("body does not open with a paragraph")
    return w


def nice(d):
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def head(title, desc, url, extra="", image=None, alt="Vifug - free presentation software"):
    image = image or f"{SITE}/og-image.png"
    return f"""<!doctype html>
<html lang="en">
<head>
{GTAG}
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}" />
<link rel="canonical" href="{url}" />
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
<meta name="theme-color" content="#080a0f" />
<meta name="author" content="Victor Abah" />
<meta property="og:title" content="{e(title)}" />
<meta property="og:description" content="{e(desc)}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="{e(alt)}" />
<meta property="og:site_name" content="Vifug" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{e(title)}" />
<meta name="twitter:description" content="{e(desc)}" />
<meta name="twitter:image" content="{image}" />
<meta name="twitter:image:alt" content="{e(alt)}" />
<link rel="alternate" type="application/rss+xml" title="Vifug blog" href="{SITE}/blog/feed.xml" />
<link rel="icon" href="{FAVICON}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/blog/blog.css" />
{extra}</head>
<body>
<header>
  <div class="nav">
    <a class="brand" href="/">
      <span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><path d="m9 9 12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
      Vifug
    </a>
    <div class="nav-links">
      <a class="hide-sm" href="/">Home</a>
      <a href="/guide.html">Guide</a>
      <a href="/blog/" aria-current="page">Blog</a>
      <a class="btn btn-live" href="/download.html">Download free</a>
    </div>
  </div>
</header>
"""


FOOT = """<footer>
  <div class="wrap foot">
    <span>© <span id="year"></span> Vifug · Free worship presentation software · Made by Victor Abah · All rights reserved</span>
    <nav class="foot-links">
      <a href="/">Home</a>
      <a href="/download.html">Download</a>
      <a href="/guide.html">Guide</a>
      <a href="/blog/">Blog</a>
      <a href="/contact.html">Contact</a>
      <a href="/support.html">Support us</a>
    </nav>
  </div>
</footer>
<script>document.getElementById("year").textContent = new Date().getFullYear();</script>
"""


def card(p):
    return f"""      <a class="post-card" href="/blog/{p['slug']}" data-cat="{p['category']}">
        <span class="tag">{e(p['category'])}</span>
        <h2>{e(p['title'])}</h2>
        <p>{e(p['description'])}</p>
        <span class="meta"><time datetime="{p['date']}">{nice(p['d'])}</time><span>{p['minutes']} min read</span></span>
      </a>"""


def build_index(posts):
    cats = [c for c in CATS if any(p["category"] == c for p in posts)]
    chips = '<button class="chip" type="button" aria-pressed="true" data-f="all">All</button>' + "".join(
        f'<button class="chip" type="button" aria-pressed="false" data-f="{c}">{c}</button>' for c in cats)
    ld = {"@context": "https://schema.org", "@type": "Blog", "name": "The Vifug blog",
          "url": f"{SITE}/blog/", "publisher": {"@type": "Organization", "name": "Vifug", "url": SITE},
          "blogPost": [{"@type": "BlogPosting", "headline": p["title"], "url": f"{SITE}/blog/{p['slug']}",
                        "datePublished": p["date"]} for p in posts]}
    h = head("Blog - Presentation software for churches and live events - Vifug",
             "Practical, detailed articles on presentation software: lyrics, Scripture, projectors, live streaming, themes and running a media team.",
             f"{SITE}/blog/", f'<script type="application/ld+json">{json.dumps(ld)}</script>\n')
    return h + f"""
<main>
  <div class="wrap">
    <section class="blog-hero">
      <span class="eyebrow">The Vifug blog</span>
      <h1>Presentation software, explained for real services</h1>
      <p>Detailed, practical articles for media teams, church tech volunteers and anyone running live presentations: design, projectors, streaming, planning and training.</p>
    </section>
    <div class="chips" role="group" aria-label="Filter by category">{chips}</div>
    <div class="grid" id="grid">
{chr(10).join(card(p) for p in posts)}
    </div>
  </div>
</main>
{FOOT}<script>
  (function () {{
    var chips = document.querySelectorAll(".chip"), cards = document.querySelectorAll(".post-card");
    chips.forEach(function (c) {{
      c.addEventListener("click", function () {{
        var f = c.getAttribute("data-f");
        chips.forEach(function (x) {{ x.setAttribute("aria-pressed", x === c ? "true" : "false"); }});
        cards.forEach(function (k) {{ k.hidden = !(f === "all" || k.getAttribute("data-cat") === f); }});
      }});
    }});
  }})();
</script>
</body>
</html>
"""


def related(p, posts):
    others = [q for q in posts if q["slug"] != p["slug"]]
    def score(q):
        return (q["category"] == p["category"]) * 2 + len(set(q["tags"]) & set(p["tags"]))
    return sorted(others, key=lambda q: (-score(q), q["slug"]))[:3]


def build_post(p, posts):
    url = f"{SITE}/blog/{p['slug']}"
    img = f"{SITE}/blog/og/{p['slug']}.png"
    body, toc = add_ids(p["body"])
    ld = [{"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"],
           "description": p["description"], "datePublished": p["date"], "dateModified": p["date"],
           "author": {"@type": "Person", "name": "Victor Abah", "url": SITE},
           "publisher": {"@type": "Organization", "name": "Vifug", "url": SITE,
                         "logo": {"@type": "ImageObject", "url": f"{SITE}/og-image.png"}},
           "mainEntityOfPage": {"@type": "WebPage", "@id": url}, "image": img,
           "keywords": ", ".join(p["tags"]), "wordCount": p["words"], "articleSection": p["category"],
           "inLanguage": "en", "isPartOf": {"@type": "Blog", "name": "The Vifug blog", "@id": SITE + "/blog/"}},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": "Vifug", "item": SITE + "/"},
              {"@type": "ListItem", "position": 2, "name": "Blog", "item": SITE + "/blog/"},
              {"@type": "ListItem", "position": 3, "name": p["title"], "item": url}]}]
    extra = "".join(f'<script type="application/ld+json">{json.dumps(x)}</script>\n' for x in ld)
    extra += f'<meta property="article:published_time" content="{p["date"]}" />\n<meta property="article:modified_time" content="{p["date"]}" />\n<meta property="article:author" content="Victor Abah" />\n<meta property="article:section" content="{e(p["category"])}" />\n'
    extra += "".join(f'<meta property="article:tag" content="{e(t)}" />\n' for t in p["tags"])

    h = head(f"{p['title']} | Vifug", p["description"], url, extra, img, p["title"]).replace(
        '<meta property="og:title"', '<meta property="og:type" content="article" />\n<meta property="og:title"', 1)
    rel = "\n".join(card(q) for q in related(p, posts))
    toc_html = ""
    if len(toc) >= 4:
        toc_html = '    <nav class="toc" aria-label="In this article"><strong>In this article</strong><ol>' + "".join(
            f'<li><a href="#{i}">{e(t)}</a></li>' for i, t in toc) + "</ol></nav>\n"
    return h + f"""
<main>
  <article class="article">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Vifug</a> / <a href="/blog/">Blog</a> / {e(p['category'])}</nav>
    <span class="eyebrow">{e(p['category'])}</span>
    <h1>{e(p['title'])}</h1>
    <p class="lede">{e(p['description'])}</p>
    <div class="meta"><span>By Victor Abah</span><time datetime="{p['date']}">{nice(p['d'])}</time><span>{p['minutes']} min read</span></div>
{toc_html}    <div class="prose">
{body}
    </div>
    <aside class="cta">
      <h2>Try Vifug free</h2>
      <p>Vifug is free presentation and live-production software for churches, events and studios: lyrics, Scripture, slides, cameras and streaming, with a Preview and Live workflow. No watermark, and it runs a service without internet.</p>
      <div class="row"><a class="btn btn-live" href="/download.html">Download Vifug</a><a class="btn" href="/guide.html">Read the guide</a></div>
    </aside>
  </article>
  <div class="wrap related">
    <h2>Keep reading</h2>
    <div class="grid">
{rel}
    </div>
  </div>
</main>
{FOOT}</body>
</html>
"""


def build_feed(posts):
    items = "".join(f"""  <item>
    <title>{e(p['title'])}</title>
    <link>{SITE}/blog/{p['slug']}</link>
    <guid>{SITE}/blog/{p['slug']}</guid>
    <pubDate>{p['d'].strftime('%a, %d %b %Y')} 08:00:00 GMT</pubDate>
    <category>{e(p['category'])}</category>
    <description>{e(p['description'])}</description>
  </item>
""" for p in posts)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Vifug blog</title>
  <link>{SITE}/blog/</link>
  <description>Practical articles on presentation software for churches and live events.</description>
  <language>en</language>
{items}</channel></rss>
"""


def update_sitemap(posts):
    p = DOCS / "sitemap.xml"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"\s*<url>\s*<loc>https://vifug\.com/blog[^<]*</loc>.*?</url>", "", s, flags=re.S)
    newest = max(x["date"] for x in posts)
    block = f"""  <url>
    <loc>{SITE}/blog/</loc>
    <lastmod>{newest}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
""" + "".join(f"""  <url>
    <loc>{SITE}/blog/{x['slug']}</loc>
    <lastmod>{x['date']}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
""" for x in posts)
    s = s.replace("</urlset>", block + "</urlset>")
    p.write_text(s, encoding="utf-8")


def update_llms(posts):
    p = DOCS / "llms.txt"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"\n# -- BLOG -+\n.*?(?=\n# -- )", "", s, flags=re.S)
    lines = "\n".join(f"#   {x['title']}: {SITE}/blog/{x['slug']}" for x in posts)
    sec = f"\n# -- BLOG ------------------------------------------\n# Articles on presentation software, design, operations and streaming: {SITE}/blog/\n{lines}\n"
    s = s.replace("\n# -- ATTRIBUTION", sec + "\n# -- ATTRIBUTION", 1)
    p.write_text(s, encoding="utf-8")


def main():
    posts = load()
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.html"):
        old.unlink()
    (OUT / "index.html").write_text(build_index(posts), encoding="utf-8")
    for p in posts:
        (OUT / f"{p['slug']}.html").write_text(build_post(p, posts), encoding="utf-8")
    (OUT / "feed.xml").write_text(build_feed(posts), encoding="utf-8")
    update_sitemap(posts)
    update_llms(posts)
    (ROOT / "blog-src" / "posts.json").write_text(json.dumps([{"slug": p["slug"], "title": p["title"], "category": p["category"]} for p in posts], indent=1))
    bad = 0
    for p in posts:
        for w in audit(p):
            bad += 1; print(f"  SEO WARN {p['slug']}: {w}")
    print(f"built {len(posts)} posts, {sum(p['words'] for p in posts)} words")
    for p in posts:
        print(f"  {p['words']:5d}  {p['slug']}")


if __name__ == "__main__":
    main()
