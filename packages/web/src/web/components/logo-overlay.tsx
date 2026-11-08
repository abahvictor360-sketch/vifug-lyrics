import { MediaImg } from "./media-el";

/** Where on the screen the station logo sits. Corners at the top only: the
 * bottom of the frame belongs to lower thirds, nameplates and the ticker. */
export type LogoPosition = "top-left" | "top-right";

export type LogoSettings = {
  enabled: boolean;
  /** Media-library url (or a browser-held "session:" marker) of the image. */
  url: string | null;
  position: LogoPosition;
  /** Width as a percentage of the frame, so it scales with the picture. */
  sizePct: number;
  /** 0.2 - 1. */
  opacity: number;
  /** Show only while live video (a camera or capture card) is on screen. */
  onlyOverVideo?: boolean;
};

export const DEFAULT_LOGO: LogoSettings = {
  enabled: false,
  url: null,
  position: "top-right",
  sizePct: 12,
  opacity: 1,
  onlyOverVideo: false,
};

/**
 * A logo pinned to a top corner of the live picture.
 *
 * Drawn by the same component for the projector and the stream page so the
 * two cannot disagree about where it is. It never takes clicks - it sits over
 * the picture and the picture's own controls must keep working - and its
 * size is a share of the frame's width, so it stays in proportion whether the
 * output is a 1080p canvas, a 4K projector or a small preview.
 */
export function LogoOverlay({ logo, hasVideo }: { logo?: LogoSettings | null; hasVideo: boolean }) {
  if (!logo?.enabled || !logo.url) return null;
  if (logo.onlyOverVideo && !hasVideo) return null;

  const size = Math.min(40, Math.max(3, logo.sizePct || DEFAULT_LOGO.sizePct));
  const opacity = Math.min(1, Math.max(0.2, logo.opacity ?? 1));
  const side = logo.position === "top-left" ? { left: "2.5%" } : { right: "2.5%" };

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "4%",
        ...side,
        width: `${size}%`,
        // A tall logo must not run down the screen; the image is contained
        // inside this box rather than stretched to it.
        maxHeight: "30%",
        opacity,
        pointerEvents: "none",
        // Above the video and the words, below nothing that matters: the
        // timer and the ticker have their own places and do not overlap.
        zIndex: 5,
        display: "flex",
        justifyContent: logo.position === "top-left" ? "flex-start" : "flex-end",
      }}
    >
      <MediaImg
        src={logo.url}
        alt=""
        draggable={false}
        style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
