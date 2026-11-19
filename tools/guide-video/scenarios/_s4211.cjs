// Shared helpers for the port-4211 guide videos.
exports.openSongLive = async (h, query, title, firstLine) => {
  await h.type('input[placeholder^="Search library"]', query);
  await h.click(h.page.getByText(title).first());
  await h.click(h.page.locator("text=" + firstLine).first());
  await h.click(h.page.getByRole("button", { name: /GO LIVE/i }));
  await h.sleep(0.6);
};
// A framed, real render of the projector page (what the room sees), drawn over the operator screen.
exports.preloadLive = async (h, hash = "/#/projector") => {
  await h.page.evaluate((src) => {
    document.getElementById("vf-live-pre")?.remove();
    const w = document.createElement("div"); w.id = "vf-live-pre";
    w.style.cssText = "position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:2147483640;width:900px;background:#0b0e14;border:1.5px solid #a3e635;border-radius:14px;padding:10px;box-shadow:0 10px 40px rgba(0,0,0,.6);visibility:hidden;pointer-events:none";
    w.innerHTML = '<div class="lab" style="font:600 14px Sora,system-ui,sans-serif;color:#a3e635;margin:0 0 8px 4px;letter-spacing:.04em"></div><iframe src="' + src + '" style="width:880px;height:495px;border:0;border-radius:8px;background:#000;display:block"></iframe>';
    document.body.appendChild(w);
  }, hash);
};
exports.showLive = async (h, label, hash = "/#/projector", waitText = "Amazing") => {
  await h.page.evaluate(([label, src]) => {
    document.getElementById("vf-live")?.remove();
    let w = document.getElementById("vf-live-pre");
    if (w) { w.id = "vf-live"; w.style.visibility = "visible"; w.querySelector(".lab").textContent = label; return; }
    w = document.createElement("div"); w.id = "vf-live";
    w.style.cssText = "position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:2147483640;width:900px;background:#0b0e14;border:1.5px solid #a3e635;border-radius:14px;padding:10px;box-shadow:0 10px 40px rgba(0,0,0,.6)";
    w.innerHTML = '<div style="font:600 14px Sora,system-ui,sans-serif;color:#a3e635;margin:0 0 8px 4px;letter-spacing:.04em">' + label + '</div>' +
      '<iframe src="' + src + '" style="width:880px;height:495px;border:0;border-radius:8px;background:#000;display:block"></iframe>';
    document.body.appendChild(w);
  }, [label, hash]);
  await h.page.waitForFunction((t) => { const f = document.querySelector("#vf-live iframe"); try { return !t || (f && f.contentDocument && f.contentDocument.body.innerText.includes(t)); } catch (e) { return true; } }, waitText, { timeout: 30000 }).catch(() => {});
  await h.sleep(1.5);
};
// Type slowly into a field that re-renders on every key; if characters were dropped, set the value outright.
exports.typeSafe = async (h, loc, text, delay = 90) => {
  await h.click(loc); await h.page.keyboard.type(text, { delay });
  if ((await loc.inputValue()) !== text) await loc.fill(text);
  await h.sleep(0.3);
};
exports.hideLive = async (h) => { await h.page.evaluate(() => document.getElementById("vf-live")?.remove()); await h.sleep(0.3); };
// A stand-in camera for the browser recording ("Test camera"): a moving picture drawn on a canvas, offered through the real
// getUserMedia / enumerateDevices calls, so the app uses it exactly as it would a webcam.
exports.fakeCamera = async (h) => {
  await h.page.context().addInitScript(() => {
    const dev = { deviceId: "testcam1", groupId: "g1", kind: "videoinput", label: "Test camera", toJSON() { return this; } };
    let canvas, t0 = Date.now();
    const make = () => {
      if (canvas) return canvas.captureStream(30);
      canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
      const g = canvas.getContext("2d");
      const draw = () => {
        const t = (Date.now() - t0) / 1000;
        const gr = g.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, "#1f3a5f"); gr.addColorStop(1, "#5b7f6a");
        g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
        g.fillStyle = "#e8c9a0"; g.beginPath(); g.arc(640 + Math.sin(t) * 40, 300, 120, 0, 7); g.fill();
        g.fillStyle = "#24324a"; g.fillRect(500 + Math.sin(t) * 40, 420, 280, 300);
        g.fillStyle = "rgba(255,255,255,.7)"; g.font = "28px sans-serif"; g.fillText("Test camera", 40, 60);
      };
      draw(); setInterval(draw, 33);
      return canvas.captureStream(30);
    };
    const md = navigator.mediaDevices;
    if (md) {
      md.getUserMedia = async (c) => { if (c && c.audio && !c.video) throw new DOMException("no mic", "NotFoundError"); return make(); };
      md.enumerateDevices = async () => [dev];
    }
  });
};
// Two real renders side by side: the room (projector page) and the stream overlay.
exports.showRoomAndStream = async (h, waitText = "Amazing") => {
  await h.page.evaluate(() => {
    document.getElementById("vf-live")?.remove();
    const w = document.createElement("div"); w.id = "vf-live";
    w.style.cssText = "position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483640;width:1240px;background:#0b0e14;border:1.5px solid #a3e635;border-radius:14px;padding:10px;box-shadow:0 10px 40px rgba(0,0,0,.6);display:flex;gap:12px";
    const lab = "font:600 14px Sora,system-ui,sans-serif;color:#a3e635;margin:0 0 8px 4px;letter-spacing:.04em";
    const fr = (src, bg) => '<iframe src="' + src + '" style="width:600px;height:338px;border:0;border-radius:8px;background:' + bg + ';display:block"></iframe>';
    w.innerHTML = '<div><div style="' + lab + '">IN THE ROOM: THE FULL DISPLAY</div>' + fr("/#/projector", "#000") + '</div>' +
      '<div><div style="' + lab + '">ON THE STREAM: THE OVERLAY OVER YOUR CAMERA</div>' + fr("/#/stream", "linear-gradient(135deg,#1f3a5f,#5b7f6a)") + '</div>';
    document.body.appendChild(w);
  });
  await h.page.waitForFunction((t) => { try { return [...document.querySelectorAll("#vf-live iframe")].every((f) => f.contentDocument.body.innerText.includes(t)); } catch (e) { return true; } }, waitText, { timeout: 20000 }).catch(() => {});
  await h.sleep(3.0);
};
