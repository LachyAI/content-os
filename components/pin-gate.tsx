'use client'

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// The PIN is checked on the server, which sets an httpOnly session cookie that every
// /api route requires (proxy.ts). The page never sees the PIN.
const OLD_STORAGE_KEY = "content-os-pin-verified";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null); // null = loading
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.removeItem(OLD_STORAGE_KEY);
    } catch {}
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => setVerified(r.ok))
      .catch(() => setVerified(false));
  }, []);

  useEffect(() => {
    if (verified === false) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [verified]);

  function reject(message: string) {
    setError(message);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin("");
      inputRef.current?.focus();
    }, 600);
  }

  async function submit(digits: string) {
    setChecking(true);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: digits }),
      });
      if (res.ok) {
        setVerified(true);
      } else if (res.status === 429) {
        reject("Too many tries. Wait 15 minutes.");
      } else if (res.status === 401) {
        reject("Incorrect PIN");
      } else {
        reject("Couldn't check the PIN. Try again.");
      }
    } catch {
      reject("No connection. Try again.");
    } finally {
      setChecking(false);
    }
  }

  function handleChange(value: string) {
    if (checking) return;
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    setError(null);
    if (digits.length === 6) void submit(digits);
  }

  // Still asking the server whether this device is signed in
  if (verified === null) return null;

  if (verified) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div
        className={cn(
          "w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-8 space-y-6 text-center shadow-2xl",
          shake && "animate-shake"
        )}
        style={shake ? { animation: "shake 0.5s ease-in-out" } : undefined}
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Content Manager</h1>
          <p className="text-sm text-muted-foreground">Enter PIN to access</p>
        </div>

        {/* 6 digit display boxes */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              onClick={() => inputRef.current?.focus()}
              className={cn(
                "w-10 h-12 rounded-md border flex items-center justify-center text-lg font-mono font-semibold cursor-pointer transition-colors",
                i === pin.length
                  ? "border-primary ring-1 ring-primary/40"
                  : pin[i]
                    ? "border-border bg-secondary"
                    : "border-border bg-input"
              )}
            >
              {pin[i] ? "•" : ""}
            </div>
          ))}
        </div>

        {/* Hidden real input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          value={pin}
          onChange={(e) => handleChange(e.target.value)}
          className="sr-only"
          autoComplete="off"
        />

        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Click the boxes and type your 6-digit PIN
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
