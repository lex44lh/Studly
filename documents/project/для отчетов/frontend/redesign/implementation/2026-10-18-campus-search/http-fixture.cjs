// Synthetic frontend UI contract fixture. Never deploy or use as Django.
if (process.env.STUDLY_ALLOW_TEST_FIXTURE !== "1") throw new Error("Explicit test-only opt-in required");
const http=require('node:http');
const s=id=>({id,title:'Проверочная услуга '+id,description:'Синтетическая HTTP-фикстура для проверки интерфейса.',price_amount:id===42?'1000.00':'500.00',currency:'RUB',duration_days:3,performer:{id:7,name:'Тестовый исполнитель'},included:['Консультация'],is_demo:false});
http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');const send=(x,status=200)=>{res.statusCode=status;res.end(JSON.stringify(x));};
if(u.pathname==='/api/v1/auth/me/')return send({detail:'No session'},403);
if(u.pathname==='/api/v1/auth/options/')return send({telegram_mini_app:false,telegram_website:false});
if(u.pathname==='/api/v1/services/'){
const q=u.searchParams.get('search')||'';if(/^fail(401|403|404|500)$/.test(q))return send({detail:'Fixture error'},Number(q.slice(4)));if(q==='malformed'){res.end('not json');return;}if(q==='bad-dto')return send({count:1,next:null,previous:null,results:[{id:42}]});if(q==='empty')return send({count:0,next:null,previous:null,results:[]});
const second=u.searchParams.get('page')==='2';const qs=new URLSearchParams({search:q,page:second?'1':'2'});return send({count:2,next:second?null:'http://127.0.0.1:18001/api/v1/services/?'+qs,previous:second?'http://127.0.0.1:18001/api/v1/services/?'+qs:null,results:[s(second?43:42)]});}
return send({detail:'Not found'},404);
}).listen(18001,'127.0.0.1');
