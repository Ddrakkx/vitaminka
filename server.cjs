const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'dist');
const TYPES={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',ico:'image/x-icon'};
http.createServer((req,res)=>{
  let rel=decodeURIComponent(req.url.split('?')[0]);
  if(rel==='/')rel='/index.html';
  const file=path.resolve(root,'.'+rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end('Not found');}
    res.setHeader('Content-Type',TYPES[file.split('.').pop().toLowerCase()]||'application/octet-stream');
    res.end(data);
  });
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
