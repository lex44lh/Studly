'use strict';
const params=new URLSearchParams(location.search),frame=document.querySelector('iframe');
const concept=['campus','editorial','orbit'].includes(params.get('concept'))?params.get('concept'):'campus';
const theme=['light','dark','auto'].includes(params.get('theme'))?params.get('theme'):'light';
frame.width=String(Math.min(1440,Math.max(320,Number(params.get('w'))||390)));
frame.height=String(Math.min(1200,Math.max(700,Number(params.get('h'))||844)));
frame.src=`${concept}.html?theme=${theme}${params.get('safe')==='1'?'&safe=1':''}`;
