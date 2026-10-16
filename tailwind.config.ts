import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        coral: "var(--coral)",
        teal: "var(--teal)",
        overprint: "var(--overprint)",
        ink: "var(--ink)",
        faded: "var(--faded)",
        buff: "var(--buff)",
        score: {
          low: "var(--score-low)",
          mid: "var(--score-mid)",
          high: "var(--score-high)",
          excellent: "var(--score-excellent)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      fontSize: {
        "score-hero": ["7.5rem", { lineHeight: "0.82", fontWeight: "800" }],
        "title-xl": ["3.2rem", { lineHeight: "0.88", fontWeight: "800" }],
        "section": ["0.72rem", { lineHeight: "1.4", fontWeight: "700", letterSpacing: "0.06em" }],
        "label": ["0.6rem", { lineHeight: "1.4", fontWeight: "700", letterSpacing: "0.04em" }],
        "body-sm": ["0.62rem", { lineHeight: "1.55" }],
        "tag": ["0.58rem", { lineHeight: "1.4", letterSpacing: "0.08em" }],
      },
    },
  },
  plugins: [],
};
export default config;
