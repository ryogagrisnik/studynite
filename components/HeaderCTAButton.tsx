"use client";
import React from "react";
import CTAButton from "./CTAButton";

export default function HeaderCTAButton() {
  return (
    <div className="hdr-cta">
      <CTAButton label="Start Practicing Free" href="/signup" size="sm" />
      <style jsx>{`
        .hdr-cta {
          display: flex;
          align-items: center;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}
