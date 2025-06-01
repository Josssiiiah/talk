/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        spin: "spin 1s linear infinite",
      },
      colors: {
        background: "hsl(0, 0%, 100%)",
        foreground: "hsl(240, 10%, 3.9%)",
        card: "hsl(0, 0%, 100%)",
        "card-foreground": "hsl(240, 10%, 3.9%)",
        primary: "hsl(240, 5.9%, 10%)",
        "primary-foreground": "hsl(0, 0%, 98%)",
        muted: "hsl(240, 4.8%, 95.9%)",
        "muted-foreground": "hsl(240, 3.8%, 46.1%)",
        destructive: "hsl(0, 84.2%, 60.2%)",
        "destructive-foreground": "hsl(0, 0%, 98%)",
      },
    },
  },
  plugins: [],
};
