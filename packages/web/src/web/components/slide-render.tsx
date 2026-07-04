import type { LiveState, LiveTheme } from "../lib/live-bus";

/**
 * The ONE render engine. Produces the lyric slide from live state + theme.
 * Reused by the projector window and the operator preview (scaled down).
 */

function outlineStyle(t: LiveTheme): React.CSSProperties {
  if (!t.textOutline || !t.textOutline.width) return {};
  const w = t.textOutline.width;
  const c = t.textOutline.color;
  return {
    textShadow: `0 0 ${w}px ${c}, ${w}px ${w}px ${w}px ${c}, -${w}px -${w}px ${w}px ${c}`,
  };
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
  const autoVw = Math.max(2.4, Math.min(7.5, 46 / Math.max(longest, 10)));
  const autoByLines = Math.max(2.4, 8 - lineCount * 0.5);
  // Use container-query width (cqw) when rendered as a scaled preview so the
  // font sizes relative to the small box, not the whole viewport. The full
  // projector uses viewport width (vw).
  const unit = scale ? "cqw" : "vw";
  const fontSize = t.fontSize
    ? scale
      ? `${t.fontSize * 0.28}cqw`
      : `${t.fontSize}px`
    : `clamp(${scale ? "0.6rem" : "1.4rem"}, ${Math.min(autoVw, autoByLines)}${unit}, ${scale ? "9cqw" : "6rem"})`;

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
        </div>
      )}
    </div>
  );
}
