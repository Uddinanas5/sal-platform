"use client"

import dynamic from "next/dynamic"
import { ChartSkeleton } from "./chart-skeleton"

export const LazyAreaChart = dynamic(
  () => import("./area-chart").then((mod) => ({ default: mod.AreaChartComponent })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

export const LazyBarChart = dynamic(
  () => import("./bar-chart").then((mod) => ({ default: mod.BarChartComponent })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

export const LazyLineChart = dynamic(
  () => import("./line-chart").then((mod) => ({ default: mod.LineChartComponent })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

export const LazyPieChart = dynamic(
  () => import("./pie-chart").then((mod) => ({ default: mod.PieChartComponent })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

export const LazyChartContainer = dynamic(
  () => import("./chart-container").then((mod) => ({ default: mod.ChartContainer })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)
