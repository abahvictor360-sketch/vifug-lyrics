import { MediaImg, MediaVideo } from "./media-el";
import { CaptureView } from "./capture";
import type { ThemeLayer } from "../lib/live-bus";

/**
 * Draws a theme's layers - pictures, videos and live cameras - in their boxes.
 * Called twice by the slide: once for the layers behind the words, once for
 * the ones in front. Always silent: a theme is a look, and the sound of the
 * service comes from the capture and media the operator sends, not from here.
 */
export function ThemeLayers({ layers, front }: { layers: ThemeLayer[] | undefined; front: boolean }) {
  const shown = (layers ?? []).filter((l) => !!l.front === front);
  if (!shown.length) return null;
  return (
    <>
      {shown.map((l) => (
        <div
          key={l.id}
          style={{
            position: "absolute",
            left: `${l.x}%`,
            top: `${l.y}%`,
            width: `${l.w}%`,
            height: `${l.h}%`,
            overflow: "hidden",
            borderRadius: l.radius ? `${l.radius}%` : undefined,
            pointerEvents: "none",
            animation: l.motion
              ? l.motion === "float"
                ? "vf-float 6s ease-in-out infinite"
                : l.motion === "pulse"
                  ? "vf-pulse 2.6s ease-in-out infinite"
                  : `vf-in-${l.motion} 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both`
              : undefined,
          }}
        >
          {l.kind === "image" && (
            <MediaImg src={l.src} alt="" style={{ width: "100%", height: "100%", objectFit: l.fit, display: "block" }} />
          )}
          {l.kind === "video" && (
            <MediaVideo
              src={l.src}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: "100%", height: "100%", objectFit: l.fit, display: "block" }}
            />
          )}
          {l.kind === "camera" && (
            <div style={{ position: "absolute", inset: 0, background: "#000" }}>
              <CaptureView sourceId={l.src} muted fit={l.fit} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
