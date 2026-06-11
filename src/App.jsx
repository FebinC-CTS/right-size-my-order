import { useState, useEffect, useRef, useCallback } from 'react';
import { complete, parseJsonObject } from './lib/claude';

/* ─── AI recommendation prompt ────────────────────────────────────────────── */
const AI_SYSTEM = `You write microcopy for "Right-Size MyOrder", a feature inside a water-delivery app that gently helps customers match their subscription to what they actually use — saving money and cutting waste. Voice: warm, honest, calm, quietly confident — never pushy or salesy. Never fabricate numbers; use only the figures provided.`;

const AI_USER = `A customer's recent water consumption (gallons per 4-week delivery cycle) was: Aug 12.8, Sep 11.5, Oct 11.0 — a gentle downward trend, averaging about 12 gallons. Their current plan delivers 15 gallons per cycle, so they are accumulating roughly 8 surplus gallons per quarter. Water costs about $8 per gallon.

Return ONLY a JSON object (no markdown fences, no preamble, no trailing prose) with exactly this shape:
{ "headline": "<max 8 words, sentence case, a gentle observation that their order is a bit larger than they need>", "body": "<max 50 words, plain text, reference the ~12 gal actual usage vs the 15 gal plan and the small surplus quietly building up; warm and non-pushy; no exclamation marks>" }`;

/* ─── Global CSS ──────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700;9..144,900&family=Inter:wght@300;400;500;600&display=swap');

:root {
  --bg:#f7f4ef; --text:#1c2b3a; --accent:#e8a020; --accent-lt:#fdf3e0;
  --green:#3dbb7a; --green-lt:#e6f9f0; --card:#fff; --border:#e4ddd3; --muted:#7a8a99;
}
.serif{font-family:'Fraunces',serif;} .sans{font-family:'Inter',sans-serif;}

/* ── Core animations ── */
@keyframes draw-ecg   {0%{stroke-dashoffset:320}100%{stroke-dashoffset:0}}
@keyframes drop-float {0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes drop-glow  {0%,100%{filter:drop-shadow(0 0 4px rgba(232,160,32,.3))}50%{filter:drop-shadow(0 0 14px rgba(232,160,32,.75))}}
@keyframes fade-up    {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes rec-glow   {0%,100%{box-shadow:0 0 0 0 rgba(232,160,32,.12),0 8px 32px rgba(28,43,58,.07)}50%{box-shadow:0 0 0 8px rgba(232,160,32,.07),0 8px 40px rgba(232,160,32,.2)}}
@keyframes flip-card  {0%{transform:perspective(900px) rotateY(0deg);opacity:1}45%{transform:perspective(900px) rotateY(88deg);opacity:0}55%{transform:perspective(900px) rotateY(-88deg);opacity:0}100%{transform:perspective(900px) rotateY(0deg);opacity:1}}
@keyframes confetti-burst{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(.4);opacity:0}}
@keyframes toast-in   {from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes shimmer-in {from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
@keyframes alert-pulse{0%,100%{background-color:rgba(232,160,32,.1)}50%{background-color:rgba(232,160,32,.2)}}
@keyframes tab-data-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* ── Modal / drawer ── */
@keyframes overlay-fade{from{opacity:0}to{opacity:1}}
@keyframes modal-in    {from{opacity:0;transform:scale(.93) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes drawer-up   {from{transform:translateY(100%)}to{transform:translateY(0)}}

.rec-card-pulse{animation:rec-glow 3.2s ease-in-out infinite;}
.rec-card-flip {animation:flip-card .65s ease-in-out forwards;}
.drop-float    {animation:drop-float 2.8s ease-in-out infinite,drop-glow 2.8s ease-in-out infinite;}
.alert-pulse   {animation:alert-pulse 2.6s ease-in-out infinite;}

/* ── Range slider ── */
input[type='range'].plan-slider{
  -webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;outline:none;cursor:pointer;
  background:linear-gradient(to right,#e8a020 0%,#e8a020 var(--sp,40%),#e4ddd3 var(--sp,40%),#e4ddd3 100%);
}
input[type='range'].plan-slider::-webkit-slider-thumb{
  -webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#e8a020;
  cursor:pointer;box-shadow:0 2px 8px rgba(232,160,32,.5);border:3px solid #fff;transition:transform .15s;
}
input[type='range'].plan-slider::-webkit-slider-thumb:hover{transform:scale(1.2);}
input[type='range'].plan-slider::-moz-range-thumb{
  width:22px;height:22px;border-radius:50%;background:#e8a020;
  cursor:pointer;box-shadow:0 2px 8px rgba(232,160,32,.5);border:3px solid #fff;
}

/* ── Toggle switch ── */
.tog-track{position:relative;width:44px;height:24px;border-radius:12px;background:#e4ddd3;transition:background .25s;flex-shrink:0;cursor:pointer;}
.tog-track.on{background:#3dbb7a;}
.tog-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .25s cubic-bezier(.34,1.4,.64,1);box-shadow:0 1px 4px rgba(0,0,0,.18);}
.tog-track.on .tog-thumb{left:23px;}

/* ── Cohort expand ── */
.expand-panel{overflow:hidden;transition:max-height .38s cubic-bezier(.4,0,.2,1),opacity .3s ease;}
.expand-panel.closed{max-height:0;opacity:0;}
.expand-panel.open  {max-height:200px;opacity:1;}
`;

/* ─── Data ───────────────────────────────────────────────────────────────── */
const CHART_ALL = [
  {month:'Nov',delivered:15,consumed:12.8},{month:'Dec',delivered:15,consumed:12.0},
  {month:'Jan',delivered:15,consumed:12.5},{month:'Feb',delivered:15,consumed:13.0},
  {month:'Mar',delivered:15,consumed:13.5},{month:'Apr',delivered:15,consumed:13.8},
  {month:'May',delivered:15,consumed:14.2},{month:'Jun',delivered:15,consumed:14.8},
  {month:'Jul',delivered:15,consumed:14.1},{month:'Aug',delivered:15,consumed:12.8},
  {month:'Sep',delivered:15,consumed:11.5},{month:'Oct',delivered:15,consumed:11.0},
];
const RANGES = {'3M':CHART_ALL.slice(9),'6M':CHART_ALL.slice(6),'12M':CHART_ALL};

const COHORT_PEERS = [
  {id:1,icon:'🏡',label:'Household A',used:10.5,plan:12,status:'matched',trend:[10.8,10.2,10.5],desc:'Right-sized 6 months ago. Stable. Churn risk: low.'},
  {id:2,icon:'🏘️',label:'Household B',used:13.0,plan:15,status:'surplus',trend:[12.5,13.2,13.0],desc:'Slight surplus 2 months running. Suggestion pending.'},
  {id:3,icon:'🏗️',label:'Household C',used:11.8,plan:12,status:'matched',trend:[11.5,12.0,11.8],desc:'Well-matched since spring. No action needed.'},
  {id:0,icon:'🏠',label:'You',        used:11,  plan:15,status:'you',    trend:[12.8,11.5,11.0],desc:'Surplus growing month-over-month. Recommendation active.'},
];

/* ─── Hooks ──────────────────────────────────────────────────────────────── */
function useInView(threshold=0.2){
  const ref=useRef(null);
  const [inView,setInView]=useState(false);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setInView(true);obs.disconnect();}},{threshold});
    obs.observe(el); return ()=>obs.disconnect();
  },[threshold]);
  return [ref,inView];
}

/* ─── CountUp ────────────────────────────────────────────────────────────── */
function CountUp({target,suffix='',duration=1100,inView}){
  const [val,setVal]=useState(0);
  const raf=useRef(null);
  useEffect(()=>{
    if(!inView) return;
    const t0=performance.now();
    const tick=now=>{
      const p=Math.min((now-t0)/duration,1);
      setVal(+(target*(1-Math.pow(1-p,3))).toFixed(1));
      if(p<1) raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf.current);
  },[inView,target,duration]);
  return <>{val}{suffix}</>;
}

/* ─── Toggle ─────────────────────────────────────────────────────────────── */
function Toggle({on,onToggle,label,sub}){
  return(
    <div onClick={onToggle} role="switch" aria-checked={on}
      style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #e4ddd3',cursor:'pointer',userSelect:'none'}}>
      <div>
        <p className="sans" style={{fontSize:14,fontWeight:600,color:'#1c2b3a'}}>{label}</p>
        {sub&&<p className="sans" style={{fontSize:12,color:'#aab4be',marginTop:1}}>{sub}</p>}
      </div>
      <div className={`tog-track${on?' on':''}`}><div className="tog-thumb"/></div>
    </div>
  );
}

/* ─── Sparkline ──────────────────────────────────────────────────────────── */
function Sparkline({data,color='#e8a020'}){
  const W=100,H=36,min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-((v-min)/range)*(H-8)-4}`).join(' ');
  return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i)=><circle key={i} cx={(i/(data.length-1))*W} cy={H-((v-min)/range)*(H-8)-4} r="3.5" fill={color}/>)}
    </svg>
  );
}

/* ─── BarChart with hover tooltips + range prop ──────────────────────────── */
function BarChart({inView,data}){
  const W=560,H=200,pad={t:20,r:16,b:36,l:28};
  const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b,MAX=18;
  const gW=cW/data.length,bW=gW*0.28,gap=gW*0.05;
  const y=v=>pad.t+cH-(v/MAX)*cH,yH=v=>(v/MAX)*cH;
  const ticks=[0,5,10,15,18];
  const containerRef=useRef(null);
  const [tip,setTip]=useState({v:false,x:0,y:0,d:null});

  const onEnter=(e,d)=>{
    if(!containerRef.current) return;
    const r=containerRef.current.getBoundingClientRect();
    setTip({v:true,x:e.clientX-r.left,y:e.clientY-r.top,d});
  };
  const onMove=(e,d)=>{
    if(!containerRef.current) return;
    const r=containerRef.current.getBoundingClientRect();
    setTip(t=>({...t,x:e.clientX-r.left,y:e.clientY-r.top}));
  };
  const onLeave=()=>setTip(t=>({...t,v:false}));

  const showGapCallout=data.length>=6;
  const gapIdx=data.findIndex(d=>d.month==='Aug');

  return(
    <div ref={containerRef} style={{overflowX:'auto',position:'relative'}}>
      {tip.v&&tip.d&&(
        <div style={{
          position:'absolute',left:tip.x,top:tip.y-80,transform:'translateX(-50%)',
          background:'#1c2b3a',color:'#fff',borderRadius:10,padding:'8px 12px',
          fontSize:12,fontFamily:'Inter,sans-serif',pointerEvents:'none',zIndex:20,
          whiteSpace:'nowrap',boxShadow:'0 6px 20px rgba(28,43,58,.25)',
        }}>
          <p style={{fontWeight:700,marginBottom:4,color:'#f7f4ef'}}>{tip.d.month}</p>
          <p style={{color:'#c8d9e8',marginBottom:2}}>Delivered: <strong>{tip.d.delivered} gal</strong></p>
          <p style={{color:'#e8a020',marginBottom:2}}>Consumed: <strong>{tip.d.consumed} gal</strong></p>
          <p style={{color:'#3dbb7a'}}>Surplus: <strong>{(tip.d.delivered-tip.d.consumed).toFixed(1)} gal</strong></p>
          <div style={{position:'absolute',bottom:-5,left:'50%',transform:'translateX(-50%)',width:10,height:6,background:'#1c2b3a',clipPath:'polygon(50% 100%,0 0,100% 0)'}}/>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{maxWidth:W,display:'block',margin:'0 auto'}}>
        {ticks.map(t=>(
          <g key={t}>
            <line x1={pad.l} y1={y(t)} x2={W-pad.r} y2={y(t)} stroke="#e4ddd3" strokeWidth="1"/>
            <text x={pad.l-5} y={y(t)+4} fontSize="9" fill="#aab4be" textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d,i)=>{
          const cx=pad.l+i*gW+gW/2,delay=i*0.09,isLate=d.consumed<13;
          return(
            <g key={d.month} style={{cursor:'crosshair'}}
              onMouseEnter={e=>onEnter(e,d)} onMouseMove={e=>onMove(e,d)} onMouseLeave={onLeave}>
              <rect x={cx-bW-gap/2} y={y(d.delivered)} width={bW} height={yH(d.delivered)} rx="2" fill="#c8d9e8"
                style={{transformOrigin:`${cx}px ${y(0)}px`,transform:inView?'scaleY(1)':'scaleY(0)',transition:`transform .6s cubic-bezier(.34,1.4,.64,1) ${delay}s`}}/>
              <rect x={cx+gap/2} y={y(d.consumed)} width={bW} height={yH(d.consumed)} rx="2"
                fill={isLate?'#e8a020':'#3dbb7a'} opacity={isLate?.75:.8}
                style={{transformOrigin:`${cx}px ${y(0)}px`,transform:inView?'scaleY(1)':'scaleY(0)',transition:`transform .6s cubic-bezier(.34,1.4,.64,1) ${delay+.05}s`}}/>
              {/* Hover hit area */}
              <rect x={cx-gW/2} y={pad.t} width={gW} height={cH} fill="transparent"/>
              <text x={cx} y={H-pad.b+14} fontSize="10" fill="#aab4be" textAnchor="middle">{d.month}</text>
            </g>
          );
        })}
        {inView&&showGapCallout&&(
          <g style={{animation:'fade-up .5s ease .85s both'}}>
            <line x1={data.length>=6?370:200} y1={pad.t+18} x2={W-pad.r} y2={pad.t+18} stroke="#e8a020" strokeWidth="1.5" strokeDasharray="4 3"/>
            <text x={data.length>=6?374:204} y={pad.t+13} fontSize="10" fill="#e8a020" fontWeight="600">Gap growing since Aug</text>
          </g>
        )}
        <rect x={pad.l} y={H-10} width={10} height={8} rx="2" fill="#c8d9e8"/>
        <text x={pad.l+13} y={H-3} fontSize="9" fill="#aab4be">Delivered</text>
        <rect x={pad.l+66} y={H-10} width={10} height={8} rx="2" fill="#3dbb7a" opacity=".8"/>
        <text x={pad.l+79} y={H-3} fontSize="9" fill="#aab4be">Consumed</text>
      </svg>
    </div>
  );
}

/* ─── Plan Slider ────────────────────────────────────────────────────────── */
function PlanSlider({value,onChange}){
  const MIN=8,MAX=20;
  const pct=((value-MIN)/(MAX-MIN))*100;
  const savings=(15-value)*8;
  const newCost=72-savings;
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20}}>
        <div>
          <p className="sans" style={{fontSize:11,color:'#aab4be',marginBottom:3}}>Selected plan</p>
          <p className="serif" style={{fontSize:32,fontWeight:700,color:'#1c2b3a',lineHeight:1}}>
            {value} <span style={{fontSize:14,fontWeight:400,color:'#7a8a99'}}>gal / 4 wks</span>
          </p>
          <p className="sans" style={{fontSize:12,color:'#aab4be',marginTop:3}}>≈ ${newCost}/month</p>
        </div>
        <div style={{textAlign:'right'}}>
          {savings>0&&(<>
            <p className="sans" style={{fontSize:11,color:'#3dbb7a',marginBottom:3}}>Monthly savings</p>
            <p className="serif" style={{fontSize:26,fontWeight:700,color:'#3dbb7a',lineHeight:1}}>${savings}/mo</p>
          </>)}
          {savings<0&&(<>
            <p className="sans" style={{fontSize:11,color:'#d05020',marginBottom:3}}>Extra cost</p>
            <p className="serif" style={{fontSize:26,fontWeight:700,color:'#d05020',lineHeight:1}}>+${-savings}/mo</p>
          </>)}
          {savings===0&&(<>
            <p className="sans" style={{fontSize:11,color:'#aab4be',marginBottom:3}}>Current plan</p>
            <p className="serif" style={{fontSize:26,fontWeight:700,color:'#1c2b3a',lineHeight:1}}>$72/mo</p>
          </>)}
        </div>
      </div>

      {/* Slider track + recommended marker */}
      <div style={{position:'relative',paddingTop:28,marginBottom:8}}>
        {/* Recommended label */}
        <div style={{
          position:'absolute',top:0,
          left:`${((12-MIN)/(MAX-MIN))*100}%`,
          transform:'translateX(-50%)',
          display:'flex',flexDirection:'column',alignItems:'center',
        }}>
          <span className="sans" style={{
            fontSize:9,fontWeight:700,
            background:value===12?'#e8a020':'rgba(232,160,32,0.25)',
            color:value===12?'#fff':'#e8a020',
            padding:'2px 7px',borderRadius:4,whiteSpace:'nowrap',
            transition:'background .25s,color .25s',
          }}>★ Recommended</span>
          <div style={{width:1,height:6,background:'rgba(232,160,32,0.5)',marginTop:1}}/>
        </div>

        <input
          type="range" className="plan-slider"
          min={MIN} max={MAX} step={1} value={value}
          onChange={e=>onChange(+e.target.value)}
          style={{'--sp':`${pct}%`}}
        />
      </div>

      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        <span className="sans" style={{fontSize:10,color:'#c8d4dc'}}>{MIN} gal</span>
        <span className="sans" style={{fontSize:10,color:'#c8d4dc'}}>Current: 15 gal</span>
        <span className="sans" style={{fontSize:10,color:'#c8d4dc'}}>{MAX} gal</span>
      </div>
    </div>
  );
}

/* ─── Confetti ───────────────────────────────────────────────────────────── */
function Confetti({active}){
  if(!active) return null;
  const colors=['#e8a020','#3dbb7a','#1c2b3a','#f7c56e','#a8dfc0','#f4d03f'];
  return(
    <div style={{position:'absolute',top:'45%',left:'50%',pointerEvents:'none',zIndex:20}}>
      {Array.from({length:32},(_,i)=>{
        const a=(i/32)*360,dist=55+Math.random()*70;
        const tx=Math.cos(a*Math.PI/180)*dist,ty=Math.sin(a*Math.PI/180)*dist-30;
        const rot=Math.random()*720-360,sz=5+Math.random()*7,delay=Math.random()*.18;
        return(<div key={i} style={{
          position:'absolute',width:i%3===0?sz:sz*.65,height:i%3===0?sz:sz*1.6,
          borderRadius:i%3===0?'50%':3,background:colors[i%colors.length],
          '--tx':`${tx}px`,'--ty':`${ty}px`,'--rot':`${rot}deg`,
          animation:`confetti-burst .95s cubic-bezier(.22,1,.36,1) ${delay}s both`,
        }}/>);
      })}
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function Toast({msg,visible,dismiss}){
  useEffect(()=>{ if(!visible) return; const t=setTimeout(dismiss,4200); return ()=>clearTimeout(t); },[visible,dismiss]);
  if(!visible) return null;
  return(
    <div role="status" style={{
      position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',zIndex:9999,
      background:'#1c2b3a',color:'#f7f4ef',padding:'13px 22px',borderRadius:14,
      fontSize:14,fontFamily:'Inter,sans-serif',fontWeight:500,
      boxShadow:'0 8px 32px rgba(28,43,58,.25)',whiteSpace:'nowrap',
      animation:'toast-in .35s ease forwards',
    }}>{msg}</div>
  );
}

/* ─── Overlay wrapper ────────────────────────────────────────────────────── */
function Overlay({onClick}){
  return(
    <div onClick={onClick} style={{
      position:'fixed',inset:0,background:'rgba(28,43,58,.5)',zIndex:200,
      animation:'overlay-fade .25s ease forwards',
    }}/>
  );
}

/* ─── Notification Drawer ────────────────────────────────────────────────── */
function NotifDrawer({open,onClose}){
  const [prefs,setPrefs]=useState({email:true,sms:false,push:true});
  const [freq,setFreq]=useState('smart');
  const [saved,setSaved]=useState(false);

  const handleSave=()=>{ setSaved(true); setTimeout(onClose,1300); };

  useEffect(()=>{ if(!open) setTimeout(()=>setSaved(false),400); },[open]);
  if(!open) return null;

  const freqOpts=[
    {val:'smart',  label:'Smart Alerts',    sub:'Only when we have something worth saying'},
    {val:'weekly', label:'Weekly Digest',    sub:'Summary every Monday morning'},
    {val:'monthly',label:'Monthly Summary',  sub:'Big picture, once a month'},
  ];

  return(
    <>
      <Overlay onClick={onClose}/>
      <div style={{
        position:'fixed',bottom:0,left:0,right:0,background:'#fff',
        borderRadius:'20px 20px 0 0',zIndex:201,maxHeight:'88vh',overflowY:'auto',
        animation:'drawer-up .38s cubic-bezier(.34,1.1,.64,1) forwards',
      }}>
        {/* Handle */}
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
          <div style={{width:40,height:4,borderRadius:2,background:'#e4ddd3'}}/>
        </div>
        <div style={{padding:'10px 24px 36px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h3 className="serif" style={{fontSize:22,fontWeight:700,color:'#1c2b3a'}}>Notification Preferences</h3>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#aab4be',lineHeight:1}}>✕</button>
          </div>

          <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.12em',color:'#e8a020',marginBottom:4}}>Channels</p>
          <Toggle on={prefs.email} onToggle={()=>setPrefs(p=>({...p,email:!p.email}))} label="Email" sub="Weekly insights + adjustment alerts"/>
          <Toggle on={prefs.sms}   onToggle={()=>setPrefs(p=>({...p,sms:!p.sms}))}     label="SMS"   sub="Delivery reminders only"/>
          <Toggle on={prefs.push}  onToggle={()=>setPrefs(p=>({...p,push:!p.push}))}   label="Push Notifications" sub="Smart suggestion alerts"/>

          <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.12em',color:'#e8a020',margin:'22px 0 10px'}}>Alert Frequency</p>
          {freqOpts.map(opt=>(
            <div key={opt.val} onClick={()=>setFreq(opt.val)} style={{
              display:'flex',gap:12,alignItems:'flex-start',
              padding:'12px 14px',borderRadius:13,marginBottom:8,cursor:'pointer',
              background:freq===opt.val?'#fdf3e0':'#f7f4ef',
              border:`1.5px solid ${freq===opt.val?'rgba(232,160,32,.45)':'transparent'}`,
              transition:'all .2s',
            }}>
              <div style={{
                width:18,height:18,borderRadius:'50%',flexShrink:0,marginTop:1,
                border:`2px solid ${freq===opt.val?'#e8a020':'#c8d4dc'}`,
                background:freq===opt.val?'#e8a020':'transparent',
                display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',
              }}>
                {freq===opt.val&&<div style={{width:7,height:7,borderRadius:'50%',background:'#fff'}}/>}
              </div>
              <div>
                <p className="sans" style={{fontSize:14,fontWeight:600,color:'#1c2b3a'}}>{opt.label}</p>
                <p className="sans" style={{fontSize:12,color:'#7a8a99',marginTop:1}}>{opt.sub}</p>
              </div>
            </div>
          ))}

          <button onClick={handleSave} className="sans" style={{
            width:'100%',background:saved?'#3dbb7a':'#e8a020',color:'#fff',
            border:'none',borderRadius:14,padding:'14px',fontSize:15,fontWeight:600,
            cursor:'pointer',marginTop:8,transition:'background .3s',
          }}>
            {saved?'✓ Preferences Saved':'Save Preferences'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Skip Delivery Modal ────────────────────────────────────────────────── */
function SkipModal({open,onClose}){
  const [done,setDone]=useState(false);
  useEffect(()=>{ if(!open) setTimeout(()=>setDone(false),400); },[open]);
  if(!open) return null;
  return(
    <>
      <Overlay onClick={onClose}/>
      <div style={{
        position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        background:'#fff',borderRadius:22,padding:'28px 28px 24px',
        width:'min(400px,90vw)',zIndex:201,boxShadow:'0 20px 60px rgba(28,43,58,.22)',
        animation:'modal-in .28s ease forwards',
      }}>
        {done?(
          <div style={{textAlign:'center',padding:'8px 0'}}>
            <div style={{fontSize:44,marginBottom:12}}>✅</div>
            <h3 className="serif" style={{fontSize:22,fontWeight:700,color:'#1c2b3a',marginBottom:8}}>Delivery Skipped</h3>
            <p className="sans" style={{fontSize:14,color:'#7a8a99',lineHeight:1.7}}>
              November 8 delivery cancelled.<br/>Next delivery: <strong>December 6</strong>.
            </p>
            <button onClick={onClose} className="sans" style={{marginTop:20,background:'#f7f4ef',border:'1.5px solid #e4ddd3',borderRadius:12,padding:'10px 24px',fontSize:14,cursor:'pointer',fontWeight:500}}>Done</button>
          </div>
        ):(
          <>
            <div style={{fontSize:36,marginBottom:12}}>📦</div>
            <h3 className="serif" style={{fontSize:22,fontWeight:700,color:'#1c2b3a',marginBottom:8}}>Skip November 8?</h3>
            <p className="sans" style={{fontSize:14,color:'#7a8a99',lineHeight:1.72,marginBottom:20}}>
              Your next delivery would be <strong>December 6</strong>. You won't be charged for the skipped delivery.
            </p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setDone(true)} className="sans" style={{flex:1,background:'#1c2b3a',color:'#fff',border:'none',borderRadius:12,padding:'12px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Confirm Skip</button>
              <button onClick={onClose} className="sans" style={{flex:1,background:'transparent',border:'1.5px solid #e4ddd3',borderRadius:12,padding:'12px',fontSize:14,cursor:'pointer',color:'#7a8a99'}}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── Phase Unlock Modal ─────────────────────────────────────────────────── */
function PhaseModal({open,onClose,onScrollToRec}){
  if(!open) return null;
  const perks=[
    'Auto-adjusts your order every 4 weeks',
    'You approve the rules once — never again',
    'Pauses automatically when you skip',
    'Sends a heads-up before every change',
  ];
  return(
    <>
      <Overlay onClick={onClose}/>
      <div style={{
        position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        background:'#fff',borderRadius:24,padding:'28px 28px 24px',
        width:'min(440px,90vw)',zIndex:201,boxShadow:'0 20px 60px rgba(28,43,58,.22)',
        animation:'modal-in .28s ease forwards',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
          <div>
            <span className="sans" style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.12em',color:'#c8d4dc'}}>Phase 3 · Locked</span>
            <h3 className="serif" style={{fontSize:24,fontWeight:700,color:'#1c2b3a',marginTop:4}}>Unlock Autopilot</h3>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#c8d4dc',lineHeight:1}}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{background:'#f7f4ef',borderRadius:14,padding:'16px 18px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <p className="sans" style={{fontSize:13,fontWeight:600,color:'#1c2b3a'}}>Suggestions accepted</p>
            <p className="sans" style={{fontSize:13,fontWeight:700,color:'#e8a020'}}>1 / 2</p>
          </div>
          <div style={{height:8,background:'#e4ddd3',borderRadius:4,overflow:'hidden'}}>
            <div style={{width:'50%',height:'100%',background:'#e8a020',borderRadius:4,transition:'width .8s ease'}}/>
          </div>
          <p className="sans" style={{fontSize:12,color:'#aab4be',marginTop:8}}>Accept 1 more suggestion to unlock.</p>
        </div>

        <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'#aab4be',marginBottom:10}}>What you get</p>
        {perks.map((p,i)=>(
          <div key={i} style={{display:'flex',gap:10,alignItems:'center',marginBottom:10}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#fdf3e0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#e8a020" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <p className="sans" style={{fontSize:13,color:'#4a5a6a'}}>{p}</p>
          </div>
        ))}

        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button onClick={()=>{onClose();onScrollToRec();}} className="sans" style={{flex:1,background:'#e8a020',color:'#fff',border:'none',borderRadius:14,padding:'13px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
            Accept Today's Suggestion
          </button>
          <button onClick={onClose} className="sans" style={{background:'transparent',border:'1.5px solid #e4ddd3',borderRadius:14,padding:'13px 16px',fontSize:14,cursor:'pointer',color:'#7a8a99'}}>
            Later
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */
function HeroSection({onScrollToRec}){
  return(
    <section style={{maxWidth:900,margin:'0 auto',padding:'48px 20px 24px',textAlign:'center'}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:32}}>
        <svg className="drop-float" width="110" height="78" viewBox="0 0 110 78" fill="none">
          <path d="M55 8C55 8 26 44 26 56C26 72 39 76 55 76C71 76 84 72 84 56C84 44 55 8 55 8Z" fill="rgba(232,160,32,.13)" stroke="#e8a020" strokeWidth="2"/>
          <polyline points="29,55 36,55 43,36 50,66 56,47 61,47 67,55 80,55" fill="none" stroke="#e8a020" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="320" style={{animation:'draw-ecg 2.4s ease-in-out infinite alternate'}}/>
        </svg>
      </div>
      <h1 className="serif" style={{fontSize:'clamp(28px,5.5vw,50px)',fontWeight:700,color:'#1c2b3a',lineHeight:1.15,marginBottom:14}}>
        Welcome back, Marcus.<br/><span style={{color:'#e8a020'}}>Your water, dialed in.</span>
      </h1>
      <p className="sans" style={{fontSize:16,color:'#7a8a99',marginBottom:36}}>We've been learning your rhythm. Here's what we know.</p>
      <div className="alert-pulse" role="button" tabIndex={0} onClick={onScrollToRec} onKeyDown={e=>e.key==='Enter'&&onScrollToRec()}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'14px 22px',borderRadius:16,cursor:'pointer',border:'1.5px solid rgba(232,160,32,.45)',maxWidth:540,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>⚡</span>
          <span className="sans" style={{fontSize:15,fontWeight:600,color:'#1c2b3a'}}>We have a recommendation for you</span>
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10l6 6 6-6" stroke="#e8a020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </section>
  );
}

/* ─── Usage Insights ─────────────────────────────────────────────────────── */
function UsageSection(){
  const [ref,inView]=useInView(.15);
  const [range,setRange]=useState('6M');
  const [chartKey,setChartKey]=useState(0);

  const switchRange=r=>{ setRange(r); setChartKey(k=>k+1); };

  const stats=[
    {label:'Avg. consumption',     value:11,suffix:' gal / 4 wks',note:'Last 90 days',       accent:false},
    {label:'Current plan delivers',value:15,suffix:' gal / 4 wks',note:'Active subscription', accent:false},
    {label:'Estimated surplus',    value:8, suffix:' gal / qtr',  note:'~2 extra gal/month',  accent:true},
  ];

  return(
    <section style={{maxWidth:900,margin:'0 auto',padding:'32px 20px'}}>
      <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.13em',color:'#e8a020',marginBottom:6}}>Your Rhythm</p>
      <h2 className="serif" style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:700,color:'#1c2b3a',marginBottom:24}}>What your last 3 months tell us</h2>

      <div ref={ref} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,marginBottom:22}}>
        {stats.map((s,i)=>(
          <div key={s.label} style={{
            background:'#fff',border:'1.5px solid #e4ddd3',borderRadius:18,padding:'20px 20px 16px',
            boxShadow:'0 2px 10px rgba(28,43,58,.04)',
            opacity:inView?1:0,transform:inView?'translateY(0)':'translateY(14px)',
            transition:`opacity .5s ease ${i*.12}s,transform .5s ease ${i*.12}s`,
          }}>
            <p className="sans" style={{fontSize:12,color:'#aab4be',fontWeight:500,marginBottom:6}}>{s.label}</p>
            <p className="serif" style={{fontSize:28,fontWeight:700,color:s.accent?'#e8a020':'#1c2b3a',lineHeight:1.1}}>
              <CountUp target={s.value} suffix={s.suffix} inView={inView} duration={950+i*160}/>
            </p>
            <p className="sans" style={{fontSize:11,color:'#c8d4dc',marginTop:4}}>{s.note}</p>
          </div>
        ))}
      </div>

      {/* Chart card with range tabs */}
      <div style={{background:'#fff',border:'1.5px solid #e4ddd3',borderRadius:18,padding:'20px 18px',marginBottom:14,boxShadow:'0 2px 10px rgba(28,43,58,.04)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <p className="sans" style={{fontSize:13,fontWeight:600,color:'#1c2b3a'}}>Delivered vs. Consumed</p>
          {/* Range tabs */}
          <div style={{display:'flex',gap:4,background:'#f7f4ef',borderRadius:10,padding:3}}>
            {['3M','6M','12M'].map(r=>(
              <button key={r} onClick={()=>switchRange(r)} className="sans" style={{
                padding:'5px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:range===r?'#fff':'transparent',
                color:range===r?'#1c2b3a':'#aab4be',
                boxShadow:range===r?'0 1px 4px rgba(28,43,58,.1)':'none',
                transition:'all .2s',
              }}>{r}</button>
            ))}
          </div>
        </div>
        <div key={chartKey} style={{animation:'tab-data-in .3s ease'}}>
          <BarChart inView={inView} data={RANGES[range]}/>
        </div>
      </div>

      <div style={{background:'#fdf3e0',border:'1.5px solid rgba(232,160,32,.3)',borderRadius:16,padding:'16px 20px',display:'flex',gap:12,alignItems:'flex-start'}}>
        <span style={{fontSize:22,flexShrink:0,lineHeight:1.3}}>🌡️</span>
        <p className="sans" style={{fontSize:14,color:'#5a4530',lineHeight:1.72}}>
          <strong>Seasonal context:</strong> Households like yours in the Midwest typically drop <strong>18% in winter</strong>. Your usage confirms this — and we're factoring it in.
        </p>
      </div>
    </section>
  );
}

/* ─── Recommendation Card ────────────────────────────────────────────────── */
const REC_FALLBACK={
  headline:'We think your order is a little too big.',
  body:"Based on your last 3 months, you're using about 11 gallons every 4 weeks. Your current plan delivers 15. You're likely accumulating a small surplus — about 8 extra gallons per quarter quietly piling up.",
};

function RecommendationCard({cardRef}){
  const [phase,setPhase]          =useState('idle');
  const [sliderVal,setSliderVal]  =useState(12);
  const [showConfetti,setConfetti]=useState(false);
  const [toast,setToast]          =useState({visible:false,msg:''});
  const dismissToast=useCallback(()=>setToast(t=>({...t,visible:false})),[]);

  // ── Live AI recommendation (Claude). Falls back to static copy on error. ──
  const [ai,setAi]          =useState(REC_FALLBACK);
  const [aiState,setAiState]=useState('loading'); // 'loading' | 'ai' | 'fallback'
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const text=await complete(
          [{role:'user',content:AI_USER}],
          {system:AI_SYSTEM,maxTokens:300,temperature:0.5},
        );
        const obj=parseJsonObject(text);
        if(cancelled) return;
        if(obj&&obj.headline&&obj.body){
          setAi({headline:String(obj.headline),body:String(obj.body)});
          setAiState('ai');
        }else{
          setAiState('fallback');
        }
      }catch{
        if(!cancelled) setAiState('fallback');
      }
    })();
    return ()=>{cancelled=true;};
  },[]);

  const handleAdjust=()=>{
    setPhase('flipping');setConfetti(true);
    setTimeout(()=>{ setPhase('adjusted'); setTimeout(()=>setConfetti(false),1100); },650);
  };
  const handleKeep  =()=>setPhase('dismissed');
  const handleRemind=()=>{ setPhase('reminded'); setToast({visible:true,msg:"We'll surface this again on Nov 14."}); };

  const isIdle     =phase==='idle'||phase==='reminded';
  const isFlipping =phase==='flipping';
  const isAdjusted =phase==='adjusted';
  const isDismissed=phase==='dismissed';
  const savings    =(15-sliderVal)*8;

  return(
    <>
      <section ref={cardRef} style={{maxWidth:900,margin:'0 auto',padding:'8px 20px'}}>
        <div className={`${isIdle||isFlipping?'rec-card-pulse':''} ${isFlipping?'rec-card-flip':''}`} style={{
          background:isAdjusted?'#e6f9f0':'#fff',
          border:`2px solid ${isAdjusted?'#3dbb7a':'#e8a020'}`,
          borderRadius:24,padding:'clamp(22px,4vw,36px)',
          position:'relative',overflow:'hidden',
          transition:'background .4s,border-color .4s,opacity .4s',
          opacity:isDismissed?.42:1,
        }}>
          <Confetti active={showConfetti}/>

          {isAdjusted?(
            <div style={{textAlign:'center',padding:'12px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
              <div style={{width:58,height:58,borderRadius:'50%',background:'#3dbb7a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,color:'#fff'}}>✓</div>
              <h3 className="serif" style={{fontSize:'clamp(20px,3vw,28px)',fontWeight:700,color:'#1c2b3a'}}>Done. Your next delivery is adjusted.</h3>
              <p className="sans" style={{fontSize:15,color:'#3a6a50',lineHeight:1.72,maxWidth:400}}>
                Changed to <strong style={{color:'#3dbb7a'}}>{sliderVal} gallons</strong> every 4 weeks.
                {savings>0&&<> Saving you <strong style={{color:'#3dbb7a'}}>${savings}/month</strong>.</>}
                {' '}We'll keep learning and re-suggest if anything shifts.
              </p>
            </div>
          ):isDismissed?(
            <div style={{textAlign:'center',padding:'12px 0'}}>
              <p className="serif" style={{fontSize:22,fontWeight:600,color:'#aab4be',marginBottom:8}}>Got it. No changes made.</p>
              <p className="sans" style={{fontSize:14,color:'#c8d4dc'}}>We'll check back in 6 weeks to see if your usage has shifted.</p>
            </div>
          ):(
            <>
              <span className="sans" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.14em',color:'#e8a020',background:'#fdf3e0',padding:'3px 11px',borderRadius:99,marginBottom:14}}>
                {aiState==='ai'?'✦ AI Recommendation':aiState==='loading'?'✦ Analyzing your usage…':'Smart Recommendation'}
              </span>
              <h2 className="serif" style={{fontSize:'clamp(22px,3.8vw,32px)',fontWeight:700,color:'#1c2b3a',lineHeight:1.22,marginBottom:14,opacity:aiState==='loading'?.55:1,transition:'opacity .35s'}}>
                {ai.headline}
              </h2>
              <p className="sans" style={{fontSize:15,color:'#4a5a6a',lineHeight:1.78,maxWidth:560,marginBottom:22,opacity:aiState==='loading'?.55:1,transition:'opacity .35s'}}>
                {ai.body}
              </p>

              {/* Interactive slider box */}
              <div style={{background:'#fdf3e0',border:'1.5px solid rgba(232,160,32,.38)',borderRadius:18,padding:'22px 22px 18px',marginBottom:22}}>
                <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.12em',color:'#e8a020',marginBottom:14}}>Adjust your plan</p>
                <PlanSlider value={sliderVal} onChange={setSliderVal}/>
                {savings>0&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:18,paddingTop:16,borderTop:'1px solid rgba(232,160,32,.22)'}}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#3dbb7a" strokeWidth="1.5"/>
                      <path d="M5 8.5l2 2 4-4" stroke="#3dbb7a" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="sans" style={{fontSize:13,color:'#3a6a50',fontWeight:500}}>
                      You'd save <strong>${savings}/month</strong>. We'll keep watching and re-suggest if usage changes.
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
                {[
                  {label:`Adjust to ${sliderVal} gal`,fn:handleAdjust,s:{background:'#e8a020',color:'#fff',border:'none',boxShadow:'0 4px 16px rgba(232,160,32,.35)'}},
                  {label:'Keep Current',              fn:handleKeep,  s:{background:'transparent',color:'#1c2b3a',border:'1.5px solid #e4ddd3'}},
                  {label:'Remind Me in a Month',      fn:handleRemind,s:{background:'transparent',color:'#7a8a99',border:'1.5px solid #e4ddd3'}},
                ].map(btn=>(
                  <button key={btn.label} onClick={btn.fn} className="sans" style={{...btn.s,borderRadius:12,padding:'11px 22px',fontSize:14,fontWeight:600,cursor:'pointer',transition:'transform .15s,opacity .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.opacity='.88';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.opacity='1';}}
                  >{btn.label}</button>
                ))}
              </div>
              {phase==='reminded'&&<p className="sans" style={{fontSize:13,color:'#7a8a99',marginTop:12}}>✓ Reminder set for Nov 14. No changes to your current plan.</p>}
            </>
          )}
        </div>
      </section>
      <Toast msg={toast.msg} visible={toast.visible} dismiss={dismissToast}/>
    </>
  );
}

/* ─── Trust Timeline ─────────────────────────────────────────────────────── */
function TrustTimeline({onPhaseClick}){
  const [ref,inView]=useInView(.18);
  const phases=[
    {n:1,label:'Observe',  status:'done',   desc:'We show you your usage. No suggestions yet.'},
    {n:2,label:'Suggest',  status:'current',desc:'We offer a recommendation. You decide.'},
    {n:3,label:'Autopilot',status:'locked', desc:'We auto-adjust monthly. You approve once.',tooltip:'Click to see unlock progress'},
  ];
  const iC=s=>s==='done'?'#3dbb7a':s==='current'?'#e8a020':'#c8d4dc';
  const lC=s=>s==='done'?'#3dbb7a':s==='current'?'#e8a020':'#c8d4dc';
  return(
    <section style={{maxWidth:900,margin:'0 auto',padding:'32px 20px'}}>
      <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.13em',color:'#e8a020',marginBottom:6}}>How This Works</p>
      <h2 className="serif" style={{fontSize:'clamp(22px,4vw,30px)',fontWeight:700,color:'#1c2b3a',marginBottom:10}}>We earn autopilot.</h2>
      <p className="sans" style={{fontSize:15,color:'#7a8a99',marginBottom:32}}>We don't assume it.</p>
      <div ref={ref} style={{position:'relative'}}>
        <div style={{position:'absolute',top:27,left:'17%',right:'17%',height:3,background:'#e4ddd3',borderRadius:99,zIndex:0}}>
          <div style={{height:'100%',background:'#e8a020',borderRadius:99,width:inView?'50%':'0%',transition:'width 1s ease .35s'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,position:'relative',zIndex:1}}>
          {phases.map((p,i)=>(
            <div key={p.n}
              onClick={p.status==='locked'?onPhaseClick:undefined}
              title={p.tooltip}
              style={{
                display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',padding:'0 12px',
                opacity:inView?1:0,transform:inView?'translateY(0)':'translateY(14px)',
                transition:`opacity .5s ease ${i*.18}s,transform .5s ease ${i*.18}s`,
                cursor:p.status==='locked'?'pointer':'default',
              }}>
              <div style={{
                width:54,height:54,borderRadius:'50%',background:iC(p.status),
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:20,color:'#fff',marginBottom:14,
                boxShadow:p.status==='current'?'0 0 0 8px rgba(232,160,32,.1)':p.status==='locked'?'none':'none',
                border:p.status==='current'?'3px solid rgba(232,160,32,.25)':'none',
                transition:'transform .2s',
              }}
              onMouseEnter={e=>p.status==='locked'&&(e.currentTarget.style.transform='scale(1.08)')}
              onMouseLeave={e=>p.status==='locked'&&(e.currentTarget.style.transform='')}>
                {p.status==='done'?'✓':p.status==='locked'?'🔒':p.n}
              </div>
              <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:lC(p.status),marginBottom:6}}>Phase {p.n} — {p.label}</p>
              <p className="sans" style={{fontSize:13,color:p.status==='locked'?'#c8d4dc':'#4a5a6a',lineHeight:1.65}}>{p.desc}</p>
              {p.status==='locked'&&<p className="sans" style={{fontSize:11,color:'#e8a020',fontStyle:'italic',marginTop:4,fontWeight:500}}>Tap to see progress →</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Cohort Comparison ──────────────────────────────────────────────────── */
function CohortSection(){
  const [ref,inView]=useInView(.15);
  const [expanded,setExpanded]=useState(null);

  const sCfg={
    matched:{label:'Well-matched',bg:'#e6f9f0',color:'#2a8a5a',border:'rgba(61,187,122,.4)'},
    surplus:{label:'Slight surplus',bg:'#fff8e6',color:'#a07010',border:'rgba(232,160,32,.4)'},
    you:    {label:'⚠ Surplus',    bg:'#fff0e6',color:'#c05020',border:'rgba(210,80,30,.4)'},
  };

  return(
    <section style={{background:'#fff9f0',borderRadius:22,padding:'clamp(22px,4vw,36px)',maxWidth:900,margin:'0 auto'}}>
      <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.13em',color:'#e8a020',marginBottom:6}}>Households Like Yours</p>
      <h2 className="serif" style={{fontSize:'clamp(20px,3.5vw,28px)',fontWeight:700,color:'#1c2b3a',marginBottom:6}}>Your cohort · Midwest · 2–3 person household</h2>
      <p className="sans" style={{fontSize:13,color:'#aab4be',marginBottom:22}}>Click any card to see trend details</p>

      <div ref={ref} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginBottom:22}}>
        {COHORT_PEERS.map((c,i)=>{
          const cfg=sCfg[c.status];
          const isYou=c.id===0;
          const isOpen=expanded===c.id;
          const sparkColor=c.status==='matched'?'#3dbb7a':c.status==='surplus'?'#e8a020':'#d05020';
          return(
            <div key={c.id}
              onClick={()=>setExpanded(isOpen?null:c.id)}
              style={{
                background:isYou?'#fff0e6':'#fff',
                border:`2px solid ${isOpen?(isYou?'rgba(210,80,30,.5)':'#e8a020'):(isYou?'rgba(210,80,30,.3)':'#e4ddd3')}`,
                borderRadius:18,padding:'18px 16px',cursor:'pointer',
                boxShadow:isOpen?'0 6px 24px rgba(28,43,58,.1)':isYou?'0 4px 20px rgba(210,80,30,.1)':'0 2px 8px rgba(28,43,58,.04)',
                opacity:inView?1:0,
                transform:inView?'scale(1) translateY(0)':'scale(.93) translateY(12px)',
                transition:`opacity .5s ease ${i*.1}s,transform .5s ease ${i*.1}s,border-color .2s,box-shadow .2s`,
              }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{width:42,height:42,borderRadius:'50%',background:isYou?'rgba(210,80,30,.1)':'#f0ede8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,marginBottom:10}}>
                  {c.icon}
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{marginTop:2,transition:'transform .25s',transform:isOpen?'rotate(180deg)':'rotate(0deg)'}}>
                  <path d="M2 4l5 6 5-6" stroke="#aab4be" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="sans" style={{fontSize:13,fontWeight:700,color:'#1c2b3a',marginBottom:2}}>{c.label}</p>
              <p className="sans" style={{fontSize:12,color:'#aab4be',marginBottom:10}}>{c.used} gal used · {c.plan} gal plan</p>
              <span className="sans" style={{
                fontSize:11,fontWeight:600,background:cfg.bg,color:cfg.color,
                border:`1px solid ${cfg.border}`,padding:'3px 10px',borderRadius:99,display:'inline-block',
                animation:inView?`shimmer-in .4s ease ${i*.1+.35}s both`:'none',
              }}>{cfg.label}</span>

              {/* Expandable detail */}
              <div className={`expand-panel ${isOpen?'open':'closed'}`}>
                <div style={{paddingTop:14,marginTop:12,borderTop:'1px solid #e4ddd3'}}>
                  <p className="sans" style={{fontSize:11,color:'#aab4be',marginBottom:6}}>3-month trend</p>
                  <Sparkline data={c.trend} color={sparkColor}/>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                    {['Aug','Sep','Oct'].map(m=><span key={m} className="sans" style={{fontSize:9,color:'#c8d4dc'}}>{m}</span>)}
                  </div>
                  <p className="sans" style={{fontSize:12,color:'#7a8a99',lineHeight:1.6,marginTop:8}}>{c.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="sans" style={{fontSize:14,color:'#5a4530',lineHeight:1.75,textAlign:'center'}}>
        <strong>4 out of 5 households in your cohort have right-sized their order.</strong>
        <br/>The ones who did churn <strong style={{color:'#e8a020'}}>3× less</strong>.
      </p>
    </section>
  );
}

/* ─── Switching Cost ─────────────────────────────────────────────────────── */
function SwitchingCostSection(){
  const [ref,inView]=useInView(.15);
  const items=[
    {icon:'📅',text:"You've been with ReadyRefresh 14 months."},
    {icon:'☀️',text:'We know your summer surge (June–August: +22%).'},
    {icon:'🎄',text:'We know your holiday dip (Dec: −15%).'},
    {icon:'👥',text:'We know you skip when guests are staying over.'},
  ];
  return(
    <section style={{maxWidth:900,margin:'0 auto',padding:'32px 20px'}}>
      <p className="sans" style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.13em',color:'#e8a020',marginBottom:6}}>What You'd Lose</p>
      <h2 className="serif" style={{fontSize:'clamp(20px,3.5vw,28px)',fontWeight:700,color:'#1c2b3a',marginBottom:28}}>14 months of learning your rhythm</h2>
      <div ref={ref}>
        {items.map((item,i)=>(
          <div key={i} style={{display:'flex',gap:16,alignItems:'flex-start',opacity:inView?1:0,transform:inView?'translateX(0)':'translateX(-16px)',transition:`opacity .45s ease ${i*.11}s,transform .45s ease ${i*.11}s`}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,width:38}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:'#fff',border:'2px solid #e4ddd3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{item.icon}</div>
              {i<items.length-1&&<div style={{width:2,flex:1,minHeight:28,background:'#e4ddd3',margin:'4px 0'}}/>}
            </div>
            <p className="sans" style={{fontSize:15,color:'#4a5a6a',lineHeight:1.72,paddingBottom:i<items.length-1?18:6,paddingTop:8}}>{item.text}</p>
          </div>
        ))}
      </div>
      <div style={{marginTop:22,background:'#1c2b3a',borderRadius:18,padding:'22px 26px'}}>
        <p className="serif" style={{fontSize:'clamp(16px,2.6vw,20px)',fontWeight:600,color:'#f7f4ef',lineHeight:1.65}}>
          Starting over with a competitor means guessing again — for months.
          <span style={{color:'#e8a020'}}> The personalization is the product.</span>
        </p>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function FooterSection({onManageNotif,onSkipDelivery}){
  return(
    <footer style={{maxWidth:900,margin:'0 auto',padding:'20px 20px 40px',borderTop:'1.5px solid #e4ddd3'}}>
      <div style={{background:'#fff',border:'1.5px solid #e4ddd3',borderRadius:18,padding:'20px 22px',marginBottom:22,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:16,alignItems:'end'}}>
        {[
          {label:'Current Plan', value:'15 gal / 4 wks',accent:false},
          {label:'Next Delivery',value:'Nov 8, 2024',   accent:false},
          {label:'Monthly Cost', value:'$72 / mo',      accent:true},
        ].map(item=>(
          <div key={item.label}>
            <p className="sans" style={{fontSize:11,color:'#aab4be',textTransform:'uppercase',letterSpacing:'.1em',fontWeight:600,marginBottom:4}}>{item.label}</p>
            <p className="serif" style={{fontSize:20,fontWeight:700,color:item.accent?'#e8a020':'#1c2b3a'}}>{item.value}</p>
          </div>
        ))}
        {/* Action buttons */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <button onClick={onManageNotif} className="sans" style={{background:'none',border:'1.5px solid #e4ddd3',borderRadius:10,padding:'8px 14px',fontSize:13,color:'#7a8a99',cursor:'pointer',fontWeight:500,transition:'border-color .15s,color .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#1c2b3a';e.currentTarget.style.color='#1c2b3a';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e4ddd3';e.currentTarget.style.color='#7a8a99';}}>
            🔔 Manage Notifications
          </button>
          <button onClick={onSkipDelivery} className="sans" style={{background:'none',border:'1.5px solid #e4ddd3',borderRadius:10,padding:'8px 14px',fontSize:13,color:'#7a8a99',cursor:'pointer',fontWeight:500,transition:'border-color .15s,color .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#1c2b3a';e.currentTarget.style.color='#1c2b3a';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e4ddd3';e.currentTarget.style.color='#7a8a99';}}>
            📦 Skip Next Delivery
          </button>
        </div>
      </div>
      <p className="serif" style={{fontSize:15,color:'#aab4be',textAlign:'center',lineHeight:1.8,maxWidth:460,margin:'0 auto 14px'}}>"Subscription products should learn your rhythm.<br/>Not require you to manage it."</p>
      <p className="sans" style={{fontSize:12,color:'#c8d4dc',textAlign:'center'}}>© 2024 ReadyRefresh · All rights reserved</p>
    </footer>
  );
}

/* ─── App ────────────────────────────────────────────────────────────────── */
export default function App(){
  const recRef=useRef(null);
  const scrollToRec=useCallback(()=>recRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),[]);

  const [notifOpen, setNotifOpen] =useState(false);
  const [skipOpen,  setSkipOpen]  =useState(false);
  const [phaseOpen, setPhaseOpen] =useState(false);

  return(
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{background:'#f7f4ef',minHeight:'100vh',fontFamily:'Inter,sans-serif',color:'#1c2b3a'}}>
        <nav style={{position:'sticky',top:0,zIndex:50,background:'rgba(247,244,239,.92)',backdropFilter:'blur(12px)',borderBottom:'1px solid #e4ddd3',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2C11 2 4 10 4 14.5C4 18.09 7.13 21 11 21C14.87 21 18 18.09 18 14.5C18 10 11 2 11 2Z" fill="#e8a020"/></svg>
            <span className="serif" style={{fontSize:18,fontWeight:700,color:'#1c2b3a'}}>ReadyRefresh</span>
          </div>
          <span className="sans" style={{fontSize:12,color:'#aab4be',fontWeight:500}}>Smart Subscription · Marcus</span>
        </nav>

        <main>
          <HeroSection onScrollToRec={scrollToRec}/>
          <UsageSection/>
          <RecommendationCard cardRef={recRef}/>
          <div style={{height:12}}/>
          <TrustTimeline onPhaseClick={()=>setPhaseOpen(true)}/>
          <div style={{padding:'0 20px',maxWidth:940,margin:'0 auto'}}>
            <CohortSection/>
          </div>
          <div style={{height:12}}/>
          <SwitchingCostSection/>
          <FooterSection
            onManageNotif={()=>setNotifOpen(true)}
            onSkipDelivery={()=>setSkipOpen(true)}
          />
        </main>
      </div>

      {/* Global overlays */}
      <NotifDrawer   open={notifOpen} onClose={()=>setNotifOpen(false)}/>
      <SkipModal     open={skipOpen}  onClose={()=>setSkipOpen(false)}/>
      <PhaseModal    open={phaseOpen} onClose={()=>setPhaseOpen(false)} onScrollToRec={()=>{setPhaseOpen(false);scrollToRec();}}/>
    </>
  );
}
