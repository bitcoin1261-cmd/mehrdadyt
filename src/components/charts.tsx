"use client";

import { fmtMoney, fmtNum } from "@/lib/stats";

export interface Point {
  x: number;
  y: number;
  label: string;
}

/* ---------------------------------------------------------------- */
/* Equity curve                                                      */
/* ---------------------------------------------------------------- */
export function EquityChart({
  points,
  height = 300,
}: {
  points: { equity: number; time: string; label: string }[];
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        برای رسم نمودار سرمایه، حداقل یک معامله بسته‌شده لازم است
      </div>
    );
  }

  const W = 900;
  const H = height;
  const padL = 14;
  const padR = 62;
  const padT = 18;
  const padB = 30;

  const values = points.map((p) => p.equity);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;

  const sx = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const sy = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.equity).toFixed(1)}`).join(" ");
  const area = `${line} L${sx(points.length - 1).toFixed(1)},${H - padB} L${padL},${H - padB} Z`;
  const last = points[points.length - 1];
  const positive = last.equity >= points[0].equity;
  const stroke = positive ? "#34d399" : "#fb7185";

  const gridCount = 4;
  const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = min + ((max - min) * i) / gridCount;
    return { v, y: sy(v) };
  });

  const fmtDateShort = (iso: string) => iso.slice(5, 10).replace("-", "/");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="نمودار سرمایه">
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={g.y} y2={g.y} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
          <text x={W - padR + 8} y={g.y + 4} fill="#64748b" fontSize="12" fontFamily="monospace">
            {fmtNum(g.v, 0)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#eqFill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      <circle cx={sx(points.length - 1)} cy={sy(last.equity)} r="5" fill={stroke} />
      <circle cx={sx(points.length - 1)} cy={sy(last.equity)} r="9" fill={stroke} opacity="0.25" />

      <text x={padL} y={H - 8} fill="#64748b" fontSize="12">
        {fmtDateShort(points[0].time)}
      </text>
      <text x={(W - padR) / 2} y={H - 8} fill="#64748b" fontSize="12" textAnchor="middle">
        {fmtDateShort(points[Math.floor(points.length / 2)].time)}
      </text>
      <text x={W - padR} y={H - 8} fill="#64748b" fontSize="12" textAnchor="end">
        {fmtDateShort(last.time)}
      </text>

      <text
        x={padL + 6}
        y={padT + 4}
        fill={stroke}
        fontSize="13"
        fontFamily="monospace"
      >
        {fmtMoney(last.equity)}
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Bars (daily / monthly P&L)                                        */
/* ---------------------------------------------------------------- */
export function PnlBars({ data }: { data: { label: string; net: number }[] }) {
  if (!data.length) return <div className="py-10 text-center text-sm text-slate-500">داده‌ای برای نمایش نیست</div>;
  const W = 900;
  const H = 240;
  const padT = 16;
  const padB = 28;
  const pad = 20;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.net)), 1);
  const zeroY = padT + (H - padT - padB) / 2;
  const slot = (W - pad * 2) / data.length;
  const bw = Math.max(3, Math.min(38, slot * 0.62));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="سود و ضرر روزانه">
      <line x1={pad} x2={W - pad} y1={zeroY} y2={zeroY} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
      {data.map((d, i) => {
        const h = (Math.abs(d.net) / maxAbs) * ((H - padT - padB) / 2 - 4);
        const x = pad + i * slot + (slot - bw) / 2;
        const y = d.net >= 0 ? zeroY - h : zeroY;
        const color = d.net >= 0 ? "#34d399" : "#fb7185";
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x} y={y} width={bw} height={Math.max(1.5, h)} rx="3" fill={color} opacity="0.85" />
            {data.length <= 32 && (
              <text x={x + bw / 2} y={H - 8} fill="#64748b" fontSize="11" textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Donut                                                             */
/* ---------------------------------------------------------------- */
export function Donut({
  wins,
  losses,
  be,
  centerLabel,
  centerValue,
}: {
  wins: number;
  losses: number;
  be: number;
  centerLabel: string;
  centerValue: string;
}) {
  const total = wins + losses + be;
  const R = 60;
  const C = 2 * Math.PI * R;
  const seg = (v: number) => (total ? (v / total) * C : 0);

  return (
    <div className="flex items-center justify-center gap-5">
      <svg viewBox="0 0 160 160" className="h-40 w-40">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(51,65,85,0.6)" strokeWidth="18" />
        {total > 0 && (
          <>
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="#34d399"
              strokeWidth="18"
              strokeDasharray={`${seg(wins)} ${C}`}
              strokeDashoffset={0}
              transform="rotate(-90 80 80)"
              strokeLinecap="butt"
            />
            <circle
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke="#fb7185"
              strokeWidth="18"
              strokeDasharray={`${seg(losses)} ${C}`}
              strokeDashoffset={-seg(wins)}
              transform="rotate(-90 80 80)"
            />
            {be > 0 && (
              <circle
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="18"
                strokeDasharray={`${seg(be)} ${C}`}
                strokeDashoffset={-(seg(wins) + seg(losses))}
                transform="rotate(-90 80 80)"
              />
            )}
          </>
        )}
        <text x="80" y="76" textAnchor="middle" fill="#e2e8f5" fontSize="24" fontWeight="700">
          {centerValue}
        </text>
        <text x="80" y="98" textAnchor="middle" fill="#64748b" fontSize="12">
          {centerLabel}
        </text>
      </svg>
      <ul className="space-y-2 text-xs">
        <li className="flex items-center gap-2 text-slate-300">
          <span className="h-3 w-3 rounded bg-emerald-400" /> برنده: {wins}
        </li>
        <li className="flex items-center gap-2 text-slate-300">
          <span className="h-3 w-3 rounded bg-rose-400" /> بازنده: {losses}
        </li>
        <li className="flex items-center gap-2 text-slate-300">
          <span className="h-3 w-3 rounded bg-slate-400" /> سر به سر: {be}
        </li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* R multiple histogram                                              */
/* ---------------------------------------------------------------- */
export function RHistogram({ values }: { values: number[] }) {
  const buckets = [
    { label: "≤-2R", min: -Infinity, max: -2 },
    { label: "-2R", min: -2, max: -1 },
    { label: "-1R", min: -1, max: 0 },
    { label: "1R", min: 0, max: 1 },
    { label: "2R", min: 1, max: 2 },
    { label: "3R", min: 2, max: 3 },
    { label: "≥3R", min: 3, max: Infinity },
  ];
  const counts = buckets.map((b) => values.filter((v) => v >= b.min && v < b.max).length);
  const max = Math.max(...counts, 1);

  return (
    <div className="space-y-2">
      {buckets.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-[11px] text-slate-400">{b.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800/70">
            <div
              className={`h-full rounded ${i < 3 ? "bg-gradient-to-l from-rose-500 to-rose-400" : "bg-gradient-to-l from-emerald-500 to-teal-400"}`}
              style={{ width: `${(counts[i] / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-[11px] tabular-nums text-slate-400">{counts[i]}</span>
        </div>
      ))}
    </div>
  );
}
