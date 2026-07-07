import type { LiveState, LiveTheme } from "../lib/live-bus";

/**
 * The ONE render engine. Produces the lyric slide from live state + theme.
 * Reused by the projector window and the operator preview (scaled down).
 */

// Measure the widest line in em units (width at 100px font / 100) using the
// real font, so fullscreen auto-fit can fill the width precisely instead of
// guessing an average glyph width.
let _measureCanvas: HTMLCanvasElement | null = null;
function longestLineEm(lines: string[], font: string): number {
  if (typeof document === "undefined" || lines.length === 0) return 0;
  _measureCanvas ??= document.createElement("canvas");
  const ctx = _measureCanvas.getContext("2d");
  if (!ctx) return Math.max(...lines.map((l) => l.length)) * 0.56;
  ctx.font = font;
  let max = 0;
  for (const l of lines) max = Math.max(max, ctx.measureText(l).width);
  return max / 100;
}

// Combined text effects: the outline glow and the optional drop shadow are both
// CSS text-shadows, layered into one comma-separated value.
function outlineStyle(t: LiveTheme): React.CSSProperties {
  const parts: string[] = [];
  if (t.textOutline && t.textOutline.width) {
    const w = t.textOutline.width;
    const c = t.textOutline.color;
    parts.push(`0 0 ${w}px ${c}`, `${w}px ${w}px ${w}px ${c}`, `-${w}px -${w}px ${w}px ${c}`);
  }
  if (t.textShadow) {
    const { x, y, blur, color } = t.textShadow;
    parts.push(`${x}px ${y}px ${blur}px ${color}`);
  }
  return parts.length ? { textShadow: parts.join(", ") } : {};
}

export function SlideRender({
  state,
  scale = false,
  transparent = false,
}: {
  state: LiveState;
  scale?: boolean;
  /** Stream / browser-source mode: no solid backdrop, media still shows. */
  transparent?: boolean;
}) {
  const t = state.theme;
  const isLowerThird = t.displayMode !== "fullscreen";
  const media = state.status === "blank" ? null : t.background;
  const showMediaColor = media?.type === "color";
  const bg =
    state.status === "blank"
      ? "#000000"
      : transparent || isLowerThird
        ? "transparent"
        : showMediaColor
          ? media!.url
          : media && (media.type === "image" || media.type === "video")
            ? "transparent"
            : t.bgColor;

  const showText = state.status === "live" && state.sourceLines.length > 0;

  // Auto-fit font sizing based on line count/length when fontSize is null.
  const lineCount = state.sourceLines.length + (state.translationLines.length ? state.translationLines.length : 0);
  const longest = Math.max(1, ...state.sourceLines.map((l) => l.length), ...state.translationLines.map((l) => l.length));
  // Use container-query units (cqw/cqh) when rendered as a scaled preview so
  // the font sizes relative to the small box, not the whole viewport. The full
  // projector uses viewport units (vw/vh).
  let fontSize: string;
  if (t.fontSize) {
    fontSize = scale ? `${t.fontSize * 0.28}cqw` : `${t.fontSize}px`;
  } else if (!isLowerThird) {
    // Fullscreen: FILL the display. Grow until the longest line spans the
    // usable width or the line stack spans the usable height, whichever binds
    // first. The safe margin keeps text off the screen edges.
    const margin = Math.max(2, t.safeMargin ?? 8);
    const usable = 100 - margin * 2;
    const effLines = Math.max(1, state.sourceLines.length + state.translationLines.length * 0.75);
    // Measure with the real font: translation lines render at 0.7em.
    const fontSpec = `${t.fontWeight || 600} 100px ${t.fontFamily || '"Archivo", system-ui, sans-serif'}`;
    const em = Math.max(
      longestLineEm(state.sourceLines, fontSpec),
      longestLineEm(state.translationLines, fontSpec) * 0.7,
      1.5, // floor so a 1-2 char slide doesn't explode
    );
    const fillW = (usable * 0.98) / em;       // 2% slack against measurement drift
    const fillH = usable / (1.3 * effLines);  // line-height + breathing room
    fontSize = scale
      ? `clamp(0.6rem, min(${fillW.toFixed(2)}cqw, ${fillH.toFixed(2)}cqh), 90cqh)`
      : `clamp(1.4rem, min(${fillW.toFixed(2)}vw, ${fillH.toFixed(2)}vh), 55vh)`;
  } else {
    // Lower thirds keep the conservative broadcast sizing.
    const autoVw = Math.max(2.4, Math.min(7.5, 46 / Math.max(longest, 10)));
    const autoByLines = Math.max(2.4, 8 - lineCount * 0.5);
    const unit = scale ? "cqw" : "vw";
    fontSize = `clamp(${scale ? "0.6rem" : "1.4rem"}, ${Math.min(autoVw, autoByLines)}${unit}, ${scale ? "9cqw" : "6rem"})`;
  }

  // Fullscreen centers vertically; lower thirds sit where verticalPos says
  // (bottom is the classic broadcast position).
  const justify = !isLowerThird
    ? "center"
    : t.verticalPos === "top"
      ? "flex-start"
      : t.verticalPos === "center"
        ? "center"
        : "flex-end";

  const align = t.textAlign;
  const alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  return (
    <div
      className="slide-fade"
      style={{
        position: scale ? "relative" : "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        background: bg,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems,
        padding: `${t.safeMargin}%`,
        color: t.textColor,
        fontFamily: t.fontFamily || "var(--font-lyric)",
        fontWeight: t.fontWeight,
        textAlign: align,
        // @ts-expect-error css var
        "--tr-ms": `${t.transitionMs}ms`,
        overflow: "hidden",
        boxSizing: "border-box",
        ...(scale ? { containerType: "size" } : {}),
      }}
    >
      {/* background media (image/video) — sits behind lyrics + scrim */}
      {media && media.type === "image" && media.url && (
        <img
          src={media.url}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: media.fit === "fill" ? "fill" : media.fit === "contain" ? "contain" : "cover",
            pointerEvents: "none",
          }}
        />
      )}
      {media && media.type === "video" && media.url && (
        <video
          src={media.url}
          autoPlay
          muted
          playsInline
          loop={media.loop}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: media.fit === "fill" ? "fill" : media.fit === "contain" ? "contain" : "cover",
            pointerEvents: "none",
          }}
        />
      )}

      {/* scrim */}
      {t.overlayScrim > 0 && state.status !== "blank" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,0,0,${t.overlayScrim / 100})`,
            pointerEvents: "none",
          }}
        />
      )}

      {showText && (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            // lower_third_bg draws a backdrop bar behind the text band
            ...(t.displayMode === "lower_third_bg"
              ? { background: t.bgColor, padding: "0.5em 0.8em", borderRadius: "0.15em" }
              : {}),
          }}
        >
          <div
            style={{
              fontSize,
              lineHeight: 1.22,
              ...outlineStyle(t),
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {state.sourceLines.map((line, i) => (
              <div key={i}>{line || "\u00A0"}</div>
            ))}
          </div>
          {state.translationLines.length > 0 && (
            <div
              style={{
                marginTop: "0.5em",
                fontSize: `calc(${fontSize} * 0.7)`,
                opacity: 0.78,
                lineHeight: 1.2,
                ...outlineStyle(t),
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {state.translationLines.map((line, i) => (
                <div key={i}>{line || "\u00A0"}</div>
              ))}
            </div>
          )}
          {t.showCaption && state.sectionLabel && (
            <div
              style={{
                marginTop: "0.7em",
                fontSize: `calc(${fontSize} * 0.42)`,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: t.captionColor || "#a3e635",
                ...outlineStyle(t),
              }}
            >
              {state.sectionLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
