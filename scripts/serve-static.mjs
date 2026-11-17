// Minimal static file server for built sites (Storybook, demo) in tests.
// Usage: node scripts/serve-static.mjs <directory> <port>

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const [dir = ".", port = "6007"] = process.argv.slice(2);
const root = resolve(dir);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  let file = normalize(join(root, decodeURIComponent(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    await stat(file);
  } catch {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(Number(port), "127.0.0.1", () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
