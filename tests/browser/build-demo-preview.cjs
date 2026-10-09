// Convert the reviewed, real UI recording into a README-compatible animation.
const path = require('path');
const fs = require('fs');
const {spawnSync} = require('child_process');
const out = path.resolve(process.env.QUERYTRACE_VIDEO_OUTPUT_DIR || 'docs/evidence/ui-polish/video');
const input = path.join(out, 'querytrace-demo.mp4');
const output = path.join(out, 'preview.gif');
const result = spawnSync(process.env.FFMPEG || 'ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
  '-filter_complex', '[0:v]fps=8,scale=1080:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
  '-loop', '0', output,
], {encoding: 'utf8'});
if (result.error || result.status !== 0) {
  console.error(result.error?.message || result.stderr);
  process.exit(1);
}
console.log(`Created ${path.relative(process.cwd(), output)} (${(fs.statSync(output).size / 1024 / 1024).toFixed(2)} MiB). Review the animation before publishing.`);
