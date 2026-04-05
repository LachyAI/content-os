'use client'

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const CORRECT_PIN = "210296";
const STORAGE_KEY = "content-os-pin-verified";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null); // null = loading
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setVerified(stored === "1");
  }, []);

  useEffect(() => {
    if (verified === false) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [verified]);

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPin(digits);
    setError(false);

    if (digits.length === 6) {
      if (digits === CORRECT_PIN) {
        localStorage.setItem(STORAGE_KEY, "1");
        setVerified(true);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
          inputRef.current?.focus();
        }, 600);
      }
    }
  }

  // Still loading from localStorage
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
          <p className="text-sm text-destructive font-medium">Incorrect PIN</p>
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
