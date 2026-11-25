// Turns the recorded demo video into the README preview GIF with ffmpeg
// (palette generation keeps text sharp at a small file size).
//
//   node scripts/preview-gif.mjs <input.webm> <output.gif>

import { execFileSync } from "node:child_process";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: preview-gif.mjs <input.webm> <output.gif>");

const filters = "fps=10,scale=880:-1:flags=lanczos";
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    input,
    "-vf",
    `${filters},split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    "-loop",
    "0",
    output,
  ],
  { stdio: "inherit" },
);
