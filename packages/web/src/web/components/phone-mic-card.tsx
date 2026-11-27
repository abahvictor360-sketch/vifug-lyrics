import { useEffect, useState } from "react";
import { Copy, RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { newPhoneMicRoom, phoneMicUrl } from "../lib/phone-mic";
import type { AppSettings } from "../hooks/use-settings";

/**
 * Settings > AI auto-follow > Microphone: use a phone as the room microphone.
 *
 * The phone opens the link (or scans the code) and sends its microphone;
 * auto-follow then listens through it instead of a microphone on this
 * computer. See lib/phone-mic.ts for how it is carried.
 */
export function PhoneMicCard({
  settings,
  patchSettings,
  connection,
}: {
  settings: AppSettings | undefined;
  patchSettings: (p: Partial<AppSettings>) => void;
  connection?: { status: string; connected: boolean };
}) {
  const on = settings?.autoFollowPhoneMic ?? false;
  const room = settings?.autoFollowPhoneMicRoom ?? null;
  const url = on && room ? phoneMicUrl(room) : null;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let off = false;
    void QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#0a0a0c", light: "#ffffff" } }).then(
      (d) => !off && setQr(d),
    );
    return () => {
      off = true;
    };
  }, [url]);

  const status = !connection
    ? ""
    : connection.connected
      ? "Phone connected. Auto-follow is listening through it."
      : connection.status === "connecting"
        ? "Phone found, connecting..."
        : connection.status === "lost"
          ? "The phone dropped out. Reopen the page on it and press Send my microphone."
          : "Waiting for the phone. Open the link on it and press Send my microphone.";

  return (
    <div className="mt-3 rounded-lg border border-[var(--v-border)] bg-[var(--v-surface-3)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm">
            <Smartphone className="h-4 w-4" /> Use my phone as the microphone
          </span>
          <span className="block text-[12px] text-[var(--v-text-faint)]">
            Put a phone near the speaker, and auto-follow listens through it instead of the microphone chosen above.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Use my phone as the microphone"
          onClick={() =>
            patchSettings(
              !on
                ? { autoFollowPhoneMic: true, autoFollowPhoneMicRoom: room ?? newPhoneMicRoom() }
                : { autoFollowPhoneMic: false },
            )
          }
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-accent)] ${on ? "bg-[var(--v-accent)]" : "bg-[var(--v-surface-2)]"}`}
        >
          <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ease-out ${on ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>

      {url && (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {qr ? (
            <img src={qr} alt="QR code to open the phone microphone page" className="h-36 w-36 rounded bg-white" />
          ) : (
            <div className="h-36 w-36 rounded bg-[var(--v-surface-2)]" />
          )}
          <div className="min-w-0 flex-1 text-[12px]">
            <p className="text-[var(--v-text-dim)]">
              On the phone, scan the code (or open the link), then press <b>Send my microphone</b> and keep that page open.
            </p>
            <p className="mt-2 break-all rounded bg-[var(--v-surface-2)] px-2 py-1 font-mono text-[11px]">{url}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--v-border)] px-2.5 py-1 hover:border-[var(--v-accent)]"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                title="Makes the old link stop working"
                onClick={() => patchSettings({ autoFollowPhoneMicRoom: newPhoneMicRoom() })}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--v-border)] px-2.5 py-1 hover:border-[var(--v-accent)]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> New link
              </button>
            </div>
            <p
              role="status"
              className={`mt-2 ${connection?.connected ? "text-[var(--v-accent)]" : "text-[var(--v-text-faint)]"}`}
            >
              {status}
            </p>
            <p className="mt-1 text-[var(--v-text-faint)]">
              Pairing goes through app.vifug.com, so it needs the internet once. The sound itself goes straight from the phone to this computer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
