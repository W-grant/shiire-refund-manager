import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { defineConfig } from "vite";

const legacyScripts = ["src/classify.js", "src/csv.js"];

export default defineConfig({
  plugins: [
    {
      name: "copy-legacy-scripts",
      apply: "build",
      async closeBundle() {
        await Promise.all(
          legacyScripts.map(async (file) => {
            const target = `dist/${file}`;
            await mkdir(dirname(target), { recursive: true });
            await copyFile(file, target);
          })
        );
      }
    }
  ]
});

