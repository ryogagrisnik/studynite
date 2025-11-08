"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  value: number; // target value
  duration?: number; // ms
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
};

export default function CounterStat({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: Props) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const prog = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - prog, 3); // easeOutCubic
      setDisplay(value * eased);
      if (prog < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = display.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <div className={`metric__num ${className}`}>{`${prefix}${formatted}${suffix}`}</div>
  );
}

