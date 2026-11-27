/* Court Cash splash screen. No gameplay, audio, or room-state changes. */
(function(){
  'use strict';
  const screen=document.getElementById('splash-screen'),art=document.getElementById('splash-art'),
    base=document.getElementById('splash-base'),cast=document.getElementById('splash-cast'),
    play=document.getElementById('splash-play'),shell=document.getElementById('shell');
  if(!screen||!art||!base||!cast||!play||!shell)return;
  // Do not interrupt an existing multiplayer room when a player refreshes.
  try{const saved=JSON.parse(sessionStorage.getItem('court-cash-identity')||'null');if(saved?.code&&saved?.token)return;}catch{}
  screen.hidden=false;document.body.classList.add('splash-open');shell.inert=true;
  let dismissed=false,started=false;
  const ready=()=>{
    if(started||dismissed)return;
    if(base.complete&&base.naturalWidth>0&&cast.complete&&cast.naturalWidth>0){
      started=true;art.classList.add('reveal');
    }
  };
  const fallback=()=>{
    if(dismissed)return;
    art.classList.add('fallback');
    if(base.complete&&!base.naturalWidth&&cast.complete&&cast.naturalWidth>0){started=true;art.classList.add('reveal');}
  };
  base.addEventListener('load',ready);cast.addEventListener('load',ready);
  base.addEventListener('error',fallback);cast.addEventListener('error',fallback);
  if((base.complete&&!base.naturalWidth)||(cast.complete&&!cast.naturalWidth))fallback();
  ready();
  play.addEventListener('click',()=>{
    if(dismissed)return;dismissed=true;
    screen.hidden=true;shell.inert=false;document.body.classList.remove('splash-open');
    document.getElementById('create-name')?.focus({preventScroll:true});
  });
  play.focus({preventScroll:true});
})();
