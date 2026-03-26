import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        score: {
          low: "#ef4444",
          medium: "#f59e0b",
          high: "#22c55e",
          excellent: "#059669",
        },
      },
    },
  },
  plugins: [],
};
export default config;
