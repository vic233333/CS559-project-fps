import { defineConfig, loadEnv } from "vite";

function parseHost(value) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return value;
}

function parseAllowedHosts(value) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "true" || normalized === "1" || normalized === "all") return true;
  const list = value
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "DEV_");

  return {
    base: "/CS559-project-fps/",
    server: {
      host: parseHost(env.DEV_HOST) ?? true,
      allowedHosts: parseAllowedHosts(env.DEV_ALLOWED_HOSTS),
      port: 5173,
      strictPort: true,
      open: true
    },
    resolve: {
      alias: {
        "@": "/src"
      }
    }
  };
});
