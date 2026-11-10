import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Lock, Download, KeyRound, Loader2, RefreshCw, X } from "lucide-react";
import { useDesktop } from "../hooks/use-desktop";
import {
  cachedPolicy,
  dismissNag,
  evaluate,
  fetchPolicy,
  isLicensed,
  nagDismissedAt,
  redeemLicence,
  storedLicence,
  type GateState,
  type PublicPolicy,
} from "../lib/entitlement";

/** How often a running app re-reads the policy. It only ever produces a notice, never a lock. */
const RECHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * The pay-for-Vifug gate, on the operator screen only.
 *
 * While the owner's policy says "off" - which is how it ships - this renders
 * nothing and costs one small request at start. When it is switched on (see
 * api/lib/entitlement.ts) it can ask politely (a pop-up), lock the app until a
 * licence key is entered, or require an update. It never touches the
 * projector, stream or stage windows, and never locks an app that is already
 * running a service: a change that arrives mid-session becomes a notice.
 */
export function EntitlementGate() {
  const [isOperator] = useRoute("/");
  const desktop = useDesktop();
  const [policy, setPolicy] = useState<PublicPolicy | null>(() => cachedPolicy());
  const [licensed, setLicensed] = useState<boolean>(() => !!storedLicence());
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // What was decided when the app started. A later change only shows a notice.
  const [startState, setStartState] = useState<GateState | null>(null);
  const [nagHidden, setNagHidden] = useState(false);
  const decided = useRef(false);

  const stateNow = useCallback(
    (p: PublicPolicy | null, lic: boolean, v: string | null): GateState =>
      evaluate({ policy: p, licensed: lic, appVersion: v, now: Date.now(), nagDismissedAt: nagDismissedAt() }),
    [],
  );

  // Learn the installed version (desktop only; a browser is always current).
  useEffect(() => {
    if (!isOperator) return;
    let off = false;
    const fake = (() => {
      try {
        return window.localStorage.getItem("vifug-fake-version");
      } catch {
        return null;
      }
    })();
    void (desktop?.getAppVersion ? desktop.getAppVersion() : Promise.resolve(fake)).then((v) => {
      if (!off) {
        setAppVersion(fake ?? v ?? null);
        setReady(true);
      }
    });
    return () => {
      off = true;
    };
  }, [isOperator, desktop]);

  // Ask now, then now and then. Failure changes nothing.
  useEffect(() => {
    if (!isOperator || !ready) return;
    let off = false;
    const check = async () => {
      const [p, lic] = await Promise.all([fetchPolicy(), isLicensed()]);
      if (off) return;
      const nextPolicy = p ?? cachedPolicy();
      setPolicy(nextPolicy);
      setLicensed(lic);
      if (!decided.current) {
        decided.current = true;
        setStartState(stateNow(nextPolicy, lic, appVersion));
      }
    };
    // A remembered lock shows at once; the fresh answer may lift it a moment later.
    if (!decided.current) setStartState(stateNow(policy, licensed, appVersion));
    void check();
    const t = setInterval(() => void check(), RECHECK_EVERY_MS);
    return () => {
      off = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperator, ready, appVersion]);

  if (!isOperator || !ready || startState === null) return null;

  const current = stateNow(policy, licensed, appVersion);

  // Locked at start, and still not resolved.
  if ((startState === "lock" || startState === "update") && (current === "lock" || current === "update") && policy) {
    return (
      <LockScreen
        policy={policy}
        kind={current}
        onUnlocked={() => {
          setLicensed(true);
          setStartState("ok");
        }}
        onRecheck={async () => {
          const p = await fetchPolicy();
          const lic = await isLicensed();
          setPolicy(p ?? policy);
          setLicensed(lic);
          if (stateNow(p ?? policy, lic, appVersion) === "ok") setStartState("ok");
        }}
      />
    );
  }

  // A polite request, once the app has started.
  if (startState === "nag" && current === "nag" && !nagHidden && policy) {
    return (
      <NagDialog
        policy={policy}
        onLater={() => {
          dismissNag();
          setNagHidden(true);
        }}
        onUnlocked={() => setLicensed(true)}
      />
    );
  }

  // The policy changed while running: say so, don't interrupt.
  if (startState === "ok" && (current === "lock" || current === "update") && policy) {
    return (
      <div role="status" className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-xs font-medium text-black">
        {current === "update" ? "A required update is available." : "A Vifug subscription will be required the next time the app starts."}
        {policy.checkoutUrl && current === "lock" && (
          <a href={policy.checkoutUrl} target="_blank" rel="noreferrer" className="underline">
            Subscribe now
          </a>
        )}
      </div>
    );
  }
  return null;
}

function LicenceEntry({ onUnlocked, compact }: { onUnlocked: () => void; compact?: boolean }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setMsg(null);
    const r = await redeemLicence(key);
    setBusy(false);
    if (r === "valid") onUnlocked();
    else setMsg(r === "invalid" ? "That key was not recognised. Check it and try again." : "Couldn't reach the licence service. Check your connection and try again.");
  }
  return (
    <div className={compact ? "mt-3" : "mt-5"}>
      <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--v-text-faint)]">
        <KeyRound className="h-3.5 w-3.5" /> Already subscribed? Enter your licence key
      </p>
      <div className="flex gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && key.trim().length >= 6 && void go()}
          placeholder="VIFUG-XXXX-XXXX"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-[var(--v-border)] bg-[var(--v-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--v-accent)]"
        />
        <button
          onClick={() => void go()}
          disabled={busy || key.trim().length < 6}
          className="rounded-md bg-[var(--v-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
        </button>
      </div>
      {msg && <p className="mt-1.5 text-xs text-red-400">{msg}</p>}
    </div>
  );
}

function LockScreen({
  policy,
  kind,
  onUnlocked,
  onRecheck,
}: {
  policy: PublicPolicy;
  kind: "lock" | "update";
  onUnlocked: () => void;
  onRecheck: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const update = kind === "update";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gate-title" className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[var(--v-bg,#0a0a0c)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--v-border)] bg-[var(--v-surface-2)] p-7 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[var(--v-accent)] to-[var(--v-accent-2)] text-black">
          {update ? <Download className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
        </div>
        <h1 id="gate-title" className="font-display text-xl font-bold">
          {update ? "Please update Vifug" : policy.title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--v-text-dim)]">
          {update ? "This version of Vifug is no longer supported. Update to the latest version to carry on." : policy.message}
        </p>
        <p className="mt-1 text-[12px] text-[var(--v-text-faint)]">Your songs, themes and settings are safe and will be here when you are back.</p>

        {update ? (
          <a href={policy.updateUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--v-accent)] px-5 py-2.5 text-sm font-semibold text-black">
            <Download className="h-4 w-4" /> Download the update
          </a>
        ) : (
          <>
            {policy.checkoutUrl && (
              <a href={policy.checkoutUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--v-accent)] px-5 py-2.5 text-sm font-semibold text-black">
                Subscribe
              </a>
            )}
            <LicenceEntry onUnlocked={onUnlocked} />
          </>
        )}
        <button
          onClick={async () => {
            setBusy(true);
            await onRecheck();
            setBusy(false);
          }}
          className="mt-5 inline-flex items-center gap-1.5 text-xs text-[var(--v-text-faint)] hover:text-white"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check again
        </button>
      </div>
    </div>
  );
}

function NagDialog({ policy, onLater, onUnlocked }: { policy: PublicPolicy; onLater: () => void; onUnlocked: () => void }) {
  const [entering, setEntering] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="nag-title" className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-6">
      <div className="relative w-full max-w-md rounded-xl border border-[var(--v-border)] bg-[var(--v-surface-2)] p-7 text-center">
        <button onClick={onLater} aria-label="Remind me later" className="absolute right-3 top-3 rounded p-1 text-[var(--v-text-faint)] hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <h2 id="nag-title" className="font-display text-lg font-bold">{policy.title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--v-text-dim)]">{policy.message}</p>
        <div className="mt-5 flex flex-col items-center gap-2">
          {policy.checkoutUrl && (
            <a href={policy.checkoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg bg-[var(--v-accent)] px-5 py-2.5 text-sm font-semibold text-black">
              Subscribe
            </a>
          )}
          <button onClick={onLater} className="text-sm text-[var(--v-text-dim)] hover:text-white">
            Maybe later
          </button>
          {!entering && (
            <button onClick={() => setEntering(true)} className="text-xs text-[var(--v-text-faint)] underline">
              I have a licence key
            </button>
          )}
        </div>
        {entering && <LicenceEntry onUnlocked={onUnlocked} compact />}
      </div>
    </div>
  );
}
