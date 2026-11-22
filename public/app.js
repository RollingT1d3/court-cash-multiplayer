(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SLOTS = ['PG','SG','SF','PF','C','Sixth','Bench 1','Bench 2'];
  const OFFENSE = ['Play Through Superstar','Play Through Stars','Team Ball','Live By the 3, Die by the 3','Paint Mash'];
  const DEFENSE = ['Man-to-Man','Double the Star','Protect the Paint','Perimeter Secured'];
  const CAT = {
    'FINISHING': [['Layup','layup',.4],['Dunking','dunk',.4],['Post Moves','post',.2]],
    'SHOOTING': [['Free Throw','ft',.10],['Mid-Range','mid',.29],['3PT','three',.46],['Fades','fades',.15]],
    'PLAYMAKING': [['Passing','passing',.52],['Dribbling','dribbling',.48]],
    'DEFENSE': [['Paint Defense','paintDef',.24],['Perimeter Defense','perimeterDef',.29],['Block','block',.24],['Steal','steal',.23]],
    'OTHER': [['Rebounding','rebound',.20],['Strength','strength',.12],['Speed','speed',.16],['IQ','iq',.16],['Teamwork','teamwork',.16],['Stamina','stamina',.20]]
  };
  let identity = null, stream = null, state = null, lastRenderKey='', currentPicked=null, expanded=new Set(), selectedFocus=null;
  let lastRoomPhase=null, wheelSize=390, noticeTimer=null;
  let canvasPositions = new Map(), courtImages = new Map(), frameRunning=false;
  let syncOffset=0;
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
    if(stream)stream.close();
    $('status-label').textContent='Connecting…';
    stream=new EventSource(`/events?code=${encodeURIComponent(identity.code)}&token=${encodeURIComponent(identity.token)}`);
    stream.onopen=()=>{$('status-label').textContent='Connected • '+identity.code;$('status-dot').classList.add('on');};
    stream.onerror=()=>{$('status-label').textContent='Reconnecting…';$('status-dot').classList.remove('on');};
    stream.onmessage=e=>{
      try{state=JSON.parse(e.data);syncOffset=Date.now()-state.serverTime;render();}catch(err){console.error(err);}
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
  function portrait(p,size='sm',side='blue'){
    if(!p)return `<span class="portrait ${size} ${side}">?</span>`;
    const initials=p.name.split(/\s+/).map(a=>a[0]).slice(0,2).join('').toUpperCase();
    return `<span class="portrait ${size} ${side}">${p.image?`<img src="${esc(p.image)}" alt="" onerror="this.style.display='none'">`:''}<span>${esc(initials)}</span></span>`;
  }
  function rosterDisplaySlots(i){
    const t=state.teams[i];if(!t)return {};
    if(state.phase==='timeout'&&state.game){
      const floor=state.game.active[i];const bench=t.roster.filter(id=>!floor.includes(id));
      return Object.fromEntries(SLOTS.map((s,j)=>[s,[...floor,...bench][j]||null]));
    }
    return t.slots;
  }
  function teamPanel(i){
    const t=state.teams[i];if(!t)return '<div class="team-panel">Waiting for a team…</div>';
    const side=i===0?'left':'right';const change=eligible()&&isMine(i);
    const roster=rosterDisplaySlots(i);
    const rows=SLOTS.map(s=>{
      const id=roster[s],p=player(id);
      const selected=currentPicked===id&&change?'selected-slot':'';
      return `<button class="slot ${side} ${id?'owned':''} ${selected}" type="button" data-slot="${esc(s)}" data-team="${i}" ${change?'':'disabled'} aria-label="${esc(s)}: ${p?esc(p.name):'Empty'}">
        <span class="slot-label">${esc(s)}</span>${p?`${portrait(p,'sm',i?'red':'blue')}<span class="slot-center"><b>${esc(p.name)}</b><small>${esc(p.positions.join('/'))}</small></span>${badge(p,s)}`:'<span class="slot-center"><small>EMPTY • DROP HERE</small></span>'}
      </button>`;
    }).join('');
    return `<div class="team-title"><strong>${esc(t.name)}</strong><span class="team-money">${money(t.budget)}</span></div>
      <div class="smallcaps">${t.roster.length}/8 DRAFTED ${isMine(i)?' • YOUR TEAM':''}</div>
      <div class="roster-list">${rows}</div>
      ${t.ready?'<p class="ready-state">✓ READY</p>':''}`;
  }
  function bindRoster(container){
    if(!container)return;
    for(const slot of container.querySelectorAll('[data-slot]')){
      if(slot.disabled)continue;
      slot.addEventListener('click',()=>{
        const id=rosterDisplaySlots(state.you)[slot.dataset.slot];
        if(currentPicked && currentPicked!==id){act('place',{playerId:currentPicked,slot:slot.dataset.slot});currentPicked=null;}
        else if(id){currentPicked=id;render(true);}
      });
      const id=rosterDisplaySlots(state.you)[slot.dataset.slot];
      if(id){slot.draggable=true;slot.addEventListener('dragstart',e=>{currentPicked=id;e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';});}
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
    return `<div class="profile"><div style="position:relative;flex:none">${portrait(p,'xl','blue')}${badge(p)}</div>
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
      <p class="tiny">Minimum opening bid $1.00. Raise by $0.50 or more in $0.50 increments.</p>
    </div>`;
  }
  function wheelMarkup(){return `<div class="wheel-stage"><span class="wheel-arrow"></span><canvas id="wheel-canvas" width="440" height="440" aria-label="Weighted player wheel"></canvas></div>`;}
  function drawWheel(){
    const canvas=$('wheel-canvas');if(!canvas)return;
    const cx=canvas.width/2,cy=canvas.height/2,r=209,ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,440,440);
    const pool=(state.remaining||[]).map(player).filter(Boolean);
    const total=pool.reduce((sum,p)=>sum+Math.max(p.weight||1,.001),0);
    let a=-Math.PI/2,selectedCenter=0;
    pool.forEach((p,i)=>{
      const frac=Math.max(p.weight||1,.001)/total,arc=frac*2*Math.PI;
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
      <h3>${esc(state.teams[state.coinWinner]?.name)} wins the flip!</h3><p class="subtle">They'll open bidding on the first wheel spin. Starting bidder alternates each spin.</p>`;
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
        <button class="pick-player" id="pick-new" type="button" ${isMine(owner)?'':'disabled'} style="background:transparent;padding:0">${portrait(p,'xl',owner===0?'blue':'red')}</button>
        <h2 style="margin:10px 0">${esc(p.name)}</h2><p class="auction-sub">${isMine(owner)?'Click the portrait, then click a roster box to place him. Or drag from a roster box to rearrange.':'Waiting for the drafting team to place their player.'}</p>
        ${isMine(owner)?'<button id="next-spin" class="primary">NEXT SPIN →</button>':''}`;
      $('pick-new')?.addEventListener('click',()=>{currentPicked=p.id;render(true);});
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
      <div class="scheme-explainer"><b>Offense:</b> Your shooting choices and ball distribution follow your chosen scheme.<br /><br />
      <b>Defense:</b> Man-to-Man • Double the Star • Protect the Paint • Perimeter Secured.<br /><br />
      ${state.phase==='lineup'?'Position suitability will affect simulation outcomes. Listed positions incur no penalty.':''}</div>
      <button class="primary full" id="ready-btn" ${my().ready?'disabled':''}>${my().ready?'✓ WAITING FOR OPPONENT': 'READY TO PLAY →'}</button>`;
    $('offense-select')?.addEventListener('change',e=>act('scheme',{offense:e.target.value}));
    $('defense-select')?.addEventListener('change',e=>act('scheme',{defense:e.target.value}));
    $('ready-btn')?.addEventListener('click',()=>act('ready'));
    if(!canChange) $('ready-btn').disabled=true;
  }
  function showScore(){
    const g=state.game;if(!g)return;
    $('scoreboard').innerHTML=`<div class="score-side"><span class="score-team">${esc(state.teams[0].name)}</span><span class="score-number">${g.score[0]}</span><span class="tiny">${state.teams[0].wins} SERIES WINS • ${state.teams[0].timeouts} TIMEOUTS</span></div>
      <div class="score-meta"><span>GAME ${state.gameNumber}${state.format===7?' • BEST OF 7':''}</span><strong>${esc(g.period)} ${secs(g.secondsLeft)}</strong>
      ${state.phase==='sim'?'<button id="call-timeout" class="primary">⏸ CALL TIMEOUT</button>':'<span class="smallcaps">⏸ TIMEOUT IN PROGRESS</span>'}</div>
      <div class="score-side end"><span class="score-team">${esc(state.teams[1].name)}</span><span class="score-number">${g.score[1]}</span><span class="tiny">${state.teams[1].timeouts} TIMEOUTS • ${state.teams[1].wins} SERIES WINS</span></div>`;
    $('call-timeout')?.addEventListener('click',()=>act('timeout'));
    if($('call-timeout')&&!my().timeouts)$('call-timeout').disabled=true;
  }
  function focusPanel(){
    const g=state.game;const id=selectedFocus&&g.stats[selectedFocus]?selectedFocus:g.active[state.you][0];
    if(!id)return;
    selectedFocus=id;
    const p=player(id),stats=g.stats[id];const owner=state.teams.findIndex(t=>t.roster.includes(id));
    $('player-focus').innerHTML=`<div class="smallcaps">CLICK ANY PLAYER TO INSPECT</div>
      <div style="display:flex;align-items:center;gap:12px;margin:10px 0">${portrait(p,'med',owner?'red':'blue')}<div><b>${esc(p.name)}</b><p class="tiny">${esc(p.positions.join('/'))} • ${p.overall} OVR</p><p class="tiny">💦 Energy: ${Math.round(state.teams[owner].energy[id]??100)}%</p></div></div>
      <div class="data-grid">${[['PTS',stats.pts],['REB',stats.reb],['AST',stats.ast],['STL',stats.stl],['BLK',stats.blk],['TOV',stats.tov],['FG',stats.fgm+'/'+stats.fga],['3PT',stats.threeM+'/'+stats.threeA],['MIN',Math.round(stats.seconds/60)]].map(([k,v])=>`<div class="data-cell"><b>${esc(v)}</b><span>${k}</span></div>`).join('')}</div>`;
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
    ${caller===state.you?`<p class="subtle" style="margin-top:15px">Your active five and three bench players are below. Click a player and then the destination slot to substitute or change position.</p><div id="timeout-team" class="team-panel"></div>`:''}
    </div>`;
    $('timeout-offense')?.addEventListener('change',e=>act('scheme',{offense:e.target.value}));
    $('timeout-defense')?.addEventListener('change',e=>act('scheme',{defense:e.target.value}));
    $('resume-game')?.addEventListener('click',()=>act('resume'));
    if(caller===state.you){$('timeout-team').innerHTML=teamPanel(state.you);bindRoster($('timeout-team'));}
  }
  function renderSim(){showScore();focusPanel();timeoutPanel();startCourtAnimation();}
  function boxTable(i){
    const t=state.teams[i];const g=state.game;if(!g)return '';
    return `<h3>${esc(t.name)} — ${g.score[i]} PTS</h3><div style="overflow:auto"><table class="box-table"><thead><tr>${['PLAYER','PTS','REB','AST','STL','BLK','TOV','FG','3PT','MIN'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>
      ${t.roster.map(id=>{const p=player(id),s=g.stats[id];return `<tr><td>${esc(p.name)}</td><td>${s.pts}</td><td>${s.reb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.blk}</td><td>${s.tov}</td><td>${s.fgm}/${s.fga}</td><td>${s.threeM}/${s.threeA}</td><td>${Math.round(s.seconds/60)}</td></tr>`;}).join('')}
    </tbody></table></div>`;
  }
  function renderEnd(){
    const end=$('end-view'),winner=state.result?.winner;
    if(winner===undefined||winner===null)return;
    const winTeam=state.teams[winner],over=state.phase==='finished';
    end.innerHTML=`<div class="end-card card"><div class="smallcaps">${state.result.forfeit?'FORFEIT':over?'MATCH COMPLETE':'GAME COMPLETE'} • GAME ${state.gameNumber}</div>
      <h1 class="winner">🏆 ${esc(winTeam.name)} WINS!</h1>
      ${state.result.forfeit?`<p class="subtle">${esc(state.result.reason)}</p>`:`<p class="lead">${state.game.score[0]} – ${state.game.score[1]} ${state.format===7?' • Series '+state.teams[0].wins+'–'+state.teams[1].wins:''}</p>`}
      ${state.game?boxTable(0)+boxTable(1):''}
      ${state.format===7&&!over?'<button id="between-ready" class="primary">ADJUST SCHEMES FOR NEXT GAME →</button>':'<p class="subtle">Match finished. To start another match, create a new room.</p>'}</div>`;
    $('between-ready')?.addEventListener('click',()=>{window.scrollTo({top:0,behavior:'smooth'});});
  }
  function render(force=false){
    if(!state)return;
    $('welcome').classList.add('hide');$('gameview').classList.remove('hide');
    $('room-header').innerHTML=`<span class="room-title">PRIVATE ROOM <span class="room-code" title="Share this code with your friend">${esc(state.code)}</span></span>
      <div class="room-versus"><span>${esc(state.teams[0]?.name)}</span><span class="vs">VS</span><span>${esc(state.teams[1]?.name||'WAITING...')}</span></div>
      <span class="smallcaps">${state.format===7?'BEST OF 7':'SINGLE GAME'} • ${state.teams.filter(Boolean).length}/2 PLAYERS</span>`;
    const banners={lobby:'Share your room code with your friend. The game starts once they join.',coinflip:'🪙 The coin determines who places the first opening bid.',wheel:'🎡 Spinning the weighted player wheel…',auction:'💰 Bid in $0.50 increments. Your turn lasts 30 seconds and resets after each new bid.',placement:'🃏 The drafted player can be placed into any roster slot, then the next spin begins.',lineup:'🧠 Set both game plans and organize your team before clicking Ready.',sim:'🏀 Live game • each marker is a player • the ball and sweat icons reflect gameplay.',timeout:'⏸ Timeout • both teams may change schemes, but only the caller may substitute.',intermission:'🔁 Series break • both teams may adjust their schemes before the next game.',finished:'🏆 Final results.'};
    $('phase-banner').textContent=banners[state.phase]||'';
    const sig=JSON.stringify({phase:state.phase,team:state.teams.map(t=>t&&[t.roster,t.slots,t.budget,t.ready,t.offense,t.defense,t.wins,t.timeouts,t.energy]),
      coin:state.coinWinner,wheel:state.wheel?.spinId,auction:state.auction?.bid+'_'+state.auction?.turn+'_'+state.auction?.mode+'_'+state.auction?.deadline,
      pending:state.pending,gameId:state.gameNumber,event:state.game?.event?.id,time:state.timeout?.until,focus:selectedFocus,picked:currentPicked});
    if(!force&&sig===lastRenderKey){updateClocks();return;}
    lastRenderKey=sig;
    for(const id of ['draft-view','setup-view','sim-view','end-view'])$(id).classList.add('hide');
    if(['lobby','coinflip','wheel','auction','placement'].includes(state.phase)){$('draft-view').classList.remove('hide');renderDraft();}
    if(['lineup','intermission'].includes(state.phase)){$('setup-view').classList.remove('hide');renderPrep();}
    if(['sim','timeout'].includes(state.phase)){$('sim-view').classList.remove('hide');renderSim();}
    if(state.phase==='finished'){$('end-view').classList.remove('hide');renderEnd();}
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
  function drawCourt(ms){
    if(!state?.game){frameRunning=false;return;}
    const el=$('court');const ctx=el.getContext('2d');const W=940,H=500;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#b78347';ctx.fillRect(0,0,W,H);
    for(let i=0;i<17;i++){ctx.fillStyle=i%2?'#ae7946':'#b9844c';ctx.fillRect(i*W/17,0,W/17,H);}
    ctx.strokeStyle='#fff6e9';ctx.lineWidth=4;ctx.strokeRect(17,17,W-34,H-34);
    ctx.beginPath();ctx.moveTo(W/2,17);ctx.lineTo(W/2,H-17);ctx.stroke();
    ctx.beginPath();ctx.arc(W/2,H/2,67,0,2*Math.PI);ctx.stroke();
    for(const s of [0,1]){
      ctx.beginPath();ctx.rect(s===0?17:W-189,H/2-94,172,188);ctx.stroke();
      ctx.beginPath();ctx.arc(s===0?189:W-189,H/2,65,0,2*Math.PI);ctx.stroke();
      ctx.beginPath();ctx.arc(s===0?54:W-54,H/2,24,0,2*Math.PI);ctx.stroke();
      ctx.beginPath();
      const basket=s===0?54:W-54;
      ctx.arc(basket,H/2,224,s===0?-Math.PI*.44:Math.PI*.56,s===0?Math.PI*.44:Math.PI*1.44);
      ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(s===0?39:W-45,H/2-19,6,38);
      ctx.beginPath();ctx.strokeStyle='#ed593c';ctx.lineWidth=5;ctx.arc(basket,H/2,11,0,Math.PI*2);ctx.stroke();ctx.lineWidth=4;ctx.strokeStyle='#fff6e9';
    }
    const game=state.game,event=game.event;
    const offense=event?.offense??game.offense;
    const attackRight=offense===0?(game.quarter<=2):!(game.quarter<=2);
    const targetGoal=attackRight?886:54;
    const anchors=[{x:.66,y:.5},{x:.74,y:.20},{x:.71,y:.82},{x:.84,y:.33},{x:.84,y:.64}];
    const defenseAnchors=[{x:.73,y:.50},{x:.81,y:.20},{x:.81,y:.82},{x:.87,y:.38},{x:.87,y:.65}];
    const present=new Set();
    for(let side=0;side<2;side++){
      for(let pos=0;pos<5;pos++){
        const id=game.active[side][pos];if(!id)continue;present.add(id);
        const attacking=side===offense;
        const anchor=(attacking?anchors:defenseAnchors)[pos];
        let x=anchor.x*W,y=anchor.y*H;
        if(event?.shooter===id&&attacking){x=.83*W;y=H*.50;}
        if(event?.defender===id&&!attacking){x=.85*W;y=H*.53;}
        if(event?.reboundId===id){x=.88*W;y=H*.58;}
        if(!attackRight)x=W-x;
        const prev=canvasPositions.get(id)||{x,y};
        const v=.060;prev.x+=(x-prev.x)*v;prev.y+=(y-prev.y)*v;canvasPositions.set(id,prev);
        const p=player(id);if(!p)continue;
        ctx.beginPath();ctx.fillStyle='#101824';ctx.arc(prev.x,prev.y,26,0,2*Math.PI);ctx.fill();
        ctx.save();ctx.beginPath();ctx.arc(prev.x,prev.y,22,0,2*Math.PI);ctx.clip();
        if(p.image){
          let img=courtImages.get(id);
          if(!img){img=new Image();img.src=p.image;courtImages.set(id,img);}
          if(img.complete&&img.naturalWidth)ctx.drawImage(img,prev.x-22,prev.y-22,44,44);
          else{ctx.fillStyle=side?'#b64e66':'#527baf';ctx.fillRect(prev.x-23,prev.y-23,46,46);drawInitials(ctx,p,prev.x,prev.y);}
        }else{ctx.fillStyle=side?'#b64e66':'#527baf';ctx.fillRect(prev.x-23,prev.y-23,46,46);drawInitials(ctx,p,prev.x,prev.y);}
        ctx.restore();
        ctx.lineWidth=4;ctx.strokeStyle=side?'#ff889e':'#91c9ff';ctx.beginPath();ctx.arc(prev.x,prev.y,24,0,2*Math.PI);ctx.stroke();
        ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#122136';ctx.fillStyle='#fff';
        const first=p.name.split(' ')[0];ctx.strokeText(first,prev.x,prev.y+39);ctx.fillText(first,prev.x,prev.y+39);
        const e=state.teams[side].energy[id]??100;
        if(e<80){ctx.font=e<40?'21px system-ui':'15px system-ui';ctx.fillText(e<40?'🥵':'💦',prev.x+20,prev.y-20);}
      }
    }
    for(const id of [...canvasPositions.keys()])if(!present.has(id))canvasPositions.delete(id);
    if(event&&canvasPositions.has(event.shooter)){
      const d=canvasPositions.get(event.shooter);const t=Date.now()-event.at;
      let bx=d.x+28,by=d.y+14;
      if(event.assistId&&canvasPositions.has(event.assistId)&&t<200){const src=canvasPositions.get(event.assistId),progress=t/200;bx=src.x+(d.x-src.x)*progress;by=src.y+(d.y-src.y)*progress;}
      else if(t>200&&t<600&&event.displayEvent!=='steal'){
        const t2=(t-200)/400;bx=d.x+(targetGoal-d.x)*t2;by=d.y+(H/2-d.y)*t2-65*4*t2*(1-t2);
      }
      ctx.beginPath();ctx.fillStyle='#fc8c2f';ctx.strokeStyle='#45290e';ctx.lineWidth=2;ctx.arc(bx,by,9,0,2*Math.PI);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx-9,by);ctx.lineTo(bx+9,by);ctx.moveTo(bx,by-9);ctx.lineTo(bx,by+9);ctx.stroke();
    }
    if(state?.phase==='timeout'){
      ctx.fillStyle='#08101acc';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#ffdb84';ctx.font='900 44px system-ui';ctx.textAlign='center';ctx.fillText('⏸  TIMEOUT',W/2,H/2);
    }
    if(['sim','timeout'].includes(state.phase))requestAnimationFrame(drawCourt);
    else frameRunning=false;
  }
  function drawInitials(ctx,p,x,y){ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='900 17px system-ui';ctx.fillText(p.name.split(' ').map(a=>a[0]).slice(0,2).join(''),x,y+6);}
  $('court').addEventListener('click',e=>{
    if(!state?.game)return;
    const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)*940/rect.width,y=(e.clientY-rect.top)*500/rect.height;
    const closest=[...canvasPositions.entries()].map(([id,pos])=>({id,d:Math.hypot(pos.x-x,pos.y-y)})).sort((a,b)=>a.d-b.d)[0];
    if(closest?.d<35){selectedFocus=closest.id;render(true);}
  });
})();
