// Create a short README highlight reel from the actual MP4, without retiming it.
const path=require('path'),fs=require('fs'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const out=path.resolve(process.env.QUERYTRACE_VIDEO_OUTPUT_DIR||'docs/media/demo');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'demo-run.json'),'utf8'));
const input=path.join(out,'querytrace-demo.mp4'),output=path.join(out,'preview.gif');
const segments=manifest.previewSegments;
if(!segments?.length)throw Error('The recording manifest must define previewSegments.');
for(const s of segments)if(s.start<0||s.duration<=0||s.start+s.duration>manifest.totalDuration)throw Error('Preview segment outside the recording.');
const trims=segments.map((s,i)=>`[0:v]trim=start=${s.start}:duration=${s.duration},setpts=PTS-STARTPTS[s${i}]`).join(';');
const inputs=segments.map((_,i)=>`[s${i}]`).join('');
const filters=`${trims};${inputs}concat=n=${segments.length}:v=1:a=0,fps=8,scale=1080:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`;
const result=spawnSync(process.env.FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-filter_complex',filters,'-loop','0',output],{encoding:'utf8'});
if(result.error||result.status!==0){console.error(result.error?.message||result.stderr);process.exit(1);}
const evidence={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'),duration:segments.reduce((sum,s)=>sum+s.duration,0),segments,fps:8,width:1080,bytes:fs.statSync(output).size};
fs.writeFileSync(path.join(out,'preview.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(`Created ${evidence.duration}s highlight preview (${(evidence.bytes/1024/1024).toFixed(2)} MiB). Review the animation before publishing.`);
