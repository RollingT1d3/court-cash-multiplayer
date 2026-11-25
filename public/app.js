(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SLOTS = ['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
  const OFFENSE = ['Play Through Superstar','Play Through Stars','Team Ball','Live By the 3, Die by the 3','Paint Mash','Pure Chaos','Run & Gun','Old-School Buckets','Run For The Hills','Play Through Point'];
  const DEFENSE = ['Man-to-Man','Double the Star','Protect the Paint','Perimeter Secured','3-2 Zone','Full Court Press','Clog The Lanes','4-1 Zone','2-2-1 Zone','Box-and-One'];
  const OFFENSE_INFO = {
    'Play Through Superstar':'The highest-rated player becomes your primary option. Higher Teamwork means teammates reliably feed the star, space the floor and follow the play call.',
    'Play Through Stars':'Prioritizes your two best players while everyone else supplies complementary touches. Teamwork controls how reliably players stick to their roles.',
    'Team Ball':'Shares possessions, rewards good passing and creates more assisted shots. High-Teamwork players run the system more faithfully.',
    'Live By the 3, Die by the 3':'Emphasizes three-point attempts, especially from your best shooters. It can produce scoring bursts or cold stretches; Teamwork improves shot selection.',
    'Paint Mash':'Emphasizes drives, dunks, post play and inside looks, with occasional mid-range attempts. Teamwork helps cutters and finishers follow the game plan.',
    'Pure Chaos':'Heavy off-ball movement and frequent screens. Hunts favorable mismatches (a big against a small defender or a scorer against a weak defender), creating chances at the cost of extra stamina. Teamwork strongly affects execution.',
    'Run & Gun':'The team works together to get the best possible shooters consistently open. Very perimeter-focused. The two best three-point shooters hunt threes, while the other three run and set screens; the two weakest combined mid/three shooters focus only on screens and rebounds. Any eligible 80+ mid-range shooter also works to get open.',
    'Old-School Buckets':'A well-balanced, slightly interior-focused offense. The best three-point shooter stays at the arc and the strongest rebounder stays near the paint. The other three run, pass, cut and screen for open layups, dunks and mid-range shots. When the shot clock runs low or an opening appears, the ball kicks out to the three-point shooter.',
    'Run For The Hills':'Your best passer (excluding your PG) inbounds, while four runners mix up routes and attack the rim. Everyone either crashes for layups, dunks and aggressive rebounds, or the top two available shooters flare out for their better 3PT/mid-range shot; a kickout may fail and return to paint offense. Slight speed and rebound boosts, higher stamina drain.',
    'Play Through Point':'Your PG and Center control the offense. The two best 3PT shooters (excluding PG/C) spread to the corners. The Center screens and rolls or pops based on their abilities; the PG can drive and kick, the Center can attack the paint, and a corner shooter occasionally cuts inside before returning to the arc if unrewarded.'
  };
  const DEFENSE_INFO = {
    'Man-to-Man':'Each defender tracks an opposing player. Balanced coverage without major tactical bonuses or vulnerabilities.',
    'Double the Star':'Sends extra pressure at the opponent’s best scorer, reducing their shot quality while taking attention away from other threats.',
    'Protect the Paint':'Loads defenders near the basket to reduce dunks and layups, leaving more space for outside jumpers.',
    'Perimeter Secured':'Prioritizes contesting three-pointers, giving opponents more chances to attack inside.',
    '3-2 Zone':'Three defenders patrol the perimeter and two defend near the rim. Helps challenge outside looks, but is more vulnerable to interior attacks and offensive rebounds.',
    'Full Court Press':'Pressure the ball all the way up court. Slightly higher on-ball steal chance, more stamina drain on opponents and roughly 10% chance to force an eight-second violation per defensive possession. Pressing defenders become significantly more exhausted.',
    'Clog The Lanes':'Defenders constantly drift beside or behind their matchups and directly into passing lanes, greatly increasing eligible lane-interception chances. This leaves the paint dangerously open for drives, layups and dunks.',
    '4-1 Zone':'Four defenders spread along the three-point arc to contest outside shots and passes, while the Center guards the paint alone. Strong against perimeter shooting; drives, interior scoring and offensive boards become easier because the Center gets little help.',
    '2-2-1 Zone':'A full-court zone press: two defenders pressure the ball high, two cover the middle passing routes, and one stays back to protect the basket. Can force occasional eight-second violations and extra steals, but uses more stamina and can give up open shots once beaten.',
    'Box-and-One':'Your best perimeter defender (weighted by perimeter defense, speed and IQ) shadows the opponent’s highest-OVR active player. Two high and two low zone defenders guard the rest. Strong against a single superstar, but other perimeter scorers get more open looks and the chaser tires faster.'
  };
  function strategyInfo(name,kind){return `<div class="strategy-info"><strong>${esc(name)}</strong><p>${esc((kind==='offense'?OFFENSE_INFO:DEFENSE_INFO)[name]||'')}</p></div>`;}
  const CAT = {
    'FINISHING': [['Layup','layup',.4],['Dunking','dunk',.4],['Post Moves','post',.2]],
    'SHOOTING': [['Free Throw','ft',.10],['Mid-Range','mid',.29],['3PT','three',.46],['Fades','fades',.15]],
    'PLAYMAKING': [['Passing','passing',.52],['Dribbling','dribbling',.48]],
    'DEFENSE': [['Paint Defense','paintDef',.24],['Perimeter Defense','perimeterDef',.29],['Block','block',.24],['Steal','steal',.23]],
    'OTHER': [['Rebounding','rebound',.20],['Strength','strength',.12],['Speed','speed',.16],['IQ','iq',.16],['Teamwork','teamwork',.16],['Stamina','stamina',.20]]
  };
  let identity = null, stream = null, state = null, lastRenderKey='', currentPicked=null, expanded=new Set(), selectedFocus=null;
  let lastRoomPhase=null, wheelSize=390, noticeTimer=null, intermissionPrep=false;
  let canvasPositions = new Map(), courtImages = new Map(), rosterImages = new Map(), frameRunning=false;
  let syncOffset=0;
  const audio=window.CourtCashAudio?.createEngine(window);
  function syncAudioControls(){
    if(!audio)return;
    const s=audio.getSettings();
    $('sound-volume').value=Math.round(s.volume*100);
    $('sound-value').textContent=Math.round(s.volume*100)+'%';
    $('sound-mute').textContent=s.muted?'🔇 Unmute':'🔊 Mute';
    $('sound-mute').setAttribute('aria-pressed',String(s.muted));
  }
  if(audio){
    syncAudioControls();
    $('sound-volume').addEventListener('input',e=>{audio.unlock();audio.setVolume(Number(e.target.value)/100);syncAudioControls();});
    $('sound-mute').addEventListener('click',()=>{audio.unlock();audio.setMuted(!audio.getSettings().muted);syncAudioControls();});
    document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
    document.addEventListener('keydown',()=>audio.unlock());
  }
  const ANKLE_STUMBLE_MS=1050, ANKLE_REACTIONS_MS=1150, POSTER_REACTIONS_MS=1250;
  // Fixed normalized positions for short comic reactions along the sidelines;
  // no random redraw flicker and never obscure the player names or main action.
  const COURT_REACTION_POSITIONS=[
    [.075,.11],[.245,.08],[.43,.085],[.63,.08],[.83,.1],[.94,.27],
    [.94,.76],[.82,.92],[.61,.91],[.39,.92],[.18,.9],[.055,.68]
  ];
  function courtReactionBurst(ctx,W,H,emojis,eventAge,duration){
    if(!(eventAge>=0&&eventAge<duration))return;
    ctx.save();
    const strength=Math.min(1,eventAge/110,(duration-eventAge)/260);
    ctx.globalAlpha=Math.max(0,strength);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='25px system-ui';
    for(let i=0;i<COURT_REACTION_POSITIONS.length;i++){
      const [xp,yp]=COURT_REACTION_POSITIONS[i];
      const wobble=Math.sin(eventAge/150+i*1.8)*4;
      ctx.fillText(emojis[i%emojis.length],xp*W,yp*H+wobble);
    }
    ctx.restore();
  }

  const esc = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = cents => '$'+((cents||0)/100).toFixed(2);
  const player = id => state?.players?.find(p=>p.id===id);
  const my = () => state?.teams?.[state.you];
  const eligible = () => state?.phase === 'lineup' || (state?.phase === 'placement' && state.pending?.winner===state.you) || (state?.phase === 'timeout' && state.timeout?.caller===state.you);
  const isMine = i => i===state?.you;
  const formatHeight = n => `${Math.floor(n/12)}'${n%12}"`;
  const secs = x => `${Math.floor(Math.max(0,x)/60)}:${String(Math.floor(Math.max(0,x)%60)).padStart(2,'0')}`;
  function toast(message){const el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.style.display='none',4700);}
  async function api(route, payload){
    const response = await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    let result;try{result=await response.json();}catch{throw Error('Cannot reach the game server.');}
    if(!response.ok)throw Error(result.error||'Request failed.');
    return result;
  }
  async function act(type,extra={}){
    if(!identity)return;
    try {await api('/api/action',{code:identity.code,token:identity.token,type,...extra});}
    catch(e){toast(e.message);}
  }
  function saveIdentity(v){identity=v;sessionStorage.setItem('court-cash-identity',JSON.stringify(v));connect();}
  function connect(){
    audio?.reset();
    if(stream)stream.close();
    $('status-label').textContent='Connecting…';
    stream=new EventSource(`/events?code=${encodeURIComponent(identity.code)}&token=${encodeURIComponent(identity.token)}`);
    stream.onopen=()=>{$('status-label').textContent='Connected • '+identity.code;$('status-dot').classList.add('on');};
    stream.onerror=()=>{audio?.reset();$('status-label').textContent='Reconnecting…';$('status-dot').classList.remove('on');};
    stream.onmessage=e=>{
      try{state=JSON.parse(e.data);syncOffset=Date.now()-state.serverTime;audio?.observe(state);render();}catch(err){console.error(err);}
    };
  }
  $('create-form').addEventListener('submit',async e=>{
    e.preventDefault();try{const result=await api('/api/create',{name:$('create-name').value,format:Number($('format').value)});saveIdentity(result);}catch(err){toast(err.message);}
  });
  $('join-form').addEventListener('submit',async e=>{
    e.preventDefault();try{const result=await api('/api/join',{name:$('join-name').value,code:$('join-code').value.toUpperCase()});saveIdentity(result);}catch(err){toast(err.message);}
  });
  try {const old=JSON.parse(sessionStorage.getItem('court-cash-identity')||'null');if(old?.code&&old?.token)saveIdentity(old);}catch{}
  function tier(ovr){return ovr>=95?'star':ovr>=90?'gold':ovr>=85?'green':ovr>=80?'blue':ovr>=70?'silver':'poop';}
  function penalty(p,pos){
    if(!p||p.positions.includes(pos)||!['PG','SG','SF','PF','C'].includes(pos))return 0;
    const W={PG:{passing:.34,dribbling:.31,speed:.19,perimeterDef:.10,three:.06},SG:{three:.29,mid:.20,perimeterDef:.24,dribbling:.17,speed:.10},SF:{perimeterDef:.23,speed:.15,three:.15,rebound:.20,strength:.15,dunk:.12},PF:{strength:.24,rebound:.29,paintDef:.20,dunk:.16,post:.11},C:{strength:.25,paintDef:.23,block:.19,rebound:.25,post:.08}};
    const quality=Object.entries(W[pos]).reduce((n,[k,w])=>n+(p.stats[k]||75)*w,0);
    const undersized=pos==='C'&&p.heightInches<78||pos==='PF'&&p.heightInches<75?2:0;
    return Math.max(1,Math.min(6,Math.round(1+(p.overall-quality)/9)+undersized));
  }
  function badge(p,position=null){
    const adj=p.overall-(position?penalty(p,position):0);
    return `<span class="ovr ${tier(adj)}" title="${position?'Position-adjusted ':' '}Overall ${adj}${adj!==p.overall?' (base '+p.overall+')':''}">${adj>=70?esc(adj):'💩'}${adj<70?`<span style="position:absolute;font-size:10px;bottom:-3px;right:-2px;background:#fff;color:#151515;border-radius:5px;padding:0 2px">${adj}</span>`:''}</span>`;
  }
  function portrait(p,size='sm',side='blue',artwork=false){
    if(!p)return `<span class="portrait ${size} ${side}">?</span>`;
    const initials=p.name.split(/\s+/).map(a=>a[0]).slice(0,2).join('').toUpperCase();
    const out=state?.game?.fouledOut?.includes(p.id);
    return `<span class="portrait ${size} ${side} ${artwork?'auction-artwork':''} ${out?'fouled-out':''}" ${out?'title="FOULED OUT — INELIGIBLE"':''}>${p.image?`<img alt="" onload="this.classList.add('loaded');this.nextElementSibling.hidden=true" onerror="this.classList.remove('loaded');this.nextElementSibling.hidden=false" src="${esc(p.image)}">`:''}<span class="portrait-initials">${esc(initials)}</span></span>`;
  }
  // Roster targets reuse the exact same square crop as the court and admin preview.
  function rosterHeadshot(p,side,position){
    if(!p)return '<span class="roster-headshot empty '+side+'" aria-hidden="true"><span>+</span></span>';
    const initials=p.name.split(/\s+/).map(a=>a[0]).slice(0,2).join('').toUpperCase();
    const out=state?.game?.fouledOut?.includes(p.id);
    return `<span class="portrait roster-headshot ${side} ${out?'fouled-out':''}" ${out?'title="FOULED OUT — INELIGIBLE"':''}><span class="roster-initials">${esc(initials)}</span><canvas class="roster-headshot-canvas" width="128" height="128" data-headshot-id="${esc(p.id)}" aria-hidden="true"></canvas></span>`;
  }
  function rosterImage(src){
    if(!rosterImages.has(src)){
      rosterImages.set(src,new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>{rosterImages.delete(src);resolve(null);};
        img.src=src;
      }));
    }
    return rosterImages.get(src);
  }
  function paintRosterHeadshots(container){
    for(const canvas of container.querySelectorAll('canvas[data-headshot-id]')){
      const p=state?.players?.find(p=>String(p.id)===canvas.dataset.headshotId);
      const src=window.CourtHeadshots.imageSource(p);
      if(!src)continue;
      rosterImage(src).then(img=>{
        if(!img||!canvas.isConnected)return;
        const ctx=canvas.getContext('2d');
        if(!ctx)return;
        const size=canvas.width;
        if(window.CourtHeadshots.draw(ctx,img,p,size/2,size/2,size)){
          canvas.classList.add('ready');
        }
      });
    }
  }
  function rosterDisplaySlots(i){
    const t=state.teams[i];if(!t)return {};
    if(state.phase==='timeout'&&state.game){
      const floor=state.game.active[i];const bench=t.roster.filter(id=>!floor.includes(id));
      return Object.fromEntries(SLOTS.map((s,j)=>[s,[...floor,...bench][j]||null]));
    }
    return t.slots;
  }
  function bindDragHeadshot(element,p,side){
    const src=window.CourtHeadshots.imageSource(p);
    let loaded=null;
    if(src)rosterImage(src).then(img=>{loaded=img;});
    // Prevent a nested full-size image from starting its own native image drag.
    for(const img of element.querySelectorAll('img'))img.draggable=false;
    element.draggable=true;
    element.addEventListener('dragstart',e=>{
      if(!e.dataTransfer)return;
      currentPicked=p.id;
      e.dataTransfer.setData('text/plain',String(p.id));
      e.dataTransfer.effectAllowed='move';
      if(typeof e.dataTransfer.setDragImage!=='function')return;
      const size=window.matchMedia('(max-width:590px)').matches?45:58;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      // If the crop source is the already-loaded auction portrait, use it even
      // while the shared image cache is still loading. Initials are the fallback.
      const original=element.querySelector('img');
      const image=loaded||(src===p.image&&original?.complete&&original.naturalWidth>0?original:null);
      const ctx=canvas.getContext('2d');
      if(!ctx)return;
      window.CourtHeadshots.drawDragPreview(ctx,image,p,size,side);
      // Keep it in the viewport for browsers that require a rendered drag image.
      const x=Math.max(0,Math.min(window.innerWidth-size,e.clientX-size/2));
      const y=Math.max(0,Math.min(window.innerHeight-size,e.clientY-size/2));
      canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{position:'fixed',left:x+'px',top:y+'px',width:size+'px',height:size+'px',pointerEvents:'none',zIndex:'10000'});
      document.body.appendChild(canvas);
      try{e.dataTransfer.setDragImage(canvas,size/2,size/2);}
      finally{setTimeout(()=>canvas.remove(),0);}
    });
  }
  function teamPanel(i){
    const t=state.teams[i];if(!t)return '<div class="team-panel">Waiting for a team…</div>';
    const side=i===0?'left':'right';const change=eligible()&&isMine(i);
    const roster=rosterDisplaySlots(i);
    const rows=SLOTS.map(s=>{
      const id=roster[s],p=player(id);
      const selected=id&&currentPicked===id&&change?'selected-slot':'';
      return `<button class="slot ${side} ${id?'owned':''} ${selected}" type="button" data-slot="${esc(s)}" data-team="${i}" ${change?'':'disabled'} aria-label="${esc(s)}: ${p?esc(p.name):'Empty'}">
        <span class="slot-label">${esc(s)}</span><span class="slot-circle">${rosterHeadshot(p,i?'red':'blue',s)}${p?badge(p,s):''}</span>${p?`<span class="slot-center"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(p.positions.join('/'))}${state?.game?.fouledOut?.includes(id)?' • FOULED OUT':''}</small></span>`:'<span class="slot-center"><small>DROP HERE</small></span>'}
      </button>`;
    }).join('');
    return `<div class="team-title"><strong>${esc(t.name)}</strong><span class="team-money">${money(t.budget)}</span></div>
      <div class="smallcaps">${t.roster.length}/8 DRAFTED ${isMine(i)?' • YOUR TEAM':''}</div>
      <div class="roster-list">${rows}</div>
      ${t.ready?'<p class="ready-state">✓ READY</p>':''}`;
  }
  function bindRoster(container){
    if(!container)return;
    paintRosterHeadshots(container);
    for(const slot of container.querySelectorAll('[data-slot]')){
      if(slot.disabled)continue;
      slot.addEventListener('click',()=>{
        const id=rosterDisplaySlots(state.you)[slot.dataset.slot];
        if(currentPicked && currentPicked!==id){act('place',{playerId:currentPicked,slot:slot.dataset.slot});currentPicked=null;}
        else if(id){currentPicked=id;render(true);}
      });
      const id=rosterDisplaySlots(state.you)[slot.dataset.slot];
      if(id){const p=player(id);if(p)bindDragHeadshot(slot,p,state.you===0?'blue':'red');}
      slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('drop-target');});
      slot.addEventListener('dragleave',()=>slot.classList.remove('drop-target'));
      slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('drop-target');const dragging=e.dataTransfer.getData('text/plain')||currentPicked;if(dragging){act('place',{playerId:dragging,slot:slot.dataset.slot});currentPicked=null;}});
    }
  }
  function allTeamPanels(where){
    $(where+'-left').innerHTML=teamPanel(0);$(where+'-right').innerHTML=teamPanel(1);
    bindRoster($(where+'-left'));bindRoster($(where+'-right'));
  }
  function weightedRows(p){
    const parts=Object.entries(CAT);
    return parts.map(([name,attrs])=>{
      const rating=Math.round(attrs.reduce((n,[,key,w])=>n+p.stats[key]*w,0)/attrs.reduce((n,[,,w])=>n+w,0));
      return `<details class="stat-category" data-cat="${name}" ${expanded.has(name)?'open':''}><summary>${name}<span style="margin-left:auto;color:var(--lime)">${rating}</span></summary>
        ${attrs.map(([title,key])=>`<div class="stat-row"><span>${title}</span><strong>${p.stats[key]}</strong></div>`).join('')}</details>`;
    }).join('');
  }
  function playerCard(p){
    return `<div class="profile"><div style="position:relative;flex:none">${portrait(p,'xl','blue',true)}${badge(p)}</div>
       <div class="profile-details"><h2>${esc(p.name)}</h2><p><strong>POS:</strong> ${esc(p.positions.join('/'))}</p><p>${esc(p.archetype)}</p><p><strong>HEIGHT:</strong> ${formatHeight(p.heightInches)}</p></div></div>
       ${weightedRows(p)}`;
  }
  function bidUI(a){
    const t=state.teams[a.turn],amI=a.turn===state.you;
    const seconds=Math.max(0,Math.ceil((a.deadline-(Date.now()-syncOffset))/1000));
    if(a.mode==='free')return `<div class="bid-controls"><div class="smallcaps">FREE SELECTION PHASE</div>
      <p class="subtle">${esc(t.name)} chooses who receives this player. No money is spent.</p>
      <div>Decision in <strong class="time-left" data-countdown>${seconds}s</strong></div>
      ${amI?'<div class="flex-row"><button id="select-free" class="primary">SELECT FOR MY TEAM</button><button id="pass-free" class="danger">PASS TO OPPONENT</button></div>':'<p class="smallcaps">WAITING FOR OPPONENT</p>'}</div>`;
    const need=a.bid ?a.bid+50:100;
    const mayBid=amI&&my().budget>=need;
    return `<div class="bid-controls">
      <div class="smallcaps">CURRENT HIGH BID</div>
      <div class="bid-amount">${a.bid?money(a.bid):'NO BIDS YET'}</div>
      <div class="tiny">${a.highBidder===null?'Opening bidder: '+esc(state.teams[a.opening].name):'Highest bidder: '+esc(state.teams[a.highBidder].name)}</div>
      <p style="margin:0"><strong>${esc(t.name)}'S TURN</strong> • <strong class="time-left" data-countdown>${seconds}s</strong></p>
      ${amI?`<div class="bid-row"><label class="smallcaps" for="bid-input">YOUR BID ($)</label><input id="bid-input" type="number" step="0.50" min="${(need/100).toFixed(2)}" max="${(my().budget/100).toFixed(2)}" value="${(need/100).toFixed(2)}" /></div>
      <div class="flex-row"><button class="primary" id="submit-bid" ${mayBid?'':'disabled'}>PLACE BID</button><button class="secondary" id="pass-bid">PASS</button></div>`:'<p class="smallcaps">WAITING FOR OPPONENT TO BID</p>'}
      <p class="tiny">The opening team automatically bids $1.00. Raise by at least $0.50 in $0.50 steps, or pass to give the player to the current high bidder.</p>
    </div>`;
  }
  function wheelMarkup(){return `<div class="wheel-stage"><span class="wheel-arrow"></span><canvas id="wheel-canvas" width="440" height="440" aria-label="Weighted player wheel"></canvas></div>`;}
  function drawWheel(){
    const canvas=$('wheel-canvas');if(!canvas)return;
    const cx=canvas.width/2,cy=canvas.height/2,r=209,ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,440,440);
    const pool=(state.remaining||[]).map(player).filter(p=>p&&p.weight>0);
    const total=pool.reduce((sum,p)=>sum+Math.round(p.weight*100),0);
    if(!total)return;
    let a=-Math.PI/2,selectedCenter=0;
    pool.forEach((p,i)=>{
      const frac=Math.round(p.weight*100)/total,arc=frac*2*Math.PI;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,a,a+arc);ctx.closePath();
      ctx.fillStyle=['#273e58','#39516c','#4a354c','#2c5d5a','#6b5a3e','#384c69','#576047'][i%7];ctx.fill();
      ctx.strokeStyle='#e6e9ef55';ctx.lineWidth=1;ctx.stroke();
      ctx.save();ctx.translate(cx,cy);ctx.rotate(a+arc/2);
      if(arc>.115){ctx.font='bold 12px system-ui';ctx.textAlign='right';ctx.fillStyle='#fff';ctx.fillText(p.name.slice(0,16),r-12,5,156);}
      ctx.restore();
      if(p.id===state.wheel?.id)selectedCenter=(a+arc/2);
      a+=arc;
    });
    ctx.beginPath();ctx.arc(cx,cy,52,0,Math.PI*2);ctx.fillStyle='#0c1726';ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#d0ff62';ctx.stroke();
    ctx.font='900 20px system-ui';ctx.textAlign='center';ctx.fillStyle='#d0ff62';ctx.fillText('DRAFT',cx,cy+7);
    if(state.phase==='wheel'){
      const turns=7*360;const angle=(((-Math.PI/2-selectedCenter)*180/Math.PI)%360+360)%360;
      requestAnimationFrame(()=>{canvas.style.transition='transform 2.6s cubic-bezier(.12,.68,.14,1)';canvas.style.transform=`rotate(${turns+angle}deg)`;});
    }
  }
  function renderDraft(){
    allTeamPanels('team');const center=$('auction-center');
    if(state.phase==='coinflip'){
      center.innerHTML=`<h2 class="auction-heading">🪙 WHO BIDS FIRST?</h2><p class="auction-sub">One side for each team. One synchronized flip.</p>
      <div class="coin flip">${esc(state.teams[state.coinWinner]?.name||'FLIP')}</div>
      <h3>${esc(state.teams[state.coinWinner]?.name)} wins the flip!</h3><p class="subtle">They automatically open the first auction with a $1.00 bid. The other team acts first; opening bidder alternates each spin.</p>`;
      return;
    }
    if(state.phase==='wheel'){
      center.innerHTML=`<div class="smallcaps">SPIN ${state.spinIndex+1}</div><h2 class="auction-heading">THE WHEEL IS SPINNING</h2><p class="auction-sub">${state.remaining.length} players left in the pool</p>${wheelMarkup()}
      <p class="wheel-caption">Each player is weighted by their configured wheel probability.</p>`;
      drawWheel();return;
    }
    if(state.phase==='auction'){
      const p=player(state.auction?.playerId);
      if(!p)return;
      center.innerHTML=`<div class="smallcaps">SPIN ${state.spinIndex+1} • PLAYER ON THE BLOCK</div><h2 class="auction-heading">THE AUCTION</h2>
        ${playerCard(p)}${bidUI(state.auction)}`;
      for(const d of center.querySelectorAll('[data-cat]'))d.addEventListener('toggle',()=>{if(d.open)expanded.add(d.dataset.cat);else expanded.delete(d.dataset.cat);});
      $('submit-bid')?.addEventListener('click',()=>{
        const dollars=Number($('bid-input').value),cents=Math.round(dollars*100);
        if(!Number.isFinite(dollars)||Math.abs(dollars*100-cents)>0.00001||cents%50!==0){toast('Bid in exact $0.50 steps.');return;}
        act('bid',{cents});
      });
      $('pass-bid')?.addEventListener('click',()=>act('pass'));
      $('select-free')?.addEventListener('click',()=>act('select'));
      $('pass-free')?.addEventListener('click',()=>act('freePass'));
      return;
    }
    if(state.phase==='placement'){
      const p=player(state.pending.playerId);const owner=state.pending.winner;
      center.innerHTML=`<div class="smallcaps">SOLD • SPIN ${state.spinIndex}</div><h2 class="auction-heading">${esc(state.teams[owner].name)} GETS THE PICK!</h2>
        <button class="pick-player" id="pick-new" type="button" ${isMine(owner)?'':'disabled'} style="background:transparent;padding:0">${portrait(p,'xl',owner===0?'blue':'red',true)}</button>
        <h2 style="margin:10px 0">${esc(p.name)}</h2><p class="auction-sub">${isMine(owner)?'Drag this player into a position circle, or click the portrait and then the circle. Occupied spots send the replaced player to an empty bench spot first. Drag existing headshots to swap.':'Waiting for the drafting team to place their player.'}</p>
        ${isMine(owner)?'<button id="next-spin" class="primary">NEXT SPIN →</button>':''}`;
      const newPick=$('pick-new');
      if(newPick&&isMine(owner)){
        bindDragHeadshot(newPick,p,owner===0?'blue':'red');
        newPick.addEventListener('click',()=>{currentPicked=p.id;render(true);});
      }
      $('next-spin')?.addEventListener('click',()=>{currentPicked=null;act('next');});
      return;
    }
    if(state.phase==='lobby'){
      center.innerHTML='<h2>ROOM CREATED ✅</h2><p class="subtle">Send your friend the room code shown above. The coin flip begins when they join.</p><p style="font-size:60px">🏀</p>';
    }
  }
  function renderPrep(){
    allTeamPanels('setup-team');const center=$('schemes-center');const canChange=['lineup','intermission'].includes(state.phase);
    center.innerHTML=`<div class="smallcaps">${state.phase==='intermission'?'BETWEEN GAMES':'PREGAME PREPARATION'}</div>
      <h2>${state.phase==='intermission'?'SET UP NEXT GAME':'SET YOUR STRATEGY'}</h2>
      <p class="subtle">${state.phase==='intermission'?'Both teams may change offensive and defensive schemes. The next game begins when both are ready.':'Arrange your eight players and choose your game plans. Click a rostered player, then click the destination slot—or drag and drop.'}</p>
      <label>OFFENSIVE SCHEME<select id="offense-select">${OFFENSE.map(o=>`<option value="${esc(o)}" ${o===my().offense?'selected':''}>${esc(o)}</option>`).join('')}</select></label>
      <label>DEFENSIVE SCHEME<select id="defense-select">${DEFENSE.map(o=>`<option value="${esc(o)}" ${o===my().defense?'selected':''}>${esc(o)}</option>`).join('')}</select></label>
      <div class="scheme-explainer" aria-live="polite"><span class="smallcaps">YOUR OFFENSIVE GAME PLAN</span><div id="offense-description">${strategyInfo(my().offense,'offense')}</div>
      <span class="smallcaps">YOUR DEFENSIVE GAME PLAN</span><div id="defense-description">${strategyInfo(my().defense,'defense')}</div>
      <p class="tiny">Players with higher Teamwork execute the chosen offense more reliably. ${state.phase==='lineup'?'Listed positions have no OVR penalty; other positions are matchup-adjusted.':''}</p></div>
      <button class="primary full" id="ready-btn" ${my().ready?'disabled':''}>${my().ready?'✓ WAITING FOR OPPONENT': 'READY TO PLAY →'}</button>`;
    $('offense-select')?.addEventListener('change',e=>{$('offense-description').innerHTML=strategyInfo(e.target.value,'offense');act('scheme',{offense:e.target.value});});
    $('defense-select')?.addEventListener('change',e=>{$('defense-description').innerHTML=strategyInfo(e.target.value,'defense');act('scheme',{defense:e.target.value});});
    $('ready-btn')?.addEventListener('click',()=>act('ready'));
    if(!canChange) $('ready-btn').disabled=true;
  }
  function showScore(){
    const g=state.game;if(!g)return;
    $('scoreboard').innerHTML=`<div class="score-side"><span class="score-team">${esc(state.teams[0].name)}</span><span class="score-number">${g.score[0]}</span><span class="tiny">${state.teams[0].wins} SERIES WINS • ${state.teams[0].timeouts} TIMEOUTS</span></div>
      <div class="score-meta"><span>GAME ${state.gameNumber}${state.format===7?' • BEST OF 7':''}</span><strong>${esc(g.period)} ${secs(g.secondsLeft)}</strong>
      ${g.tipoff&&Date.now()-syncOffset-g.tipoff.at<8500 ? `<div class="tipoff-notice">🏀 TIP-OFF WON: ${esc(state.teams[g.tipoff.winningTeam].name)} · ${Math.round(g.tipoff.probabilities[g.tipoff.winningTeam]*100)}% chance</div>` : ''}
      ${state.phase==='sim'?`<button id="call-timeout" class="primary" ${state.game.offense!==state.you||!my().timeouts?'disabled title="Only the team with possession may call timeout"':''}>⏸ CALL TIMEOUT</button><div class="tiny">${state.game.offense===state.you?'🏀 YOUR POSSESSION':'🏀 OPPONENT POSSESSION'}</div>`:state.phase==='foulout'?'<span class="smallcaps" style="color:var(--red)">🚫 FOUL-OUT • SUB REQUIRED</span>':'<span class="smallcaps">⏸ TIMEOUT IN PROGRESS</span>'}</div>
      <div class="score-side end"><span class="score-team">${esc(state.teams[1].name)}</span><span class="score-number">${g.score[1]}</span><span class="tiny">${state.teams[1].timeouts} TIMEOUTS • ${state.teams[1].wins} SERIES WINS</span></div>`;
    $('call-timeout')?.addEventListener('click',()=>act('timeout'));
    if($('call-timeout')&&(!my().timeouts||state.game.offense!==state.you))$('call-timeout').disabled=true;
  }
  function focusPanel(){
    const g=state.game;const id=selectedFocus&&g.stats[selectedFocus]?selectedFocus:g.active[state.you][0];
    if(!id)return;
    selectedFocus=id;
    const p=player(id),stats=g.stats[id];const owner=state.teams.findIndex(t=>t.roster.includes(id));
    $('player-focus').innerHTML=`<div class="smallcaps">CLICK ANY PLAYER TO INSPECT</div>
      <div style="display:flex;align-items:center;gap:12px;margin:10px 0">${portrait(p,'med',owner?'red':'blue')}<div><b>${esc(p.name)}</b><p class="tiny">${esc(p.positions.join('/'))} • ${p.overall} OVR</p><p class="tiny">⚡ Energy: ${Math.round(state.teams[owner].energy[id]??100)}%</p></div></div>
      <div class="data-grid">${[['PTS',stats.pts],['REB',stats.reb],['AST',stats.ast],['STL',stats.stl],['AB',stats.ankleBreaks??0],['BLK',stats.blk],['PF',stats.pf],['FT',stats.ftm+'/'+stats.fta],['TOV',stats.tov],['FG',stats.fgm+'/'+stats.fga],['3PT',stats.threeM+'/'+stats.threeA],['MIN',Math.round(stats.seconds/60)]].map(([k,v])=>`<div class="data-cell"><b>${esc(v)}</b><span>${k}</span></div>`).join('')}</div>`;
    $('sim-events').innerHTML=`<h3>LIVE PLAY-BY-PLAY</h3>${[...state.log].reverse().slice(0,12).map(x=>`<p>${esc(x)}</p>`).join('')}`;
  }
  function timeoutPanel(){
    const panel=$('timeout-panel');if(state.phase!=='timeout'){panel.classList.add('hide');return;}
    const caller=state.timeout.caller;
    panel.classList.remove('hide');
    panel.innerHTML=`<div class="timeout-card"><div class="timeout-info">⏸ ${esc(state.teams[caller].name)} CALLS TIMEOUT • <span data-timeout-count>30</span>s REMAINING</div>
    <p class="subtle">Both teams can change offensive and defensive schemes. Only the caller can manually substitute players.</p>
    <div class="flex-row" style="justify-content:flex-start;align-items:end;gap:16px">
      <label>OFFENSE <select id="timeout-offense">${OFFENSE.map(x=>`<option ${my().offense===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
      <label>DEFENSE <select id="timeout-defense">${DEFENSE.map(x=>`<option ${my().defense===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
      ${caller===state.you?'<button id="resume-game" class="primary">RESUME GAME →</button>':''}
    </div>
    <div class="timeout-strategies" aria-live="polite"><div><span class="smallcaps">OFFENSE</span><div id="timeout-offense-description">${strategyInfo(my().offense,'offense')}</div></div>
    <div><span class="smallcaps">DEFENSE</span><div id="timeout-defense-description">${strategyInfo(my().defense,'defense')}</div></div></div>
    ${caller===state.you?`<p class="subtle" style="margin-top:15px">Your active five and three bench players are below. Click a player and then the destination slot to substitute or change position.</p><div id="timeout-team" class="team-panel"></div>`:''}
    </div>`;
    $('timeout-offense')?.addEventListener('change',e=>{$('timeout-offense-description').innerHTML=strategyInfo(e.target.value,'offense');act('scheme',{offense:e.target.value});});
    $('timeout-defense')?.addEventListener('change',e=>{$('timeout-defense-description').innerHTML=strategyInfo(e.target.value,'defense');act('scheme',{defense:e.target.value});});
    $('resume-game')?.addEventListener('click',()=>act('resume'));
    if(caller===state.you){$('timeout-team').innerHTML=teamPanel(state.you);bindRoster($('timeout-team'));}
  }
  function fouloutPanel(){
    const panel=$('foulout-panel');
    if(state.phase!=='foulout'||!state.foulout){panel.classList.add('hide');return;}
    const f=state.foulout,team=state.teams[f.side],ejected=player(f.playerId);
    const bench=team.roster.filter(id=>!state.game.active[f.side].includes(id)&&!state.game.fouledOut.includes(id));
    const mine=f.side===state.you;
    panel.classList.remove('hide');
    panel.innerHTML=`<div class="foulout-card" role="alert" aria-live="assertive">
      <div class="foulout-title">🚫 SIX PERSONAL FOULS — PLAYER FOULED OUT</div>
      <div class="foulout-identity">${portrait(ejected,'med',f.side?'red':'blue')}<div><strong>${esc(ejected?.name||'Player')} is OUT for the rest of this game.</strong><p class="subtle">${esc(team.name)} must replace the player at ${esc(SLOTS[f.slot])}. Game clock and simulation are paused. No timeout is spent.</p></div></div>
      ${mine?`<h3>SELECT A BENCH REPLACEMENT</h3><div class="foulout-options">${bench.map(id=>{const p=player(id);return `<button class="foulout-option" type="button" data-foulout-sub="${esc(id)}">${portrait(p,'med',f.side?'red':'blue')}<span><b>${esc(p.name)}</b><small>${esc(p.positions.join('/'))} • ${p.overall} OVR</small></span></button>`;}).join('')}</div>`:`<p class="foulout-wait">Waiting for ${esc(team.name)} to select a bench replacement…</p>`}
    </div>`;
    panel.querySelectorAll('[data-foulout-sub]').forEach(btn=>btn.addEventListener('click',()=>act('fouloutSub',{playerId:btn.dataset.fouloutSub})));
  }
  function renderSim(){showScore();focusPanel();timeoutPanel();fouloutPanel();startCourtAnimation();}
  function boxTable(i){
    const t=state.teams[i];const g=state.game;if(!g)return '';
    return `<h3>${esc(t.name)} — ${g.score[i]} PTS</h3><div style="overflow:auto"><table class="box-table"><thead><tr>${['PLAYER','PTS','REB','AST','STL','BLK','PF','FT','TOV','FG','3PT','MIN'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>
      ${t.roster.map(id=>{const p=player(id),s=g.stats[id];return `<tr><td><div class="box-player">${portrait(p,'sm',i?'red':'blue')}<span>${esc(p.name)}${g.fouledOut.includes(id)?'<small class="fouled-out-label">FOULED OUT</small>':''}</span></div></td><td>${s.pts}</td><td>${s.reb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.blk}</td><td>${s.pf}</td><td>${s.ftm}/${s.fta}</td><td>${s.tov}</td><td>${s.fgm}/${s.fga}</td><td>${s.threeM}/${s.threeA}</td><td>${Math.round(s.seconds/60)}</td></tr>`;}).join('')}
    </tbody></table></div>`;
  }
  let leavingRoom=false;
  async function leaveCurrentRoom(){
    if(leavingRoom||!identity)return;
    const who=identity;
    let confirmed=false;
    const prompt=()=>window.confirm('Leave this room? Your opponent will win by forfeit.');
    if(state?.teams?.[1-state.you]&&state.phase!=='finished'){
      if(!prompt())return;
      confirmed=true;
    }
    leavingRoom=true;
    $('leave-room').disabled=true;
    try{
      try{await api('/api/action',{code:who.code,token:who.token,type:'leave',confirmForfeit:confirmed});}
      catch(error){
        // A second player may have joined just as the host pressed Leave.
        if(error.message==='Confirm forfeiting this match.'&&!confirmed){
          if(!prompt())return;
          await api('/api/action',{code:who.code,token:who.token,type:'leave',confirmForfeit:true});
        }else throw error;
      }
      if(identity===who)returnToMainMenu();
    }catch(error){
      if(identity===who&&/Room not found|Not authorized for this room/.test(error.message))returnToMainMenu();
      else toast(error.message);
    }finally{
      leavingRoom=false;
      $('leave-room').disabled=false;
    }
  }
  $('leave-room').addEventListener('click',leaveCurrentRoom);
  function returnToMainMenu(){
    audio?.reset();
    if(stream){stream.close();stream=null;}
    identity=null;state=null;sessionStorage.removeItem('court-cash-identity');
    lastRenderKey='';lastRoomPhase=null;selectedFocus=null;currentPicked=null;
    canvasPositions.clear();courtImages.clear();rosterImages.clear();intermissionPrep=false;
    $('status-label').textContent='Not in a room';$('status-dot').classList.remove('on');
    $('gameview').classList.add('hide');$('welcome').classList.remove('hide');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function awardCard(id,role,stats,labels,teamIndex){
    const p=player(id);
    if(!p)return '<div class="award-empty">No award data available</div>';
    const rows=labels.map(({label,value})=>`<span class="award-mini-stat"><strong>${esc(value)}</strong><small>${esc(label)}</small></span>`).join('');
    return `<div class="award-role">${role}</div>
      <h3 class="award-name">${esc(p.name)}</h3>
      <div class="award-portrait">${portrait(p,'xl',teamIndex===0?'blue':'red')}</div>
      <div class="award-mini-stats">${rows}</div>`;
  }
  function teamBoxSummary(i,awards){
    const t=state.teams[i],s=awards?.totals?.[i],g=awards?.grades?.[i];
    if(!s||!g)return '';
    return `<section class="final-team-box"><h3>${esc(t.name)}</h3>
       <div class="final-grades"><div><strong>${esc(g.offense)}/100</strong><small>OFFENSE</small></div><div><strong>${esc(g.defense)}/100</strong><small>DEFENSE</small></div></div>
       <div class="final-team-stats">${[
         ['PTS',s.pts],['REB',s.reb],['AST',s.ast],['STL',s.stl],['BLK',s.blk],
         ['TOV',s.tov],['FG',`${s.fgm}/${s.fga}`],['3PT',`${s.threeM}/${s.threeA}`],
         ['FT',`${s.ftm}/${s.fta}`],['PF',s.pf]
       ].map(([label,value])=>`<div><span>${label}</span><b>${esc(value)}</b></div>`).join('')}</div></section>`;
  }
  function renderEnd(){
    const end=$('end-view'),winner=state.result?.winner;
    if(winner===undefined||winner===null)return;
    const winnerTeam=state.teams[winner],over=state.phase==='finished';
    const awards=state.result?.awards;
    const owner=id=>state.teams.findIndex(t=>t.roster.includes(id));
    end.innerHTML=`<section class="final-stage">
      <div class="final-topbar"><span class="smallcaps">${state.result.forfeit?'FORFEIT':over?'MATCH COMPLETE':'GAME COMPLETE'} · GAME ${state.gameNumber}${state.format===7?' · SERIES '+state.teams.map(t=>t.wins).join('–'):''}</span><button id="final-main-menu" class="final-main-menu" type="button">MAIN MENU</button></div>
      <h1 class="gold-winner">WINNER: ${esc(winnerTeam.name)}</h1>
      <p class="final-score">${state.game?`${state.teams.map((t,i)=>`${esc(t.name)} ${state.game.score[i]}`).join(' · ')}`:''}</p>
      ${state.result.forfeit?`<p class="final-forfeit">${esc(state.result.reason)}</p>`:''}
      ${awards?`<div class="final-award-layout">
        <div class="final-award final-dpog">${awardCard(awards.dpog,'🔒DPOG🔒',null,[{label:'STEALS',value:awards.dpogSteals},{label:'BLOCKS',value:awards.dpogBlocks}],owner(awards.dpog))}</div>
        <div class="final-award final-mvp">${awardCard(awards.mvp,'🏆MVP🏆',null,awards.mvpTop3,owner(awards.mvp))}</div>
        <div class="final-teams">${teamBoxSummary(0,awards)}${teamBoxSummary(1,awards)}</div>
      </div>`:'<p class="subtle">Player awards are available after a completed game.</p>'}
      <div class="final-actions">
        ${over?(state.departed?.some(Boolean)?'<p class="subtle">Your opponent has left the room. Rematch unavailable.</p>':`<div class="final-rematch-area"><button id="rematch-button" type="button" class="rematch-button" ${state.rematchReady?.[state.you]?'disabled':''}>${state.rematchReady?.[state.you]?'REMATCH REQUESTED ✓':'REMATCH!'}</button><p class="tiny">${state.rematchReady?.[state.you]?'Waiting for your opponent to press REMATCH!':'Both players must agree. Same drafted rosters, fresh game.'}</p></div>`):
          `<button id="next-game-setup" class="primary" type="button">ADJUST STRATEGIES / NEXT GAME →</button>`}
      </div>
      <details class="final-box-details"><summary>FULL PLAYER BOX SCORES</summary>${state.game?boxTable(0)+boxTable(1):''}</details>
    </section>`;
    $('final-main-menu')?.addEventListener('click',leaveCurrentRoom);
    $('rematch-button')?.addEventListener('click',()=>act('rematch'));
    $('next-game-setup')?.addEventListener('click',()=>{intermissionPrep=true;render(true);});
  }
  function render(force=false){
    if(!state)return;
    if(state.phase==='intermission'&&lastRoomPhase!=='intermission')intermissionPrep=false;
    $('welcome').classList.add('hide');$('gameview').classList.remove('hide');
    $('room-header').innerHTML=`<span class="room-title">PRIVATE ROOM <span class="room-code" title="Share this code with your friend">${esc(state.code)}</span></span>
      <div class="room-versus"><span>${esc(state.teams[0]?.name)}</span><span class="vs">VS</span><span>${esc(state.teams[1]?.name||'WAITING...')}</span></div>
      <span class="smallcaps">${state.format===7?'BEST OF 7':'SINGLE GAME'} • ${state.teams.filter(Boolean).length}/2 PLAYERS</span>`;
    const banners={lobby:'Share your room code with your friend. The game starts once they join.',coinflip:'🪙 The coin determines who places the first opening bid.',wheel:'🎡 Spinning the weighted player wheel…',auction:'💰 Bid in $0.50 increments. Your turn lasts 30 seconds and resets after each new bid.',placement:'🃏 The drafted player can be placed into any roster slot, then the next spin begins.',lineup:'🧠 Set both game plans and organize your team before clicking Ready.',sim:'🏀 Live game • each marker is a player • the ball and sweat icons reflect gameplay.',timeout:'⏸ Timeout • both teams may change schemes, but only the caller may substitute.',foulout:'🚫 SIX FOULS • Game paused until the affected team selects an eligible bench replacement.',intermission:'🔁 Series break • both teams may adjust their schemes before the next game.',finished:'🏆 Final results.'};
    $('phase-banner').textContent=banners[state.phase]||'';
    const sig=JSON.stringify({phase:state.phase,team:state.teams.map(t=>t&&[t.roster,t.slots,t.budget,t.ready,t.offense,t.defense,t.wins,t.timeouts,t.energy]),
      coin:state.coinWinner,wheel:state.wheel?.spinId,auction:state.auction?.bid+'_'+state.auction?.turn+'_'+state.auction?.mode+'_'+state.auction?.deadline,
      appearance:state.teams.flatMap(t=>(t?.roster||[]).map(id=>{const p=player(id);return [id,p?.image,p?.courtPortrait];})),
      pending:state.pending,gameId:state.gameNumber,event:state.game?.event?.id,time:state.timeout?.until,foulout:state.foulout,fouledOut:state.game?.fouledOut,focus:selectedFocus,picked:currentPicked,rematch:state.rematchReady,departed:state.departed,intermissionPrep});
    if(!force&&sig===lastRenderKey){updateClocks();return;}
    lastRenderKey=sig;
    for(const id of ['draft-view','setup-view','sim-view','end-view'])$(id).classList.add('hide');
    if(['lobby','coinflip','wheel','auction','placement'].includes(state.phase)){$('draft-view').classList.remove('hide');renderDraft();}
    if(state.phase==='lineup'||(state.phase==='intermission'&&intermissionPrep)){$('setup-view').classList.remove('hide');renderPrep();}
    if(['sim','timeout','foulout'].includes(state.phase)){$('sim-view').classList.remove('hide');renderSim();}
    if(state.phase==='finished'||(state.phase==='intermission'&&!intermissionPrep)){$('end-view').classList.remove('hide');renderEnd();}
    lastRoomPhase=state.phase;updateClocks();
  }
  function updateClocks(){
    const corrected=Date.now()-syncOffset;
    if(state?.phase==='auction'&&state.auction?.deadline){
      const x=Math.max(0,Math.ceil((state.auction.deadline-corrected)/1000));
      for(const label of document.querySelectorAll('[data-countdown]')){label.textContent=x+'s';label.classList.toggle('urgent',x<=10);}
    }
    if(state?.phase==='timeout'&&state.timeout?.until){
      const target=document.querySelector('[data-timeout-count]');if(target)target.textContent=Math.max(0,Math.ceil((state.timeout.until-corrected)/1000));
    }
  }
  setInterval(updateClocks,200);
  
  // Canvas rendering: gameplay results are computed on the server; all viewers animate the same event.
  function startCourtAnimation(){if(frameRunning)return;frameRunning=true;requestAnimationFrame(drawCourt);}
  let transitionKey='',transitionStarts=new Map(),previousBall=null,transitionBallStart=null;
  function drawCourt(ms){
    if(!state?.game){frameRunning=false;return;}
    const el=$('court');const ctx=el.getContext('2d');const W=940,H=525;
    ctx.clearRect(0,0,W,H);
    // Server picks one of four equally likely courts when each game starts.
    // The geometry includes fully connected NBA-style three-point arcs and corners.
    window.CourtDesigns.drawCourt(ctx,state.game.courtStyle,W,H);
    const game=state.game,rawEvent=game.event;
    // The server's pass geometry remains authoritative for gameplay. For the
    // presentation, backcourt inbound anchors become frontcourt pass anchors
    // after the separate visible inbound/advance stage.
    const event=!Array.isArray(rawEvent?.passes)&&rawEvent?.transition&&rawEvent.passFrom?.x<.25?{...rawEvent,passFrom:{x:.60,y:rawEvent.passFrom.y}}:rawEvent;
    const offense=event?.offense??game.offense;
    const attackRight=event?.attackRight??(offense===0?(game.quarter<=2):!(game.quarter<=2));
    const targetGoal=attackRight?W-(17+5.25*(W/94)):(17+5.25*(W/94));
    const anchors=[{x:.66,y:.5},{x:.74,y:.20},{x:.71,y:.82},{x:.84,y:.33},{x:.84,y:.64}];
    const defenseAnchors=[{x:.73,y:.50},{x:.81,y:.20},{x:.81,y:.82},{x:.87,y:.38},{x:.87,y:.65}];
    const zoneAnchors=[{x:.72,y:.19},{x:.74,y:.50},{x:.72,y:.81},{x:.86,y:.33},{x:.86,y:.67}];
    const fourOneAnchors=[{x:.71,y:.17},{x:.73,y:.38},{x:.73,y:.62},{x:.71,y:.83},{x:.89,y:.50}];
    const twoTwoOneAnchors=[{x:.39,y:.29},{x:.39,y:.71},{x:.61,y:.30},{x:.61,y:.70},{x:.88,y:.50}];
    const pressAnchors=[{x:.32,y:.50},{x:.41,y:.22},{x:.42,y:.78},{x:.55,y:.37},{x:.55,y:.64}];
    const fb=event?.fastBreak,quickBreak=!!fb&&fb.mode!=='reset';
    const scheme=quickBreak?'Fast Break':state.teams[offense].offense;
    const isChaos=scheme==='Pure Chaos';
    const isRunGun=scheme==='Run & Gun';
    const isOldSchool=scheme==='Old-School Buckets';
    const isHills=scheme==='Run For The Hills';
    const isPoint=scheme==='Play Through Point';
    const isClog=!quickBreak&&state.teams[1-offense].defense==='Clog The Lanes';
    const isPress=!quickBreak&&state.teams[1-offense].defense==='Full Court Press';
    const isZone=!quickBreak&&state.teams[1-offense].defense==='3-2 Zone';
    const isFourOne=!quickBreak&&state.teams[1-offense].defense==='4-1 Zone';
    const isTwoTwoOne=!quickBreak&&state.teams[1-offense].defense==='2-2-1 Zone';
    const isBox=!quickBreak&&state.teams[1-offense].defense==='Box-and-One';
    const rawAge=event?Math.max(0,Date.now()-syncOffset-event.at):Infinity;
    const tr=event?.transition,lead=tr?.durationMs||0,transitioning=!!tr&&rawAge<lead;
    const eventAge=rawAge-lead;
    const playAge=Math.max(0,eventAge);
    const motion=window.CourtMotion,goal={x:targetGoal,y:H/2},direction=attackRight?1:-1;
    const key=state.code+':'+state.gameNumber+':'+(event?.id||0);
    if(key!==transitionKey){transitionKey=key;transitionStarts=new Map([...canvasPositions].map(([id,p])=>[id,{...p}]));transitionBallStart=previousBall?{...previousBall}:null;}
    const tipAge=game.tipoff?Math.max(0,Date.now()-syncOffset-game.tipoff.at):Infinity;
    const tipping=!event&&tipAge<motion.TIP_MS&&state.phase==='sim';
    const tip=tipping?motion.tipFrame(tipAge,W,H,game.tipoff.winningTeam):null;
    const chain=event?.passes,passFrame=event&&!transitioning?motion.passFrame(event,eventAge):null;
    const passLead=Array.isArray(chain)?event.passDurationMs||0:0;
    const resultAge=eventAge-passLead;
    const freeThrow=!transitioning&&event?.foul&&event.freeThrowResults?.length&&resultAge>=0&&resultAge<motion.FT_START+event.freeThrowResults.length*motion.FT_STEP;
    const shotEffectAge=eventAge-(event?motion.shotEnd(event):0);
    const putbackEffectAge=eventAge-(event?motion.putbackEnd(event):0);
    const present=new Set();
    for(let side=0;side<2;side++){
      for(let pos=0;pos<5;pos++){
        const id=game.active[side][pos];if(!id)continue;present.add(id);
        const attacking=side===offense;
        const anchor=attacking?anchors:(isTwoTwoOne?twoTwoOneAnchors:isFourOne?fourOneAnchors:
          isPress?pressAnchors:isZone?zoneAnchors:defenseAnchors)[pos];
        let x=anchor.x*W,y=anchor.y*H;
        if(!attacking&&(isFourOne||isTwoTwoOne||isBox)&&event?.zonePositions?.[id]){
          const target=event.zonePositions[id];x=target.x*W;y=target.y*H;
        }
        if(!attacking&&isClog){
          const coverage=(passFrame?.pass.clogPositions||event?.clogPositions)?.[id];
          if(coverage){x=coverage.x*W;y=coverage.y*H;}
          else {x=(.65+pos*.025)*W;y=(pos%2?.77:.23)*H;}
        }
        if(attacking&&isPoint&&event?.pointRoutes&&eventAge<3000){
          const target=event.pointRoutes[id];
          if(target){
            const progress=Math.min(1,playAge/950);
            x=(anchor.x+(target.x-anchor.x)*progress)*W;
            y=(anchor.y+(target.y-anchor.y)*progress)*H;
            if(event.pointWingCut===id&&event.pointCutReturned){
              // Decoy wing cuts in before running back to the corner.
              const dive=playAge<750?playAge/750:Math.max(0,1-(playAge-750)/950);
              x+=.16*W*dive;y+=(.5-target.y)*H*dive;
            }
          }
        }
        // Different offensive roles are visible: perimeter screening, cuts and paint anchors.
        if(attacking&&(isChaos||isRunGun||isOldSchool)&&eventAge<3500){
          const wave=(Date.now()/(isRunGun?260:isOldSchool?410:330))+(pos*1.7);
          const isScreener=event?.screeners?.includes(id);
          x+=Math.sin(wave)*(isScreener?42:isChaos?31:20);
          y+=Math.cos(wave*.85)*(isScreener?31:isChaos?25:18);
          if(isOldSchool&&id===event?.oldRebounder){x=.86*W;y=.52*H;}
          if(isOldSchool&&id===event?.arcShooter){x=.67*W;y=.24*H;}
          if(isRunGun&&event?.arcShooters?.includes(id)){x=.66*W;y=(id===event.arcShooters[0]?.27:.73)*H;}
        }
        if(attacking&&isHills&&event?.hillsRoutes&&eventAge<3500){
          if(id===event.hillsInbounder){x=(tr?.durationMs? .60:.18)*W;y=.5*H;}
          else if(event.hillsRoutes[id]){
            const t=Math.min(1,playAge/1750);
            const route=event.hillsRoutes[id];
            const speed=1.07; // slight on-court movement boost
            const advance=Math.min(1,t*speed);
            const curve=Math.sin(Math.PI*advance)*(pos%2?.055:-.055);
            const startX=tr?.durationMs? .60:.30;
            x=(startX+(route.x-startX)*advance)*W;
            y=(anchor.y+(route.y-anchor.y)*advance+curve)*H;
          }
        }
        if(quickBreak){const target=(attacking?fb.targets:fb.recoveryTargets)?.[id];if(target){
          const progress=fb.mode==='outlet'?Math.min(1,Math.max(0,rawAge/(lead+passLead||1))):1;
          const origin=attacking?fb.starts[id]:null;
          if(origin){x=(origin.x+(target.x-origin.x)*progress)*W;y=(origin.y+(target.y-origin.y)*progress)*H;}else{x=target.x*W;y=target.y*H;}
        }}
        // Animate the actual sender and receiver for each pass.
        const activePass=passFrame?.pass||(transitioning?chain?.[0]:null);
        if(attacking&&activePass&&activePass.fromId===id){x=activePass.from.x*W;y=activePass.from.y*H;}
        else if(attacking&&activePass&&activePass.toId===id){
          x=activePass.to.x*W;y=activePass.to.y*H;
          if(passFrame?.final&&passFrame.received&&activePass.outcome==='complete'&&id===event.shooter&&!event.foul&&!['steal','illegal-screen','eight-second-violation'].includes(event.displayEvent)){
            const feet=event.shotDistanceFt??(event.type==='three'?25:12);
            const settle=Math.min(1,Math.max(0,(eventAge-activePass.endMs)/(310+(quickBreak?fb.afterMs:0))));
            const shotX=quickBreak?fb.shotTarget.x*W:Math.max(.14*W,W-(17+5.25*(W/94))-feet*(W/94));
            x+=(shotX-x)*settle;y+=((quickBreak?fb.shotTarget.y:.50)*H-y)*settle;
          }
        }
        else if(!Array.isArray(chain)&&event?.passerId===id&&attacking&&eventAge<event.passDurationMs+220){
          x=event.passFrom.x*W;y=event.passFrom.y*H;
        }else if(!Array.isArray(chain)&&event?.shooter===id&&attacking&&event.passerId&&eventAge<event.passDurationMs+220){
          x=event.passTo.x*W;y=event.passTo.y*H;
        }else if(event?.shooter===id&&attacking&&!activePass&&!['illegal-screen','pass-out-of-bounds','interception','eight-second-violation'].includes(event.displayEvent)){
          const feet=event.shotDistanceFt??(event.type==='three'?25:12);
          x=quickBreak?fb.shotTarget.x*W:Math.max(.14*W,W-(17+5.25*(W/94))-feet*(W/94));y=H*(quickBreak?fb.shotTarget.y:.50);
        }
        if(!quickBreak&&event?.defender===id&&!attacking&&event.displayEvent!=='interception'&&!isPress&&!isClog&&!isBox){x=.85*W;y=H*.53;}
        // The chaser tracks the target even off the ball; a zone defender closes out on other shooters.
        if(!attacking&&isBox&&event?.zoneDefense==='Box-and-One'){
          const follow=id===event.boxChaser?event.boxTarget:event.defender===id?event.shooter:null;
          const at=follow?canvasPositions.get(follow):null;
          if(at){x=Math.min(.96*W,(attackRight?at.x:W-at.x)+.045*W);y=at.y;}
        }
        if(event?.interceptorId===id&&!attacking&&event.interceptionAt&&(!Array.isArray(chain)||passFrame?.pass.interceptorId===id||resultAge>=0)){
          x=event.interceptionAt.x*W;y=event.interceptionAt.y*H;
        }
        if(event?.reboundId===id&&!transitioning&&eventAge>=motion.shotEnd(event)){x=.88*W;y=H*.58;}
        if(freeThrow){
          // One shooter at the foul line; the others line up outside the lane.
          if(id===event.shooter){x=W-(17+5.25*(W/94))-14*(W/94);y=H*.50;}
          else {const laneIndex=game.active[side].filter(pid=>pid!==event.shooter).indexOf(id);x=(.79+.045*Math.floor(laneIndex/2))*W;y=(laneIndex%2?.67:.33)*H; if(side===offense)y+=(laneIndex%2?1:-1)*.09*H;}
        }
        // Defender stumbles out of their assignment on a successful crossover.
        const ankleStumble=!transitioning&&event?.ankleBreaker&&event?.defender===id&&!attacking&&resultAge>=0&&resultAge<ANKLE_STUMBLE_MS;
        if(ankleStumble){
          const sway=Math.sin(Math.PI*resultAge/ANKLE_STUMBLE_MS);
          x+=((pos%2)?1:-1)*23*sway;y+=14*sway;
        }
        if(!attackRight)x=W-x;
        if(tipping){
          const sign=side===0?-1:1;
          if(id===game.tipoff.centerIds[side]){x=W/2+sign*31;y=H/2-tip.jump;}
          else {x=W/2+sign*(105+pos%2*50);y=H*(pos<2?.25:.75);}
        }
        let prev=canvasPositions.get(id)||{x,y};
        if(transitioning){
          const start=transitionStarts.get(id)||{x:direction===1?W*.24:W*.76,y:H*(.18+pos*.16)};
          prev=motion.transitionPosition(tr,rawAge,start,{x,y},side,offense,pos,id,W,H,direction);
        }else{
          const v=tipping?.25:isHills&&attacking?.072:(isPress||isTwoTwoOne)&&!attacking?.075:.060;
          const dx=x-prev.x,dy=y-prev.y,dist=Math.hypot(dx,dy),step=Math.min(dist*v,12);
          if(dist){prev.x+=dx/dist*step;prev.y+=dy/dist*step;}
        }
        canvasPositions.set(id,prev);
        const p=player(id);if(!p)continue;
        ctx.save();
        if(ankleStumble){
          // Brief visible spin/stagger of the circular player portrait.
          const spin=Math.sin(Math.PI*resultAge/ANKLE_STUMBLE_MS);
          ctx.translate(prev.x,prev.y);
          ctx.rotate((pos%2?1:-1)*.32*spin);
          ctx.translate(-prev.x,-prev.y);
        }
        ctx.beginPath();ctx.fillStyle='#101824';ctx.arc(prev.x,prev.y,26,0,2*Math.PI);ctx.fill();
        ctx.save();ctx.beginPath();ctx.arc(prev.x,prev.y,22,0,2*Math.PI);ctx.clip();
        // The moving on-court circles show HEAD + HAIR, never the full-body art.
        // Draft/player cards still use p.image in portrait() above.
        const courtSrc=window.CourtHeadshots.imageSource(p);
        let painted=false;
        if(courtSrc){
          let entry=courtImages.get(id);
          if(!entry||entry.src!==courtSrc){
            const img=new Image();img.src=courtSrc;
            entry={src:courtSrc,img};courtImages.set(id,entry);
          }
          if(entry.img.complete&&entry.img.naturalWidth){
            painted=window.CourtHeadshots.draw(ctx,entry.img,p,prev.x,prev.y,44);
          }
        }
        if(!painted){
          ctx.fillStyle=side?'#b64e66':'#527baf';
          ctx.fillRect(prev.x-23,prev.y-23,46,46);
          drawInitials(ctx,p,prev.x,prev.y);
        }
        ctx.restore();
        ctx.lineWidth=4;ctx.strokeStyle=side?'#ff889e':'#91c9ff';ctx.beginPath();ctx.arc(prev.x,prev.y,24,0,2*Math.PI);ctx.stroke();
        ctx.restore(); // keep names and comic reaction emojis upright
        ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#122136';ctx.fillStyle='#fff';
        const first=p.name.split(' ')[0];ctx.strokeText(first,prev.x,prev.y+39);ctx.fillText(first,prev.x,prev.y+39);
        const e=state.teams[side].energy[id]??100;
        if(e<60){
          // Tiny upper-right badge straddles the circular portrait border.
          // The headshot remains visible; no extra substitution-menu bars.
          ctx.save();
          const badgeX=prev.x+16,badgeY=prev.y-16;
          ctx.beginPath();ctx.arc(badgeX,badgeY,9,0,Math.PI*2);
          ctx.fillStyle='rgba(16,24,36,.82)';ctx.fill();
          ctx.lineWidth=1;ctx.strokeStyle='#fff9';ctx.stroke();
          ctx.font='12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillText(e<25?'🥵':'💦',badgeX,badgeY+1);
          ctx.restore();
        }
        if(event?.deepThree&&shotEffectAge>=0&&shotEffectAge<1250&&id===event.shooter){
          ctx.save();ctx.globalAlpha=Math.min(1,(1250-shotEffectAge)/350);
          ctx.font='36px system-ui';ctx.textAlign='center';ctx.fillText('🔥',prev.x,prev.y-45);
          ctx.restore();
        }
        if(!transitioning&&event?.ankleBreaker&&resultAge>=0&&resultAge<ANKLE_STUMBLE_MS&&id===event.defender){
          ctx.save();ctx.globalAlpha=Math.min(1,(ANKLE_STUMBLE_MS-resultAge)/240);
          ctx.font='29px system-ui';ctx.textAlign='center';
          ctx.fillText('😵‍💫',prev.x,prev.y-44);ctx.restore();
        }
        if(!transitioning&&event?.posterDunk&&resultAge>=0&&resultAge<POSTER_REACTIONS_MS){
          ctx.save();ctx.globalAlpha=Math.min(1,(POSTER_REACTIONS_MS-resultAge)/290);
          ctx.font='27px system-ui';ctx.textAlign='center';
          if(id===event.shooter)ctx.fillText('🗣️',prev.x,prev.y-44);
          if(id===event.defender)ctx.fillText('😢',prev.x+31,prev.y+3);
          ctx.restore();
        }
      }
    }
    for(const id of [...canvasPositions.keys()])if(!present.has(id))canvasPositions.delete(id);
    // Draw the ball from the authoritative event timeline, without rerolling outcomes.
    let ball=null,ftFrame=null;
    if(transitioning){ball=motion.transitionBall(tr,rawAge,canvasPositions,direction,transitionBallStart);}
    else if(tipping){ball=tip.ball;}
    else if(!event&&game.tipoff){
      const receiver=canvasPositions.get(game.active[game.tipoff.winningTeam][0]);
      if(receiver)ball={x:receiver.x+16,y:receiver.y+12};
    } else if(event&&canvasPositions.has(event.shooter)){
      const d=canvasPositions.get(event.shooter),t=eventAge;
      const turnover=['eight-second-violation','illegal-screen','pass-out-of-bounds','interception','steal'].includes(event.displayEvent);
      if(passFrame){ball=motion.passBall(passFrame,canvasPositions,W,H,direction);}
      else if(event.foul&&event.freeThrowResults?.length){
        const line={x:targetGoal-direction*14*(W/94),y:H/2};
        ftFrame=motion.freeThrowFrame(event.freeThrowResults,resultAge,line,goal,direction);ball=ftFrame?.ball;
      } else if(!Array.isArray(chain)&&event.passerId&&event.passFrom&&event.passTo&&t<event.passDurationMs&&!event.illegalScreen&&!event.eightSecondViolation){
        const from=event.passFrom,to=event.passOutcome==='intercepted'&&event.interceptionAt?event.interceptionAt:event.passTo;
        const progress=Math.min(1,t/Math.max(1,event.passDurationMs));
        const fx=attackRight?from.x*W:(1-from.x)*W,tx=attackRight?to.x*W:(1-to.x)*W;
        ball={x:fx+(tx-fx)*progress,y:from.y*H+(to.y-from.y)*H*progress};
        if(event.passOutcome==='out-of-bounds')ball.y=from.y*H+((event.passTo.y>.5?H+18:-18)-from.y*H)*progress;
      } else if(event.passOutcome==='intercepted'&&event.interceptorId&&canvasPositions.has(event.interceptorId)){
        ball=canvasPositions.get(event.interceptorId);
      } else if(event.displayEvent==='steal'&&event.stealId&&canvasPositions.has(event.stealId)){
        ball=canvasPositions.get(event.stealId);
      } else if(event.displayEvent==='pass-out-of-bounds'){
        ball={x:attackRight?event.passTo.x*W:(1-event.passTo.x)*W,y:event.passTo.y>.5?H+18:-18};
      } else if(!turnover){
        ball=motion.normalBall(event,t,d,canvasPositions.get(event.reboundId),goal,direction);
      } else ball={x:d.x+28,y:d.y+14};
    }
    if(ball){
      previousBall={...ball};
      const bx=ball.x,by=ball.y;
      ctx.beginPath();ctx.fillStyle='#fc8c2f';ctx.strokeStyle='#45290e';ctx.lineWidth=2;ctx.arc(bx,by,9,0,2*Math.PI);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx-9,by);ctx.lineTo(bx+9,by);ctx.moveTo(bx,by-9);ctx.lineTo(bx,by+9);ctx.stroke();
    }
    if(tipping){
      ctx.save();ctx.textAlign='center';ctx.font='900 26px system-ui';ctx.fillStyle='#d0ff62';
      ctx.fillText(tip.won?state.teams[game.tipoff.winningTeam].name.toUpperCase()+' WINS THE TIP!':'JUMP BALL!',W/2,H*.14);ctx.restore();
    }
    if(transitioning&&state.phase==='sim'){
      ctx.save();ctx.textAlign='center';ctx.font='900 18px system-ui';ctx.fillStyle='#d0ff62';
      const title=quickBreak?(fb.mode==='outlet'?'FAST BREAK · OUTLET':fb.mode==='kickout'?'FAST BREAK · DRIVE & KICK':'FAST BREAK'):fb?.mode==='reset'?'DEFENSE RECOVERS · SET OFFENSE':tr.kind==='inbound'?(rawAge<650?'INBOUND PASS':'BRINGING THE BALL UP'):tr.kind==='reset'?'RESETTING THE OFFENSE':'TRANSITION';
      ctx.fillText(title,W/2,31);ctx.restore();
    }
    if(quickBreak&&!transitioning&&state.phase==='sim'&&resultAge<850){
      ctx.save();ctx.font='900 18px system-ui';ctx.textAlign='center';ctx.fillStyle='#d0ff62';ctx.fillText('⚡ FAST BREAK',W/2,31);ctx.restore();
    }
    if(passFrame&&state.phase==='sim'){
      const p=passFrame.pass;
      ctx.save();ctx.font='900 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#e8f4ff';ctx.strokeStyle='#101824';ctx.lineWidth=4;
      const label=`PASS ${chain.indexOf(p)+1}/${chain.length} · ${player(p.fromId)?.name.split(' ')[0]||'PLAYER'} → ${player(p.toId)?.name.split(' ')[0]||'PLAYER'}`;
      ctx.strokeText(label,W/2,H-26);ctx.fillText(label,W/2,H-26);ctx.restore();
    }
    // One short 🖐️ centered between the actual blocker and the blocked shooter.
    // Positions are the rendered, interpolated circle coordinates on this frame.
    if(!transitioning&&event?.displayEvent==='block'&&event?.blockId&&shotEffectAge>=0&&shotEffectAge<850&&state.phase==='sim'&&
       canvasPositions.has(event.blockId)&&canvasPositions.has(event.shooter)){
      const defender=canvasPositions.get(event.blockId),attacker=canvasPositions.get(event.shooter);
      const midX=(defender.x+attacker.x)/2,midY=(defender.y+attacker.y)/2;
      ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,shotEffectAge/110,(850-shotEffectAge)/200));
      ctx.font='32px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('🖐️',midX,midY);ctx.restore();
    }
    if(!transitioning&&resultAge>=0&&event?.ankleBreaker&&state.phase==='sim'){
      courtReactionBurst(ctx,W,H,['🫪','😱','😯'],resultAge,ANKLE_REACTIONS_MS);
    }
    // Mid-range and three-point baskets use a brief WHITE scoreboard label at
    // the rim (not on fouls, misses, or made putbacks).
    if(event?.made&&['mid','three'].includes(event.displayEvent)&&shotEffectAge>=0&&shotEffectAge<850&&state.phase==='sim'){
      ctx.save();ctx.globalAlpha=Math.min(1,shotEffectAge/100,(850-shotEffectAge)/160);
      ctx.textAlign='center';ctx.font='1000 34px system-ui';ctx.lineWidth=5;
      ctx.strokeStyle='#111827';ctx.fillStyle='#ffffff';
      const text=event.displayEvent==='mid'?'SWISH!':'3PTS!';
      ctx.strokeText(text,targetGoal,H/2-58);ctx.fillText(text,targetGoal,H/2-58);
      ctx.restore();
    }
    if(!transitioning&&resultAge>=0&&event?.posterDunk&&state.phase==='sim'){
      courtReactionBurst(ctx,W,H,['📸😯','📸','🫪'],resultAge,POSTER_REACTIONS_MS);
      if(resultAge>=0&&resultAge<POSTER_REACTIONS_MS){
        ctx.save();ctx.globalAlpha=Math.min(1,(POSTER_REACTIONS_MS-resultAge)/260);
        ctx.font='28px system-ui';ctx.textAlign='center';
        ctx.fillText('💪',targetGoal,H/2-41);ctx.restore();
      }
    }
    const turnoverBanner={
      'illegal-screen':'🚫 ILLEGAL SCREEN • OFFENSIVE FOUL',
      'pass-out-of-bounds':'🏀 ERRANT PASS • OUT OF BOUNDS',
      'interception':'✋ PASS INTERCEPTED!',
      'steal':'✋ BALL STOLEN!',
      'eight-second-violation':'⏱ 8 SECOND VIOLATION!'
    }[event?.displayEvent];
    if(!transitioning&&turnoverBanner&&resultAge>=0&&resultAge<1900&&state.phase==='sim'){
      ctx.save();ctx.globalAlpha=Math.min(1,(1900-resultAge)/300);
      ctx.fillStyle='#101824e5';ctx.fillRect(W/2-230,H*.14,460,48);
      ctx.font='900 22px system-ui';ctx.fillStyle='#ffdb84';ctx.textAlign='center';
      ctx.fillText(turnoverBanner,W/2,H*.14+31);ctx.restore();
    }
    if(!transitioning&&event?.inboundAfterTimeout&&eventAge<1500&&state.phase==='sim'){
      ctx.save();ctx.globalAlpha=Math.min(1,(1500-eventAge)/260);
      ctx.fillStyle='#091b2cce';ctx.fillRect(W/2-175,H*.78,350,34);
      ctx.fillStyle='#fff3ab';ctx.font='900 18px system-ui';ctx.textAlign='center';
      ctx.fillText('🏀 INBOUND AFTER TIMEOUT',W/2,H*.78+24);ctx.restore();
    }
    if(!transitioning&&event?.pointMode&&eventAge<1700&&state.phase==='sim'){
      ctx.save();ctx.globalAlpha=Math.min(1,(1700-eventAge)/300);
      ctx.textAlign='center';ctx.font='900 19px system-ui';ctx.fillStyle='#ffdf84';
      ctx.fillText(`🎯 POINT + CENTER · ${event.pointMode.replaceAll('-',' ').toUpperCase()}`,W/2,H*.14);
      ctx.restore();
    }
    if(!transitioning&&event?.hillsMode&&eventAge<1750&&state.phase==='sim'){
      ctx.save();ctx.globalAlpha=Math.min(1,(1750-eventAge)/350);
      ctx.fillStyle='#14233fdf';ctx.fillRect(W/2-190,65,380,37);
      ctx.fillStyle='#cbff77';ctx.textAlign='center';ctx.font='900 19px system-ui';
      ctx.fillText(event.hillsMode==='kickout'?'🏃 HILLS • SHOOTERS FLARE OUT':
        event.hillsMode==='paint-crash'?'🏃 HILLS • CRASH THE PAINT':'🏃 HILLS • BACK TO THE PAINT',W/2,91);ctx.restore();
    }
    if(event?.putbackMade&&putbackEffectAge>=0&&putbackEffectAge<750&&state.phase==='sim'){
      ctx.save();ctx.fillStyle='#ffe87f';ctx.textAlign='center';ctx.font='900 20px system-ui';
      ctx.fillText('PUTBACK!',W/2,H*.79);ctx.restore();
    }
    if(!transitioning&&event?.screen&&!event?.illegalScreen&&eventAge<1500&&state.phase==='sim'){
      ctx.save();ctx.globalAlpha=Math.min(1,(1500-eventAge)/350);
      ctx.fillStyle='#112236da';ctx.fillRect(W/2-148,30,296,34);
      ctx.fillStyle='#d0ff62';ctx.font='900 19px system-ui';ctx.textAlign='center';
      ctx.fillText(event.mismatch?'⚡ MISMATCH HUNT':
        isRunGun?'🏀 RUN & GUN SCREEN':isOldSchool?(event.kickout?'↗ KICKOUT PASS':'↗ OLD-SCHOOL CUT'):'↗ OFF-BALL SCREEN',W/2,53);
      ctx.restore();
    }
    if(event?.deepThree&&shotEffectAge>=0&&shotEffectAge<1250){
      // Flames over the scoring rim and a short glowing red/orange center-screen banner.
      ctx.save();ctx.globalAlpha=Math.min(1,(1250-shotEffectAge)/320);
      ctx.font='40px system-ui';ctx.textAlign='center';ctx.fillText('🔥',targetGoal,H/2-40);
      ctx.shadowColor='#ff3b15';ctx.shadowBlur=32;
      ctx.lineWidth=8;ctx.strokeStyle='#7e150e';ctx.fillStyle='#ff8624';
      ctx.font='900 48px system-ui';ctx.textAlign='center';
      ctx.strokeText('🔥FROM DEEP!🔥',W/2,H*.43);
      ctx.fillText('🔥FROM DEEP!🔥',W/2,H*.43);
      ctx.restore();
    }
    if(!transitioning&&event?.foul&&resultAge>=0&&resultAge<350){
      ctx.save();ctx.globalAlpha=Math.min(1,(2250-resultAge)/450);
      ctx.fillStyle='#0c1726e0';ctx.fillRect(W/2-190,16,380,42);
      ctx.fillStyle='#ffcc58';ctx.font='900 21px system-ui';ctx.textAlign='center';
      ctx.fillText(`📣 SHOOTING FOUL • ${event.freeThrowsAttempted} FT`,W/2,45);
      ctx.restore();
    }
    if(freeThrow&&ftFrame&&resultAge>=motion.FT_START){
      ctx.save();ctx.fillStyle='#0c1726e8';ctx.fillRect(W/2-145,16,290,65);
      ctx.textAlign='center';ctx.font='900 19px system-ui';ctx.fillStyle='#fff';ctx.fillText('FREE THROW '+(ftFrame.index+1)+' / '+event.freeThrowResults.length,W/2,40);
      ctx.fillStyle=ftFrame.revealed?(ftFrame.made?'#d0ff62':'#ff8999'):'#b7c7da';ctx.fillText(ftFrame.revealed?(ftFrame.made?'MADE!':'MISS!'):'AT THE LINE',W/2,66);ctx.restore();
    }
    if(state?.phase==='foulout'){
      ctx.fillStyle='#08101add';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#ff7087';ctx.font='900 38px system-ui';ctx.textAlign='center';
      ctx.fillText('🚫 PLAYER FOULED OUT',W/2,H/2-12);
      ctx.fillStyle='#ffffff';ctx.font='bold 17px system-ui';
      ctx.fillText('AWAITING MANDATORY SUBSTITUTION',W/2,H/2+28);
    }
    if(state?.phase==='timeout'){
      ctx.fillStyle='#08101acc';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#ffdb84';ctx.font='900 44px system-ui';ctx.textAlign='center';ctx.fillText('⏸  TIMEOUT',W/2,H/2);
    }
    if(['sim','timeout','foulout'].includes(state.phase))requestAnimationFrame(drawCourt);
    else frameRunning=false;
  }
  function drawInitials(ctx,p,x,y){ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='900 17px system-ui';ctx.fillText(p.name.split(' ').map(a=>a[0]).slice(0,2).join(''),x,y+6);}
  $('court').addEventListener('click',e=>{
    if(!state?.game)return;
    const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)*940/rect.width,y=(e.clientY-rect.top)*525/rect.height;
    const closest=[...canvasPositions.entries()].map(([id,pos])=>({id,d:Math.hypot(pos.x-x,pos.y-y)})).sort((a,b)=>a.d-b.d)[0];
    if(closest?.d<35){selectedFocus=closest.id;render(true);}
  });
})();
