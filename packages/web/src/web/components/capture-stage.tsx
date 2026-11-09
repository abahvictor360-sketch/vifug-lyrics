import { SlideRender } from "./slide-render";
import { CaptureView } from "./capture";
import type { LiveState, LiveCapture } from "../lib/live-bus";
import { useMediaUrl } from "../hooks/use-media-url";
import { useAudioOutputMuted } from "../hooks/use-audio-output";

/** Preacher/speaker nameplate (lower third), composited over any capture layout. */
function Nameplate({ nameplate, scale }: { nameplate: NonNullable<LiveCapture>["nameplate"]; scale?: boolean }) {
  const logo = useMediaUrl(nameplate?.logo);
  if (!nameplate?.name) return null;
  const unit = scale ? "cqw" : "vw";
  const style = nameplate.style ?? "classic";
  const accent = nameplate.accent || (style === "pill" ? "#22c55e" : style === "social" ? "#e11d48" : "#1d4ed8");
  const font = 'var(--font-lyric), "Archivo", system-ui, sans-serif';
  const nameSize = `clamp(0.75rem, 1.7${unit}, 2.2rem)`;
  const subSize = `clamp(0.6rem, 1.05${unit}, 1.4rem)`;
  const sub = nameplate.title;

  if (style === "broadcast") {
    // Two slanted bars: accent name bar over a white title bar.
    return (
      <div style={{ position: "absolute", left: "4%", bottom: "7%", maxWidth: "70%", fontFamily: font, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>
        <div style={{ background: accent, color: "#fff", padding: "0.4em 1.6em 0.4em 1em", fontSize: nameSize, fontWeight: 800, lineHeight: 1.1, clipPath: "polygon(0 0, 100% 0, calc(100% - 0.8em) 100%, 0 100%)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
          {nameplate.name}
        </div>
        {sub && (
          <div style={{ background: "#fff", color: "#111", padding: "0.3em 1.6em 0.3em 1em", fontSize: subSize, fontWeight: 600, marginTop: "0.12em", width: "fit-content", clipPath: "polygon(0 0, 100% 0, calc(100% - 0.7em) 100%, 0 100%)" }}>
            {sub}
          </div>
        )}
      </div>
    );
  }

  if (style === "social") {
    // Name bar with a handle bar tucked underneath, offset like a sticker.
    return (
      <div style={{ position: "absolute", left: "4%", bottom: "7%", maxWidth: "70%", fontFamily: font, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>
        <div style={{ background: "#fff", color: "#111", padding: "0.4em 1em", fontSize: nameSize, fontWeight: 800, lineHeight: 1.1, borderLeft: `0.4em solid ${accent}`, width: "fit-content" }}>
          {nameplate.name}
        </div>
        {(nameplate.handle || sub) && (
          <div style={{ background: accent, color: "#fff", padding: "0.3em 1em", marginLeft: "1.2em", fontSize: subSize, fontWeight: 600, width: "fit-content" }}>
            {nameplate.handle || sub}
          </div>
        )}
      </div>
    );
  }

  if (style === "pill") {
    // Rounded pill with a logo / avatar badge at the left.
    const initial = nameplate.name.trim().charAt(0).toUpperCase();
    return (
      <div style={{ position: "absolute", left: "4%", bottom: "7%", maxWidth: "70%", fontFamily: font, display: "flex", alignItems: "center", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>
        <div style={{ width: "3.4em", height: "3.4em", borderRadius: "50%", background: logo ? `center / cover no-repeat url(${logo})` : "#0a0a0c", color: accent, border: `0.18em solid ${accent}`, display: "grid", placeItems: "center", fontWeight: 800, fontSize: `clamp(0.7rem, 1.2${unit}, 1.6rem)`, zIndex: 1, flex: "none" }}>
          {!logo && initial}
        </div>
        <div style={{ background: accent, color: "#fff", padding: "0.35em 1.4em 0.35em 1.6em", marginLeft: "-1.1em", borderRadius: "0 999px 999px 0", lineHeight: 1.15 }}>
          <div style={{ fontSize: nameSize, fontWeight: 800 }}>{nameplate.name}</div>
          {sub && <div style={{ fontSize: subSize, opacity: 0.9 }}>{sub}</div>}
        </div>
      </div>
    );
  }

  if (style === "minimal") {
    return (
      <div style={{ position: "absolute", left: "4%", bottom: "7%", maxWidth: "70%", fontFamily: font, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)" }}>
        <div style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.1 }}>{nameplate.name}</div>
        {sub && <div style={{ fontSize: subSize, opacity: 0.9, marginTop: "0.15em" }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "4%",
        bottom: "6%",
        maxWidth: "60%",
        background: "rgba(10,10,14,0.82)",
        borderLeft: "0.3em solid var(--v-accent, #f4c025)",
        padding: "0.55em 1em",
        borderRadius: "0.15em",
        color: "#ffffff",
        fontFamily: font,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: `clamp(0.75rem, 1.6${unit}, 2rem)`, fontWeight: 700, lineHeight: 1.15 }}>
        {nameplate.name}
      </div>
      {sub && (
        <div style={{ fontSize: `clamp(0.6rem, 1.05${unit}, 1.3rem)`, opacity: 0.8, marginTop: "0.2em" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * Composites live video and the current slide onto one output.
 *
 * The three layouts answer different room setups:
 *  - "full"    video takes the screen (a playback PC, a camera feed on its own)
 *  - "overlay" lyrics or scripture sit over the video. Either fills the whole
 *              frame ("fullscreen") or sits in a sized band at the bottom -
 *              the classic broadcast lower third, whose width/height and
 *              backdrop (color or image) the operator controls.
 *  - "pip"     video and text side by side so neither covers the other, for a
 *              portrait camera feed beside landscape scripture
 *
 * A preacher/speaker nameplate can be composited on top regardless of layout.
 */
export function CaptureStage({
  state,
  scale,
  playAudio = false,
  micDeviceId,
}: {
  state: LiveState;
  scale?: boolean;
  /** This is the actual on-air instance (the Live column), not a preview -
   * so its background video is the one the Audio Mixer's Media channel taps
   * for a level meter (see lib/audio-taps.ts). */
  /**
   * Let this instance's capture audio actually be heard. Only the real output
   * (the projector) sets it: the operator's own preview and live thumbnails
   * render the same capture, and unmuting all of them would play the room's
   * sound two or three times over, out of phase. Passed on to the slide too,
   * whose background video answers to the same rule.
   */
  playAudio?: boolean;
  /** Which mic to use when the capture's audioSource is "mic". */
  micDeviceId?: string | null;
}) {
  // Hooks before the early return: a slide with no capture is the common
  // case and still needs the same mute state.
  const outputMuted = useAudioOutputMuted();
  const capture = state.capture;
  if (!capture) return <SlideRender state={state} scale={scale} playAudio={playAudio} />;

  const layout = capture.layout ?? "full";
  const nameplate = <Nameplate nameplate={capture.nameplate} scale={scale} />;
  const audioSource = capture.audioSource ?? "none";
  const av = {
    colorFilter: capture.colorFilter,
    lutId: capture.lutId,
    chromaKey: capture.chromaKey,
    audioSource,
    micDeviceId,
    muted: !playAudio || outputMuted || audioSource === "none",
  };

  if (layout === "full") {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <CaptureView sourceId={capture.sourceId} {...av} />
        {nameplate}
      </div>
    );
  }

  if (layout === "overlay") {
    const overlayMode = capture.overlayMode ?? "fullscreen";
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <CaptureView sourceId={capture.sourceId} {...av} />
        {overlayMode === "lower_third" ? (
          <LowerThirdBand capture={capture}>
            {/*
             * The band is its own sized box, not the viewport - so the slide
             * inside it always renders in container-relative (cqw/cqh) mode,
             * regardless of whether the OUTER stage itself is scaled (a
             * shrunk operator preview) or full-size (the real projector).
             */}
            <SlideRender
              state={{
                ...state,
                theme: {
                  ...state.theme,
                  displayMode: "fullscreen",
                  // No backdrop bar behind the words - so they need a heavy
                  // black shadow/outline of their own to read over live video,
                  // regardless of whatever outline the operator has set for
                  // ordinary slides.
                  ...(capture.overlayBgEnabled === false
                    ? {
                        textShadow: { color: "rgba(0,0,0,0.85)", blur: 14, x: 0, y: 3 },
                        textOutline: { color: "rgba(0,0,0,0.8)", width: 3 },
                      }
                    : {}),
                },
              }}
              transparent
              scale
             
              playAudio={playAudio}
              textPosition={{
                vertical: capture.overlayTextVerticalPos ?? "bottom",
                horizontal: capture.overlayTextAlign ?? "center",
              }}
            />
          </LowerThirdBand>
        ) : (
          // transparent: the video is the backdrop, so the slide must not paint
          // its own background over it.
          <div style={{ position: "absolute", inset: 0 }}>
            <SlideRender state={state} transparent scale={scale} playAudio={playAudio} />
          </div>
        )}
        {nameplate}
      </div>
    );
  }

  // pip - split the frame. Video keeps its aspect (object-contain) so a
  // portrait camera feed isn't stretched to fill a landscape half.
  const videoWidth = Math.min(0.8, Math.max(0.2, capture.pipVideoWidth ?? 0.5));
  const videoFirst = (capture.pipVideoSide ?? "left") === "left";
  const videoPct = `${videoWidth * 100}%`;
  const textPct = `${(1 - videoWidth) * 100}%`;

  if (capture.pipBroadcast) {
    const accent = capture.pipAccent || "#1d4ed8";
    const unit = scale ? "cqw" : "vw";
    const bar = (text: string | undefined, top: boolean) => (
      <div
        style={{
          height: "9%",
          flex: "none",
          background: accent,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: 'var(--font-lyric), "Archivo", system-ui, sans-serif',
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontSize: `clamp(0.7rem, 2${unit}, 2.4rem)`,
          [top ? "borderBottom" : "borderTop"]: "0.25em solid rgba(255,255,255,0.85)",
        }}
      >
        {text}
      </div>
    );
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "#06080f" }}>
        {capture.pipTopText ? bar(capture.pipTopText, true) : <div style={{ height: "3%", background: accent, flex: "none" }} />}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: videoFirst ? "row" : "row-reverse", gap: "2%", padding: "2%" }}>
          <div
            style={{
              width: videoPct,
              position: "relative",
              background: "#000",
              border: `0.35em solid ${accent}`,
              borderRadius: "0.6em",
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            <CaptureView sourceId={capture.sourceId} {...av} />
          </div>
          <div style={{ width: textPct, position: "relative", borderRadius: "0.6em", overflow: "hidden", containerType: "size" }}>
            <SlideRender state={state} scale playAudio={playAudio} />
          </div>
        </div>
        {capture.pipBottomText ? bar(capture.pipBottomText, false) : <div style={{ height: "3%", background: accent, flex: "none" }} />}
        {nameplate}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: videoFirst ? "row" : "row-reverse",
      }}
    >
      <div style={{ width: videoPct, height: "100%", position: "relative", background: "#000" }}>
        <CaptureView sourceId={capture.sourceId} {...av} />
      </div>
      <div style={{ width: textPct, height: "100%", position: "relative" }}>
        <SlideRender state={state} scale={scale} playAudio={playAudio} />
      </div>
      {nameplate}
    </div>
  );
}

/**
 * The sized band a lower third renders inside, instead of the full frame.
 * `containerType: size` (mirroring SlideRender's own `scale` convention) lets
 * the slide's auto-fit font math measure against THIS box rather than the
 * viewport, so text fills a short band the same way it fills a tall one.
 */
function LowerThirdBand({
  capture,
  children,
}: {
  capture: NonNullable<LiveCapture>;
  children: React.ReactNode;
}) {
  const heightPct = Math.min(100, Math.max(10, capture.overlayHeightPct ?? 32));
  const widthPct = Math.min(100, Math.max(20, capture.overlayWidthPct ?? 100));
  // May be a browser-held file rather than a URL; resolve it like any other.
  const bgImage = useMediaUrl(capture.overlayBgImage);
  const bgEnabled = capture.overlayBgEnabled ?? true;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 0,
        transform: "translateX(-50%)",
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        overflow: "hidden",
        background: !bgEnabled
          ? "transparent"
          : bgImage
            ? `center / cover no-repeat url(${bgImage})`
            : (capture.overlayBgColor ?? "#0a0a0c"),
        containerType: "size",
      }}
    >
      {children}
    </div>
  );
}
