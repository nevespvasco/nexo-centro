import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/schema/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ["src/migrate.ts", "src/grant-hospital-approver.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
  },
]);
