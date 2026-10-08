/** Motion toolkit: exact damped springs, easing and a seeded generator. Pass the real `dt` in seconds. */
export const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const smoothstep=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export interface Spring{x:number;v:number}
export const spring=(x=0):Spring=>({x,v:0});
/** Closed-form damped oscillator toward `target`, exact for any dt; omega in rad/s, zeta below 1 rings. */
export function stepSpring(s:Spring,target:number,omega:number,zeta:number,dt:number):Spring{
 if(dt<=0)return s;
 const x0=s.x-target,v0=s.v;
 if(zeta>=1){
  const e=Math.exp(-omega*dt),b=v0+omega*x0;
  s.x=target+e*(x0+b*dt);
  s.v=e*(b-omega*(x0+b*dt));
  return s;
 }
 const wd=omega*Math.sqrt(1-zeta*zeta),e=Math.exp(-zeta*omega*dt),c=Math.cos(wd*dt),sn=Math.sin(wd*dt),b=(v0+zeta*omega*x0)/wd;
 s.x=target+e*(x0*c+b*sn);
 s.v=e*((wd*b-zeta*omega*x0)*c-(wd*x0+zeta*omega*b)*sn);
 return s;
}
/** Seeded mulberry32, so a replayed crash falls the same way every time. */
export function mulberry32(seed:number):()=>number{
 let a=seed>>>0;
 return()=>{
  a=(a+0x6d2b79f5)>>>0;
  let t=a;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return((t^(t>>>14))>>>0)/4294967296;
 };
}
