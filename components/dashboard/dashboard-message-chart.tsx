"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type DashboardMessageChartProps = {
  data: Array<{
    label: string;
    inbound: number;
    outbound: number;
  }>;
};

const chartConfig = {
  inbound: {
    label: "Inbound",
    color: "#10b981"
  },
  outbound: {
    label: "Outbound",
    color: "#0ea5e9"
  }
} satisfies ChartConfig;

export function DashboardMessageChart({ data }: DashboardMessageChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full aspect-auto md:h-[320px]">
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -24, bottom: 4 }}>
        <defs>
          <linearGradient id="dashboardInboundGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-inbound)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-inbound)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="dashboardOutboundGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-outbound)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-outbound)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Area
          type="monotone"
          dataKey="inbound"
          stroke="var(--color-inbound)"
          fill="url(#dashboardInboundGradient)"
          strokeWidth={3}
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="outbound"
          stroke="var(--color-outbound)"
          fill="url(#dashboardOutboundGradient)"
          strokeWidth={3}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
