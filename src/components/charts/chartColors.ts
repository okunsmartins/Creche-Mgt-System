// Soft pastel palette for charts — tuned to the lavender theme.
export const CHART_COLORS = [
  '#a78bfa', // violet
  '#f4a9c7', // pink
  '#f6cd72', // amber
  '#8fca9d', // green
  '#89b8f2', // blue
  '#c9a7ec', // lilac
  '#f0b892', // peach
]

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] as string
}
