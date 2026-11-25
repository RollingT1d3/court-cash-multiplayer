/* Court Cash: original synthesized sound effects, no downloads or third-party audio. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const KEY='court-cash-audio-v1';
  const names=['tick','reveal','star','poop','bid','won','bounce','swish','rim','dunk','whistle','reaction','buzzer','cheer'];
  function settings(storage){
    try{
      const s=JSON.parse(storage.getItem(KEY)||'{}');
      return {volume:Number.isFinite(s.volume)?clamp(s.volume,0,1):.45,muted:s.muted===true};
    }catch{return {volume:.45,muted:false};}
  }
  // Each SSE snapshot is compared with the preceding snapshot, not with the render loop.
  // First snapshot after connecting establishes a baseline without replaying old events.
  function plan(prev,next){
    if(!prev||!next||prev.code!==next.code)return [];
    const out=[], add=(name,delay=0)=>out.push({name,delay});
    if(next.phase==='wheel'&&(prev.phase!=='wheel'||prev.wheel?.spinId!==next.wheel?.spinId)){
      const duration=clamp(Number(next.wheel?.until)-Number(next.serverTime)||2600,0,2600);
      for(let t=0,step=47;t<duration-35;t+=step,step=Math.min(270,step*1.07))add('tick',Math.round(t));
    }
    if(next.phase==='auction'){
      const fresh=prev.phase!=='auction'||prev.auction?.playerId!==next.auction?.playerId||prev.spinIndex!==next.spinIndex;
      if(fresh){
        const p=next.players?.find(p=>p.id===next.auction?.playerId);
        add(p?.overall>=95?'star':p?.overall<70?'poop':'reveal');
        if(next.auction?.bid>0)add('bid',p?.overall>=95?850:500);
      }else if(next.auction?.bid>prev.auction?.bid)add('bid');
    }
    if(next.phase==='placement'&&(prev.phase!=='placement'||prev.pending?.playerId!==next.pending?.playerId||prev.spinIndex!==next.spinIndex))add('won');
    const g=next.game,old=prev.game;
    if(g&&old&&next.gameNumber===prev.gameNumber){
      const e=g.event;
      if(e&&e.id!==old.event?.id){
        const age=Math.max(0,Number(next.serverTime)-Number(e.at)||0);
        const lead=e.transition?.durationMs||0;
        if(age<1800+lead){
          const at=(name,ms)=>add(name,Math.max(0,lead+ms-age));
          if(lead&&age<lead){for(let ms=e.transition.kind==='inbound'?650:200;ms<lead;ms+=300){if(ms>=age)add('bounce',ms-age);}}
          const passLead=Array.isArray(e.passes)?Number(e.passDurationMs)||0:0;
          const setup=Number(e.fadeSetupMs)||Number(e.jumperSetupMs)||0;
          const end=(Number(e.passDurationMs)||0)+setup+470;
          if(e.passes?.length)for(const p of e.passes){if(lead+p.startMs>=age)at('bounce',p.startMs);}
          const turnover=['eight-second-violation','illegal-screen','pass-out-of-bounds','interception','steal'].includes(e.displayEvent);
          if(!turnover&&!e.foul){if(age<250)at('bounce',0);if(end>650&&age<500)at('bounce',300);}
          if(e.ankleBreaker)at('reaction',passLead+70);
          if(e.foul||e.illegalScreen||e.displayEvent==='illegal-screen'||e.displayEvent==='eight-second-violation'){at('whistle',e.foul?passLead+setup:Math.min(end,600));if(e.foul&&Array.isArray(e.freeThrowResults))e.freeThrowResults.forEach((made,i)=>at(made?'swish':'rim',passLead+setup+350+i*850+550));}
          else if(!turnover){
            if(e.putbackMade){const count=e.rimBounces||1;for(let i=0;i<count;i++)at('rim',end+i*180);at('dunk',e.rimBounces?end+count*180+260+300:end+260);}
            else if(e.made)at(e.type==='dunk'||e.displayEvent==='dunk'?'dunk':'swish',end);
            else if(e.displayEvent==='miss'||e.displayEvent==='block'){const count=e.rimBounces||1;for(let i=0;i<count;i++)at('rim',end+i*180);}
          }
        }
      }
      if(g.quarter>old.quarter)add('buzzer',1100+(g.event?.transition?.durationMs||0));
    }
    if(['finished','intermission'].includes(next.phase)&&!['finished','intermission'].includes(prev.phase)){
      if(!next.result?.forfeit){add('buzzer',1250);add('cheer',1750);}
    }
    return out;
  }
  function createEngine(win){
    let prefs;try{prefs=settings(win.localStorage);}catch{prefs={volume:.45,muted:false};}
    let ctx=null,master=null,previous=null,noiseBuffer=null;
    const sources=new Set(),timers=new Set();
    function updateGain(){if(master&&ctx)master.gain.setTargetAtTime(prefs.muted?0:prefs.volume*.65,ctx.currentTime,.012);}
    function persist(){try{win.localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}updateGain();}
    function unlock(){
      try{
        if(!ctx){
          const Audio=win.AudioContext||win.webkitAudioContext;if(!Audio)return;
          ctx=new Audio();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
          const count=ctx.sampleRate*3;
          noiseBuffer=ctx.createBuffer(1,count,ctx.sampleRate);
          const d=noiseBuffer.getChannelData(0);let last=0;
          for(let i=0;i<d.length;i++){last=.08*(Math.random()*2-1)+.92*last;d[i]=.72*(Math.random()*2-1)+.28*last;}
          updateGain();
        }
        if(ctx.state==='suspended')ctx.resume().catch(()=>{});
      }catch{}
    }
    function attach(source,chain,start,stop){
      sources.add(source);source.onended=()=>{sources.delete(source);for(const node of chain)try{node.disconnect();}catch{}};
      source.start(start);source.stop(stop);
    }
    function tone(t,f,end,dur,amp,type='sine',attack=.006){
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;
      o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+dur);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,amp),t+Math.min(attack,dur/3));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g);g.connect(master);attach(o,[o,g],t,t+dur+.01);
    }
    function noise(t,dur,amp,f,q=1,attack=.008,endF=f){
      const s=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
      s.buffer=noiseBuffer;filter.type='bandpass';filter.Q.value=q;filter.frequency.setValueAtTime(f,t);filter.frequency.exponentialRampToValueAtTime(endF,t+dur);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+Math.min(attack,dur/3));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      s.connect(filter);filter.connect(g);g.connect(master);attach(s,[s,filter,g],t,t+dur+.01);
    }
    function crowd(t,long){
      const dur=long?1.7:.65;
      noise(t,dur,.28,650,.7,.15,1000);noise(t+.045,dur*.86,.20,1400,1.3,.14,1800);noise(t+.08,dur*.7,.12,2400,1.5,.08,1900);
      for(let i=0;i<(long?7:3);i++){const f=500+Math.random()*400;tone(t+i*.13,f,f*1.24,.22,.025,'triangle',.06);}
    }
    function play(name){
      if(!ctx||ctx.state!=='running'||prefs.muted||prefs.volume===0||!names.includes(name))return;
      const t=ctx.currentTime+.005;
      switch(name){
        case 'tick':tone(t,960,620,.035,.11,'triangle');noise(t,.022,.09,3000,2);break;
        case 'reveal':tone(t,660,660,.18,.17,'sine');tone(t+.11,990,990,.32,.14,'triangle');break;
        case 'star': [392,523,659,784].forEach((f,i)=>{tone(t+i*.105,f,f,.36,.14,'triangle',.025);tone(t+i*.105,f*2,f*2,.22,.035);});noise(t+.2,.75,.10,2200,1,.06);tone(t+.42,1046,1046,.55,.12,'sine');break;
        case 'poop':tone(t,112,47,.53,.23,'sawtooth',.03);tone(t+.045,73,35,.39,.12,'triangle');noise(t,.50,.20,290,.65,.03,125);break;
        case 'bid':tone(t,1550,1220,.075,.12,'triangle');tone(t+.075,2040,1750,.16,.10,'sine');noise(t,.10,.10,3200,1.2);break;
        case 'won':tone(t,988,988,.25,.19,'triangle');tone(t+.10,1319,1319,.39,.15,'sine');noise(t+.03,.22,.10,4200,1.4);tone(t+.19,1760,1760,.22,.075);break;
        case 'bounce':tone(t,148,54,.13,.30,'sine');noise(t,.075,.14,510,1.4,.003,240);break;
        case 'swish':noise(t,.22,.26,2700,.85,.013,850);noise(t+.06,.14,.10,5000,1.1,.012,1600);break;
        case 'rim':tone(t,430,360,.26,.13,'triangle');tone(t+.016,1090,870,.19,.12,'triangle');noise(t,.10,.19,3100,2);break;
        case 'dunk':tone(t,125,42,.30,.35,'sine');noise(t,.18,.27,650,.75,.004,220);tone(t+.04,670,510,.22,.14,'triangle');noise(t+.08,.25,.11,2300,1);break;
        case 'whistle':tone(t,2550,2850,.22,.17,'sine',.018);tone(t+.24,2800,2450,.18,.15,'sine',.018);noise(t,.39,.065,2750,8);break;
        case 'reaction':crowd(t,false);break;
        case 'buzzer':tone(t,180,180,.52,.20,'sawtooth',.02);tone(t,185,185,.52,.10,'square',.02);break;
        case 'cheer':crowd(t,true);break;
      }
    }
    function cancel(){
      for(const id of timers)win.clearTimeout(id);timers.clear();
      for(const s of sources)try{s.stop();}catch{}
      sources.clear();
    }
    function observe(next){
      const prior=previous;previous=next;
      if(!prior||prior.code!==next.code)return;
      if(prior.phase==='wheel'&&next.phase!=='wheel')cancel();
      // Cancel delayed effects from an old possession/room before they can sound in the next one.
      if(prior.game?.event?.id!==next.game?.event?.id&&next.game?.event){for(const id of timers)win.clearTimeout(id);timers.clear();}
      if(prefs.muted||prefs.volume===0||!ctx||ctx.state!=='running')return;
      for(const cue of plan(prior,next)){
        if(cue.delay===0)play(cue.name);
        else {const id=win.setTimeout(()=>{timers.delete(id);play(cue.name);},cue.delay);timers.add(id);}
      }
    }
    function setVolume(v){prefs.volume=clamp(Number(v)||0,0,1);if(!prefs.volume)cancel();persist();return {...prefs};}
    function setMuted(v){prefs.muted=!!v;if(prefs.muted)cancel();persist();return {...prefs};}
    function reset(){cancel();previous=null;}
    return Object.freeze({unlock,observe,reset,play,setVolume,setMuted,getSettings:()=>({...prefs})});
  }
  root.CourtCashAudio=Object.freeze({plan,settings,createEngine,names:Object.freeze(names)});
})(typeof window==='undefined'?globalThis:window);
