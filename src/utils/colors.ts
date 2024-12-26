/**
 * Maps color names to ANSI color codes.
 * @param color - Name of the color
 * @returns ANSI color code string
 */
export function getColorCode(color: string): string {
  const codes: Record<string, string> = {
    black: "30",
    red: "31",
    green: "32",
    yellow: "33",
    blue: "34",
    magenta: "35",
    cyan: "36",
    white: "37",
  };
  return codes[color.toLowerCase()] || "37";
}

export const ANSI_COLORS = ["blue", "green", "yellow", "magenta", "cyan"].map(
  (c: string) => `\x1b[${getColorCode(c)}m`
);
