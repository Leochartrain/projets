import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "fr.leochartrain.fonte",
  appName: "Fonte",
  webDir: "dist",
  android: { backgroundColor: "#14120f" },
  plugins: { SystemBars: { style: "DARK" } },
};

export default config;
