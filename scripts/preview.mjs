import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
createServer(async (req,res) => {
  try {
    let path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (path.startsWith('/AngelFleetPRD/')) path = path.slice('/AngelFleetPRD'.length);
    let file = resolve(root,'.'+path);
    if (file !== root && !file.startsWith(root+sep)) {res.writeHead(403).end();return;}
    if ((await stat(file)).isDirectory()) file = resolve(file,'index.html');
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream'}).end(await readFile(file));
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('未找到文件');}
}).listen(4173,'127.0.0.1',() => console.log('Preview: http://127.0.0.1:4173/AngelFleetPRD/'));
