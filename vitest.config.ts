import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    coverage: { include: ["lib/dominio/**"], exclude: ["lib/dominio/__tests__/**"] },
  },
});
