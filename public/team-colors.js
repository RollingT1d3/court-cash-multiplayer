// Shared allowlist for the browser and the authoritative multiplayer server.
(function(root){
  'use strict';
  const palette=Object.freeze({
    red:'#d84b4b',blue:'#4b6fd8',grey:'#7a7a7a',black:'#1f1f1f',white:'#f2f2f2',
    green:'#3fae5a',yellow:'#d8c84b',purple:'#8a55d8',pink:'#d86fb0',orange:'#d8893f',
    sky:'#7f94ad',grass:'#6f8f6f',sun:'#ffd84a',
    poop:'#b58a5c','dog poop':'#624026',puke:'#aaff45',periwinkle:'#ccccff','other sky':'#a9d8f5',
    highlighter:'#ffff00',rust:'#a34b32','night sky':'#303d52'
  });
  const valid=id=>typeof id==='string'&&Object.hasOwn(palette,id);
  function choose(preferred,side,occupied){
    if(preferred!=null&&preferred!==''&&!valid(preferred))throw Error('Choose a valid team color.');
    if(valid(preferred)){
      if(preferred===occupied)throw Error('That team color is already taken. Choose another color on the main menu.');
      return preferred;
    }
    const defaults=side===0?['blue','red']:['red','blue'];
    return defaults.find(id=>id!==occupied);
  }
  const hex=id=>valid(id)?palette[id]:palette.blue;
  const ink=id=>{
    const h=hex(id);
    const rgb=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#111827':'#ffffff';
  };
  root.CourtTeamColors=Object.freeze({palette,valid,choose,hex,ink});
})(globalThis);
