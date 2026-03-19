"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function ODKLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [locked, setLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pin.length === 6) {
      handleSubmit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function handleSubmit(value: string) {
    try {
      const res = await fetch("/api/command/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });

      if (res.status === 429) {
        setLocked(true);
        setError("Too many attempts. Try again in 15 minutes.");
        setPin("");
        return;
      }

      if (!res.ok) {
        setShake(true);
        setError("Access denied");
        setPin("");
        setTimeout(() => { setShake(false); setError(""); }, 2000);
        return;
      }

      router.push("/odk");
    } catch {
      setError("Connection error");
      setPin("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0F1C" }}>
      <div className="flex flex-col items-center gap-6">
        <Lock className="w-8 h-8" style={{ color: "#B8972B" }} />
        <input
          ref={inputRef}
          type="password"
          maxLength={6}
          value={pin}
          onChange={(e) => { if (!locked) setPin(e.target.value); }}
          disabled={locked}
          placeholder="------"
          autoComplete="off"
          className={`
            w-48 text-center text-2xl tracking-[0.5em] font-mono py-3 px-4
            bg-transparent border-b-2 outline-none
            disabled:opacity-30
            ${shake ? "animate-shake" : ""}
          `}
          style={{
            color: "#B8972B",
            borderColor: error ? "#e05c5c" : "#B8972B40",
            caretColor: "#B8972B",
          }}
        />
        {error && (
          <p className="text-xs" style={{ color: "#e05c5c" }}>{error}</p>
        )}
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        input::placeholder {
          color: #B8972B20;
          letter-spacing: 0.5em;
        }
      `}</style>
    </div>
  );
}
