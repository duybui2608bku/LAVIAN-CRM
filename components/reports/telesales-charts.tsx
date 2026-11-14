"use client";

import * as React from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type ChartType,
  type Plugin,
} from "chart.js";
import { FunnelController, TrapezoidElement } from "chartjs-chart-funnel";
import { Chart, Line } from "react-chartjs-2";

ChartJS.register(FunnelController, TrapezoidElement, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

type Palette = { primary: string; series2: string; fg: string; muted: string; border: string; card: string; font: string };
const FALLBACK: Palette = {
  primary: "#684fd4",
  series2: "#16834a",
  fg: "#18181b",
  muted: "#71717a",
  border: "#e7e7ec",
  card: "#ffffff",
  font: "system-ui, sans-serif",
};

const VARS = ["--chart-1", "--chart-3", "--foreground", "--muted-foreground", "--border", "--card"] as const;

/** Đổi theme (next-themes đổi class/style trên <html>) → đọc lại màu. */
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  return () => mo.disconnect();
}
const snapshot = () => {
  const css = getComputedStyle(document.documentElement);
  return [...VARS.map((v) => css.getPropertyValue(v).trim()), getComputedStyle(document.body).fontFamily].join("|");
};

/** Canvas không đọc được CSS var → lấy giá trị thật của theme hiện tại. */
function usePalette(): Palette {
  const key = React.useSyncExternalStore(subscribe, snapshot, () => "");
  return React.useMemo(() => {
    const [primary, series2, fg, muted, border, card, font] = key.split("|");
    return {
      primary: primary || FALLBACK.primary,
      series2: series2 || FALLBACK.series2,
      fg: fg || FALLBACK.fg,
      muted: muted || FALLBACK.muted,
      border: border || FALLBACK.border,
      card: card || FALLBACK.card,
      font: font || FALLBACK.font,
    };
  }, [key]);
}

const rgb = (hex: string): [number, number, number] | null => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
/** Trộn màu a → b theo t (0..1); màu không phải hex thì giữ a. */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return a;
  return `rgb(${x.map((c, i) => Math.round(c + (y[i] - c) * t)).join(",")})`;
}
const alpha = (color: string, a: number) => {
  const x = rgb(color);
  return x ? `rgba(${x.join(",")},${a})` : color;
};
function luminance(color: string): number {
  const m = color.match(/\d+/g);
  const c = color.startsWith("#") ? rgb(color) : m && m.length >= 3 ? (m.slice(0, 3).map(Number) as [number, number, number]) : null;
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Chữ đen/trắng theo nền, chọn cái tương phản cao hơn. */
const inkOn = (bg: string) => {
  const l = luminance(bg);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#18181b" : "#ffffff";
};

export type FunnelStep = { label: string; value: string; detail?: string };

declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    funnelLabels?: { steps: FunnelStep[]; font: string };
  }
}

/** In nhãn + số trực tiếp lên từng tầng phễu; chữ đen/trắng theo nền tầng. */
const funnelLabels: Plugin<"funnel", { steps: FunnelStep[]; font: string }> = {
  id: "funnelLabels",
  afterDatasetsDraw(chart, _args, { steps, font }) {
    const { ctx } = chart;
    const els = chart.getDatasetMeta(0).data;
    const halfOf = (i: number) => {
      const { x, base } = els[i].getProps(["x", "base"], true) as { x: number; base: number };
      return Math.abs(x - base);
    };
    els.forEach((el, i) => {
      const s = steps?.[i];
      if (!s) return;
      const { y, base } = el.getProps(["y", "base"], true) as { y: number; base: number };
      // Cạnh xiên thu từ độ rộng tầng này về tầng sau → lấy độ rộng ở giữa tầng.
      const half = (halfOf(i) + halfOf(Math.min(i + 1, els.length - 1))) / 2;
      const bg = (el.options as { backgroundColor?: string }).backgroundColor ?? FALLBACK.primary;
      const pad = 16;
      const value = s.detail ? `${s.value} (${s.detail})` : s.value;
      ctx.save();
      ctx.fillStyle = inkOn(bg);
      ctx.textBaseline = "middle";
      ctx.font = `500 12px ${font}`;
      const lw = ctx.measureText(s.label).width;
      ctx.font = `600 12px ${font}`;
      const vw = ctx.measureText(value).width;
      if (lw + vw + pad * 3 <= half * 2) {
        ctx.font = `500 12px ${font}`;
        ctx.textAlign = "left";
        ctx.fillText(s.label, base - half + pad, y);
        ctx.font = `600 12px ${font}`;
        ctx.textAlign = "right";
        ctx.fillText(value, base + half - pad, y);
      } else {
        // Tầng hẹp: xếp 2 dòng ở giữa.
        ctx.textAlign = "center";
        ctx.font = `500 11px ${font}`;
        ctx.fillText(s.label, base, y - 7);
        ctx.font = `600 11px ${font}`;
        ctx.fillText(value, base, y + 7);
      }
      ctx.restore();
    });
  },
};

/**
 * Phễu dạng hình thang (Chart.js + chartjs-chart-funnel). Độ rộng các tầng thu hẹp đều theo thứ tự
 * (dáng phễu cố định), số thật + % in trực tiếp trên từng tầng.
 */
export function FunnelChart({ steps, ariaLabel }: { steps: FunnelStep[]; ariaLabel: string }) {
  const p = usePalette();
  const n = steps.length;
  // Sequential 1 hue: tầng đầu đậm nhất, nhạt dần về đáy.
  const colors = steps.map((_, i) => mix(p.primary, p.card, n > 1 ? (i / (n - 1)) * 0.55 : 0));
  const widths = steps.map((_, i) => 1 - (n > 1 ? (i / (n - 1)) * 0.55 : 0));

  const options: ChartOptions<"funnel"> = {
    indexAxis: "y",
    maintainAspectRatio: false,
    animation: { duration: 400 },
    elements: { trapezoid: { shrinkAnchor: "top", shrinkFraction: 1, borderWidth: 2, borderColor: p.card } },
    plugins: {
      funnelLabels: { steps, font: p.font },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => steps[items[0]?.dataIndex ?? 0]?.label ?? "",
          label: (item) => {
            const s = steps[item.dataIndex];
            return s ? (s.detail ? `${s.value} (${s.detail})` : s.value) : "";
          },
        },
      },
    },
  };

  return (
    <div className="relative h-60">
      <Chart
        type="funnel"
        aria-label={ariaLabel}
        role="img"
        data={{ labels: steps.map((s) => s.label), datasets: [{ data: widths, backgroundColor: colors }] }}
        options={options}
        plugins={[funnelLabels]}
      />
    </div>
  );
}

export type TrendSeries = { label: string; data: number[] };

/** Biểu đồ đường + vùng (2 series, 1 trục). Tooltip theo ngày, legend dạng chấm tròn. */
export function TrendChart({ labels, series, ariaLabel }: { labels: string[]; series: [TrendSeries, TrendSeries]; ariaLabel: string }) {
  const p = usePalette();
  const colors = [p.primary, p.series2];

  const options: ChartOptions<"line"> = {
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: "index", intersect: false },
    font: { family: p.font },
    scales: {
      x: {
        grid: { display: false },
        border: { color: p.border },
        ticks: { color: p.muted, font: { size: 11, family: p.font }, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        beginAtZero: true,
        grid: { color: alpha(p.border, 0.8) },
        border: { display: false },
        ticks: { color: p.muted, font: { size: 11, family: p.font }, precision: 0, maxTicksLimit: 5 },
      },
    },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { color: p.fg, usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, font: { size: 12, family: p.font } },
      },
      tooltip: { usePointStyle: true, boxPadding: 4 },
    },
  };

  return (
    <div className="relative h-60">
      <Line
        aria-label={ariaLabel}
        role="img"
        options={options}
        data={{
          labels,
          datasets: series.map((s, i) => ({
            label: s.label,
            data: s.data,
            borderColor: colors[i],
            backgroundColor: (ctx: { chart: ChartJS }) => {
              const { ctx: c, chartArea } = ctx.chart;
              if (!chartArea) return alpha(colors[i], 0.12);
              const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, alpha(colors[i], i === 0 ? 0.28 : 0.18));
              g.addColorStop(1, alpha(colors[i], 0));
              return g;
            },
            fill: "origin",
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: p.card,
            pointBorderColor: colors[i],
            pointBorderWidth: 2,
          })),
        }}
      />
    </div>
  );
}
