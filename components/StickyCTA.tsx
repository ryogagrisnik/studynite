"use client";
import { useEffect, useRef, useState } from "react";

export default function StickyCTA({ targetId = "plan-card-anchor", href = "#" }: { targetId?: string; href?: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const e = entries[0];
      setShow(!e.isIntersecting);
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  return (
    <div ref={ref} className={`stickybar ${show ? "is-visible" : ""}`}>
      <a className="stickybar__btn" href={href} onClick={(e)=>{ e.preventDefault(); document.getElementById(targetId)?.scrollIntoView({ behavior:'smooth'}); }}>
        Upgrade to Pro — $5.99/mo
      </a>
      <style jsx>{`
        .stickybar{ position:fixed; left:50%; transform:translateX(-50%) translateY(100%); bottom:12px; background:#2f1104; color:#fff; padding:10px 14px; border-radius:999px; box-shadow:0 12px 36px rgba(0,0,0,.25); opacity:0; transition:transform .3s ease, opacity .3s ease; z-index:60; }
        .stickybar.is-visible{ transform:translateX(-50%) translateY(0); opacity:1; }
        .stickybar__btn{ color:#fff; font-weight:800; text-decoration:none; white-space:nowrap; }
      `}</style>
    </div>
  );
}

