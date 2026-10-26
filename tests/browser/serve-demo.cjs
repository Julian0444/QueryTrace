// Local-only static player server with byte-range support for MP4 chapter seeks.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(process.env.QUERYTRACE_VIDEO_OUTPUT_DIR||'docs/media/demo');
const port=Number(process.env.QUERYTRACE_VIDEO_PORT||8036);
const types={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.srt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json','.png':'image/png','.gif':'image/gif'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 let stat;
 try{stat=fs.statSync(file);if(!stat.isFile())throw Error();}catch{res.writeHead(404).end();return;}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
 let start=0,end=stat.size-1,status=200;
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(match&&(match[1]||match[2])){
   if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}
   else start=Math.max(0,stat.size-Number(match[2]));
  }else start=NaN;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=stat.size){res.writeHead(416,{...headers,'Content-Range':`bytes */${stat.size}`}).end();return;}
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
 }
 headers['Content-Length']=Math.max(0,end-start+1);
 res.writeHead(status,headers);
 if(req.method==='HEAD'||!stat.size){res.end();return;}
 const stream=fs.createReadStream(file,{start,end});
 stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`QueryTrace chapter player: http://localhost:${port}/`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
