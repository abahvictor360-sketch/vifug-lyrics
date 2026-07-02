import { useEffect } from "react";
import { SlideRender } from "../components/slide-render";
import { useLiveState } from "../hooks/use-live";

/** Pure lyric output. Loaded in the second-monitor Electron window (or a browser tab). */
export default function ProjectorPage() {
  const state = useLiveState();

  useEffect(() => {
    document.title = "Vifug Projector";
    document.body.style.cursor = "none";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <SlideRender state={state} />
    </div>
  );
}
