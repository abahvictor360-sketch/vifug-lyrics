import { useEffect } from "react";
import { SlideRender } from "../components/slide-render";
import { CaptureView } from "../components/capture";
import { AnnouncementTicker } from "../components/announcement-ticker";
import { LogoOverlay } from "../components/logo-overlay";
import { useLiveState } from "../hooks/use-live";
import { useSettings } from "../hooks/use-settings";
import { useOnlineLook } from "../hooks/use-online-look";

/**
 * The online audience's picture: the camera, with whatever is live in the
 * room laid over it as a lower third.
 *
 * It is what the built-in stream captures when Settings > Streaming & output
 * > "What the online audience sees" is set to a lower third - the room keeps
 * its full-screen words, and viewers at home see the speaker with the words
 * along the bottom. It can also be opened in a browser as a full-screen
 * programme output for a vision mixer.
 */
export default function BroadcastPage() {
  const sent = useLiveState();
  const settings = useSettings({ refetchInterval: 4000 }).data;
  const state = useOnlineLook(sent, settings);
  const camera = settings?.online?.cameraId || null;
  const announcement = settings?.announcement;

  useEffect(() => {
    document.title = "Vifug Broadcast";
    document.body.style.overflow = "hidden";
    document.body.style.background = "#000";
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", containerType: "size" }}>
      {camera && (
        <div style={{ position: "absolute", inset: 0 }}>
          <CaptureView sourceId={camera} muted fit="cover" />
        </div>
      )}
      <div style={{ position: "absolute", inset: 0 }}>
        <SlideRender state={state} transparent scale />
      </div>
      <LogoOverlay logo={settings?.logo} hasVideo={!!camera} />
      {announcement?.enabled && (
        <AnnouncementTicker
          text={announcement.text}
          speed={announcement.speed}
          bgColor={announcement.bgColor}
          textColor={announcement.textColor}
        />
      )}
    </div>
  );
}
