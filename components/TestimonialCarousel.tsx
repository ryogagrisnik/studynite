"use client";
import { useEffect, useState } from "react";

type Item = { quote: string; author: string; tag?: string };

export default function TestimonialCarousel({ items, interval = 4800 }: { items: Item[]; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % items.length), interval);
    return () => clearInterval(id);
  }, [items.length, interval]);

  return (
    <div className="tcar" role="region" aria-label="Student testimonials">
      {items.map((t, idx) => (
        <figure key={idx} className={"tcar__slide" + (idx === i ? " is-active" : "")}
                aria-hidden={idx !== i}>
          {t.tag ? <span className="tcar__tag">{t.tag}</span> : null}
          <blockquote>“{t.quote}”</blockquote>
          <figcaption>— {t.author}</figcaption>
        </figure>
      ))}
      <div className="tcar__dots">
        {items.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Go to testimonial ${idx + 1}`}
            className={"tcar__dot" + (idx === i ? " is-active" : "")}
            onClick={() => setI(idx)}
          />
        ))}
      </div>
      <style jsx>{`
        .tcar{ position:relative; border-radius:18px; border:1px solid rgba(249,177,84,.26); background:#fff; padding: 18px 22px; }
        .tcar__slide{ position:absolute; inset:0; padding:18px 22px; opacity:0; visibility:hidden; transition:opacity .45s ease; display:grid; gap:10px; }
        .tcar__slide.is-active{ opacity:1; visibility:visible; position:relative; }
        .tcar__tag{ align-self:start; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#7a4a2d; background:#fff7ee; border:1px solid #f4d8be; padding:4px 8px; border-radius:999px; width:max-content; }
        blockquote{ margin:0; font-size:16px; line-height:1.6; color:rgba(47,17,4,.86); }
        figcaption{ font-size:13px; color:rgba(47,17,4,.62); }
        .tcar__dots{ position:absolute; right:10px; bottom:10px; display:flex; gap:6px; }
        .tcar__dot{ width:8px; height:8px; border-radius:999px; background:#f4d8be; border:none; cursor:pointer; }
        .tcar__dot.is-active{ background:#f77f00; }
      `}</style>
    </div>
  );
}
