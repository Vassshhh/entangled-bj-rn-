import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [glsl()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    cors: true,
    allowedHosts: ["t6px2r-3000.csb.app"],
    hmr: {
      protocol: "wss",
      host: "t6px2r-3000.csb.app",
      clientPort: 443,
    },
  },
});
