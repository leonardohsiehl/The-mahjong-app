
import React, { useMemo, useState } from "react";

const NAMES = ["Leo", "Amanda", "Mason", "Andrew", "Christina", "Albert", "Wen", "Benson", "Linus"];

const copy = {
  en: {
    title:"Settlement", mahjong:"Mahjong", hint:"Player 1 is you.", rounds:"Rounds", round:"Round", me:"Me",
    players:"Players", choose:"Choose 4 players with bubbles, then place them around the table.",
    bubbles:"Player bubbles", custom:"Custom name", add:"Add", selected:"Selected", table:"TABLE",
    mahjongTable:"Mahjong Table", tableHint:"Drag a player to a seat, or tap a name then tap a seat.",
    useSeats:"Use seating order", east:"East", south:"South", west:"West", north:"North", empty:"Empty",
    current:"Current Round", total:"Total", needs0:"needs 0", clear:"Clear", win:"WIN", lose:"LOSE",
    savedRounds:"Saved Rounds", noSaved:"No saved rounds yet.", delete:"Delete", result:"Calculated Result",
    previewHint:"Preview auto-saves the current balanced round.", saveFirst:"Save at least one round first.",
    notBalanced:"Saved rounds are not balanced.", noPayments:"No payments needed.", saveMatch:"Save Match",
    output:"Output", outputHint:"Tap copy, then paste in your group chat.", copyBtn:"Copy",
    outputEmpty:"Save rounds first, then preview/output.", outputBad:"Saved rounds are not balanced yet.",
    payHistory:"My Payment History", onlyMine:"Only showing {name}'s payments", currentMatch:"Current Match",
    noMine:"No payment for you.", noMatches:"No saved matches yet.", pay:"Pay", receive:"Receive",
    undo:"Undo", preview:"Preview Settlement", saved:"Saved", myPay:"My Pay",
    copied:"Copied result text", copyFail:"Copy failed. Long press the text to copy.",
    cleared:"Cleared current round", deleted:"Round deleted", autoSaved:"Current round auto-saved",
    currentBad:"Current round not balanced", undoClear:"Undo: restored current round",
    undoDelete:"Undo: restored deleted round", undoSave:"Undo: restored unsaved round", matchSaved:"Match saved",
    seatsApplied:"Seating order applied"
  },
  zh: {
    title:"結算", mahjong:"麻將", hint:"玩家 1 是你。", rounds:"局數", round:"本局", me:"我",
    players:"玩家", choose:"用名字泡泡選 4 位玩家，然後放到麻將桌座位。",
    bubbles:"玩家泡泡", custom:"自訂名字", add:"新增", selected:"已選", table:"麻將桌",
    mahjongTable:"麻將桌座位", tableHint:"可拖曳玩家到座位，或先點名字再點座位。",
    useSeats:"套用座位順序", east:"東", south:"南", west:"西", north:"北", empty:"空位",
    current:"目前這局", total:"合計", needs0:"需為 0", clear:"清除", win:"贏", lose:"輸",
    savedRounds:"已儲存局數", noSaved:"尚未儲存任何局。", delete:"刪除", result:"預覽結果",
    previewHint:"預覽會自動儲存目前已平衡的局。", saveFirst:"請先儲存至少一局。",
    notBalanced:"已儲存局數尚未平衡。", noPayments:"無需付款。", saveMatch:"儲存比賽",
    output:"輸出", outputHint:"點擊複製後，可貼到群組。", copyBtn:"複製",
    outputEmpty:"請先儲存局數，再預覽／輸出。", outputBad:"已儲存局數尚未平衡。",
    payHistory:"我的付款紀錄", onlyMine:"只顯示 {name} 相關付款", currentMatch:"目前比賽",
    noMine:"你沒有需要付款或收款。", noMatches:"尚無儲存比賽。", pay:"付給", receive:"收款自",
    undo:"復原", preview:"預覽結算", saved:"已存", myPay:"我的付款",
    copied:"已複製結算文字", copyFail:"複製失敗，請長按文字複製。",
    cleared:"已清除目前這局", deleted:"已刪除該局", autoSaved:"目前這局已自動儲存",
    currentBad:"目前這局尚未平衡", undoClear:"復原：已恢復目前這局",
    undoDelete:"復原：已恢復刪除的局", undoSave:"復原：已恢復未儲存的局", matchSaved:"比賽已儲存",
    seatsApplied:"已套用座位順序"
  }
};

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = v => Number(v || 0).toLocaleString(undefined, {maximumFractionDigits: 2});
const sign = (v, s) => Math.abs(Number(v || 0)) * (s === "lose" ? -1 : 1);
const newDraft = n => ({values:Array(n).fill(0), statuses:Array(n).fill("lose")});
const dt = (v,l) => new Date(v).toLocaleString(l==="zh"?"zh-TW":undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

function roundSum(r){ return r.values.reduce((a,b)=>a+Number(b||0),0); }
function hasAny(r){ return r.values.some(v=>Math.abs(Number(v||0))>0); }
function normalize(r, players){
  const ps = r.players || players;
  return {id:r.id||id(), players:[...ps], values:ps.map((_,i)=>Number(r.values?.[i]||0)), statuses:ps.map((_,i)=>r.statuses?.[i] || (Number(r.values?.[i]||0)>=0?"win":"lose"))};
}
function totals(players, rounds){
  const m = {};
  players.forEach(p => m[p] = m[p] || 0);
  rounds.forEach(r => (r.players||players).forEach((p,i)=> m[p] = (m[p]||0) + Number(r.values[i]||0)));
  return Object.entries(m).map(([player,total])=>({player,total}));
}
function settle(players, totalItems){
  const ds=[], cs=[];
  totalItems.forEach(x=>{ if(x.total<0) ds.push({player:x.player,amount:-x.total}); if(x.total>0) cs.push({player:x.player,amount:x.total}); });
  const out=[]; let d=0,c=0;
  while(d<ds.length && c<cs.length){
    const amount=Math.min(ds[d].amount,cs[c].amount);
    if(amount>0) out.push({from:ds[d].player,to:cs[c].player,amount});
    ds[d].amount-=amount; cs[c].amount-=amount;
    if(ds[d].amount<=0.000001) d++; if(cs[c].amount<=0.000001) c++;
  }
  return out;
}
function outputText(payments, started, lang){
  if(!payments.length) return lang==="zh" ? "麻將結算：\n無需付款。" : "Mahjong result:\nNo payments needed.";
  const lines = payments.map(p => lang==="zh" ? `${p.from} 付給 ${p.to}：${money(p.amount)}` : `${p.from} pays ${p.to}: ${money(p.amount)}`);
  return [lang==="zh" ? `麻將結算 - ${dt(started,lang)}` : `Mahjong result - ${dt(started,lang)}`, ...lines].join("\n");
}
(function tests(){
  const ps=["A","B","C","D"];
  const ts=totals(ps,[{players:ps,values:[-50,-50,100,0]}]);
  const st=settle(ps,ts);
  console.assert(st.length===2 && st[0].from==="A" && st[0].to==="C" && st[0].amount===50, "settle test");
  console.assert(outputText([{from:"B",to:"A",amount:50}],"2026-04-28T12:00:00+08:00","zh").includes("B 付給 A：50"), "zh output");
})();

export default function App(){
  const [lang,setLang]=useState("en");
  const t=copy[lang];
  const [players,setPlayers]=useState(["Leo","Amanda","Mason","Andrew"]);
  const [seatPlayers,setSeatPlayers]=useState(["Leo","Amanda","Mason","Andrew"]);
  const [selected,setSelected]=useState(null);
  const [custom,setCustom]=useState("");
  const [extra,setExtra]=useState([]);
  const [started,setStarted]=useState(new Date().toISOString());
  const [draft,setDraft]=useState(newDraft(4));
  const [rounds,setRounds]=useState([]);
  const [history,setHistory]=useState([]);
  const [tab,setTab]=useState("players");
  const [msg,setMsg]=useState("");
  const [show,setShow]=useState(false);
  const [undo,setUndo]=useState(null);

  const allNames=useMemo(()=>[...NAMES,...extra.filter(n=>!NAMES.includes(n))],[extra]);
  const current=useMemo(()=>normalize({...draft,players},players),[draft,players]);
  const saved=useMemo(()=>rounds.map(r=>normalize(r,r.players||players)),[rounds,players]);
  const currentTotal=roundSum(current);
  const totalItems=useMemo(()=>totals(players,saved),[players,saved]);
  const balance=totalItems.reduce((a,b)=>a+b.total,0);
  const payments=useMemo(()=>settle(players,totalItems),[players,totalItems]);
  const mine=payments.filter(p=>p.from===players[0]||p.to===players[0]);
  const canSave=rounds.length>0 && Math.abs(balance)<0.000001;
  const out=useMemo(()=>outputText(payments,started,lang),[payments,started,lang]);
  const seats=[t.east,t.south,t.west,t.north];

  const s={
    page:{minHeight:"100vh",background:"#111",fontFamily:"Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:"#171717"},
    phone:{height:"100vh",maxWidth:430,margin:"0 auto",background:"#f5f5f4",overflow:"hidden",boxShadow:"0 0 40px rgba(0,0,0,.35)",display:"flex",flexDirection:"column"},
    headerWrap:{background:"#f5f5f4",padding:"10px 12px 8px",flex:"0 0 auto"},
    header:{background:"#171717",color:"white",borderRadius:20,padding:12,boxShadow:"0 8px 24px rgba(0,0,0,.12)"},
    headerTop:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10},
    eyebrow:{margin:0,fontSize:10,letterSpacing:2.5,textTransform:"uppercase",color:"#a3a3a3"},
    title:{margin:"2px 0 0",fontSize:21,fontWeight:850,letterSpacing:-.7},
    hint:{margin:"3px 0 0",fontSize:11,color:"#d4d4d4"},
    langToggle:{display:"flex",alignItems:"center",gap:4,border:0,borderRadius:999,background:"rgba(255,255,255,.12)",height:42,padding:4,cursor:"pointer"},
    langOpt:{minWidth:32,height:34,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900},
    icon:{border:0,borderRadius:15,background:"rgba(255,255,255,.12)",color:"white",minWidth:42,minHeight:42,fontSize:18,cursor:"pointer"},
    stats:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:9},
    stat:{background:"rgba(255,255,255,.1)",borderRadius:13,padding:"7px 8px"},
    statLabel:{color:"#a3a3a3",fontSize:10,marginBottom:2},
    statValue:{fontSize:17,fontWeight:900,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
    main:{flex:"1 1 auto",overflow:"hidden",padding:"0 12px 8px",display:"flex",flexDirection:"column",gap:8},
    card:{background:"white",borderRadius:20,padding:11,boxShadow:"0 4px 16px rgba(0,0,0,.06)"},
    row:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8},
    btn:{border:0,borderRadius:15,background:"#171717",color:"white",minHeight:38,padding:"0 12px",fontSize:13,fontWeight:800,cursor:"pointer"},
    secondary:{border:"1px solid #d4d4d4",borderRadius:15,background:"white",color:"#171717",minHeight:38,padding:"0 12px",fontSize:13,fontWeight:800,cursor:"pointer"},
    danger:{border:0,borderRadius:14,background:"#fee2e2",color:"#b91c1c",minHeight:34,padding:"0 10px",fontSize:12,fontWeight:800,cursor:"pointer"},
    input:{width:"100%",height:40,border:"1px solid #e5e5e5",borderRadius:15,background:"#fafafa",padding:"0 12px",fontSize:15,outline:"none",boxSizing:"border-box"},
    grid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8},
    block:{borderRadius:17,padding:8,minHeight:104,display:"flex",flexDirection:"column",justifyContent:"center",cursor:"pointer",border:"2px solid transparent",boxSizing:"border-box"},
    amount:{width:"100%",height:42,border:"1px solid rgba(255,255,255,.7)",borderRadius:14,background:"rgba(255,255,255,.94)",padding:"0 8px",fontSize:21,fontWeight:900,textAlign:"center",outline:"none",boxSizing:"border-box"},
    pill:{display:"inline-flex",justifyContent:"center",alignItems:"center",minWidth:48,height:20,borderRadius:999,fontSize:10,fontWeight:900,color:"white",marginTop:3},
    scroll:{flex:"1 1 auto",overflow:"auto",display:"grid",gap:8,alignContent:"start"},
    payGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},
    payBox:{background:"#171717",color:"white",borderRadius:14,padding:9,boxSizing:"border-box"},
    output:{background:"#171717",color:"white",borderRadius:16,padding:12,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap",userSelect:"text"},
    saved:{background:"#fafafa",borderRadius:14,padding:9,border:"1px solid #eee"},
    footer:{flex:"0 0 auto",background:"rgba(245,245,244,.96)",padding:"8px 12px 12px",boxSizing:"border-box"},
    footerActions:{display:"grid",gridTemplateColumns:"0.8fr 1.2fr",gap:8,marginBottom:8},
    nav:{display:"flex",gap:7,background:"white",borderRadius:22,padding:7,boxShadow:"0 4px 16px rgba(0,0,0,.06)"},
    navBtn:{flex:1,border:0,borderRadius:16,padding:"7px 2px",fontSize:10.5,fontWeight:800,cursor:"pointer"},
    tableWrap:{marginTop:12,background:"#fafafa",borderRadius:18,padding:10,border:"1px solid #eee"},
    tableGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gridTemplateRows:"70px 70px 70px",gap:8,alignItems:"center",justifyItems:"center",marginTop:10},
    tableCenter:{gridColumn:"2",gridRow:"2",width:86,height:58,borderRadius:18,background:"#171717",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,textAlign:"center"},
    seat:{width:"100%",minHeight:62,borderRadius:16,border:"2px dashed #d4d4d4",background:"white",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:6,boxSizing:"border-box",cursor:"pointer"},
    pool:{display:"flex",gap:7,flexWrap:"wrap",marginTop:8},
    chip:{border:"1px solid #d4d4d4",borderRadius:999,background:"white",color:"#171717",padding:"8px 10px",fontSize:12,fontWeight:800,cursor:"grab"}
  };

  function addCustom(){
    const name=custom.trim();
    if(!name) return;
    if(!allNames.includes(name)) setExtra(e=>[...e,name]);
    setSelected(name);
    setCustom("");
  }
  function assign(name, idx){
    if(!name) return;
    setSeatPlayers(cur=>{
      const next=[...cur];
      const old=next.indexOf(name);
      if(old>=0) next[old]=next[idx];
      next[idx]=name;
      return next;
    });
    setSelected(null);
  }
  function applySeats(){
    const next=seatPlayers.filter(Boolean).slice(0,4);
    if(next.length!==4) return;
    setPlayers(next);
    setDraft(newDraft(4));
    setMsg(t.seatsApplied);
    setTab("round");
  }
  function setStatus(i){
    setDraft(d=>{
      const statuses=[...d.statuses], values=[...d.values];
      statuses[i]=statuses[i]==="win"?"lose":"win";
      values[i]=sign(values[i],statuses[i]);
      return {values,statuses};
    });
    setShow(false); setMsg("");
  }
  function setAmount(i, val){
    const clean=val.replace(/[^0-9.]/g,"");
    setDraft(d=>{
      const values=[...d.values];
      values[i]=clean===""?"":sign(clean,d.statuses[i]);
      return {...d,values};
    });
    setShow(false); setMsg("");
  }
  function clear(){
    if(hasAny(current)) setUndo({type:"clear",draft});
    setDraft(newDraft(players.length)); setMsg(t.cleared); setShow(false);
  }
  function delRound(rid){
    const r=rounds.find(x=>x.id===rid);
    if(r) setUndo({type:"delete",round:r});
    setRounds(rs=>rs.filter(x=>x.id!==rid));
    setMsg(t.deleted); setShow(false);
  }
  function preview(){
    const r=normalize({...draft,players},players);
    if(hasAny(r)){
      const total=roundSum(r);
      if(Math.abs(total)>=0.000001){ setMsg(`${t.currentBad}: ${money(total)}`); setTab("round"); setShow(false); return; }
      const saved={...r,id:id()};
      setUndo({type:"save",draft,savedId:saved.id});
      setRounds(rs=>[...rs,saved]);
      setDraft(newDraft(players.length));
      setMsg(t.autoSaved);
    } else setMsg("");
    setShow(true); setTab("round");
  }
  function undoLast(){
    if(!undo) return;
    if(undo.type==="clear"){ setDraft(undo.draft); setMsg(t.undoClear); }
    if(undo.type==="delete"){ setRounds(rs=>[...rs,undo.round]); setMsg(t.undoDelete); }
    if(undo.type==="save"){ setRounds(rs=>rs.filter(r=>r.id!==undo.savedId)); setDraft(undo.draft); setShow(false); setMsg(t.undoSave); }
    setUndo(null);
  }
  async function doCopy(){
    try{ await navigator.clipboard.writeText(out); setMsg(t.copied); } catch{ setMsg(t.copyFail); }
  }
  function saveMatch(){
    if(!rounds.length){ setMsg(t.saveFirst); return; }
    const match={id:id(),startedAt:started,endedAt:new Date().toISOString(),players:[...players],userName:players[0],rounds:saved.map(r=>({...r})),totals:totalItems.map(x=>({...x})),settlements:payments.map(p=>({...p}))};
    setHistory(h=>[match,...h]);
    setRounds([]); setDraft(newDraft(players.length)); setStarted(new Date().toISOString()); setTab("pay"); setMsg(t.matchSaved); setShow(false); setUndo(null);
  }
  function reset(){
    setDraft(newDraft(players.length)); setRounds([]); setStarted(new Date().toISOString()); setTab("players"); setMsg(""); setShow(false); setUndo(null);
  }

  const Nav=({id,icon,label})=>{
    const active=tab===id;
    return <button onClick={()=>setTab(id)} style={{...s.navBtn,background:active?"#171717":"transparent",color:active?"white":"#737373"}}><div style={{fontSize:15,lineHeight:1}}>{icon}</div><div style={{marginTop:2}}>{label}</div></button>
  };
  const Chip=({name})=>{
    const isSel=selected===name, seated=seatPlayers.includes(name);
    return <button draggable onDragStart={e=>e.dataTransfer.setData("text/plain",name)} onClick={()=>setSelected(isSel?null:name)} style={{...s.chip,background:isSel?"#171717":seated?"#e5e7eb":"white",color:isSel?"white":"#171717"}}>{name}</button>
  };
  const RoundPlayers=({round,small=false})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:small?4:5,marginTop:small?5:7,fontSize:small?11:12}}>
    {(round.players||players).slice(0,4).map((p,i)=><div key={`${p}-${i}`} style={{color:round.values[i]>=0?"#15803d":"#dc2626",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p}: {round.values[i]>=0?"+":""}{money(round.values[i])}</div>)}
  </div>;
  const Payment=({p,personal=false})=>{
    if(!personal) return <div style={s.payBox}><div style={{fontSize:12,opacity:.7}}>{lang==="zh"?"支付":"PAY"}</div><div style={{fontSize:14,fontWeight:900,margin:"4px 0",color:"#fca5a5"}}>{p.from} → {p.to}</div><div style={{fontSize:18,fontWeight:950}}>{money(p.amount)}</div></div>;
    const recv=p.to===players[0];
    return <div style={s.payBox}><div style={{fontSize:12,opacity:.7}}>{recv?(lang==="zh"?"收款":"RECEIVE"):(lang==="zh"?"支付":"PAY")}</div><div style={{fontSize:14,fontWeight:900,margin:"4px 0",color:recv?"#86efac":"#fca5a5"}}>{recv?"←":"→"} {recv?p.from:p.to}</div><div style={{fontSize:18,fontWeight:950}}>{money(p.amount)}</div></div>;
  };
  const Table=()=>{
    const pos=[{gridColumn:"2",gridRow:"1"},{gridColumn:"3",gridRow:"2"},{gridColumn:"2",gridRow:"3"},{gridColumn:"1",gridRow:"2"}];
    return <div style={s.tableWrap}><div style={s.row}><div><strong style={{fontSize:14}}>{t.mahjongTable}</strong><p style={{margin:"3px 0 0",color:"#737373",fontSize:12}}>{t.tableHint}</p></div><button onClick={applySeats} style={{...s.btn,minHeight:34}}>{t.useSeats}</button></div>
      <div style={s.tableGrid}>{[0,1,2,3].map(i=><div key={i} onClick={()=>selected?assign(selected,i):setSelected(seatPlayers[i])} onDragOver={e=>e.preventDefault()} onDrop={e=>assign(e.dataTransfer.getData("text/plain"),i)} style={{...s.seat,...pos[i],borderColor:selected?"#171717":"#d4d4d4"}}><div style={{fontSize:11,color:"#737373",marginBottom:3}}>{seats[i]}</div><strong style={{fontSize:13,textAlign:"center"}}>{seatPlayers[i]||t.empty}</strong></div>)}<div style={s.tableCenter}>{t.table}</div></div>
    </div>
  };
  const PlayerSetup=()=> <section style={{...s.card,flex:"1 1 auto",overflow:"auto"}}>
    <div style={{...s.row,marginBottom:10}}><h2 style={{margin:0,fontSize:18}}>{t.players}</h2></div>
    <p style={{margin:"0 0 8px",fontSize:12,color:"#737373"}}>{t.choose}</p>
    <div style={{marginTop:8}}><strong style={{fontSize:13}}>{t.bubbles}</strong><div style={s.pool}>{allNames.map(n=><Chip key={n} name={n}/>)}</div>{selected&&<div style={{marginTop:8,fontSize:12,color:"#737373"}}>{t.selected}: <strong>{selected}</strong></div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:6,marginTop:8}}><input value={custom} onChange={e=>setCustom(e.target.value)} placeholder={t.custom} style={s.input}/><button onClick={addCustom} style={s.btn}>{t.add}</button></div>
    </div>
    <Table/>
  </section>;

  return <div style={s.page}><div style={s.phone}>
    <div style={s.headerWrap}><div style={s.header}>
      <div style={s.headerTop}><div><p style={s.eyebrow}>{t.mahjong}</p><h1 style={s.title}>{t.title}</h1><p style={s.hint}>{dt(started,lang)} · {t.hint}</p></div>
        <div style={{display:"flex",gap:6}}><button onClick={()=>setLang(lang==="en"?"zh":"en")} style={s.langToggle}><span style={{...s.langOpt,background:lang==="en"?"white":"transparent",color:lang==="en"?"#171717":"#d4d4d4"}}>EN</span><span style={{...s.langOpt,background:lang==="zh"?"white":"transparent",color:lang==="zh"?"#171717":"#d4d4d4"}}>CN</span></button><button onClick={reset} style={s.icon}>↻</button></div>
      </div>
      <div style={s.stats}><div style={s.stat}><div style={s.statLabel}>{t.rounds}</div><div style={s.statValue}>{rounds.length}</div></div><div style={s.stat}><div style={s.statLabel}>{t.round}</div><div style={{...s.statValue,color:Math.abs(currentTotal)<0.000001?"#86efac":"#fca5a5"}}>{money(currentTotal)}</div></div><div style={s.stat}><div style={s.statLabel}>{t.me}</div><div style={s.statValue}>{players[0]}</div></div></div>
    </div></div>
    <main style={s.main}>
      {tab==="players" && <PlayerSetup/>}
      {tab==="round" && <section style={{...s.card,flex:"1 1 auto",overflow:"auto"}}>
        <div style={s.row}><div><h2 style={{margin:0,fontSize:18}}>{t.current}</h2><p style={{margin:"3px 0 0",fontSize:13,color:Math.abs(currentTotal)<0.000001?"#15803d":"#dc2626"}}>{t.total} {money(currentTotal)} {Math.abs(currentTotal)<0.000001?"✓":t.needs0}</p></div><button onClick={clear} style={s.secondary}>{t.clear}</button></div>
        <div style={s.grid}>{players.slice(0,4).map((p,i)=>{const isWin=current.statuses[i]==="win", amount=Math.abs(Number(current.values[i]||0)); return <div key={`${p}-${i}`} onClick={()=>setStatus(i)} style={{...s.block,background:isWin?"#dcfce7":"#fee2e2",borderColor:isWin?"#86efac":"#fca5a5"}}><div style={{marginBottom:7,textAlign:"center"}}><strong style={{display:"block",fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p}</strong><span style={{...s.pill,background:isWin?"#16a34a":"#dc2626"}}>{isWin?t.win:t.lose}</span></div><input type="text" inputMode="decimal" value={amount||""} onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onChange={e=>setAmount(i,e.target.value)} placeholder="0" style={s.amount}/></div>})}</div>
        {msg && <div style={{marginTop:8,borderRadius:15,padding:9,fontSize:13,background:/not|Enter|least|failed|尚未|請先/i.test(msg)?"#fef2f2":"#ecfdf5",color:/not|Enter|least|failed|尚未|請先/i.test(msg)?"#b91c1c":"#15803d"}}>{msg}</div>}
        <div style={{marginTop:10}}><div style={s.row}><strong style={{fontSize:15}}>{t.savedRounds}</strong><span style={{fontSize:12,color:"#737373"}}>{rounds.length} {t.rounds}</span></div><div style={{display:"grid",gap:6,marginTop:7,maxHeight:130,overflow:"auto"}}>{saved.length===0?<div style={{background:"#fafafa",borderRadius:14,padding:9,color:"#737373",fontSize:12}}>{t.noSaved}</div>:saved.map((r,i)=><div key={r.id} style={s.saved}><div style={s.row}><strong style={{fontSize:13}}>{t.round} {i+1}</strong><button onClick={()=>delRound(r.id)} style={{...s.danger,minHeight:28,fontSize:11}}>{t.delete}</button></div><RoundPlayers round={r} small/></div>)}</div></div>
        {show && <div style={{marginTop:10}}><div style={s.row}><strong style={{fontSize:15}}>{t.result}</strong><button onClick={saveMatch} disabled={!canSave} style={{...s.btn,minHeight:34,opacity:canSave?1:.4}}>{t.saveMatch}</button></div><p style={{margin:"3px 0 0",fontSize:12,color:"#737373"}}>{t.previewHint}</p>{rounds.length===0?<div style={{marginTop:8,background:"#fafafa",color:"#737373",borderRadius:15,padding:9,fontSize:13}}>{t.saveFirst}</div>:Math.abs(balance)>=0.000001?<div style={{marginTop:8,background:"#fef2f2",color:"#b91c1c",borderRadius:15,padding:9,fontSize:13}}>{t.notBalanced}</div>:payments.length===0?<div style={{marginTop:8,background:"#fafafa",color:"#737373",borderRadius:15,padding:9,fontSize:13}}>{t.noPayments}</div>:<div style={{...s.payGrid,marginTop:8}}>{payments.map((p,i)=><Payment key={i} p={p}/>)}</div>}</div>}
      </section>}
      {tab==="saved" && <section style={{...s.card,flex:"1 1 auto",overflow:"hidden",display:"flex",flexDirection:"column"}}><div style={{...s.row,marginBottom:8}}><h2 style={{margin:0,fontSize:18}}>{t.savedRounds}</h2><span style={{fontSize:13,color:"#737373"}}>{rounds.length} {t.rounds}</span></div><div style={s.scroll}>{saved.length===0?<div style={{background:"#fafafa",borderRadius:16,padding:12,color:"#737373",fontSize:13}}>{t.noSaved}</div>:saved.map((r,i)=><div key={r.id} style={{background:"#fafafa",borderRadius:16,padding:10}}><div style={s.row}><strong>{t.round} {i+1}</strong><button onClick={()=>delRound(r.id)} style={s.danger}>{t.delete}</button></div><RoundPlayers round={r}/></div>)}</div></section>}
      {tab==="output" && <section style={{...s.card,flex:"1 1 auto",overflow:"auto"}}><div style={{...s.row,marginBottom:10}}><div><h2 style={{margin:0,fontSize:18}}>{t.output}</h2><p style={{margin:"3px 0 0",fontSize:12,color:"#737373"}}>{t.outputHint}</p></div><button onClick={doCopy} style={s.btn}>{t.copyBtn}</button></div>{rounds.length===0?<div style={{background:"#fafafa",color:"#737373",borderRadius:16,padding:12,fontSize:13}}>{t.outputEmpty}</div>:Math.abs(balance)>=0.000001?<div style={{background:"#fef2f2",color:"#b91c1c",borderRadius:16,padding:12,fontSize:13}}>{t.outputBad}</div>:<div onClick={doCopy} style={s.output}>{out}</div>}</section>}
      {tab==="pay" && <section style={{...s.card,flex:"1 1 auto",overflow:"hidden",display:"flex",flexDirection:"column"}}><div style={{...s.row,marginBottom:10}}><div><h2 style={{margin:0,fontSize:18}}>{t.payHistory}</h2><p style={{margin:"3px 0 0",fontSize:12,color:"#737373"}}>{t.onlyMine.replace("{name}",players[0])}</p></div><button onClick={saveMatch} style={s.btn}>{t.saveMatch}</button></div><div style={s.scroll}>{rounds.length>0&&<div style={{background:"#fafafa",borderRadius:16,padding:10}}><strong style={{fontSize:14}}>{t.currentMatch}</strong><div style={{marginTop:8}}>{Math.abs(balance)>=0.000001?<div style={{color:"#b91c1c",fontSize:13}}>{t.notBalanced}</div>:mine.length===0?<div style={{color:"#737373",fontSize:13}}>{t.noMine}</div>:<div style={s.payGrid}>{mine.map((p,i)=><Payment key={i} p={p} personal/>)}</div>}</div></div>}{history.length===0?<div style={{background:"#fafafa",borderRadius:16,padding:12,color:"#737373",fontSize:13}}>{t.noMatches}</div>:history.map(m=><div key={m.id} style={{background:"#171717",color:"white",borderRadius:18,padding:12}}><div style={s.row}><strong>{dt(m.startedAt,lang)}</strong><span style={{fontSize:12,color:"#a3a3a3"}}>{m.rounds.length} {t.rounds}</span></div>{m.settlements.filter(p=>p.from===m.userName||p.to===m.userName).length===0?<div style={{marginTop:8,color:"#a3a3a3",fontSize:13}}>{t.noMine}</div>:m.settlements.filter(p=>p.from===m.userName||p.to===m.userName).map((p,i)=>{const recv=p.to===m.userName; return <div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,fontSize:13,color:recv?"#86efac":"#fca5a5"}}><span>{recv?t.receive:t.pay} {recv?p.from:p.to}</span><strong>{money(p.amount)}</strong></div>})}</div>)}</div></section>}
    </main>
    <footer style={s.footer}><div style={s.footerActions}><button onClick={undoLast} disabled={!undo} style={{...s.secondary,opacity:undo?1:.4}}>{t.undo}</button><button onClick={preview} style={s.btn}>{t.preview}</button></div><nav style={s.nav}><Nav id="players" icon="👥" label={t.players}/><Nav id="round" icon="🀄" label={t.round}/><Nav id="saved" icon="🧾" label={t.saved}/><Nav id="output" icon="📋" label={t.output}/><Nav id="pay" icon="💰" label={t.myPay}/></nav></footer>
  </div></div>;
}
