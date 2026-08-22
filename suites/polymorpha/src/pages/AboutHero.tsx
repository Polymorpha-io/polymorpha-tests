import React from "react";
import {
  CONNECTION_LINES,
  PRIMARY_BLOBS,
  SECONDARY_BLOBS,
  TINY_BLOBS,
  type BlobShape,
  type TinyBlob,
} from "./blobData";

function BlobOrb({ b }: { b: BlobShape }) {
  const kt = b.keyTimes ?? "0;0.15;0.35;0.5;0.65;0.85;1";
  const ks =
    b.keySplines ??
    "0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1";
  return (
    <g className={b.className}>
      <path
        fill={b.fill}
        opacity={b.opacity}
        filter={b.filter}
        stroke="white"
        strokeWidth={b.strokeWidth}
        strokeOpacity={b.strokeOpacity}
      >
        <animate
          attributeName="d"
          dur={`${b.morphDuration}s`}
          begin={b.morphBegin}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={ks}
          keyTimes={kt}
          values={b.morphValues}
        />
      </path>
      {b.colorShiftFill && (
        <path opacity="0">
          <animate
            attributeName="d"
            dur={`${b.morphDuration}s`}
            begin={b.morphBegin}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines={ks}
            keyTimes={kt}
            values={b.morphValues}
          />
          <animate
            attributeName="fill"
            dur={`${b.shiftDuration}s`}
            begin={b.shiftBegin}
            repeatCount="indefinite"
            values={b.colorShiftFill}
          />
          <animate
            attributeName="opacity"
            dur={`${b.shiftDuration}s`}
            begin={b.shiftBegin}
            repeatCount="indefinite"
            values={b.colorShiftOpacity!}
          />
        </path>
      )}
      {b.ellipses.map((e, i) => (
        <ellipse
          key={`e${i}`}
          cx={e.cx}
          cy={e.cy}
          rx={e.rx}
          ry={e.ry}
          fill="white"
          opacity={e.opacity}
        />
      ))}
      {b.sparkles.map((s, i) => (
        <circle
          key={`s${i}`}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="white"
          opacity={s.opacity}
        />
      ))}
      {b.lines.map((l, i) => (
        <line
          key={`l${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="white"
          strokeWidth={b.lineWidth ?? 0.7}
          strokeOpacity={l.opacity}
          strokeDasharray={b.lineDash ?? "3 3"}
        />
      ))}
    </g>
  );
}

function DriftBlob({ b }: { b: BlobShape }) {
  const ks = "0.3 0 0.7 1;0.3 0 0.7 1;0.3 0 0.7 1;0.3 0 0.7 1";
  return (
    <g className={b.className}>
      <path
        fill={b.fill}
        opacity={b.opacity}
        filter={b.filter}
        stroke="white"
        strokeWidth={b.strokeWidth}
        strokeOpacity={b.strokeOpacity}
      >
        <animate
          attributeName="d"
          dur={`${b.morphDuration}s`}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={ks}
          values={b.morphValues}
        />
      </path>
      {b.ellipses.map((e, i) => (
        <ellipse
          key={`e${i}`}
          cx={e.cx}
          cy={e.cy}
          rx={e.rx}
          ry={e.ry}
          fill="white"
          opacity={e.opacity}
        />
      ))}
      {b.sparkles.map((s, i) => (
        <circle
          key={`s${i}`}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="white"
          opacity={s.opacity}
        />
      ))}
      {b.lines.map((l, i) => (
        <line
          key={`l${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="white"
          strokeWidth={b.lineWidth ?? 0.5}
          strokeOpacity={l.opacity}
          strokeDasharray={b.lineDash ?? "2 2"}
        />
      ))}
    </g>
  );
}

function TinyDrift({ b }: { b: TinyBlob }) {
  const ks = "0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1";
  return (
    <g className={b.className}>
      <circle cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} opacity={b.opacity}>
        <animate
          attributeName="cx"
          dur={`${b.animDuration}s`}
          repeatCount="indefinite"
          values={b.cxValues}
          calcMode="spline"
          keySplines={ks}
        />
        <animate
          attributeName="cy"
          dur={`${b.animDuration2}s`}
          repeatCount="indefinite"
          values={b.cyValues}
          calcMode="spline"
          keySplines={ks}
        />
      </circle>
      <circle
        cx={b.sparkCx}
        cy={b.sparkCy}
        r={b.sparkR}
        fill="white"
        opacity={b.sparkOpacity}
      />
    </g>
  );
}

export function AboutHero() {
  const heroRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        el.style.setProperty(
          "--blob-spread",
          `${Math.min(window.scrollY * 0.33, 120)}px`,
        );
        el.style.setProperty(
          "--hero-translate",
          `${Math.min(window.scrollY * 0.25, 300)}px`,
        );
        el.style.setProperty(
          "--hero-opacity",
          Math.max(0.15, 1 - window.scrollY / window.innerHeight).toString(),
        );
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="about-blob-hero" ref={heroRef}>
      <svg
        className="about-blob-hero-svg"
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bh1" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#6366f1" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
          </radialGradient>
          <radialGradient id="bh2" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.65" />
          </radialGradient>
          <radialGradient id="bh3" cx="40%" cy="30%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
          </radialGradient>
          <filter id="bhGlow">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="about-blob-scatter-group">
          {CONNECTION_LINES.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="white"
              strokeWidth={i < 2 ? "0.5" : "0.4"}
              opacity={l.opacity}
            />
          ))}
          {PRIMARY_BLOBS.map((b, i) => (
            <BlobOrb key={`p${i}`} b={b} />
          ))}
          {SECONDARY_BLOBS.map((b, i) => (
            <DriftBlob key={`s${i}`} b={b} />
          ))}
          {TINY_BLOBS.map((b, i) => (
            <TinyDrift key={`t${i}`} b={b} />
          ))}
        </g>
      </svg>
      <div className="about-scroll-indicator" aria-hidden="true">
        <span>Scroll</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
