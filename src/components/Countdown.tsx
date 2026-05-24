"use client";

import { useEffect, useState, useRef } from "react";

interface CountdownProps {
  expiresAt: string;
  onExpired: () => void;
}

export default function Countdown({ expiresAt, onExpired }: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const expiredCalled = useRef(false);

  useEffect(() => {
    function tick() {
      const diff = Math.floor(
        (new Date(expiresAt).getTime() - Date.now()) / 1000
      );
      if (diff <= 0) {
        setSecondsLeft(0);
        if (!expiredCalled.current) {
          expiredCalled.current = true;
          onExpired();
        }
      } else {
        setSecondsLeft(diff);
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-3xl font-mono font-bold tabular-nums ${
        isUrgent ? "text-red-600" : "text-yellow-800"
      }`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      {isUrgent && (
        <span className="text-sm text-red-500 font-medium animate-pulse">
          Expiring soon!
        </span>
      )}
    </div>
  );
}