import React, { useMemo, useState } from "react";

const NAME_POOL = ["Leo", "Amanda", "Mason", "Andrew", "Christina", "Albert", "Wen", "Benson", "Linus"];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDateTime(value, language = "en") {
  return new Date(value).toLocaleString(language === "zh" ? "zh-TW" : undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function signedAmount(amount, status) {
  const absolute = Math.abs(Number(amount || 0));
  if (absolute === 0) return 0;
  return status === "lose" ? -absolute : absolute;
}

function createDraftRound(playerCount) {
  return {
    values: Array(playerCount).fill(0),
    statuses: Array(playerCount).fill("lose"),
  };
}

function normalizeRound(round, fallbackPlayers) {
  const players = round.players || fallbackPlayers;
  return {
    id: round.id || createId(),
    players: [...players],
    values: players.map((_, index) => Number(round.values?.[index] || 0)),
    statuses: players.map((_, index) =>
      round.statuses?.[index] || (Number(round.values?.[index] || 0) >= 0 ? "win" : "lose")
    ),
  };
}

function roundSum(round) {
  return round.values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function hasAnyAmount(round) {
  return round.values.some((value) => Math.abs(Number(value || 0)) > 0);
}

function calculateTotals(basePlayers, rounds) {
  const totals = {};
  basePlayers.forEach((player) => {
    totals[player] = totals[player] || 0;
  });
  rounds.forEach((round) => {
    const roundPlayers = round.players || basePlayers;
    round.values.forEach((value, index) => {
      const player = roundPlayers[index] || `Player ${index + 1}`;
      totals[player] = (totals[player] || 0) + Number(value || 0);
    });
  });
  return Object.entries(totals).map(([player, total]) => ({ player, total }));
}

function totalsToArray(players, totalsByPlayer) {
  return players.map((player) => totalsByPlayer.find((item) => item.player === player)?.total || 0);
}

function calculateSettlements(players, totals) {
  const normalizedTotals = totals.map((item, index) =>
    typeof item === "number" ? { player: players[index], total: item } : item
  );
  const debtors = [];
  const creditors = [];

  normalizedTotals.forEach((item) => {
    if (item.total < 0) debtors.push({ player: item.player, amount: Math.abs(item.total) });
    if (item.total > 0) creditors.push({ player: item.player, amount: item.total });
  });

  const payments = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    if (amount > 0) {
      payments.push({
        from: debtors[debtorIndex].player,
        to: creditors[creditorIndex].player,
        amount,
      });
    }
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount <= 0.000001) debtorIndex += 1;
    if (creditors[creditorIndex].amount <= 0.000001) creditorIndex += 1;
  }

  return payments;
}

function getTopResult(players, totals) {
  const normalizedTotals = totals.map((item, index) =>
    typeof item === "number" ? { player: players[index], total: item } : item
  );
  if (normalizedTotals.length === 0) return null;
  let best = normalizedTotals[0];
  let worst = normalizedTotals[0];
  normalizedTotals.forEach((item) => {
    if (item.total > best.total) best = item;
    if (item.total < worst.total) worst = item;
  });
  return {
    winner: best.player,
    winnerAmount: best.total,
    loser: worst.player,
    loserAmount: worst.total,
  };
}

function getMyPayments(settlements, userName) {
  return settlements.filter((payment) => payment.from === userName || payment.to === userName);
}

function describeMyPayment(payment, userName, language = "en") {
  if (payment.from === userName) {
    return { direction: language === "zh" ? "支付" : "PAY", person: payment.to, amount: payment.amount, color: "#fca5a5" };
  }
  return { direction: language === "zh" ? "收款" : "RECEIVE", person: payment.from, amount: payment.amount, color: "#86efac" };
}

function buildOutputText(payments, startedAt, language = "en") {
  if (!payments || payments.length === 0) {
    return language === "zh" ? "麻將結算：\n無需付款。" : "Mahjong result:\nNo payments needed.";
  }
  const lines = payments.map((payment) =>
    language === "zh"
      ? `${payment.from} 付給 ${payment.to}：${formatMoney(payment.amount)}`
      : `${payment.from} pays ${payment.to}: ${formatMoney(payment.amount)}`
  );
  const title = language === "zh"
    ? `麻將結算 - ${formatDateTime(startedAt, language)}`
    : `Mahjong result - ${formatDateTime(startedAt, language)}`;
  return [title, ...lines].join("\n");
}

const uiText = {
  en: {
    appTitle: "Settlement",
    eyebrow: "Mahjong",
    headerHint: "Choose which seat is you." ,
    setMe: "Set as Me",
    meBadge: "ME",
    rounds: "Rounds",
    round: "Round",
    me: "Me",
    players: "Players",
    playersHint: "Choose 4 players with bubbles, then place them around the table.",
    delete: "Delete",
    currentRound: "Current Round",
    total: "Total",
    needsZero: "needs 0",
    clear: "Clear",
    win: "WIN",
    lose: "LOSE",
    savedRounds: "Saved Rounds",
    noSavedRounds: "No saved rounds yet.",
    calculatedResult: "Calculated Result",
    saveMatch: "Save Match",
    previewHint: "Preview auto-saves the current balanced round.",
    saveFirst: "Save at least one round first.",
    notBalanced: "Saved rounds are not balanced.",
    noPayments: "No payments needed.",
    output: "Output",
    outputHint: "Tap copy, then paste in your group chat.",
    copy: "Copy",
    outputEmpty: "Save rounds first, then preview/output.",
    outputNotBalanced: "Saved rounds are not balanced yet.",
    myPaymentHistory: "My Payment History",
    myPayHint: "Only showing {name}'s payments",
    currentMatch: "Current Match",
    noPaymentForYou: "No payment for you.",
    noSavedMatches: "No saved matches yet.",
    payVerb: "Pay",
    receiveVerb: "Receive",
    undo: "Undo",
    previewSettlement: "Preview Settlement",
    saved: "Saved",
    myPay: "My Pay",
    copied: "Copied result text",
    copyNotSupported: "Copy not supported here. Long press the text to copy.",
    copyFailed: "Copy failed. Long press the text to copy.",
    roundNotBalanced: "Round not balanced",
    enterAmounts: "Enter amounts before saving",
    roundDeleted: "Round deleted",
    clearedCurrentRound: "Cleared current round",
    currentRoundNotBalanced: "Current round not balanced",
    currentRoundAutoSaved: "Current round auto-saved",
    undoRestoredCurrentRound: "Undo: restored current round",
    undoRestoredDeletedRound: "Undo: restored deleted round",
    undoRestoredUnsavedRound: "Undo: restored unsaved round",
    matchSaved: "Match saved",
    tableSeats: "Mahjong Table",
    tableHint: "Drag a player to a seat, or tap a name then tap a seat.",
    tablePool: "Player bubbles",
    tableApply: "Use seating order",
    customName: "Custom name",
    addCustom: "Add",
    selected: "Selected",
    seatEast: "East",
    seatSouth: "South",
    seatWest: "West",
    seatNorth: "North",
    emptySeat: "Empty",
    table: "TABLE",
  },
  zh: {
    appTitle: "結算",
    eyebrow: "麻將",
    headerHint: "請選擇哪個座位是你。",
    setMe: "設為我",
    meBadge: "我",
    rounds: "局數",
    round: "本局",
    me: "我",
    players: "玩家",
    playersHint: "用名字泡泡選 4 位玩家，然後放到麻將桌座位。",
    delete: "刪除",
    currentRound: "目前這局",
    total: "合計",
    needsZero: "需為 0",
    clear: "清除",
    win: "贏",
    lose: "輸",
    savedRounds: "已儲存局數",
    noSavedRounds: "尚未儲存任何局。",
    calculatedResult: "預覽結果",
    saveMatch: "儲存比賽",
    previewHint: "預覽會自動儲存目前已平衡的局。",
    saveFirst: "請先儲存至少一局。",
    notBalanced: "已儲存局數尚未平衡。",
    noPayments: "無需付款。",
    output: "輸出",
    outputHint: "點擊複製後，可貼到群組。",
    copy: "複製",
    outputEmpty: "請先儲存局數，再預覽／輸出。",
    outputNotBalanced: "已儲存局數尚未平衡。",
    myPaymentHistory: "我的付款紀錄",
    myPayHint: "只顯示 {name} 相關付款",
    currentMatch: "目前比賽",
    noPaymentForYou: "你沒有需要付款或收款。",
    noSavedMatches: "尚無儲存比賽。",
    payVerb: "付給",
    receiveVerb: "收款自",
    undo: "復原",
    previewSettlement: "預覽結算",
    saved: "已存",
    myPay: "我的付款",
    copied: "已複製結算文字",
    copyNotSupported: "此環境不支援自動複製，請長按文字複製。",
    copyFailed: "複製失敗，請長按文字複製。",
    roundNotBalanced: "本局尚未平衡",
    enterAmounts: "請先輸入金額",
    roundDeleted: "已刪除該局",
    clearedCurrentRound: "已清除目前這局",
    currentRoundNotBalanced: "目前這局尚未平衡",
    currentRoundAutoSaved: "目前這局已自動儲存",
    undoRestoredCurrentRound: "復原：已恢復目前這局",
    undoRestoredDeletedRound: "復原：已恢復刪除的局",
    undoRestoredUnsavedRound: "復原：已恢復未儲存的局",
    matchSaved: "比賽已儲存",
    tableSeats: "麻將桌座位",
    tableHint: "可拖曳玩家到座位，或先點名字再點座位。",
    tablePool: "玩家泡泡",
    tableApply: "套用座位順序",
    customName: "自訂名字",
    addCustom: "新增",
    selected: "已選",
    seatEast: "東",
    seatSouth: "南",
    seatWest: "西",
    seatNorth: "北",
    emptySeat: "空位",
    table: "麻將桌",
  },
};

function runSettlementTests() {
  const players = ["A", "B", "C", "D"];
  const testOneRounds = [{ players, values: [-50, -50, 100, 0] }];
  const testOneTotals = calculateTotals(players, testOneRounds);
  const testOnePayments = calculateSettlements(players, testOneTotals);
  console.assert(JSON.stringify(totalsToArray(players, testOneTotals)) === JSON.stringify([-50, -50, 100, 0]), "Test 1 totals failed");
  console.assert(testOnePayments.length === 2, "Test 1 payment count failed");
  console.assert(testOnePayments[0].from === "A" && testOnePayments[0].to === "C" && testOnePayments[0].amount === 50, "Test 1 first payment failed");
  console.assert(testOnePayments[1].from === "B" && testOnePayments[1].to === "C" && testOnePayments[1].amount === 50, "Test 1 second payment failed");

  const testTwoRounds = [
    { players, values: [100, -30, -70, 0] },
    { players, values: [-20, 50, -30, 0] },
  ];
  const testTwoTotals = calculateTotals(players, testTwoRounds);
  const testTwoPayments = calculateSettlements(players, testTwoTotals);
  console.assert(JSON.stringify(totalsToArray(players, testTwoTotals)) === JSON.stringify([80, 20, -100, 0]), "Test 2 totals failed");
  console.assert(testTwoPayments.length === 2, "Test 2 payment count failed");
  console.assert(testTwoPayments[0].from === "C" && testTwoPayments[0].to === "A" && testTwoPayments[0].amount === 80, "Test 2 first payment failed");
  console.assert(testTwoPayments[1].from === "C" && testTwoPayments[1].to === "B" && testTwoPayments[1].amount === 20, "Test 2 second payment failed");

  console.assert(signedAmount(50, "win") === 50, "Win sign test failed");
  console.assert(signedAmount(50, "lose") === -50, "Lose sign test failed");
  console.assert(signedAmount(-50, "win") === 50, "Absolute amount win test failed");
  console.assert(signedAmount(-50, "lose") === -50, "Absolute amount lose test failed");

  const mixedRounds = [
    { players: ["A", "B", "C", "D"], values: [100, -50, -50, 0] },
    { players: ["A", "E", "F", "G"], values: [-30, 30, 0, 0] },
  ];
  const mixedTotals = calculateTotals(["A", "B", "C", "D"], mixedRounds);
  console.assert(mixedTotals.find((item) => item.player === "A").total === 70, "Mixed A total failed");
  console.assert(mixedTotals.find((item) => item.player === "E").total === 30, "Mixed E total failed");

  const outputText = buildOutputText([{ from: "B", to: "A", amount: 50 }], "2026-04-28T12:00:00+08:00");
  console.assert(outputText.includes("B pays A: 50") && outputText.includes("\n"), "Output text test failed");
  const zhOutputText = buildOutputText([{ from: "B", to: "A", amount: 50 }], "2026-04-28T12:00:00+08:00", "zh");
  console.assert(zhOutputText.includes("B 付給 A：50") && zhOutputText.includes("\n"), "Chinese output text test failed");

  const pool = [...NAME_POOL, "Custom"];
  console.assert(pool.includes("Leo") && pool.includes("Linus") && pool.includes("Custom"), "Name bubble pool test failed");
}

runSettlementTests();

export default function MahjongSettlementMobileApp() {
  const [players, setPlayers] = useState(["Leo", "Amanda", "Mason", "Andrew"]);
  const [customName, setCustomName] = useState("");
  const [gameStartedAt, setGameStartedAt] = useState(new Date().toISOString());
  const [draftRound, setDraftRound] = useState(createDraftRound(4));
  const [savedRounds, setSavedRounds] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("players");
  const [message, setMessage] = useState("");
  const [showRoundOutput, setShowRoundOutput] = useState(false);
  const [undoState, setUndoState] = useState(null);
  const [language, setLanguage] = useState("en");
  const [seatPlayers, setSeatPlayers] = useState(["Leo", "Amanda", "Mason", "Andrew"]);
  const [selectedSeatPlayer, setSelectedSeatPlayer] = useState(null);
  const [mePlayer, setMePlayer] = useState("Leo");
  const [extraNames, setExtraNames] = useState([]);

  const txt = uiText[language];
  const userName = mePlayer || players[0] || "Player 1";
  const availableNames = useMemo(() => [...NAME_POOL, ...extraNames.filter((name) => !NAME_POOL.includes(name))], [extraNames]);
  const normalizedDraft = useMemo(() => normalizeRound({ ...draftRound, players }, players), [draftRound, players]);
  const normalizedSavedRounds = useMemo(() => savedRounds.map((round) => normalizeRound(round, round.players || players)), [savedRounds, players]);
  const draftTotal = roundSum(normalizedDraft);
  const finalTotals = useMemo(() => calculateTotals(players, normalizedSavedRounds), [players, normalizedSavedRounds]);
  const finalBalance = finalTotals.reduce((sum, item) => sum + item.total, 0);
  const settlements = useMemo(() => calculateSettlements(players, finalTotals), [players, finalTotals]);
  const myPayments = useMemo(() => getMyPayments(settlements, userName), [settlements, userName]);
  const canFinalize = savedRounds.length > 0 && Math.abs(finalBalance) < 0.000001;
  const seatLabels = useMemo(() => [txt.seatEast, txt.seatSouth, txt.seatWest, txt.seatNorth], [txt]);
  const outputText = useMemo(() => buildOutputText(settlements, gameStartedAt, language), [settlements, gameStartedAt, language]);

  const styles = {
    page: { minHeight: "100vh", background: "#111", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#171717" },
    phone: { height: "100vh", maxWidth: 430, margin: "0 auto", background: "#f5f5f4", overflow: "hidden", boxShadow: "0 0 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" },
    headerWrap: { background: "#f5f5f4", padding: "10px 12px 8px", flex: "0 0 auto" },
    header: { background: "#171717", color: "white", borderRadius: 20, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" },
    headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    eyebrow: { margin: 0, fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "#a3a3a3" },
    title: { margin: "2px 0 0", fontSize: 21, fontWeight: 850, letterSpacing: -0.7 },
    hint: { margin: "3px 0 0", fontSize: 11, color: "#d4d4d4" },
    iconButton: { border: 0, borderRadius: 15, background: "rgba(255,255,255,0.12)", color: "white", minWidth: 42, minHeight: 42, fontSize: 18, cursor: "pointer" },
    languageToggle: { display: "flex", alignItems: "center", gap: 4, border: 0, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "white", height: 42, padding: 4, cursor: "pointer" },
    languageToggleOption: { minWidth: 32, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 },
    statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 9 },
    stat: { background: "rgba(255,255,255,0.1)", borderRadius: 13, padding: "7px 8px" },
    statLabel: { color: "#a3a3a3", fontSize: 10, marginBottom: 2 },
    statValue: { fontSize: 17, fontWeight: 900, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    main: { flex: "1 1 auto", overflow: "hidden", padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 8 },
    card: { background: "white", borderRadius: 20, padding: 11, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    button: { border: 0, borderRadius: 15, background: "#171717", color: "white", minHeight: 38, padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
    secondaryButton: { border: "1px solid #d4d4d4", borderRadius: 15, background: "white", color: "#171717", minHeight: 38, padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
    dangerButton: { border: 0, borderRadius: 14, background: "#fee2e2", color: "#b91c1c", minHeight: 34, padding: "0 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
    input: { width: "100%", height: 40, border: "1px solid #e5e5e5", borderRadius: 15, background: "#fafafa", padding: "0 12px", fontSize: 15, outline: "none", boxSizing: "border-box" },
    numberInput: { width: "100%", height: 42, border: "1px solid rgba(255,255,255,0.7)", borderRadius: 14, background: "rgba(255,255,255,0.94)", padding: "0 8px", fontSize: 21, fontWeight: 900, textAlign: "center", outline: "none", boxSizing: "border-box" },
    playerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 },
    roundPlayerBox: { borderRadius: 17, padding: 8, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", border: "2px solid transparent", boxSizing: "border-box" },
    statusPill: { display: "inline-flex", justifyContent: "center", alignItems: "center", minWidth: 48, height: 20, borderRadius: 999, fontSize: 10, fontWeight: 900, color: "white", marginTop: 3 },
    compactScroll: { flex: "1 1 auto", overflow: "auto", display: "grid", gap: 8, alignContent: "start" },
    paymentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    paymentBox: { background: "#171717", color: "white", borderRadius: 16, padding: 10, minHeight: 82, boxSizing: "border-box" },
    outputBox: { background: "#171717", color: "white", borderRadius: 16, padding: 12, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", userSelect: "text" },
    smallPaymentBox: { background: "#171717", color: "white", borderRadius: 14, padding: 9, boxSizing: "border-box" },
    savedRoundMini: { background: "#fafafa", borderRadius: 14, padding: 9, border: "1px solid #eeeeee" },
    footer: { flex: "0 0 auto", background: "rgba(245,245,244,0.96)", padding: "8px 12px 12px", boxSizing: "border-box" },
    footerActions: { display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 8, marginBottom: 8 },
    nav: { display: "flex", gap: 7, background: "white", borderRadius: 22, padding: 7, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
    navButton: { flex: 1, border: 0, borderRadius: 16, padding: "7px 2px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" },
    tableWrap: { marginTop: 12, background: "#fafafa", borderRadius: 18, padding: 10, border: "1px solid #eeeeee" },
    tableGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "70px 70px 70px", gap: 8, alignItems: "center", justifyItems: "center", marginTop: 10 },
    tableCenter: { gridColumn: "2", gridRow: "2", width: 86, height: 58, borderRadius: 18, background: "#171717", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, textAlign: "center" },
    seatBox: { width: "100%", minHeight: 62, borderRadius: 16, border: "2px dashed #d4d4d4", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 6, boxSizing: "border-box", cursor: "pointer" },
    pool: { display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 },
    poolChip: { border: "1px solid #d4d4d4", borderRadius: 999, background: "white", color: "#171717", padding: "8px 10px", fontSize: 12, fontWeight: 800, cursor: "grab" },
  };

  function addCustomName() {
    const name = customName.trim();
    if (!name) return;
    if (!availableNames.includes(name)) setExtraNames((current) => [...current, name]);
    setSelectedSeatPlayer(name);
    setCustomName("");
  }

  function assignPlayerToSeat(playerName, seatIndex) {
    if (!playerName) return;
    setSeatPlayers((current) => {
      const next = [...current];
      const oldIndex = next.indexOf(playerName);
      if (oldIndex >= 0) {
        const previousSeatValue = next[seatIndex];
        next[oldIndex] = previousSeatValue;
      }
      next[seatIndex] = playerName;
      return next;
    });
    setSelectedSeatPlayer(null);
  }

  function handleSeatClick(seatIndex) {
    if (selectedSeatPlayer) {
      assignPlayerToSeat(selectedSeatPlayer, seatIndex);
      return;
    }
    setSelectedSeatPlayer(seatPlayers[seatIndex]);
  }

  function applySeatingOrder() {
    const nextPlayers = seatPlayers.filter(Boolean).slice(0, 4);
    if (nextPlayers.length !== 4) return;
    setPlayers(nextPlayers);
    if (!nextPlayers.includes(mePlayer)) setMePlayer(nextPlayers[0]);
    setDraftRound(createDraftRound(nextPlayers.length));
    setMessage(language === "zh" ? "已套用座位順序" : "Seating order applied");
    setActiveTab("round");
  }

  function toggleDraftStatus(playerIndex) {
    setDraftRound((current) => {
      const statuses = [...current.statuses];
      const values = [...current.values];
      const nextStatus = statuses[playerIndex] === "win" ? "lose" : "win";
      statuses[playerIndex] = nextStatus;
      values[playerIndex] = signedAmount(values[playerIndex], nextStatus);
      return { values, statuses };
    });
    setMessage("");
    setShowRoundOutput(false);
  }

  function updateDraftValue(playerIndex, value) {
    setDraftRound((current) => {
      const values = [...current.values];
      values[playerIndex] = value === "" ? "" : signedAmount(value, current.statuses[playerIndex]);
      return { ...current, values };
    });
    setMessage("");
    setShowRoundOutput(false);
  }

  function deleteSavedRound(id) {
    const deletedRound = savedRounds.find((round) => round.id === id);
    if (deletedRound) setUndoState({ type: "deleteRound", deletedRound });
    setSavedRounds((current) => current.filter((round) => round.id !== id));
    setMessage(txt.roundDeleted);
    setShowRoundOutput(false);
  }

  function clearDraft() {
    if (hasAnyAmount(normalizedDraft)) setUndoState({ type: "clearDraft", previousDraft: draftRound });
    setDraftRound(createDraftRound(players.length));
    setMessage(txt.clearedCurrentRound);
    setShowRoundOutput(false);
  }

  function calculateOnRoundPage() {
    const currentDraft = normalizeRound({ ...draftRound, players }, players);
    if (hasAnyAmount(currentDraft)) {
      const total = roundSum(currentDraft);
      if (Math.abs(total) >= 0.000001) {
        setMessage(`${txt.currentRoundNotBalanced}: ${formatMoney(total)}`);
        setShowRoundOutput(false);
        setActiveTab("round");
        return;
      }
      const roundToSave = { ...currentDraft, id: createId() };
      setUndoState({ type: "previewAutoSave", previousDraft: draftRound, savedRoundId: roundToSave.id });
      setSavedRounds((current) => [...current, roundToSave]);
      setDraftRound(createDraftRound(players.length));
      setMessage(txt.currentRoundAutoSaved);
    } else {
      setMessage("");
    }
    setShowRoundOutput(true);
    setActiveTab("round");
  }

  function undoLastAction() {
    if (!undoState) return;
    if (undoState.type === "clearDraft") {
      setDraftRound(undoState.previousDraft);
      setMessage(txt.undoRestoredCurrentRound);
    }
    if (undoState.type === "deleteRound") {
      setSavedRounds((current) => [...current, undoState.deletedRound]);
      setMessage(txt.undoRestoredDeletedRound);
    }
    if (undoState.type === "previewAutoSave") {
      setSavedRounds((current) => current.filter((round) => round.id !== undoState.savedRoundId));
      setDraftRound(undoState.previousDraft);
      setMessage(txt.undoRestoredUnsavedRound);
      setShowRoundOutput(false);
    }
    setUndoState(null);
  }

  async function copyOutputText() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(outputText);
        setMessage(txt.copied);
      } else {
        setMessage(txt.copyNotSupported);
      }
    } catch {
      setMessage(txt.copyFailed);
    }
  }

  function saveMatchToHistory() {
    if (savedRounds.length === 0) {
      setMessage(txt.saveFirst);
      return;
    }
    const match = {
      id: createId(),
      startedAt: gameStartedAt,
      endedAt: new Date().toISOString(),
      players: [...players],
      allPlayers: finalTotals.map((item) => item.player),
      userName,
      rounds: normalizedSavedRounds.map((round) => ({ ...round })),
      totals: finalTotals.map((item) => ({ ...item })),
      settlements: settlements.map((payment) => ({ ...payment })),
      myPayments: myPayments.map((payment) => ({ ...payment })),
    };
    setMatchHistory((current) => [match, ...current]);
    setSavedRounds([]);
    setDraftRound(createDraftRound(players.length));
    setGameStartedAt(new Date().toISOString());
    setActiveTab("pay");
    setMessage(txt.matchSaved);
    setShowRoundOutput(false);
    setUndoState(null);
  }

  function resetGame() {
    setDraftRound(createDraftRound(players.length));
    setSavedRounds([]);
    setGameStartedAt(new Date().toISOString());
    setActiveTab("players");
    setMePlayer(seatPlayers[0] || players[0] || "Leo");
    setMessage("");
    setShowRoundOutput(false);
    setUndoState(null);
  }

  function NavButton({ id, icon, label }) {
    const active = activeTab === id;
    return (
      <button onClick={() => setActiveTab(id)} style={{ ...styles.navButton, background: active ? "#171717" : "transparent", color: active ? "white" : "#737373" }}>
        <div style={{ fontSize: 15, lineHeight: 1 }}>{icon}</div>
        <div style={{ marginTop: 2 }}>{label}</div>
      </button>
    );
  }

  function PaymentCard({ payment, compact = false, personal = false, matchUser = userName }) {
    if (!personal) {
      return (
        <div style={compact ? styles.smallPaymentBox : styles.paymentBox}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{language === "zh" ? "支付" : "PAY"}</div>
          <div style={{ fontSize: compact ? 14 : 16, fontWeight: 900, margin: "4px 0", color: "#fca5a5" }}>{payment.from} → {payment.to}</div>
          <div style={{ fontSize: compact ? 18 : 20, fontWeight: 950 }}>{formatMoney(payment.amount)}</div>
        </div>
      );
    }
    const info = describeMyPayment(payment, matchUser, language);
    return (
      <div style={compact ? styles.smallPaymentBox : styles.paymentBox}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{info.direction}</div>
        <div style={{ fontSize: compact ? 14 : 16, fontWeight: 900, margin: "4px 0", color: info.color }}>{info.direction === (language === "zh" ? "支付" : "PAY") ? "→" : "←"} {info.person}</div>
        <div style={{ fontSize: compact ? 18 : 20, fontWeight: 950 }}>{formatMoney(info.amount)}</div>
      </div>
    );
  }

  function renderRoundPlayers(round) {
    const roundPlayers = round.players || players;
    return roundPlayers.slice(0, 4).map((player, playerIndex) => (
      <div key={`${player}-${playerIndex}`} style={{ color: round.values[playerIndex] >= 0 ? "#15803d" : "#dc2626", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {player}: {round.values[playerIndex] >= 0 ? "+" : ""}{formatMoney(round.values[playerIndex])}
      </div>
    ));
  }

  function NameBubble({ name }) {
    const isSelected = selectedSeatPlayer === name;
    const isSeated = seatPlayers.includes(name);
    return (
      <button
        draggable
        onDragStart={(event) => event.dataTransfer.setData("text/plain", name)}
        onClick={() => setSelectedSeatPlayer(isSelected ? null : name)}
        style={{ ...styles.poolChip, background: isSelected ? "#171717" : isSeated ? "#e5e7eb" : "white", color: isSelected ? "white" : "#171717" }}
      >
        {name}
      </button>
    );
  }

  function TableSeating() {
    const positions = [
      { gridColumn: "2", gridRow: "1" },
      { gridColumn: "3", gridRow: "2" },
      { gridColumn: "2", gridRow: "3" },
      { gridColumn: "1", gridRow: "2" },
    ];
    return (
      <div style={styles.tableWrap}>
        <div style={styles.row}>
          <div>
            <strong style={{ fontSize: 14 }}>{txt.tableSeats}</strong>
            <p style={{ margin: "3px 0 0", color: "#737373", fontSize: 12 }}>{txt.tableHint}</p>
          </div>
          <button onClick={applySeatingOrder} style={{ ...styles.button, minHeight: 34 }}>{txt.tableApply}</button>
        </div>
        <div style={styles.tableGrid}>
          {[0, 1, 2, 3].map((seatIndex) => (
            <div
              key={seatIndex}
              onClick={() => handleSeatClick(seatIndex)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => assignPlayerToSeat(event.dataTransfer.getData("text/plain"), seatIndex)}
              style={{ ...styles.seatBox, ...positions[seatIndex], borderColor: selectedSeatPlayer ? "#171717" : "#d4d4d4" }}
            >
              <div style={{ fontSize: 11, color: "#737373", marginBottom: 3 }}>{seatLabels[seatIndex]}</div>
              <strong style={{ fontSize: 13, textAlign: "center" }}>{seatPlayers[seatIndex] || txt.emptySeat}</strong>
              {seatPlayers[seatIndex] === mePlayer && (
                <span style={{ marginTop: 4, background: "#171717", color: "white", borderRadius: 999, padding: "2px 7px", fontSize: 10, fontWeight: 900 }}>{txt.meBadge}</span>
              )}
              {seatPlayers[seatIndex] && seatPlayers[seatIndex] !== mePlayer && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setMePlayer(seatPlayers[seatIndex]);
                  }}
                  style={{ marginTop: 4, border: 0, borderRadius: 999, background: "#e5e7eb", color: "#171717", padding: "3px 7px", fontSize: 10, fontWeight: 900, cursor: "pointer" }}
                >
                  {txt.setMe}
                </button>
              )}
            </div>
          ))}
          <div style={styles.tableCenter}>{txt.table}</div>
        </div>
      </div>
    );
  }

  function PlayerSetupPage() {
    return (
      <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}>
        <div style={{ ...styles.row, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{txt.players}</h2>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#737373" }}>{txt.playersHint}</p>
        <div style={{ background: "#171717", color: "white", borderRadius: 15, padding: 9, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
          {txt.me}: {mePlayer}
        </div>

        <div style={{ marginTop: 8 }}>
          <strong style={{ fontSize: 13 }}>{txt.tablePool}</strong>
          <div style={styles.pool}>{availableNames.map((name) => <NameBubble key={name} name={name} />)}</div>
          {selectedSeatPlayer && <div style={{ marginTop: 8, fontSize: 12, color: "#737373" }}>{txt.selected}: <strong>{selectedSeatPlayer}</strong></div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginTop: 8 }}>
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={txt.customName} style={styles.input} />
            <button onClick={addCustomName} style={styles.button}>{txt.addCustom}</button>
          </div>
        </div>

        <TableSeating />
      </section>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.phone}>
        <div style={styles.headerWrap}>
          <div style={styles.header}>
            <div style={styles.headerTop}>
              <div>
                <p style={styles.eyebrow}>{txt.eyebrow}</p>
                <h1 style={styles.title}>{txt.appTitle}</h1>
                <p style={styles.hint}>{formatDateTime(gameStartedAt, language)} · {txt.headerHint}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setLanguage(language === "en" ? "zh" : "en")} style={styles.languageToggle} aria-label="Toggle language">
                  <span style={{ ...styles.languageToggleOption, background: language === "en" ? "white" : "transparent", color: language === "en" ? "#171717" : "#d4d4d4" }}>EN</span>
                  <span style={{ ...styles.languageToggleOption, background: language === "zh" ? "white" : "transparent", color: language === "zh" ? "#171717" : "#d4d4d4" }}>CN</span>
                </button>
                <button onClick={resetGame} style={styles.iconButton}>↻</button>
              </div>
            </div>
            <div style={styles.statGrid}>
              <div style={styles.stat}><div style={styles.statLabel}>{txt.rounds}</div><div style={styles.statValue}>{savedRounds.length}</div></div>
              <div style={styles.stat}><div style={styles.statLabel}>{txt.round}</div><div style={{ ...styles.statValue, color: Math.abs(draftTotal) < 0.000001 ? "#86efac" : "#fca5a5" }}>{formatMoney(draftTotal)}</div></div>
              <div style={styles.stat}><div style={styles.statLabel}>{txt.me}</div><div style={styles.statValue}>{userName}</div></div>
            </div>
          </div>
        </div>

        <main style={styles.main}>
          {activeTab === "players" && <PlayerSetupPage />}

          {activeTab === "round" && (
            <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}>
              <div style={styles.row}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{txt.currentRound}</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: Math.abs(draftTotal) < 0.000001 ? "#15803d" : "#dc2626" }}>
                    {txt.total} {formatMoney(draftTotal)} {Math.abs(draftTotal) < 0.000001 ? "✓" : txt.needsZero}
                  </p>
                </div>
                <button onClick={clearDraft} style={styles.secondaryButton}>{txt.clear}</button>
              </div>

              <div style={styles.playerGrid}>
                {players.slice(0, 4).map((player, playerIndex) => {
                  const status = normalizedDraft.statuses[playerIndex] || "lose";
                  const isWin = status === "win";
                  const amount = Math.abs(Number(normalizedDraft.values[playerIndex] || 0));
                  return (
                    <div key={`${player}-${playerIndex}`} onClick={() => toggleDraftStatus(playerIndex)} style={{ ...styles.roundPlayerBox, background: isWin ? "#dcfce7" : "#fee2e2", borderColor: isWin ? "#86efac" : "#fca5a5" }} role="button" tabIndex={0}>
                      <div style={{ marginBottom: 7, textAlign: "center" }}>
                        <strong style={{ display: "block", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player}</strong>
                        <span style={{ ...styles.statusPill, background: isWin ? "#16a34a" : "#dc2626" }}>{isWin ? txt.win : txt.lose}</span>
                      </div>
                      <input type="text" inputMode="decimal" value={amount || ""} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onChange={(event) => updateDraftValue(playerIndex, event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" style={styles.numberInput} />
                    </div>
                  );
                })}
              </div>

              {message && (
                <div style={{ marginTop: 8, borderRadius: 15, padding: 9, fontSize: 13, background: /not|Enter|least|failed|尚未|請先/i.test(message) ? "#fef2f2" : "#ecfdf5", color: /not|Enter|least|failed|尚未|請先/i.test(message) ? "#b91c1c" : "#15803d" }}>{message}</div>
              )}

              <div style={{ marginTop: 10 }}>
                <div style={styles.row}>
                  <strong style={{ fontSize: 15 }}>{txt.savedRounds}</strong>
                  <span style={{ fontSize: 12, color: "#737373" }}>{savedRounds.length} {txt.rounds}</span>
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 7, maxHeight: 130, overflow: "auto" }}>
                  {normalizedSavedRounds.length === 0 ? (
                    <div style={{ background: "#fafafa", borderRadius: 14, padding: 9, color: "#737373", fontSize: 12 }}>{txt.noSavedRounds}</div>
                  ) : normalizedSavedRounds.map((round, roundIndex) => (
                    <div key={round.id} style={styles.savedRoundMini}>
                      <div style={styles.row}>
                        <strong style={{ fontSize: 13 }}>{txt.round} {roundIndex + 1}</strong>
                        <button onClick={() => deleteSavedRound(round.id)} style={{ ...styles.dangerButton, minHeight: 28, fontSize: 11 }}>{txt.delete}</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 5, fontSize: 11 }}>{renderRoundPlayers(round)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {showRoundOutput && (
                <div style={{ marginTop: 10 }}>
                  <div style={styles.row}>
                    <strong style={{ fontSize: 15 }}>{txt.calculatedResult}</strong>
                    <button onClick={saveMatchToHistory} disabled={!canFinalize} style={{ ...styles.button, minHeight: 34, opacity: canFinalize ? 1 : 0.4 }}>{txt.saveMatch}</button>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#737373" }}>{txt.previewHint}</p>
                  {savedRounds.length === 0 ? (
                    <div style={{ marginTop: 8, background: "#fafafa", color: "#737373", borderRadius: 15, padding: 9, fontSize: 13 }}>{txt.saveFirst}</div>
                  ) : Math.abs(finalBalance) >= 0.000001 ? (
                    <div style={{ marginTop: 8, background: "#fef2f2", color: "#b91c1c", borderRadius: 15, padding: 9, fontSize: 13 }}>{txt.notBalanced}</div>
                  ) : settlements.length === 0 ? (
                    <div style={{ marginTop: 8, background: "#fafafa", color: "#737373", borderRadius: 15, padding: 9, fontSize: 13 }}>{txt.noPayments}</div>
                  ) : (
                    <div style={{ ...styles.paymentGrid, marginTop: 8 }}>{settlements.map((payment, index) => <PaymentCard key={`${payment.from}-${payment.to}-${index}`} payment={payment} compact personal={false} />)}</div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === "saved" && (
            <section style={{ ...styles.card, flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ ...styles.row, marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{txt.savedRounds}</h2>
                <span style={{ fontSize: 13, color: "#737373" }}>{savedRounds.length} {txt.rounds}</span>
              </div>
              <div style={styles.compactScroll}>
                {normalizedSavedRounds.length === 0 ? (
                  <div style={{ background: "#fafafa", borderRadius: 16, padding: 12, color: "#737373", fontSize: 13 }}>{txt.noSavedRounds}</div>
                ) : normalizedSavedRounds.map((round, roundIndex) => (
                  <div key={round.id} style={{ background: "#fafafa", borderRadius: 16, padding: 10 }}>
                    <div style={styles.row}>
                      <strong>{txt.round} {roundIndex + 1}</strong>
                      <button onClick={() => deleteSavedRound(round.id)} style={styles.dangerButton}>{txt.delete}</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 7, fontSize: 12 }}>{renderRoundPlayers(round)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "output" && (
            <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}>
              <div style={{ ...styles.row, marginBottom: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{txt.output}</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#737373" }}>{txt.outputHint}</p>
                </div>
                <button onClick={copyOutputText} style={styles.button}>{txt.copy}</button>
              </div>
              {savedRounds.length === 0 ? (
                <div style={{ background: "#fafafa", color: "#737373", borderRadius: 16, padding: 12, fontSize: 13 }}>{txt.outputEmpty}</div>
              ) : Math.abs(finalBalance) >= 0.000001 ? (
                <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 16, padding: 12, fontSize: 13 }}>{txt.outputNotBalanced}</div>
              ) : (
                <div onClick={copyOutputText} style={styles.outputBox}>{outputText}</div>
              )}
            </section>
          )}

          {activeTab === "pay" && (
            <section style={{ ...styles.card, flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ ...styles.row, marginBottom: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{txt.myPaymentHistory}</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#737373" }}>{txt.myPayHint.replace("{name}", userName)}</p>
                </div>
                <button onClick={saveMatchToHistory} style={styles.button}>{txt.saveMatch}</button>
              </div>
              <div style={styles.compactScroll}>
                {savedRounds.length > 0 && (
                  <div style={{ background: "#fafafa", borderRadius: 16, padding: 10 }}>
                    <strong style={{ fontSize: 14 }}>{txt.currentMatch}</strong>
                    <div style={{ marginTop: 8 }}>
                      {Math.abs(finalBalance) >= 0.000001 ? (
                        <div style={{ color: "#b91c1c", fontSize: 13 }}>{txt.notBalanced}</div>
                      ) : myPayments.length === 0 ? (
                        <div style={{ color: "#737373", fontSize: 13 }}>{txt.noPaymentForYou}</div>
                      ) : (
                        <div style={styles.paymentGrid}>{myPayments.map((payment, index) => <PaymentCard key={`${payment.from}-${payment.to}-${index}`} payment={payment} compact personal />)}</div>
                      )}
                    </div>
                  </div>
                )}
                {matchHistory.length === 0 ? (
                  <div style={{ background: "#fafafa", borderRadius: 16, padding: 12, color: "#737373", fontSize: 13 }}>{txt.noSavedMatches}</div>
                ) : matchHistory.map((match) => {
                  const matchUser = match.userName || match.players[0];
                  const relevant = getMyPayments(match.settlements || [], matchUser);
                  return (
                    <div key={match.id} style={{ background: "#171717", color: "white", borderRadius: 18, padding: 12 }}>
                      <div style={styles.row}>
                        <strong>{formatDateTime(match.startedAt, language)}</strong>
                        <span style={{ fontSize: 12, color: "#a3a3a3" }}>{match.rounds.length} {txt.rounds}</span>
                      </div>
                      {relevant.length === 0 ? (
                        <div style={{ marginTop: 8, color: "#a3a3a3", fontSize: 13 }}>{txt.noPaymentForYou}</div>
                      ) : (
                        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          {relevant.map((payment, index) => {
                            const info = describeMyPayment(payment, matchUser, language);
                            const isPay = info.direction === (language === "zh" ? "支付" : "PAY");
                            return (
                              <div key={`${payment.from}-${payment.to}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: info.color }}>
                                <span>{isPay ? txt.payVerb : txt.receiveVerb} {info.person}</span>
                                <strong>{formatMoney(info.amount)}</strong>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <footer style={styles.footer}>
          <div style={styles.footerActions}>
            <button onClick={undoLastAction} disabled={!undoState} style={{ ...styles.secondaryButton, opacity: undoState ? 1 : 0.4 }}>{txt.undo}</button>
            <button onClick={calculateOnRoundPage} style={styles.button}>{txt.previewSettlement}</button>
          </div>
          <nav style={styles.nav}>
            <NavButton id="players" icon="👥" label={txt.players} />
            <NavButton id="round" icon="🀄" label={txt.round} />
            <NavButton id="saved" icon="🧾" label={txt.saved} />
            <NavButton id="output" icon="📋" label={txt.output} />
            <NavButton id="pay" icon="💰" label={txt.myPay} />
          </nav>
        </footer>
      </div>
    </div>
  );
}
