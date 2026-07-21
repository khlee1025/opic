import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(() => ({
    // This is a loopback-only desktop app. Avoid the experimental OXC
    // minifier so Korean-heavy curriculum bundles build reliably on Windows.
    build: { minify: false },
    server: isCodexSeatbeltSandbox
      ? { host: "127.0.0.1", watch: { useFsEvents: false, usePolling: true } }
      : { host: "127.0.0.1" },
    preview: { host: "127.0.0.1" },
    plugins: [vinext()],
  }));
