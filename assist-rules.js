// Conditional probability of crediting the final successful passer on a made field goal.
export function assistAwardChance(compliance,{teamBall=false,chaos=false,runGun=false,oldSchool=false,screen=false}={}){
  const discipline=Math.max(.15,Math.min(1,compliance));
  return Math.max(.35,Math.min(.98,.60+.25*discipline+(teamBall?.12:0)+(chaos&&screen?.10:0)+(runGun&&screen?.16:0)+(oldSchool?.18:0)));
}
