import { useServerNow } from "../hooks/use-server-clock";
import { useMedia } from "../hooks/use-media";
import { useMediaUrl } from "../hooks/use-media-url";
import { colorFilterCss } from "../lib/color-filters";
import {
  DEFAULT_TIMER_BG,
  formatTimer,
  timerMs,
  timerPhase,
  timerVisibleOn,
  type ServiceTimer,
  type TimerScreens,
} from "../lib/timer";

/**
 * Sized against the screen it is drawn on, or against its own box when that
 * box is a scaled-down copy of a screen - the operator's Live thumbnail. The
 * same swap the slides make, and for the same reason: 7vmin inside a 300px
 * preview is the viewport's 7%, which would put a countdown across the whole
 * thumbnail and tell the operator nothing about how it will actually look.
 */
const SIZES: Record<ServiceTimer["size"], [string, string]> = {
  small: ["clamp(20px, 4vmin, 46px)", "4cqmin"],
  medium: ["clamp(28px, 7vmin, 80px)", "7cqmin"],
  large: ["clamp(38px, 11vmin, 130px)", "11cqmin"],
};

/**
 * In the middle the timer is the thing on the screen, not a badge over it, so
 * it is sized to the screen's width instead of a few percent of its height.
 * Small / medium / large are the share of the width the digits may take.
 */
const FILL_WIDTH: Record<ServiceTimer["size"], number> = { small: 0.5, medium: 0.7, large: 0.9 };

const CORNERS: Record<Exclude<ServiceTimer["position"], "center">, React.CSSProperties> = {
  "top-left": { top: "4%", left: "4%" },
  "top-right": { top: "4%", right: "4%" },
  "bottom-left": { bottom: "8%", left: "4%" },
  "bottom-right": { bottom: "8%", right: "4%" },
};

/** The picture, video or colour behind the digits. */
function TimerBackdrop({ timer }: { timer: ServiceTimer }) {
  const bg = timer.bg ?? DEFAULT_TIMER_BG;
  const media = useMedia().data?.find((m) => m.id === bg.mediaId);
  const url = useMediaUrl(bg.kind === "media" && media && media.type !== "color" ? media.url : null);
  if (bg.kind === "none") return null;
  const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };
  if (bg.kind === "color") return <div aria-hidden style={{ ...fill, background: bg.color }} />;
  if (!media) return null;
  if (media.type === "color") return <div aria-hidden style={{ ...fill, background: media.url }} />;
  const filter = colorFilterCss(media.colorFilter);
  if (media.type === "video") {
    return url ? <video aria-hidden src={url} autoPlay muted loop playsInline style={{ ...fill, objectFit: "cover", filter }} /> : null;
  }
  return url ? <img aria-hidden alt="" src={url} style={{ ...fill, objectFit: "cover", filter }} /> : null;
}

/**
 * The timer as every screen draws it.
 *
 * One component for the projector, the stream overlay and the stage display,
 * for the same reason the announcement bar is shared: a countdown that reads
 * 0:30 on the stage monitor and 0:27 on the projector is worse than useless to
 * the person watching both.
 *
 * It ticks locally off a server-corrected clock rather than waiting to be told
 * the time - see lib/timer.ts.
 */
export function TimerOverlay({
  timer,
  screen,
  scale,
}: {
  timer: ServiceTimer | null | undefined;
  screen: keyof TimerScreens;
  /** Drawn inside a scaled preview of a screen rather than on one. */
  scale?: boolean;
}) {
  const visible = timerVisibleOn(timer, screen);
  // The hook must run every render, so the interval is gated rather than the
  // call: a hidden timer costs nothing but does not break the hook order.
  const now = useServerNow(visible);
  if (!visible || !timer) return null;

  const ms = timerMs(timer, now);
  const phase = timerPhase(timer, ms);
  const color = phase === "over" ? "#ff5a5a" : phase === "warn" ? "#f4b740" : timer.color;
  const text = formatTimer(ms);
  const centred = timer.position === "center";
  const hasBg = (timer.bg ?? DEFAULT_TIMER_BG).kind !== "none";

  let size = SIZES[timer.size][scale ? 1 : 0];
  if (centred) {
    // Monospace digits are about 0.6em wide, so the font size that makes the
    // string span a share of the width is share / (characters x 0.6). Capped
    // by the height so a short, wide screen does not overflow.
    const w = scale ? "cqw" : "vw";
    const h = scale ? "cqh" : "vh";
    const share = FILL_WIDTH[timer.size] * 100;
    size = `min(calc(${share}${w} / ${(text.length * 0.6).toFixed(2)}), ${timer.label ? 55 : 70}${h})`;
  }

  const digits = (
    <>
      {timer.label ? (
        <div
          style={{
            fontSize: `calc(${size} * ${centred ? 0.18 : 0.3})`,
            fontWeight: 600,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color,
            opacity: 0.85,
            marginBottom: "0.15em",
          }}
        >
          {timer.label}
        </div>
      ) : null}
      <div
        style={{
          fontSize: size,
          fontWeight: 800,
          color,
          fontVariantNumeric: "tabular-nums",
          // Tabular figures alone are not enough at display sizes - without a
          // mono stack the digits still shuffle as the seconds change.
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        {text}
      </div>
    </>
  );

  // Readable over a photo or video without a panel behind it.
  const shadow = "0 2px 14px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.9)";

  if (centred) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          overflow: "hidden",
          textShadow: shadow,
          lineHeight: 1.05,
        }}
      >
        <TimerBackdrop timer={timer} />
        <div style={{ position: "relative" }}>{digits}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        ...CORNERS[timer.position as keyof typeof CORNERS],
        zIndex: 40,
        pointerEvents: "none",
        textShadow: shadow,
        lineHeight: 1.05,
        ...(hasBg ? { padding: "0.25em 0.5em", borderRadius: "0.18em", overflow: "hidden", fontSize: size } : {}),
      }}
    >
      {hasBg && <TimerBackdrop timer={timer} />}
      <div style={{ position: "relative" }}>{digits}</div>
    </div>
  );
}
