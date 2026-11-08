const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s={};vm.createContext(s);vm.runInContext(fs.readFileSync('dist/motion.js','utf8'),s);const w=320,h=240;
function frame(v){const a=new Uint8ClampedArray(w*h*4);for(let i=0;i<a.length;i+=4){a[i]=a[i+1]=a[i+2]=v;a[i+3]=255}return a}
const base=s.measureMotion(frame(80),null,w,h,100).gray;
test('cena parada e iluminação uniforme não disparam',()=>{for(const v of [80,110])assert.equal(s.measureMotion(frame(v),base,w,h,100).percent,0)});
test('detecta movimento distante com baixo contraste',()=>{const a=frame(80);for(let y=100;y<112;y++)for(let x=150;x<162;x++){const i=(y*w+x)*4;a[i]=a[i+1]=a[i+2]=92}const high=s.measureMotion(a,base,w,h,100),low=s.measureMotion(a,base,w,h,30);assert(high.percent>high.threshold);assert(low.percent<low.threshold)});
test('ruído isolado não dispara',()=>{const a=frame(80);for(let y=2;y<h;y+=5)for(let x=2;x<w;x+=5){const i=(y*w+x)*4;a[i]=a[i+1]=a[i+2]=105}assert.equal(s.measureMotion(a,base,w,h,100).percent,0)});
test('respeita atraso configurado em aba oculta sem repetir',()=>{
 const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==='scareDelay'?'0.3':'10',width:w,height:h,readyState:4,style:{},getContext(){return{drawImage(){},getImageData(){return{data:[]}}}},addEventListener(){}});return elements.get(id)}
 const env={document:{hidden:true,getElementById:el,addEventListener(){}},window:{addEventListener(){}},performance:{now:()=>env.now},now:10000,measureMotion:()=>({gray:[],percent:20,threshold:.08}),assert};vm.createContext(env);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),env);vm.runInContext(`running=true;armedAt=nextAt=0;let plays=0;play=async()=>{plays++;return 2};tick();assert.equal(pendingScareAt,10300);assert.equal(plays,0);globalThis.now=10299;tick();assert.equal(plays,0);globalThis.now=10300;tick();assert.equal(plays,1);tick();assert.equal(plays,1);$('scareDelay').value='1.2';nextAt=0;tick();assert.equal(pendingScareAt,11500);pendingScareAt=null;$('scareDelay').value='0';nextAt=0;tick();assert.equal(plays,2);`,env);
});
