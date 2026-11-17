import app from "./src/api";
const dist = "/tmp/claude-0/-home-user/2f31005b-0cb0-55ad-bfea-147290deb386/scratchpad/vid/dist-prod";
Bun.serve({
  port: 5190, idleTimeout: 120,
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname.startsWith("/api")) return app.fetch(req);
    const f = Bun.file(dist + (u.pathname === "/" ? "/index.html" : u.pathname));
    if (await f.exists()) return new Response(f);
    return new Response(Bun.file(dist + "/index.html"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
});
console.log("up");
