import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const base=await read('base.css'),platform=await read('platform.css'),app=await read('app.js');
const templates={};
for(const name of ['campus','editorial','orbit']){
  templates[name]=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'"><style>${base}\n${await read('themes/'+name+'.css')}\n${platform}</style></head><body class="concept-${name}" data-concept="${name}" data-preview-theme="__THEME__" data-components="__COMPONENTS__"><div id="app"></div><script>${app}</script></body></html>`;
}
let studio=await read('studio.js');
studio=studio.replace("if(frame.getAttribute('src')!==src)frame.src=src;",`const key=host.dataset.frame+'-'+theme.value+'-'+mode;if(frame.dataset.previewKey!==key){frame.removeAttribute('src');frame.srcdoc=templates[host.dataset.frame].replace('__THEME__',theme.value).replace('__COMPONENTS__',mode==='components'?'1':'0');frame.dataset.previewKey=key;}`);
studio=studio.replace("document.querySelector('.open-full').href=", "document.querySelector('.open-full').dataset.originalHref=");
studio=studio.replace('sizeFrames();}',`const full=templates[selected].replace('__THEME__',theme.value).replace('__COMPONENTS__',mode==='components'?'1':'0');document.querySelector('.open-full').href=URL.createObjectURL(new Blob([full],{type:'text/html'}));sizeFrames();}`);
let html=await read('index.html');
html=html.replace("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'self'","default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'self' blob:; object-src 'none'");
html=html.replace('<link rel="stylesheet" href="studio.css">',`<style>${await read('studio.css')}</style>`).replace('<script src="studio.js" defer></script>','');
html=html.replaceAll(/ src="(?:campus|editorial|orbit)\.html\?theme=light"/g,'');
const encoded=JSON.stringify(templates).replaceAll('<','\\u003c');
html=html.replace('</body>',`<script>const templates=${encoded};\n${studio}</script></body>`);
await fs.writeFile(path.join(root,'studly-concepts.html'),html);
process.stdout.write(JSON.stringify({file:'dist/studly-concepts.html',bytes:Buffer.byteLength(html),externalRequests:0})+'\n');
