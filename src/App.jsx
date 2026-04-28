import React, { useMemo, useState } from "react";

const text = {
  en: {
    title: "Settlement", eyebrow: "Mahjong", hint: "Player 1 is you.", rounds: "Rounds", round: "Round", me: "Me",
    players: "Players", add: "＋ Add", playerHint: "Player 1 is always you. Changing players now only affects new rounds.",
    you: "You", delete: "Delete", common: "Common players", commonEmpty: "Names will appear here after they show up in 2 saved matches.",
    currentRound: "Current Round", total: "Total", needsZero: "needs 0", clear: "Clear", win: "WIN", lose: "LOSE",
    savedRounds: "Saved Rounds", noSaved: "No saved rounds yet.", result: "Calculated Result", saveMatch: "Save Match",
    previewHint: "Preview auto-saves the current balanced round.", saveFirst: "Save at least one round first.",
    notBalanced: "Saved rounds are not balanced.", noPayments: "No payments needed.", output: "Output",
    outputHint: "Tap copy, then paste in your group chat.", copy: "Copy", outputEmpty: "Save rounds first, then preview/output.",
    outputNotBalanced: "Saved rounds are not balanced yet.", myHistory: "My Payment History",
    myHint: "Only showing {name}'s payments", currentMatch: "Current Match", noMine: "No payment for you.",
    noMatches: "No saved matches yet.", pay: "Pay", receive: "Receive", undo: "Undo", preview: "Preview Settlement",
    saved: "Saved", myPay: "My Pay", copied: "Copied result text", copyFail: "Copy failed. Long press the text to copy.",
    roundNotBalanced: "Round not balanced", enter: "Enter amounts before saving", savedRound: "Saved round",
    deleted: "Round deleted", cleared: "Cleared current round", currentNotBalanced: "Current round not balanced",
    autoSaved: "Current round auto-saved", undoClear: "Undo: restored current round",
    undoDelete: "Undo: restored deleted round", undoSave: "Undo: restored unsaved round", matchSaved: "Match saved"
  },
  zh: {
    title: "結算", eyebrow: "麻將", hint: "玩家 1 是你。", rounds: "局數", round: "本局", me: "我",
    players: "玩家", add: "＋ 新增", playerHint: "玩家 1 固定是你。現在更改玩家只會影響新的局。",
    you: "你", delete: "刪除", common: "常用玩家", commonEmpty: "玩家在 2 場已儲存比賽出現後，會顯示在這裡。",
    currentRound: "目前這局", total: "合計", needsZero: "需為 0", clear: "清除", win: "贏", lose: "輸",
    savedRounds: "已儲存局數", noSaved: "尚未儲存任何局。", result: "預覽結果", saveMatch: "儲存比賽",
    previewHint: "預覽會自動儲存目前已平衡的局。", saveFirst: "請先儲存至少一局。",
    notBalanced: "已儲存局數尚未平衡。", noPayments: "無需付款。", output: "輸出",
    outputHint: "點擊複製後，可貼到群組。", copy: "複製", outputEmpty: "請先儲存局數，再預覽／輸出。",
    outputNotBalanced: "已儲存局數尚未平衡。", myHistory: "我的付款紀錄",
    myHint: "只顯示 {name} 相關付款", currentMatch: "目前比賽", noMine: "你沒有需要付款或收款。",
    noMatches: "尚無儲存比賽。", pay: "付給", receive: "收款自", undo: "復原", preview: "預覽結算",
    saved: "已存", myPay: "我的付款", copied: "已複製結算文字", copyFail: "複製失敗，請長按文字複製。",
    roundNotBalanced: "本局尚未平衡", enter: "請先輸入金額", savedRound: "已儲存第",
    deleted: "已刪除該局", cleared: "已清除目前這局", currentNotBalanced: "目前這局尚未平衡",
    autoSaved: "目前這局已自動儲存", undoClear: "復原：已恢復目前這局",
    undoDelete: "復原：已恢復刪除的局", undoSave: "復原：已恢復未儲存的局", matchSaved: "比賽已儲存"
  }
};

function id(){ return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function money(v){ return Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function dt(v, lang="en"){
  return new Date(v).toLocaleString(lang === "zh" ? "zh-TW" : undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}
function signed(amount, status){
  const n = Math.abs(Number(amount || 0));
  if (!n) return 0;
  return status === "lose" ? -n : n;
}
function newDraft(count){ return { values: Array(count).fill(0), statuses: Array(count).fill("lose") }; }
function normalize(round, fallbackPlayers){
  const players = round.players || fallbackPlayers;
  return {
    id: round.id || id(),
    players: [...players],
    values: players.map((_, i) => Number(round.values?.[i] || 0)),
    statuses: players.map((_, i) => round.statuses?.[i] || (Number(round.values?.[i] || 0) >= 0 ? "win" : "lose"))
  };
}
function sumRound(round){ return round.values.reduce((a,b)=>a+Number(b||0),0); }
function hasAmount(round){ return round.values.some(v => Math.abs(Number(v || 0)) > 0); }
function totals(basePlayers, rounds){
  const map = {};
  basePlayers.forEach(p => { map[p] = map[p] || 0; });
  rounds.forEach(r => {
    const ps = r.players || basePlayers;
    r.values.forEach((v,i) => {
      const name = ps[i] || `Player ${i+1}`;
      map[name] = (map[name] || 0) + Number(v || 0);
    });
  });
  return Object.entries(map).map(([player,total]) => ({ player, total }));
}
function settlements(players, totalItems){
  const normalized = totalItems.map((item,i) => typeof item === "number" ? { player: players[i], total: item } : item);
  const debtors = [], creditors = [];
  normalized.forEach(x => {
    if (x.total < 0) debtors.push({ player: x.player, amount: Math.abs(x.total) });
    if (x.total > 0) creditors.push({ player: x.player, amount: x.total });
  });
  const payments = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length){
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) payments.push({ from: debtors[d].player, to: creditors[c].player, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount <= 0.000001) d++;
    if (creditors[c].amount <= 0.000001) c++;
  }
  return payments;
}
function myPayments(payments, me){ return payments.filter(p => p.from === me || p.to === me); }
function outputText(payments, startedAt, lang){
  if (!payments.length) return lang === "zh" ? "麻將結算：\n無需付款。" : "Mahjong result:\nNo payments needed.";
  const lines = payments.map(p => lang === "zh" ? `${p.from} 付給 ${p.to}：${money(p.amount)}` : `${p.from} pays ${p.to}: ${money(p.amount)}`);
  return [lang === "zh" ? `麻將結算 - ${dt(startedAt, lang)}` : `Mahjong result - ${dt(startedAt, lang)}`, ...lines].join("\n");
}
function commonPlayers(history, current, min=2){
  const counts = {};
  history.forEach(m => (m.allPlayers || m.players || []).slice(1).forEach(name => {
    if (!name || /^Player [0-9]+$/.test(name)) return;
    counts[name] = (counts[name] || 0) + 1;
  }));
  return Object.entries(counts).filter(([name,count]) => count >= min && !current.includes(name)).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([name,count]) => ({ name, count }));
}

// Basic tests
(function runTests(){
  const ps = ["A","B","C","D"];
  const t = totals(ps, [{players:ps, values:[-50,-50,100,0]}]);
  const p = settlements(ps,t);
  console.assert(p.length===2 && p[0].from==="A" && p[0].to==="C" && p[0].amount===50, "settlement test failed");
  const mixed = totals(ps, [{players:["A","B","C","D"],values:[100,-50,-50,0]},{players:["A","E","F","G"],values:[-30,30,0,0]}]);
  console.assert(mixed.find(x=>x.player==="A").total===70 && mixed.find(x=>x.player==="E").total===30, "mixed players test failed");
  console.assert(outputText([{from:"B",to:"A",amount:50}], "2026-04-28T12:00:00+08:00", "zh").includes("B 付給 A：50"), "zh output failed");
})();

export default function App(){
  const [players, setPlayers] = useState(["Leo", "Player 2", "Player 3", "Player 4"]);
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [draft, setDraft] = useState(newDraft(4));
  const [savedRounds, setSavedRounds] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("round");
  const [message, setMessage] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [undo, setUndo] = useState(null);
  const [lang, setLang] = useState("en");

  const tx = text[lang];
  const me = players[0] || "Player 1";
  const currentRound = useMemo(() => normalize({ ...draft, players }, players), [draft, players]);
  const rounds = useMemo(() => savedRounds.map(r => normalize(r, r.players || players)), [savedRounds, players]);
  const roundTotal = sumRound(currentRound);
  const totalItems = useMemo(() => totals(players, rounds), [players, rounds]);
  const balance = totalItems.reduce((a,b)=>a+b.total, 0);
  const payments = useMemo(() => settlements(players, totalItems), [players, totalItems]);
  const mine = useMemo(() => myPayments(payments, me), [payments, me]);
  const canSaveMatch = savedRounds.length > 0 && Math.abs(balance) < 0.000001;
  const common = useMemo(() => commonPlayers(history, players), [history, players]);
  const out = useMemo(() => outputText(payments, startedAt, lang), [payments, startedAt, lang]);

  const styles = {
    page:{minHeight:"100vh",background:"#111",fontFamily:"Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:"#171717"},
    phone:{height:"100vh",maxWidth:430,margin:"0 auto",background:"#f5f5f4",overflow:"hidden",boxShadow:"0 0 40px rgba(0,0,0,.35)",display:"flex",flexDirection:"column"},
    headerWrap:{background:"#f5f5f4",padding:"10px 12px 8px",flex:"0 0 auto"},
    header:{background:"#171717",color:"white",borderRadius:20,padding:12,boxShadow:"0 8px 24px rgba(0,0,0,.12)"},
    headerTop:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10},
    eyebrow:{margin:0,fontSize:10,letterSpacing:2.5,textTransform:"uppercase",color:"#a3a3a3"},
    title:{margin:"2px 0 0",fontSize:21,fontWeight:850,letterSpacing:-0.7},
    hint:{margin:"3px 0 0",fontSize:11,color:"#d4d4d4"},
    iconButton:{border:0,borderRadius:15,background:"rgba(255,255,255,.12)",color:"white",minWidth:42,minHeight:42,fontSize:18,cursor:"pointer"},
    languageToggle:{display:"flex",alignItems:"center",gap:4,border:0,borderRadius:999,background:"rgba(255,255,255,.12)",color:"white",height:42,padding:4,cursor:"pointer"},
    languageToggleOption:{minWidth:32,height:34,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900},
    statGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:9},
    stat:{background:"rgba(255,255,255,.1)",borderRadius:13,padding:"7px 8px"},
    statLabel:{color:"#a3a3a3",fontSize:10,marginBottom:2},
    statValue:{fontSize:17,fontWeight:900,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
    main:{flex:"1 1 auto",overflow:"hidden",padding:"0 12px 8px",display:"flex",flexDirection:"column",gap:8},
    card:{background:"white",borderRadius:20,padding:11,boxShadow:"0 4px 16px rgba(0,0,0,.06)"},
    row:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8},
    button:{border:0,borderRadius:15,background:"#171717",color:"white",minHeight:38,padding:"0 12px",fontSize:13,fontWeight:800,cursor:"pointer"},
    secondary:{border:"1px solid #d4d4d4",borderRadius:15,background:"white",color:"#171717",minHeight:38,padding:"0 12px",fontSize:13,fontWeight:800,cursor:"pointer"},
    danger:{border:0,borderRadius:14,background:"#fee2e2",color:"#b91c1c",minHeight:34,padding:"0 10px",fontSize:12,fontWeight:800,cursor:"pointer"},
    input:{width:"100%",height:44,border:"1px solid #e5e5e5",borderRadius:15,background:"#fafafa",padding:"0 12px",fontSize:15,outline:"none",boxSizing:"border-box"},
    amount:{width:"100%",height:42,border:"1px solid rgba(255,255,255,.7)",borderRadius:14,background:"rgba(255,255,255,.94)",padding:"0 8px",fontSize:21,fontWeight:900,textAlign:"center",outline:"none",boxSizing:"border-box"},
    grid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8},
    block:{borderRadius:17,padding:8,minHeight:104,display:"flex",flexDirection:"column",justifyContent:"center",cursor:"pointer",border:"2px solid transparent",boxSizing:"border-box"},
    pill:{display:"inline-flex",justifyContent:"center",alignItems:"center",minWidth:48,height:20,borderRadius:999,fontSize:10,fontWeight:900,color:"white",marginTop:3},
    compact:{flex:"1 1 auto",overflow:"auto",display:"grid",gap:8,alignContent:"start"},
    chipGrid:{display:"flex",gap:7,flexWrap:"wrap",marginTop:8},
    chip:{border:0,borderRadius:999,background:"#171717",color:"white",padding:"8px 10px",fontSize:12,fontWeight:800,cursor:"pointer"},
    paymentGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},
    payment:{background:"#171717",color:"white",borderRadius:14,padding:9,boxSizing:"border-box"},
    output:{background:"#171717",color:"white",borderRadius:16,padding:12,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap",userSelect:"text"},
    savedRound:{background:"#fafafa",borderRadius:14,padding:9,border:"1px solid #eee"},
    footer:{flex:"0 0 auto",background:"rgba(245,245,244,.96)",padding:"8px 12px 12px",boxSizing:"border-box"},
    footerActions:{display:"grid",gridTemplateColumns:"0.8fr 1.2fr",gap:8,marginBottom:8},
    nav:{display:"flex",gap:7,background:"white",borderRadius:22,padding:7,boxShadow:"0 4px 16px rgba(0,0,0,.06)"},
    navButton:{flex:1,border:0,borderRadius:16,padding:"7px 2px",fontSize:10.5,fontWeight:800,cursor:"pointer"}
  };

  function setName(i, value){ setPlayers(p => p.map((x,idx)=>idx===i?value:x)); setMessage(""); }
  function suggest(name){
    setPlayers(p => {
      if (p.includes(name)) return p;
      const hole = p.findIndex((x,i)=>i>0 && /^Player [0-9]+$/.test(x));
      if (hole >= 0) return p.map((x,i)=>i===hole?name:x);
      return p.length < 4 ? [...p,name] : p.map((x,i)=>i===p.length-1?name:x);
    });
  }
  function addPlayer(){
    if (players.length >= 4) return;
    setPlayers(p => [...p, `Player ${p.length+1}`]);
    setDraft(d => ({ values:[...d.values,0], statuses:[...d.statuses,"lose"] }));
  }
  function removePlayer(i){
    if (players.length <= 2 || i === 0) return;
    setPlayers(p => p.filter((_,idx)=>idx!==i));
    setDraft(d => ({ values:d.values.filter((_,idx)=>idx!==i), statuses:d.statuses.filter((_,idx)=>idx!==i) }));
  }
  function toggleStatus(i){
    setDraft(d => {
      const statuses = [...d.statuses], values = [...d.values];
      statuses[i] = statuses[i] === "win" ? "lose" : "win";
      values[i] = signed(values[i], statuses[i]);
      return { values, statuses };
    });
    setShowResult(false);
    setMessage("");
  }
  function setAmount(i, raw){
    const clean = raw.replace(/[^0-9.]/g,"");
    setDraft(d => {
      const values = [...d.values];
      values[i] = clean === "" ? "" : signed(clean, d.statuses[i]);
      return { ...d, values };
    });
    setShowResult(false);
    setMessage("");
  }
  function clearDraft(){
    if (hasAmount(currentRound)) setUndo({ type:"clear", draft });
    setDraft(newDraft(players.length));
    setMessage(tx.cleared);
    setShowResult(false);
  }
  function deleteRound(rid){
    const deleted = savedRounds.find(r => r.id === rid);
    if (deleted) setUndo({ type:"delete", deleted });
    setSavedRounds(rs => rs.filter(r => r.id !== rid));
    setMessage(tx.deleted);
    setShowResult(false);
  }
  function preview(){
    const r = normalize({ ...draft, players }, players);
    if (hasAmount(r)){
      const total = sumRound(r);
      if (Math.abs(total) > 0.000001){
        setMessage(`${tx.currentNotBalanced}: ${money(total)}`);
        setShowResult(false);
        setTab("round");
        return;
      }
      const saved = { ...r, id:id() };
      setUndo({ type:"autoSave", draft, savedId:saved.id });
      setSavedRounds(rs => [...rs, saved]);
      setDraft(newDraft(players.length));
      setMessage(tx.autoSaved);
    } else {
      setMessage("");
    }
    setShowResult(true);
    setTab("round");
  }
  function undoLast(){
    if (!undo) return;
    if (undo.type === "clear"){
      setDraft(undo.draft);
      setMessage(tx.undoClear);
    }
    if (undo.type === "delete"){
      setSavedRounds(rs => [...rs, undo.deleted]);
      setMessage(tx.undoDelete);
    }
    if (undo.type === "autoSave"){
      setSavedRounds(rs => rs.filter(r => r.id !== undo.savedId));
      setDraft(undo.draft);
      setShowResult(false);
      setMessage(tx.undoSave);
    }
    setUndo(null);
  }
  async function copy(){
    try{
      await navigator.clipboard.writeText(out);
      setMessage(tx.copied);
    } catch {
      setMessage(tx.copyFail);
    }
  }
  function saveMatch(){
    if (!savedRounds.length) return setMessage(tx.saveFirst);
    const match = {
      id:id(), startedAt, endedAt:new Date().toISOString(), players:[...players], allPlayers:totalItems.map(x=>x.player), userName:me,
      rounds:rounds.map(r=>({ ...r })), totals:totalItems.map(x=>({ ...x })), settlements:payments.map(p=>({ ...p }))
    };
    setHistory(h => [match, ...h]);
    setSavedRounds([]);
    setDraft(newDraft(players.length));
    setStartedAt(new Date().toISOString());
    setTab("pay");
    setMessage(tx.matchSaved);
    setShowResult(false);
    setUndo(null);
  }

  function NavButton({id, icon, label}){
    const active = tab === id;
    return <button onClick={()=>setTab(id)} style={{...styles.navButton,background:active?"#171717":"transparent",color:active?"white":"#737373"}}><div style={{fontSize:15,lineHeight:1}}>{icon}</div><div style={{marginTop:2}}>{label}</div></button>
  }
  function RoundDetails({round, small=false}){
    const ps = round.players || players;
    return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:small?4:5,marginTop:small?5:7,fontSize:small?11:12}}>
      {ps.slice(0,4).map((p,i)=><div key={`${p}-${i}`} style={{color:round.values[i]>=0?"#15803d":"#dc2626",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p}: {round.values[i]>=0?"+":""}{money(round.values[i])}</div>)}
    </div>
  }
  function Payment({payment, personal=false}){
    if (!personal) return <div style={styles.payment}><div style={{fontSize:12,opacity:.7}}>{lang==="zh"?"支付":"PAY"}</div><div style={{fontSize:14,fontWeight:900,margin:"4px 0",color:"#fca5a5"}}>{payment.from} → {payment.to}</div><div style={{fontSize:18,fontWeight:950}}>{money(payment.amount)}</div></div>
    const receive = payment.to === me;
    return <div style={styles.payment}><div style={{fontSize:12,opacity:.7}}>{receive ? (lang==="zh"?"收款":"RECEIVE") : (lang==="zh"?"支付":"PAY")}</div><div style={{fontSize:14,fontWeight:900,margin:"4px 0",color:receive?"#86efac":"#fca5a5"}}>{receive ? "←" : "→"} {receive ? payment.from : payment.to}</div><div style={{fontSize:18,fontWeight:950}}>{money(payment.amount)}</div></div>
  }

  return <div style={styles.page}><div style={styles.phone}>
    <div style={styles.headerWrap}><div style={styles.header}>
      <div style={styles.headerTop}>
        <div><p style={styles.eyebrow}>{tx.eyebrow}</p><h1 style={styles.title}>{tx.title}</h1><p style={styles.hint}>{dt(startedAt,lang)} · {tx.hint}</p></div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setLang(lang==="en"?"zh":"en")} style={styles.languageToggle} aria-label="Toggle language">
            <span style={{...styles.languageToggleOption,background:lang==="en"?"white":"transparent",color:lang==="en"?"#171717":"#d4d4d4"}}>EN</span>
            <span style={{...styles.languageToggleOption,background:lang==="zh"?"white":"transparent",color:lang==="zh"?"#171717":"#d4d4d4"}}>CN</span>
          </button>
          <button onClick={()=>{setStartedAt(new Date().toISOString());setDraft(newDraft(players.length));setSavedRounds([]);setMessage("");setShowResult(false);setTab("round");setUndo(null)}} style={styles.iconButton}>↻</button>
        </div>
      </div>
      <div style={styles.statGrid}>
        <div style={styles.stat}><div style={styles.statLabel}>{tx.rounds}</div><div style={styles.statValue}>{savedRounds.length}</div></div>
        <div style={styles.stat}><div style={styles.statLabel}>{tx.round}</div><div style={{...styles.statValue,color:Math.abs(roundTotal)<0.000001?"#86efac":"#fca5a5"}}>{money(roundTotal)}</div></div>
        <div style={styles.stat}><div style={styles.statLabel}>{tx.me}</div><div style={styles.statValue}>{me}</div></div>
      </div>
    </div></div>

    <main style={styles.main}>
      {tab==="players" && <section style={{...styles.card,flex:"1 1 auto",overflow:"auto"}}>
        <div style={{...styles.row,marginBottom:10}}><h2 style={{margin:0,fontSize:18}}>{tx.players}</h2><button onClick={addPlayer} disabled={players.length>=4} style={{...styles.button,opacity:players.length>=4?.4:1}}>{tx.add}</button></div>
        <p style={{margin:"0 0 8px",fontSize:12,color:"#737373"}}>{tx.playerHint}</p>
        <div style={{display:"grid",gap:8}}>{players.map((p,i)=><div key={i} style={{display:"flex",gap:7}}><input value={p} onChange={e=>setName(i,e.target.value)} style={styles.input}/><button onClick={()=>removePlayer(i)} disabled={players.length<=2||i===0} style={{...styles.danger,opacity:players.length<=2||i===0?.35:1}}>{i===0?tx.you:tx.delete}</button></div>)}</div>
        <div style={{marginTop:12}}><strong style={{fontSize:14}}>{tx.common}</strong>{common.length===0?<div style={{marginTop:8,background:"#fafafa",borderRadius:15,padding:10,color:"#737373",fontSize:12}}>{tx.commonEmpty}</div>:<div style={styles.chipGrid}>{common.slice(0,10).map(p=><button key={p.name} onClick={()=>suggest(p.name)} style={styles.chip}>{p.name} ×{p.count}</button>)}</div>}</div>
      </section>}

      {tab==="round" && <section style={{...styles.card,flex:"1 1 auto",overflow:"auto"}}>
        <div style={styles.row}><div><h2 style={{margin:0,fontSize:18}}>{tx.currentRound}</h2><p style={{margin:"3px 0 0",fontSize:13,color:Math.abs(roundTotal)<0.000001?"#15803d":"#dc2626"}}>{tx.total} {money(roundTotal)} {Math.abs(roundTotal)<0.000001?"✓":tx.needsZero}</p></div><button onClick={clearDraft} style={styles.secondary}>{tx.clear}</button></div>
        <div style={styles.grid}>{players.slice(0,4).map((p,i)=>{const isWin=currentRound.statuses[i]==="win"; const amount=Math.abs(Number(currentRound.values[i]||0)); return <div key={`${p}-${i}`} onClick={()=>toggleStatus(i)} style={{...styles.block,background:isWin?"#dcfce7":"#fee2e2",borderColor:isWin?"#86efac":"#fca5a5"}}><div style={{marginBottom:7,textAlign:"center"}}><strong style={{display:"block",fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p}</strong><span style={{...styles.pill,background:isWin?"#16a34a":"#dc2626"}}>{isWin?tx.win:tx.lose}</span></div><input type="text" inputMode="decimal" value={amount||""} onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onChange={e=>setAmount(i,e.target.value)} placeholder="0" style={styles.amount}/></div>})}</div>
        {message && <div style={{marginTop:8,borderRadius:15,padding:9,fontSize:13,background:/not|Enter|least|failed|尚未|請先/i.test(message)?"#fef2f2":"#ecfdf5",color:/not|Enter|least|failed|尚未|請先/i.test(message)?"#b91c1c":"#15803d"}}>{message}</div>}
        <div style={{marginTop:10}}><div style={styles.row}><strong style={{fontSize:15}}>{tx.savedRounds}</strong><span style={{fontSize:12,color:"#737373"}}>{savedRounds.length} {tx.rounds}</span></div><div style={{display:"grid",gap:6,marginTop:7,maxHeight:130,overflow:"auto"}}>{rounds.length===0?<div style={{background:"#fafafa",borderRadius:14,padding:9,color:"#737373",fontSize:12}}>{tx.noSaved}</div>:rounds.map((r,idx)=><div key={r.id} style={styles.savedRound}><div style={styles.row}><strong style={{fontSize:13}}>{tx.round} {idx+1}</strong><button onClick={()=>deleteRound(r.id)} style={{...styles.danger,minHeight:28,fontSize:11}}>{tx.delete}</button></div><RoundDetails round={r} small/></div>)}</div></div>
        {showResult && <div style={{marginTop:10}}><div style={styles.row}><strong style={{fontSize:15}}>{tx.result}</strong><button onClick={saveMatch} disabled={!canSaveMatch} style={{...styles.button,minHeight:34,opacity:canSaveMatch?1:.4}}>{tx.saveMatch}</button></div><p style={{margin:"3px 0 0",fontSize:12,color:"#737373"}}>{tx.previewHint}</p>{savedRounds.length===0?<div style={{marginTop:8,background:"#fafafa",color:"#737373",borderRadius:15,padding:9,fontSize:13}}>{tx.saveFirst}</div>:Math.abs(balance)>0.000001?<div style={{marginTop:8,background:"#fef2f2",color:"#b91c1c",borderRadius:15,padding:9,fontSize:13}}>{tx.notBalanced}</div>:payments.length===0?<div style={{marginTop:8,background:"#fafafa",color:"#737373",borderRadius:15,padding:9,fontSize:13}}>{tx.noPayments}</div>:<div style={{...styles.paymentGrid,marginTop:8}}>{payments.map((p,i)=><Payment key={`${p.from}-${p.to}-${i}`} payment={p}/>)}</div>}</div>}
      </section>}

      {tab==="saved" && <section style={{...styles.card,flex:"1 1 auto",overflow:"hidden",display:"flex",flexDirection:"column"}}><div style={{...styles.row,marginBottom:8}}><h2 style={{margin:0,fontSize:18}}>{tx.savedRounds}</h2><span style={{fontSize:13,color:"#737373"}}>{savedRounds.length} {tx.rounds}</span></div><div style={styles.compact}>{rounds.length===0?<div style={{background:"#fafafa",borderRadius:16,padding:12,color:"#737373",fontSize:13}}>{tx.noSaved}</div>:rounds.map((r,idx)=><div key={r.id} style={{background:"#fafafa",borderRadius:16,padding:10}}><div style={styles.row}><strong>{tx.round} {idx+1}</strong><button onClick={()=>deleteRound(r.id)} style={styles.danger}>{tx.delete}</button></div><RoundDetails round={r}/></div>)}</div></section>}

      {tab==="output" && <section style={{...styles.card,flex:"1 1 auto",overflow:"auto"}}><div style={{...styles.row,marginBottom:10}}><div><h2 style={{margin:0,fontSize:18}}>{tx.output}</h2><p style={{margin:"3px 0 0",fontSize:12,color:"#737373"}}>{tx.outputHint}</p></div><button onClick={copy} style={styles.button}>{tx.copy}</button></div>{savedRounds.length===0?<div style={{background:"#fafafa",color:"#737373",borderRadius:16,padding:12,fontSize:13}}>{tx.outputEmpty}</div>:Math.abs(balance)>0.000001?<div style={{background:"#fef2f2",color:"#b91c1c",borderRadius:16,padding:12,fontSize:13}}>{tx.outputNotBalanced}</div>:<div onClick={copy} style={styles.output}>{out}</div>}</section>}

      {tab==="pay" && <section style={{...styles.card,flex:"1 1 auto",overflow:"hidden",display:"flex",flexDirection:"column"}}><div style={{...styles.row,marginBottom:10}}><div><h2 style={{margin:0,fontSize:18}}>{tx.myHistory}</h2><p style={{margin:"3px 0 0",fontSize:12,color:"#737373"}}>{tx.myHint.replace("{name}",me)}</p></div><button onClick={saveMatch} style={styles.button}>{tx.saveMatch}</button></div><div style={styles.compact}>{savedRounds.length>0&&<div style={{background:"#fafafa",borderRadius:16,padding:10}}><strong style={{fontSize:14}}>{tx.currentMatch}</strong><div style={{marginTop:8}}>{Math.abs(balance)>0.000001?<div style={{color:"#b91c1c",fontSize:13}}>{tx.notBalanced}</div>:mine.length===0?<div style={{color:"#737373",fontSize:13}}>{tx.noMine}</div>:<div style={styles.paymentGrid}>{mine.map((p,i)=><Payment key={`${p.from}-${p.to}-${i}`} payment={p} personal/>)}</div>}</div></div>}{history.length===0?<div style={{background:"#fafafa",borderRadius:16,padding:12,color:"#737373",fontSize:13}}>{tx.noMatches}</div>:history.map(m=>{const matchUser=m.userName||m.players[0]; const rel=myPayments(m.settlements||[],matchUser); return <div key={m.id} style={{background:"#171717",color:"white",borderRadius:18,padding:12}}><div style={styles.row}><strong>{dt(m.startedAt,lang)}</strong><span style={{fontSize:12,color:"#a3a3a3"}}>{m.rounds.length} {tx.rounds}</span></div>{rel.length===0?<div style={{marginTop:8,color:"#a3a3a3",fontSize:13}}>{tx.noMine}</div>:rel.map((p,i)=>{const receive=p.to===matchUser; return <div key={i} style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,fontSize:13,color:receive?"#86efac":"#fca5a5"}}><span>{receive?tx.receive:tx.pay} {receive?p.from:p.to}</span><strong>{money(p.amount)}</strong></div>})}</div>})}</div></section>}
    </main>

    <footer style={styles.footer}>
      <div style={styles.footerActions}><button onClick={undoLast} disabled={!undo} style={{...styles.secondary,opacity:undo?1:.4}}>{tx.undo}</button><button onClick={preview} style={styles.button}>{tx.preview}</button></div>
      <nav style={styles.nav}><NavButton id="players" icon="👥" label={tx.players}/><NavButton id="round" icon="🀄" label={tx.round}/><NavButton id="saved" icon="🧾" label={tx.saved}/><NavButton id="output" icon="📋" label={tx.output}/><NavButton id="pay" icon="💰" label={tx.myPay}/></nav>
    </footer>
  </div></div>
}
