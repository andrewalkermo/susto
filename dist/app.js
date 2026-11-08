'use strict';
const $=id=>document.getElementById(id);
const sounds=[{name:'Grito de horror',offset:.095,url:'audio/grito-horror.mp3'},{name:'Grito curto',url:'audio/grito-curto.mp3'},{name:'Grito agudo',offset:.065,url:'audio/grito-agudo.mp3'},{name:'Grito estridente',offset:.065,url:'audio/grito-estridente.mp3'},{name:'Grito de menino',offset:.045,url:'audio/grito-menino.mp3'}];
const canvas=$('analysis'),ctx=canvas.getContext('2d',{willReadFrequently:true});
function scareDelayMs(){const value=Number($('scareDelay').value);return Number.isFinite(value)?Math.max(0,Math.min(5,value))*1000:300;}
$('scareDelay').oninput=()=>{$('scareDelayOut').textContent=Number($('scareDelay').value).toLocaleString('pt-BR',{minimumFractionDigits:1})+' s';};
let pendingScareAt=null;
let ambience, ambientGeneration=0, detectorWorker=null;
let audioContext, gain, buffers=[],stream=null,running=false,starting=false,generation=0,previous=null,timer=null,armedAt=0,nextAt=0,hits=0,count=0,lastSound=-1,source=null,wakeLock=null;
const error=message=>$('error').textContent=message;
for(const key of ['sensitivity','volume']){$(key).oninput=()=>{$(key+'Out').textContent=$(key).value+'%';if(key==='volume'&&gain)gain.gain.value=Number($('volume').value)/100;};}
async function initAudio(){audioContext??=new AudioContext({latencyHint:'interactive'});await audioContext.resume();if(!gain){gain=audioContext.createGain();gain.connect(audioContext.destination);}gain.gain.value=Number($('volume').value)/100;await Promise.all(sounds.map(async(s,i)=>{if(!buffers[i]){const response=await fetch(s.url);if(!response.ok)throw new Error('Não foi possível carregar um dos áudios.');buffers[i]=await audioContext.decodeAudioData(await response.arrayBuffer());}}));}
async function play(){if(!gain||audioContext?.state!=='running'||sounds.some((_,i)=>!buffers[i]))await initAudio();let index=Number($('sound').value);if($('sound').value==='random'){const pool=sounds.map((_,i)=>i).filter(i=>sounds.length===1||i!==lastSound);index=pool[Math.floor(Math.random()*pool.length)];}lastSound=index;source?.stop();source=audioContext.createBufferSource();source.buffer=buffers[index];source.connect(gain);const offset=sounds[index].offset||0;source.start(0,offset);const duration=buffers[index].duration-offset;ambience?.duck(duration+.4);return duration;}
$('test').onclick=async()=>{error('');try{const duration=await play();if(running)nextAt=performance.now()+duration*1000+Number($('cooldown').value)*1000;}catch(e){error('Falha no áudio: '+e.message);}};
async function keepAwake(){try{if('wakeLock'in navigator&&running&&!document.hidden)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
function stop(){pendingScareAt=null;stopAmbience();generation++;running=false;starting=false;clearInterval(timer);timer=null;detectorWorker?.terminate();detectorWorker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;previous=null;source?.stop();source=null;wakeLock?.release().catch(()=>{});wakeLock=null;$('placeholder').style.display='flex';$('previewTitle').textContent='Pronto para a surpresa.';$('previewHint').textContent='Ative a webcam para visualizar e detectar movimentos.';$('start').disabled=false;$('start').classList.remove('active');$('start').innerHTML='◎ Ativar sustos <span>↗</span>';$('badge').textContent='● DESLIGADA';$('status').textContent='Aguardando ativação';$('meter').style.width='0%';$('level').textContent='0%';}
async function start(){if(running||starting){stop();return;}starting=true;const token=++generation;$('start').disabled=true;error('');try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Abra em HTTPS ou localhost para acessar a câmera.');await initAudio();if(token!==generation)return;const candidate=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}},audio:false});if(token!==generation){candidate.getTracks().forEach(t=>t.stop());return;}stream=candidate;$('video').srcObject=stream;await $('video').play();if(token!==generation)return;running=true;starting=false;previous=null;hits=0;armedAt=performance.now()+5000;nextAt=armedAt;$('placeholder').style.display='none';$('previewTitle').textContent='De olho no movimento.';$('previewHint').textContent='Pode trocar de aba. O detector continua ativo.';$('start').disabled=false;$('start').classList.add('active');$('start').innerHTML='■ Desativar sustos <span>Esc</span>';$('badge').textContent='● CÂMERA ATIVA';stream.getVideoTracks()[0].onended=()=>{stop();error('A câmera foi desconectada. Ative novamente.');};if(typeof Worker!=='undefined'){detectorWorker=new Worker('detector-worker.js');detectorWorker.onmessage=tick;detectorWorker.onerror=()=>{detectorWorker?.terminate();detectorWorker=null;if(running&&!timer)timer=setInterval(tick,40);};}else{timer=setInterval(tick,40);}await keepAwake();}catch(e){if(token!==generation)return;stop();const messages={NotAllowedError:'Permita o acesso à câmera nas configurações do navegador.',NotFoundError:'Nenhuma câmera encontrada. Conecte uma webcam.',NotReadableError:'A câmera está ocupada. Feche outros aplicativos que a utilizam.'};error(messages[e.name]||e.message);}}
function tick(){if(!running)return;if(pendingScareAt!==null){if(performance.now()>=pendingScareAt){pendingScareAt=null;fireScare();}return;}if($('video').readyState<2)return;const width=canvas.width,height=canvas.height;ctx.drawImage($('video'),0,0,width,height);const motion=measureMotion(ctx.getImageData(0,0,width,height).data,previous,width,height,$('sensitivity').value);previous=motion.gray;const percent=motion.percent;$('meter').style.width=Math.min(100,percent/Math.max(motion.threshold,.08)*50)+'%';$('level').textContent=percent.toFixed(2)+'%';const now=performance.now();if(now<armedAt){$('status').textContent='Saia da frente · '+Math.ceil((armedAt-now)/1000)+'s';return;}if(now<nextAt){$('status').textContent='Próximo susto em '+Math.ceil((nextAt-now)/1000)+'s';hits=0;return;}$('status').textContent='Armado · esperando movimento';const threshold=motion.threshold;hits=percent>threshold?hits+1:0;if(hits>=1){hits=0;nextAt=now+Number($('cooldown').value)*1000;const delay=scareDelayMs();if(delay===0){fireScare();}else{pendingScareAt=now+delay;$('status').textContent='Movimento detectado · preparando susto';}}}
function fireScare(){count++;$('count').textContent=String(count).padStart(2,'0')+' SUSTOS';$('status').textContent='Movimento detectado!';play().then(duration=>{if(running)nextAt=Math.max(nextAt,performance.now()+duration*1000+Number($('cooldown').value)*1000);}).catch(e=>{stop();error('Falha ao tocar o grito: '+e.message);});}
$('start').onclick=start;document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('blackout').hidden){e.preventDefault();exitBlackout();}else stop();}});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&running)keepAwake();});window.addEventListener('pagehide',stop);
$('upload').onchange=async event=>{error('');for(const file of event.target.files){try{audioContext??=new AudioContext({latencyHint:'interactive'});const buffer=await audioContext.decodeAudioData(await file.arrayBuffer());const index=sounds.length;sounds.push({name:file.name,url:null});buffers[index]=buffer;const option=document.createElement('option');option.value=String(index);option.textContent=file.name;$('sound').append(option);}catch{error('Não foi possível ler '+file.name+'. Use MP3, WAV ou OGG.');}}$('sound').options[0].textContent='↝ Aleatório · '+sounds.length+' gritos';event.target.value='';};

function stopAmbience(){
  ambientGeneration++;
  ambience?.stop();
  $('ambientToggle').disabled=false;
  $('ambientToggle').textContent='♫ Ligar ambiente';
  $('ambientToggle').setAttribute('aria-pressed','false');
  $('ambientStatus').textContent='Desligado';
}
$('ambientVolume').oninput=()=>{
  $('ambientVolumeOut').textContent=$('ambientVolume').value+'%';
  ambience?.setVolume($('ambientVolume').value);
};
$('ambientToggle').onclick=async()=>{
  if(ambience?.active){stopAmbience();return;}
  const token=++ambientGeneration;
  $('ambientToggle').disabled=true;
  error('');
  try{
    audioContext??=new AudioContext({latencyHint:'interactive'});
    await audioContext.resume();
    if(token!==ambientGeneration)return;
    ambience??=new SpookyAmbience(audioContext);
    await ambience.loadLaugh();
    if(token!==ambientGeneration)return;
    ambience.setVolume($('ambientVolume').value);
    ambience.start();
    $('ambientToggle').textContent='■ Desligar ambiente';
    $('ambientToggle').setAttribute('aria-pressed','true');
    $('ambientStatus').textContent='Tocando ao fundo';
  }catch(e){stopAmbience();error('Falha na ambientação: '+e.message);}
  finally{if(token===ambientGeneration)$('ambientToggle').disabled=false;}
};

function exitBlackout(){
  $('blackout').hidden=true;
  document.body.classList.remove('blackout-mode');
  $('blackoutToggle').focus();
}
$('blackoutToggle').onclick=()=>{
  $('blackout').hidden=false;
  document.body.classList.add('blackout-mode');
  $('blackout').focus();
};
$('blackout').ondblclick=exitBlackout;
$('blackout').addEventListener('keydown',event=>{
  if(event.key==='Tab') {event.preventDefault();$('blackout').focus();}
});

$('helpToggle').onclick=()=>$('helpDialog').showModal();
$('helpClose').onclick=()=>$('helpDialog').close();
$('helpDialog').addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
