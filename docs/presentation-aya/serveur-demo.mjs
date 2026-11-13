import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./demo/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return}
 try{
  let path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(path.endsWith('/'))path+='index.html';
  const target=resolve(root,'.'+path);
  if(!target.toLowerCase().startsWith(resolve(root).toLowerCase()+sep)){res.writeHead(403);res.end();return}
  const file=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]??'application/octet-stream','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:file);
 }catch{res.writeHead(404);res.end('Fichier introuvable.')}
});
server.on('error',e=>{console.error('Serveur non demarre :',e.message);process.exitCode=1});
server.listen(5182,'127.0.0.1',()=>console.log('Ouvrir http://127.0.0.1:5182/decors.html\nGarder cette fenetre ouverte pendant la demonstration.'));
