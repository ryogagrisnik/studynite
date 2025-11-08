"use client";
import React from "react";

type CTAButtonProps = {
  label?: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
};

export default function CTAButton({
  label = "Start Practicing Free",
  href = "/signup",
  onClick,
  ariaLabel,
  size = "md",
  fullWidth = false,
  className = "",
}: CTAButtonProps) {
  const sizes = {
    sm: { pad: "10px 14px", fs: "14px" },
    md: { pad: "12px 18px", fs: "16px" },
    lg: { pad: "14px 22px", fs: "17px" },
  }[size];

  const Base = ({ children }: { children: React.ReactNode }) => (
    <>
      {children}
      <style jsx>{`
        .cta,
        .linkwrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: ${sizes.pad};
          font-size: ${sizes.fs};
          font-weight: 700;
          color: #fff;
          background: var(--orange, #F77F00);
          border: none;
          border-radius: var(--radius, 18px);
          box-shadow: var(--shadow, 0 10px 30px rgba(0,0,0,.06));
          cursor: pointer;
          transition: transform .06s ease, opacity .2s ease;
          text-decoration: none;
          white-space: nowrap;
        }
        .cta:hover,
        .linkwrap:hover { opacity: .95; }
        .cta:active,
        .linkwrap:active { transform: translateY(1px); }
        .full { width: 100%; }
      `}</style>
    </>
  );

  if (href && !onClick) {
    return (
      <Base>
        <a
          href={href}
          className={`linkwrap ${fullWidth ? "full" : ""} ${className}`}
          aria-label={ariaLabel || label}
        >
          {label}
        </a>
      </Base>
    );
  }

  return (
    <Base>
      <button
        type="button"
        aria-label={ariaLabel || label}
        className={`cta ${fullWidth ? "full" : ""} ${className}`}
        onClick={onClick}
      >
        {label}
      </button>
    </Base>
  );
}
