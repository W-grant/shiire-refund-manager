import { copyFile, mkdir, readFile } from "node:fs/promises";
import { defineConfig } from "vite";

const legacyScripts = [
  { source: "src/classify.js", output: "assets/classify.js", contentType: "application/javascript; charset=utf-8" },
  { source: "src/csv.js", output: "assets/csv.js", contentType: "application/javascript; charset=utf-8" }
];

export default defineConfig({
  plugins: [
    {
      name: "copy-legacy-scripts",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const script = legacyScripts.find((item) => req.url === `/${item.output}`);
          if (!script) {
            next();
            return;
          }

          try {
            const contents = await readFile(script.source);
            res.statusCode = 200;
            res.setHeader("Content-Type", script.contentType);
            res.end(contents);
          } catch (error) {
            next(error);
          }
        });
      },
      async closeBundle() {
        await Promise.all(
          legacyScripts.map(async (script) => {
            const target = `dist/${script.output}`;
            await mkdir("dist/assets", { recursive: true });
            await copyFile(script.source, target);
          })
        );
      }
    }
  ]
});
