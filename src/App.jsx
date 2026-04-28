import React, { useMemo, useState } from "react";

const currency = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const nowLabel = (d) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function makeDraft(count) {
  return { values: Array(count).fill(0), statuses: Array(count).fill("lose") };
}

function signed(value, status) {
  const amount = Math.abs(Number(value || 0));
  if (!amount) return 0;
  return status === "win" ? amount : -amount;
}

function normalizeRound(round, fallbackPlayers) {
  const players = round.players || fallbackPlayers;
  return {
    id: round.id || makeId(),
    players: [...players],
    values: players.map((_, i) => Number(round.values?.[i] || 0)),
    statuses: players.map((_, i) => round.statuses?.[i] || (Number(round.values?.[i] || 0) >= 0 ? "win" : "lose")),
  };
}

function roundTotal(round) {
  return round.values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function hasAmount(round) {
  return round.values.some((value) => Math.abs(Number(value || 0)) > 0);
}

function calculateTotals(currentPlayers, rounds) {
  const totals = {};
  currentPlayers.forEach((p) => (totals[p] = totals[p] || 0));
  rounds.forEach((round) => {
    const roundPlayers = round.players || currentPlayers;
    round.values.forEach((value, i) => {
      const name = roundPlayers[i] || `Player ${i + 1}`;
      totals[name] = (totals[name] || 0) + Number(value || 0);
    });
  });
  return Object.entries(totals).map(([player, total]) => ({ player, total }));
}

function settle(players, totals) {
  const normalized = totals.map((x, i) => (typeof x === "number" ? { player: players[i], total: x } : x));
  const debtors = normalized.filter((x) => x.total < 0).map((x) => ({ player: x.player, amount: Math.abs(x.total) }));
  const creditors = normalized.filter((x) => x.total > 0).map((x) => ({ player: x.player, amount: x.total }));
  const payments = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) payments.push({ from: debtors[d].player, to: creditors[c].player, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount <= 0.000001) d += 1;
    if (creditors[c].amount <= 0.000001) c += 1;
  }
  return payments;
}

function outputText(payments, startedAt) {
  if (!payments.length) return "Mahjong result:\nNo payments needed.";
  return [`Mahjong result - ${nowLabel(startedAt)}`, ...payments.map((p) => `${p.from} pays ${p.to}: ${currency(p.amount)}`)].join("\n");
}

function myPayments(payments, me) {
  return payments.filter((p) => p.from === me || p.to === me);
}

function commonPlayers(history, current, min = 2) {
  const counts = {};
  history.forEach((match) => {
    (match.allPlayers || match.players || []).slice(1).forEach((name) => {
      if (!name || /^Player [0-9]+$/.test(name)) return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .filter(([name, count]) => count >= min && !current.includes(name))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

export default function App() {
  const [players, setPlayers] = useState(["Leo", "Player 2", "Player 3", "Player 4"]);
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [draft, setDraft] = useState(makeDraft(4));
  const [savedRounds, setSavedRounds] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("round");
  const [message, setMessage] = useState("");
  const [showCalc, setShowCalc] = useState(false);

  const me = players[0] || "Player 1";
  const currentRound = useMemo(() => normalizeRound({ ...draft, players }, players), [draft, players]);
  const rounds = useMemo(() => savedRounds.map((r) => normalizeRound(r, r.players || players)), [savedRounds, players]);
  const currentTotal = roundTotal(currentRound);
  const totals = useMemo(() => calculateTotals(players, rounds), [players, rounds]);
  const balance = totals.reduce((s, x) => s + x.total, 0);
  const payments = useMemo(() => settle(players, totals), [players, totals]);
  const mine = useMemo(() => myPayments(payments, me), [payments, me]);
  const common = useMemo(() => commonPlayers(history, players), [history, players]);
  const copyString = useMemo(() => outputText(payments, startedAt), [payments, startedAt]);

  const styles = {
    page: { minHeight: "100vh", background: "#111", color: "#171717", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
    phone: { height: "100vh", maxWidth: 430, margin: "0 auto", background: "#f5f5f4", overflow: "hidden", boxShadow: "0 0 40px rgba(0,0,0,.35)", display: "flex", flexDirection: "column" },
    headerWrap: { padding: "10px 12px 8px", flex: "0 0 auto" },
    header: { background: "#171717", color: "white", borderRadius: 20, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)" },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { margin: 0, fontSize: 21, fontWeight: 900, letterSpacing: -0.7 },
    hint: { margin: "3px 0 0", fontSize: 11, color: "#d4d4d4" },
    stats: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 9 },
    stat: { background: "rgba(255,255,255,.1)", borderRadius: 13, padding: "7px 8px" },
    statLabel: { color: "#a3a3a3", fontSize: 10, marginBottom: 2 },
    statValue: { fontSize: 17, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    main: { flex: "1 1 auto", overflow: "hidden", padding: "0 12px 8px", display: "flex", flexDirection: "column" },
    card: { background: "white", borderRadius: 20, padding: 11, boxShadow: "0 4px 16px rgba(0,0,0,.06)" },
    input: { width: "100%", height: 44, border: "1px solid #e5e5e5", borderRadius: 15, background: "#fafafa", padding: "0 12px", fontSize: 15, boxSizing: "border-box", outline: "none" },
    button: { border: 0, borderRadius: 15, background: "#171717", color: "white", minHeight: 38, padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
    secondary: { border: "1px solid #d4d4d4", borderRadius: 15, background: "white", color: "#171717", minHeight: 38, padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
    danger: { border: 0, borderRadius: 14, background: "#fee2e2", color: "#b91c1c", minHeight: 34, padding: "0 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 },
    block: { borderRadius: 17, padding: 8, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", border: "2px solid transparent" },
    amount: { width: "100%", height: 42, border: "1px solid rgba(255,255,255,.7)", borderRadius: 14, background: "rgba(255,255,255,.94)", fontSize: 21, fontWeight: 900, textAlign: "center", outline: "none", boxSizing: "border-box" },
    pill: { display: "inline-flex", justifyContent: "center", alignItems: "center", minWidth: 48, height: 20, borderRadius: 999, fontSize: 10, fontWeight: 900, color: "white", marginTop: 3 },
    saved: { background: "#fafafa", borderRadius: 14, padding: 9, border: "1px solid #eee" },
    footer: { flex: "0 0 auto", padding: "8px 12px 12px" },
    footerActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 },
    nav: { display: "flex", gap: 7, background: "white", borderRadius: 22, padding: 7, boxShadow: "0 4px 16px rgba(0,0,0,.06)" },
    navButton: { flex: 1, border: 0, borderRadius: 16, padding: "7px 2px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" },
    payment: { background: "#171717", color: "white", borderRadius: 14, padding: 9, boxSizing: "border-box" },
    output: { background: "#171717", color: "white", borderRadius: 16, padding: 12, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", userSelect: "text" },
  };

  function addPlayer() {
    if (players.length >= 4) return;
    setPlayers((p) => [...p, `Player ${p.length + 1}`]);
    setDraft((d) => ({ values: [...d.values, 0], statuses: [...d.statuses, "lose"] }));
  }

  function removePlayer(index) {
    if (players.length <= 2 || index === 0) return;
    setPlayers((p) => p.filter((_, i) => i !== index));
    setDraft((d) => ({ values: d.values.filter((_, i) => i !== index), statuses: d.statuses.filter((_, i) => i !== index) }));
  }

  function updateName(index, value) {
    setPlayers((p) => p.map((x, i) => (i === index ? value : x)));
    setMessage("");
  }

  function setSuggested(name) {
    setPlayers((p) => {
      if (p.includes(name)) return p;
      const placeholder = p.findIndex((x, i) => i > 0 && /^Player [0-9]+$/.test(x));
      if (placeholder >= 0) return p.map((x, i) => (i === placeholder ? name : x));
      return p.length < 4 ? [...p, name] : p.map((x, i) => (i === p.length - 1 ? name : x));
    });
  }

  function toggleStatus(i) {
    setDraft((d) => {
      const statuses = [...d.statuses];
      const values = [...d.values];
      statuses[i] = statuses[i] === "win" ? "lose" : "win";
      values[i] = signed(values[i], statuses[i]);
      return { statuses, values };
    });
    setShowCalc(false);
  }

  function updateValue(i, raw) {
    const clean = raw.replace(/[^0-9.]/g, "");
    setDraft((d) => {
      const values = [...d.values];
      values[i] = clean === "" ? "" : signed(clean, d.statuses[i]);
      return { ...d, values };
    });
    setShowCalc(false);
  }

  function saveRound() {
    const round = normalizeRound({ ...draft, players }, players);
    if (Math.abs(roundTotal(round)) > 0.000001) return setMessage(`Round not balanced: ${currency(roundTotal(round))}`);
    if (!hasAmount(round)) return setMessage("Enter amounts before saving");
    setSavedRounds((r) => [...r, { ...round, id: makeId() }]);
    setDraft(makeDraft(players.length));
    setMessage(`Saved round ${savedRounds.length + 1}`);
    setShowCalc(false);
  }

  function deleteRound(id) {
    setSavedRounds((r) => r.filter((x) => x.id !== id));
    setShowCalc(false);
  }

  function resetGame() {
    setStartedAt(new Date().toISOString());
    setDraft(makeDraft(players.length));
    setSavedRounds([]);
    setMessage("");
    setShowCalc(false);
    setTab("round");
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(copyString);
      setMessage("Copied result text");
    } catch {
      setMessage("Copy failed. Long press the text to copy.");
    }
  }

  function finalize() {
    if (!savedRounds.length) return setMessage("Save at least one round first");
    const match = { id: makeId(), startedAt, endedAt: new Date().toISOString(), players: [...players], allPlayers: totals.map((x) => x.player), userName: me, rounds, totals, settlements: payments, myPayments: mine };
    setHistory((h) => [match, ...h]);
    setStartedAt(new Date().toISOString());
    setSavedRounds([]);
    setDraft(makeDraft(players.length));
    setTab("pay");
    setMessage("Match saved");
    setShowCalc(false);
  }

  function NavButton({ id, icon, label }) {
    const active = tab === id;
    return <button onClick={() => setTab(id)} style={{ ...styles.navButton, background: active ? "#171717" : "transparent", color: active ? "white" : "#737373" }}><div>{icon}</div><div>{label}</div></button>;
  }

  function Payment({ payment, personal = false }) {
    if (!personal) return <div style={styles.payment}><div style={{ fontSize: 12, opacity: 0.7 }}>PAY</div><div style={{ fontWeight: 900, color: "#fca5a5", margin: "4px 0" }}>{payment.from} → {payment.to}</div><div style={{ fontSize: 18, fontWeight: 950 }}>{currency(payment.amount)}</div></div>;
    const receive = payment.to === me;
    return <div style={styles.payment}><div style={{ fontSize: 12, opacity: 0.7 }}>{receive ? "RECEIVE" : "PAY"}</div><div style={{ fontWeight: 900, color: receive ? "#86efac" : "#fca5a5", margin: "4px 0" }}>{receive ? "←" : "→"} {receive ? payment.from : payment.to}</div><div style={{ fontSize: 18, fontWeight: 950 }}>{currency(payment.amount)}</div></div>;
  }

  function RoundDetails({ round }) {
    return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 5, fontSize: 11 }}>{(round.players || players).slice(0, 4).map((p, i) => <div key={`${p}-${i}`} style={{ color: round.values[i] >= 0 ? "#15803d" : "#dc2626", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p}: {round.values[i] >= 0 ? "+" : ""}{currency(round.values[i])}</div>)}</div>;
  }

  return <div style={styles.page}><div style={styles.phone}>
    <div style={styles.headerWrap}><div style={styles.header}>
      <div style={styles.row}><div><p style={{ margin: 0, fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "#a3a3a3" }}>Mahjong</p><h1 style={styles.title}>Settlement</h1><p style={styles.hint}>{nowLabel(startedAt)} · Player 1 is you.</p></div><button onClick={resetGame} style={styles.iconButton}>↻</button></div>
      <div style={styles.stats}><div style={styles.stat}><div style={styles.statLabel}>Rounds</div><div style={styles.statValue}>{savedRounds.length}</div></div><div style={styles.stat}><div style={styles.statLabel}>Round</div><div style={{ ...styles.statValue, color: Math.abs(currentTotal) < 0.000001 ? "#86efac" : "#fca5a5" }}>{currency(currentTotal)}</div></div><div style={styles.stat}><div style={styles.statLabel}>Me</div><div style={styles.statValue}>{me}</div></div></div>
    </div></div>

    <main style={styles.main}>
      {tab === "players" && <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}><div style={{ ...styles.row, marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 18 }}>Players</h2><button onClick={addPlayer} disabled={players.length >= 4} style={{ ...styles.button, opacity: players.length >= 4 ? 0.4 : 1 }}>＋ Add</button></div><p style={{ margin: "0 0 8px", fontSize: 12, color: "#737373" }}>Player 1 is always you. Changing players only affects new rounds.</p><div style={{ display: "grid", gap: 8 }}>{players.map((p, i) => <div key={i} style={{ display: "flex", gap: 7 }}><input value={p} onChange={(e) => updateName(i, e.target.value)} style={styles.input}/><button onClick={() => removePlayer(i)} disabled={players.length <= 2 || i === 0} style={{ ...styles.danger, opacity: players.length <= 2 || i === 0 ? .35 : 1 }}>{i === 0 ? "You" : "Delete"}</button></div>)}</div><div style={{ marginTop: 12 }}><strong style={{ fontSize: 14 }}>Common players</strong>{common.length === 0 ? <div style={{ marginTop: 8, background: "#fafafa", borderRadius: 15, padding: 10, color: "#737373", fontSize: 12 }}>Names appear here after they show up in 2 saved matches.</div> : <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>{common.map((p) => <button key={p.name} onClick={() => setSuggested(p.name)} style={styles.chip}>{p.name} ×{p.count}</button>)}</div>}</div></section>}

      {tab === "round" && <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}><div style={styles.row}><div><h2 style={{ margin: 0, fontSize: 18 }}>Current Round</h2><p style={{ margin: "3px 0 0", fontSize: 13, color: Math.abs(currentTotal) < 0.000001 ? "#15803d" : "#dc2626" }}>Total {currency(currentTotal)} {Math.abs(currentTotal) < 0.000001 ? "✓" : "needs 0"}</p></div><button onClick={() => { setDraft(makeDraft(players.length)); setShowCalc(false); }} style={styles.secondary}>Clear</button></div><div style={styles.grid}>{players.slice(0,4).map((p,i) => { const isWin = currentRound.statuses[i] === "win"; const amount = Math.abs(Number(currentRound.values[i] || 0)); return <div key={`${p}-${i}`} onClick={() => toggleStatus(i)} style={{ ...styles.block, background: isWin ? "#dcfce7" : "#fee2e2", borderColor: isWin ? "#86efac" : "#fca5a5" }}><div style={{ textAlign: "center", marginBottom: 7 }}><strong style={{ display: "block", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p}</strong><span style={{ ...styles.pill, background: isWin ? "#16a34a" : "#dc2626" }}>{isWin ? "WIN" : "LOSE"}</span></div><input type="text" inputMode="decimal" value={amount || ""} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onChange={(e) => updateValue(i, e.target.value)} placeholder="0" style={styles.amount}/></div> })}</div>{message && <div style={{ marginTop: 8, borderRadius: 15, padding: 9, fontSize: 13, background: /not|Enter|least|failed/i.test(message) ? "#fef2f2" : "#ecfdf5", color: /not|Enter|least|failed/i.test(message) ? "#b91c1c" : "#15803d" }}>{message}</div>}<div style={{ marginTop: 10 }}><div style={styles.row}><strong style={{ fontSize: 15 }}>Saved Rounds</strong><span style={{ fontSize: 12, color: "#737373" }}>{savedRounds.length} rounds</span></div><div style={{ display: "grid", gap: 6, marginTop: 7, maxHeight: 130, overflow: "auto" }}>{rounds.length === 0 ? <div style={{ background: "#fafafa", borderRadius: 14, padding: 9, color: "#737373", fontSize: 12 }}>No saved rounds yet.</div> : rounds.map((r, idx) => <div key={r.id} style={styles.saved}><div style={styles.row}><strong style={{ fontSize: 13 }}>Round {idx + 1}</strong><button onClick={() => deleteRound(r.id)} style={{ ...styles.danger, minHeight: 28, fontSize: 11 }}>Delete</button></div><RoundDetails round={r}/></div>)}</div></div>{showCalc && <div style={{ marginTop: 10 }}><div style={styles.row}><strong style={{ fontSize: 15 }}>Calculated Result</strong><button onClick={finalize} disabled={!savedRounds.length || Math.abs(balance) > 0.000001} style={{ ...styles.button, minHeight: 34, opacity: savedRounds.length && Math.abs(balance) < 0.000001 ? 1 : .4 }}>Finalize</button></div><p style={{ margin: "3px 0 0", fontSize: 12, color: "#737373" }}>Based on saved rounds only.</p>{!savedRounds.length ? <div style={{ marginTop: 8, background: "#fafafa", color: "#737373", borderRadius: 15, padding: 9, fontSize: 13 }}>Save at least one round first.</div> : Math.abs(balance) > 0.000001 ? <div style={{ marginTop: 8, background: "#fef2f2", color: "#b91c1c", borderRadius: 15, padding: 9, fontSize: 13 }}>Saved rounds are not balanced.</div> : payments.length === 0 ? <div style={{ marginTop: 8, background: "#fafafa", color: "#737373", borderRadius: 15, padding: 9, fontSize: 13 }}>No payments needed.</div> : <div style={{ ...styles.paymentGrid, marginTop: 8 }}>{payments.map((p, i) => <Payment key={`${p.from}-${p.to}-${i}`} payment={p}/>)}</div>}</div>}</section>}

      {tab === "saved" && <section style={{ ...styles.card, flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" }}><div style={{ ...styles.row, marginBottom: 8 }}><h2 style={{ margin: 0, fontSize: 18 }}>Saved Rounds</h2><span style={{ fontSize: 13, color: "#737373" }}>{savedRounds.length} rounds</span></div><div style={styles.compactScroll}>{rounds.length === 0 ? <div style={{ background: "#fafafa", borderRadius: 16, padding: 12, color: "#737373", fontSize: 13 }}>No saved rounds yet.</div> : rounds.map((r, idx) => <div key={r.id} style={{ background: "#fafafa", borderRadius: 16, padding: 10 }}><div style={styles.row}><strong>Round {idx+1}</strong><button onClick={() => deleteRound(r.id)} style={styles.danger}>Delete</button></div><RoundDetails round={r}/></div>)}</div></section>}

      {tab === "output" && <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}><div style={{ ...styles.row, marginBottom: 10 }}><div><h2 style={{ margin: 0, fontSize: 18 }}>Output</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#737373" }}>Tap copy, then paste in your group chat.</p></div><button onClick={copyOutput} style={styles.button}>Copy</button></div>{!savedRounds.length ? <div style={{ background: "#fafafa", color: "#737373", borderRadius: 16, padding: 12, fontSize: 13 }}>Save rounds first, then calculate/output.</div> : Math.abs(balance) > 0.000001 ? <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 16, padding: 12, fontSize: 13 }}>Saved rounds are not balanced yet.</div> : <div onClick={copyOutput} style={styles.output}>{copyString}</div>}</section>}

      {tab === "pay" && <section style={{ ...styles.card, flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" }}><div style={{ ...styles.row, marginBottom: 10 }}><div><h2 style={{ margin: 0, fontSize: 18 }}>My Payment History</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#737373" }}>Only showing {me}'s payments</p></div><button onClick={finalize} style={styles.button}>Save Match</button></div><div style={styles.compactScroll}>{savedRounds.length > 0 && <div style={{ background: "#fafafa", borderRadius: 16, padding: 10 }}><strong style={{ fontSize: 14 }}>Current Match</strong><div style={{ marginTop: 8 }}>{Math.abs(balance) > 0.000001 ? <div style={{ color: "#b91c1c", fontSize: 13 }}>Saved rounds not balanced.</div> : mine.length === 0 ? <div style={{ color: "#737373", fontSize: 13 }}>No payment for you.</div> : <div style={styles.paymentGrid}>{mine.map((p,i) => <Payment key={`${p.from}-${p.to}-${i}`} payment={p} personal />)}</div>}</div></div>}{history.length === 0 ? <div style={{ background: "#fafafa", borderRadius: 16, padding: 12, color: "#737373", fontSize: 13 }}>No saved matches yet.</div> : history.map((m) => <div key={m.id} style={{ background: "#171717", color: "white", borderRadius: 18, padding: 12 }}><div style={styles.row}><strong>{nowLabel(m.startedAt)}</strong><span style={{ fontSize: 12, color: "#a3a3a3" }}>{m.rounds.length} rounds</span></div>{myPayments(m.settlements || [], m.userName || m.players[0]).length === 0 ? <div style={{ marginTop: 8, color: "#a3a3a3", fontSize: 13 }}>No payment for you.</div> : myPayments(m.settlements || [], m.userName || m.players[0]).map((p,i) => { const receive = p.to === (m.userName || m.players[0]); return <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 13, color: receive ? "#86efac" : "#fca5a5" }}><span>{receive ? "Receive" : "Pay"} {receive ? p.from : p.to}</span><strong>{currency(p.amount)}</strong></div> })}</div>)}</div></section>}
    </main>

    <footer style={styles.footer}><div style={styles.footerActions}><button onClick={saveRound} style={styles.button}>Save Round</button><button onClick={() => { setShowCalc(true); setMessage(""); setTab("round"); }} style={styles.secondary}>Calculate</button></div><nav style={styles.nav}><NavButton id="players" icon="👥" label="Players"/><NavButton id="round" icon="🀄" label="Round"/><NavButton id="saved" icon="🧾" label="Saved"/><NavButton id="output" icon="📋" label="Output"/><NavButton id="pay" icon="💰" label="My Pay"/></nav></footer>
  </div></div>;
}
