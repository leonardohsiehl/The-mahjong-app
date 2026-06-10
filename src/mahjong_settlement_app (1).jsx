import React, { useEffect, useMemo, useState } from "react";

const NAME_POOL = ["Leo", "Amanda", "Mason", "Andrew", "Christina", "Albert", "Wen", "Benson", "Linus"];
const STORAGE_KEY = "mahjong_settlement_v6";
const LOST_ALL_AMOUNT = 1150;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function dateTime(value, language = "en") {
  return new Date(value).toLocaleString(language === "zh" ? "zh-TW" : undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function signedAmount(rawAmount, status) {
  const absolute = Math.abs(Number(rawAmount || 0));
  if (!absolute) return 0;
  return status === "lose" ? -absolute : absolute;
}

function newDraft(count = 4) {
  return {
    values: Array(count).fill(0),
    statuses: Array(count).fill("lose"),
  };
}

function normalizeRound(round, players) {
  const roundPlayers = round.players || players;
  return {
    id: round.id || createId(),
    players: [...roundPlayers],
    values: roundPlayers.map((_, index) => Number(round.values?.[index] || 0)),
    statuses: roundPlayers.map((_, index) => round.statuses?.[index] || "lose"),
  };
}

function roundTotal(round) {
  return round.values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function hasAmount(round) {
  return round.values.some((value) => Math.abs(Number(value || 0)) > 0);
}

function calculateTotals(rounds) {
  const totals = {};
  rounds.forEach((round) => {
    round.players.forEach((player, index) => {
      totals[player] = (totals[player] || 0) + Number(round.values[index] || 0);
    });
  });
  return Object.entries(totals).map(([player, total]) => ({ player, total }));
}

function mergeDirectDebts(payments, directDebts = []) {
  const merged = {};
  [...payments, ...directDebts].forEach((payment) => {
    if (!payment?.from || !payment?.to || Number(payment.amount || 0) <= 0) return;
    const key = `${payment.from}__${payment.to}`;
    merged[key] = {
      from: payment.from,
      to: payment.to,
      amount: (merged[key]?.amount || 0) + Number(payment.amount || 0),
    };
  });
  return Object.values(merged);
}

function applyDirectDebtsToTotals(totals, directDebts = []) {
  const adjusted = {};

  totals.forEach((item) => {
    adjusted[item.player] = Number(item.total || 0);
  });

  directDebts.forEach((debt) => {
    if (!debt?.from || !debt?.to || Number(debt.amount || 0) <= 0) return;
    adjusted[debt.from] = (adjusted[debt.from] || 0) - Number(debt.amount || 0);
    adjusted[debt.to] = (adjusted[debt.to] || 0) + Number(debt.amount || 0);
  });

  return Object.entries(adjusted).map(([player, total]) => ({ player, total }));
}

function calculateSettlements(totals) {
  const debtors = [];
  const creditors = [];

  totals.forEach((item) => {
    if (item.total < 0) debtors.push({ player: item.player, amount: Math.abs(item.total) });
    if (item.total > 0) creditors.push({ player: item.player, amount: item.total });
  });

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

function makeMatch(round, directDebts = []) {
  const tableTotals = calculateTotals([round]);
  const baseSettlements = calculateSettlements(tableTotals);
  const adjustedTotals = applyDirectDebtsToTotals(tableTotals, directDebts);

  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    players: [...round.players],
    round: { ...round },
    tableTotals,
    totals: adjustedTotals,
    directDebts: directDebts.map((debt) => ({ ...debt })),
    settlements: mergeDirectDebts(baseSettlements, directDebts),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function runTests() {
  const round = { players: ["A", "B", "C", "D"], values: [-50, -50, 100, 0], statuses: ["lose", "lose", "win", "lose"] };
  const totals = calculateTotals([round]);
  const settlements = calculateSettlements(totals);
  console.assert(totals.find((item) => item.player === "C").total === 100, "Totals should calculate winners correctly");
  console.assert(settlements.length === 2, "One winner should receive from two losers");
  console.assert(settlements[0].from === "A" && settlements[0].to === "C" && settlements[0].amount === 50, "First payment should be A to C");

  const round2 = { players: ["A", "B", "E", "F"], values: [30, -10, -20, 0], statuses: ["win", "lose", "lose", "lose"] };
  const combined = calculateTotals([round, round2]);
  console.assert(combined.find((item) => item.player === "E").total === -20, "Different players between games should still total correctly");

  const balancedDraft = { players: ["A", "B"], values: [100, -100], statuses: ["win", "lose"] };
  console.assert(roundTotal(balancedDraft) === 0, "Round should balance to zero");

  const oneToMany = calculateSettlements([
    { player: "A", total: -40 },
    { player: "B", total: -60 },
    { player: "C", total: 100 },
  ]);
  console.assert(oneToMany.length === 2 && oneToMany[1].from === "B", "Multiple payers should be supported");

  const mergedDebt = mergeDirectDebts([{ from: "A", to: "C", amount: 50 }], [{ from: "A", to: "C", amount: 25 }]);
  console.assert(mergedDebt[0].amount === 75, "Direct debts should merge with normal settlements");

  const selection = ["Leo", "Amanda", "Mason", "Andrew"];
  console.assert(selection.length === 4 && selection.includes("Leo"), "Tap-select player pool should support four players");
}

runTests();

const copy = {
  en: {
    title: "Settlement",
    mahjong: "Mahjong",
    saved: "Auto-saved locally",
    players: "Players",
    round: "Round",
    savedPage: "Saved",
    choosePlayers: "Tap up to 4 players. Then use the tally counter to enter chip totals.",
    playerBubbles: "Player bubbles",
    customName: "Custom name",
    add: "Add",
    selected: "Selected",
    mahjongTable: "Tally Counter",
    tableHint: "Choose a player, then tap + or - chip values to enter their amount.",
    useSeats: "Start Round",
    setMe: "Set as Me",
    me: "Me",
    east: "East",
    south: "South",
    west: "West",
    north: "North",
    currentGame: "Current Game",
    total: "Total",
    needsZero: "needs 0",
    clear: "Undo",
    win: "WIN",
    lose: "LOSE",
    preview: "Preview Settlement",
    saveGame: "Save",
    previewResult: "Preview Result",
    noPreview: "Enter balanced numbers, then tap Preview Settlement.",
    savedMatches: "Saved Games",
    noSaved: "No saved games yet.",
    game: "Game",
    delete: "Delete",
    select: "Select",
    selectedGames: "selected",
    totalSelected: "Total Selected",
    totalResult: "Total Result",
    noPayments: "No payments needed.",
    payments: "Payments",
    winLose: "Win / Lose",
    notBalanced: "Game is not balanced",
    enterAmounts: "Enter amounts first",
    savedGame: "Game saved",
    memoryCleared: "Local memory cleared",
    clearMemory: "Clear",
    reset: "Reset",
    all: "All",
    finalize: "Finalize",
    selectGamesHint: "Select games, then tap Finalize.",
    nothingToUndo: "Nothing to undo",
    tally: "Tally",
    chooseTallyPlayer: "Choose player",
    addChip: "+",
    removeChip: "−",
    clearTally: "Reset Tally",
    lostAll: "Lost All 1150",
    directDebt: "Direct Debt",
    owes: "Owes",
    receives: "Receives",
    amount: "Amount",
    addDebt: "Add Debt",
    debts: "Debts",
  },
  zh: {
    title: "結算",
    mahjong: "麻將",
    saved: "已自動儲存在此裝置",
    players: "玩家",
    round: "本局",
    savedPage: "已存",
    choosePlayers: "點選最多 4 位玩家，然後用籌碼計數器輸入金額。",
    playerBubbles: "玩家泡泡",
    customName: "自訂名字",
    add: "新增",
    selected: "已選",
    mahjongTable: "籌碼計數器",
    tableHint: "選擇玩家後，點擊 + 或 - 籌碼金額來輸入。",
    useSeats: "開始本局",
    setMe: "設為我",
    me: "我",
    east: "東",
    south: "南",
    west: "西",
    north: "北",
    currentGame: "目前這場",
    total: "合計",
    needsZero: "需為 0",
    clear: "復原",
    win: "贏",
    lose: "輸",
    preview: "預覽結算",
    saveGame: "儲存",
    previewResult: "預覽結果",
    noPreview: "輸入平衡金額後，點預覽結算。",
    savedMatches: "已儲存比賽",
    noSaved: "尚無儲存比賽。",
    game: "Game",
    delete: "刪除",
    select: "選取",
    selectedGames: "已選",
    totalSelected: "合計選取比賽",
    totalResult: "合計結果",
    noPayments: "無需付款。",
    payments: "付款",
    winLose: "輸贏",
    notBalanced: "本場尚未平衡",
    enterAmounts: "請先輸入金額",
    savedGame: "已儲存比賽",
    memoryCleared: "已清除本機記憶",
    clearMemory: "清除",
    reset: "重設",
    all: "全部",
    finalize: "合計",
    selectGamesHint: "選取比賽後，點合計。",
    nothingToUndo: "沒有可復原的輸入",
    tally: "計數",
    chooseTallyPlayer: "選擇玩家",
    addChip: "+",
    removeChip: "−",
    clearTally: "重設計數",
    lostAll: "輸光 1150",
    directDebt: "直接欠款",
    owes: "欠款人",
    receives: "收款人",
    amount: "金額",
    addDebt: "新增欠款",
    debts: "欠款"
  },
};

export default function MahjongSettlementMobileApp() {
  const initial = loadState();

  const [language, setLanguage] = useState(initial?.language || "en");
  const [players, setPlayers] = useState(initial?.players || ["Leo", "Amanda", "Mason", "Andrew"]);
  const [seatPlayers, setSeatPlayers] = useState(initial?.seatPlayers || initial?.players || ["Leo", "Amanda", "Mason", "Andrew"]);
  const [mePlayer, setMePlayer] = useState(initial?.mePlayer || "Leo");
  const [extraNames, setExtraNames] = useState(initial?.extraNames || []);
  const [customName, setCustomName] = useState("");
  const [draft, setDraft] = useState(initial?.draft || newDraft(4));
  const [directDebts, setDirectDebts] = useState(initial?.directDebts || []);
  const [debtFrom, setDebtFrom] = useState(initial?.debtFrom || "");
  const [debtTo, setDebtTo] = useState(initial?.debtTo || "");
  const [debtAmount, setDebtAmount] = useState("");
  const [savedMatches, setSavedMatches] = useState(initial?.savedMatches || []);
  const [selectedMatchId, setSelectedMatchId] = useState(initial?.selectedMatchId || null);
  const [selectedForTotal, setSelectedForTotal] = useState(initial?.selectedForTotal || []);
  const [activeTab, setActiveTab] = useState(initial?.activeTab || "players");
  const [message, setMessage] = useState("");
  const [previewMatches, setPreviewMatches] = useState(initial?.previewMatches || []);
  const [undoDraft, setUndoDraft] = useState(null);
  const [tallyPlayerIndex, setTallyPlayerIndex] = useState(0);
  const [showFinalizedTotal, setShowFinalizedTotal] = useState(initial?.showFinalizedTotal || false);

  const t = copy[language];
  const allNames = useMemo(() => [...NAME_POOL, ...extraNames.filter((name) => !NAME_POOL.includes(name))], [extraNames]);
  const currentRound = useMemo(() => normalizeRound({ ...draft, players }, players), [draft, players]);
  const draftTotal = roundTotal(currentRound);
  const selectedMatches = useMemo(() => savedMatches.filter((match) => selectedForTotal.includes(match.id)), [savedMatches, selectedForTotal]);
  const totalSelectedDirectDebts = useMemo(() => selectedMatches.flatMap((match) => match.directDebts || []), [selectedMatches]);
  const totalSelectedTotals = useMemo(() => applyDirectDebtsToTotals(calculateTotals(selectedMatches.map((match) => match.round)), totalSelectedDirectDebts), [selectedMatches, totalSelectedDirectDebts]);
  const totalSelectedPayments = useMemo(() => mergeDirectDebts(calculateSettlements(totalSelectedTotals), totalSelectedDirectDebts), [totalSelectedTotals, totalSelectedDirectDebts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      language,
      players,
      seatPlayers,
      mePlayer,
      extraNames,
      draft,
      directDebts,
      debtFrom,
      debtTo,
      savedMatches,
      selectedMatchId,
      selectedForTotal,
      activeTab,
      previewMatches,
      showFinalizedTotal,
    }));
  }, [language, players, seatPlayers, mePlayer, extraNames, draft, directDebts, debtFrom, debtTo, savedMatches, selectedMatchId, selectedForTotal, activeTab, previewMatches, showFinalizedTotal]);

  const styles = {
    page: { minHeight: "100vh", background: "#111", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#171717" },
    phone: { height: "100vh", maxWidth: 430, margin: "0 auto", background: "#f5f5f4", overflow: "hidden", boxShadow: "0 0 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" },
    headerWrap: { padding: "10px 12px 8px", flex: "0 0 auto" },
    header: { background: "#171717", color: "white", borderRadius: 20, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" },
    headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    eyebrow: { margin: 0, fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "#a3a3a3" },
    title: { margin: "2px 0 0", fontSize: 21, fontWeight: 850, letterSpacing: -0.7 },
    hint: { margin: "3px 0 0", fontSize: 11, color: "#d4d4d4" },
    iconButton: { border: 0, borderRadius: 15, background: "rgba(255,255,255,0.12)", color: "white", minWidth: 42, minHeight: 42, fontSize: 12, fontWeight: 900, cursor: "pointer" },
    langToggle: { display: "flex", alignItems: "center", gap: 4, border: 0, borderRadius: 999, background: "rgba(255,255,255,0.12)", height: 42, padding: 4, cursor: "pointer" },
    langOption: { minWidth: 32, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 },
    stats: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 9 },
    stat: { background: "rgba(255,255,255,0.1)", borderRadius: 13, padding: "7px 8px" },
    statLabel: { color: "#a3a3a3", fontSize: 10, marginBottom: 2 },
    statValue: { fontSize: 17, fontWeight: 900, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    main: { flex: "1 1 auto", overflow: "hidden", padding: "0 12px 6px", display: "flex", flexDirection: "column" },
    card: { background: "white", borderRadius: 20, padding: 11, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    button: { border: 0, borderRadius: 15, background: "#171717", color: "white", minHeight: 38, padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
    secondaryButton: { border: "1px solid #d4d4d4", borderRadius: 15, background: "white", color: "#171717", minHeight: 38, padding: "0 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
    dangerButton: { border: 0, borderRadius: 14, background: "#fee2e2", color: "#b91c1c", minHeight: 34, padding: "0 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
    input: { width: "100%", height: 40, border: "1px solid #e5e5e5", borderRadius: 15, background: "#fafafa", padding: "0 12px", fontSize: 15, outline: "none", boxSizing: "border-box" },
    playerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 },
    playerBlock: { borderRadius: 17, padding: 8, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", border: "2px solid transparent", boxSizing: "border-box" },
    numberInput: { width: "100%", height: 42, border: "1px solid rgba(255,255,255,0.7)", borderRadius: 14, background: "rgba(255,255,255,0.94)", padding: "0 8px", fontSize: 21, fontWeight: 900, textAlign: "center", outline: "none", boxSizing: "border-box" },
    pill: { display: "inline-flex", justifyContent: "center", alignItems: "center", minWidth: 48, height: 20, borderRadius: 999, fontSize: 10, fontWeight: 900, color: "white", marginTop: 3 },
    scroll: { flex: "1 1 auto", overflow: "auto", display: "grid", gap: 8, alignContent: "start" },
    paymentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    paymentBox: { background: "#171717", color: "white", borderRadius: 14, padding: 9, boxSizing: "border-box" },
    totalBox: { borderRadius: 14, padding: 9, fontSize: 13, fontWeight: 900 },
    tableWrap: { marginTop: 6, background: "#fafafa", borderRadius: 18, padding: 8, border: "1px solid #eeeeee" },
    pool: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 },
    chip: { border: "1px solid #d4d4d4", borderRadius: 999, background: "white", color: "#171717", padding: "6px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer" },
    footer: { flex: "0 0 auto", background: "rgba(245,245,244,0.96)", padding: "8px 12px 12px", boxSizing: "border-box" },
    footerActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 },
    nav: { display: "flex", gap: 7, background: "white", borderRadius: 22, padding: 7, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
    navButton: { flex: 1, border: 0, borderRadius: 16, padding: "7px 2px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  };

  function addCustomName() {
    const name = customName.trim();
    if (!name) return;
    if (!allNames.includes(name)) setExtraNames((current) => [...current, name]);
    setCustomName("");
  }

  function togglePlayerSelection(name) {
    setSeatPlayers((current) => {
      if (current.includes(name)) {
        const next = current.filter((player) => player !== name);
        if (mePlayer === name) setMePlayer(next[0] || "");
        return next;
      }
      if (current.length >= 4) return current;
      if (!mePlayer) setMePlayer(name);
      return [...current, name];
    });
  }

  function applySeats() {
    const nextPlayers = seatPlayers.filter(Boolean).slice(0, 4);
    if (nextPlayers.length !== 4) {
      setMessage(language === "zh" ? "請選滿 4 位玩家" : "Please select 4 players");
      return;
    }
    setPlayers(nextPlayers);
    if (!nextPlayers.includes(mePlayer)) setMePlayer(nextPlayers[0]);
    setDraft((current) => ({
      values: nextPlayers.map((_, index) => Number(current.values?.[index] || 0)),
      statuses: nextPlayers.map((_, index) => current.statuses?.[index] || "lose"),
    }));
    setTallyPlayerIndex(0);
    setMessage(language === "zh" ? "已套用玩家" : "Players applied");
    setActiveTab("round");
  }

  function changeTallyAmount(index, delta) {
    const selectedPlayers = seatPlayers.length === 4 ? seatPlayers : players;
    const targetIndex = Math.min(index, selectedPlayers.length - 1);
    const targetPlayers = selectedPlayers.length === 4 ? selectedPlayers : players;

    setPlayers(targetPlayers);
    setDraft((current) => {
      const values = [...(current.values || newDraft(4).values)];
      const statuses = [...(current.statuses || newDraft(4).statuses)];
      const currentValue = Number(values[targetIndex] || 0);
      values[targetIndex] = currentValue + delta;
      statuses[targetIndex] = values[targetIndex] >= 0 ? "win" : "lose";
      return { values, statuses };
    });
  }

  function clearTallyPlayer(index) {
    setDraft((current) => {
      const values = [...(current.values || newDraft(4).values)];
      const statuses = [...(current.statuses || newDraft(4).statuses)];
      values[index] = 0;
      statuses[index] = "lose";
      return { values, statuses };
    });
  }

  function setLostAll(index) {
    setDraft((current) => {
      const values = [...(current.values || newDraft(4).values)];
      const statuses = [...(current.statuses || newDraft(4).statuses)];
      values[index] = -LOST_ALL_AMOUNT;
      statuses[index] = "lose";
      return { values, statuses };
    });
  }

  function addDirectDebt() {
    const amount = Number(debtAmount || 0);
    if (!debtFrom || !debtTo || debtFrom === debtTo || amount <= 0) return;
    setDirectDebts((current) => [...current, { id: createId(), from: debtFrom, to: debtTo, amount }]);
    setDebtAmount("");
  }

  function removeDirectDebt(id) {
    setDirectDebts((current) => current.filter((debt) => debt.id !== id));
  }

  function toggleStatus(index) {
    setDraft((current) => {
      const statuses = [...current.statuses];
      const values = [...current.values];
      statuses[index] = statuses[index] === "win" ? "lose" : "win";
      values[index] = signedAmount(values[index], statuses[index]);
      return { values, statuses };
    });
    setMessage("");
  }

  function updateValue(index, raw) {
    const clean = raw.replace(/[^0-9.]/g, "");
    setDraft((current) => {
      const values = [...current.values];
      values[index] = clean === "" ? "" : signedAmount(clean, current.statuses[index]);
      return { ...current, values };
    });
    setMessage("");
  }

  function previewSettlement() {
    const round = normalizeRound({ ...draft, players }, players);
    if (!hasAmount(round)) {
      setMessage(t.enterAmounts);
      return;
    }
    if (Math.abs(roundTotal(round)) > 0.000001) {
      setMessage(`${t.notBalanced}: ${money(roundTotal(round))}`);
      return;
    }

    const match = makeMatch(round, directDebts);
    setPreviewMatches((current) => [match, ...current]);
    setUndoDraft(draft);
    setDraft(newDraft(players.length));
    setDirectDebts([]);
    setDebtFrom("");
    setDebtTo("");
    setDebtAmount("");
    setMessage("");
    setActiveTab("round");
  }

  function savePreview() {
    if (previewMatches.length === 0) return;

    const startingNumber = savedMatches.length + 1;
    const matches = previewMatches.slice().reverse().map((match, index) => ({
      ...match,
      label: `${t.game} ${startingNumber + index}`,
    }));

    setSavedMatches((current) => [...current, ...matches]);
    setSelectedMatchId(matches[matches.length - 1]?.id || null);
    setSelectedForTotal((current) => [...current, ...matches.map((match) => match.id)]);
    setPreviewMatches([]);
    setUndoDraft(null);
    setMessage(t.savedGame);
    setActiveTab("saved");
  }

  function undoLastInput() {
    if (undoDraft) {
      setDraft(undoDraft);
      setUndoDraft(null);
      setMessage("");
      return;
    }
    setMessage(t.nothingToUndo);
  }

  function deleteMatch(id) {
    setSavedMatches((current) => current.filter((match) => match.id !== id));
    setSelectedForTotal((current) => current.filter((matchId) => matchId !== id));
    if (selectedMatchId === id) setSelectedMatchId(null);
  }

  function clearMemory() {
    localStorage.removeItem(STORAGE_KEY);
    setPlayers(["Leo", "Amanda", "Mason", "Andrew"]);
    setSeatPlayers(["Leo", "Amanda", "Mason", "Andrew"]);
    setMePlayer("Leo");
    setExtraNames([]);
    setDraft(newDraft(4));
    setDirectDebts([]);
    setDebtFrom("");
    setDebtTo("");
    setDebtAmount("");
    setSavedMatches([]);
    setSelectedForTotal([]);
    setSelectedMatchId(null);
    setPreviewMatches([]);
    setUndoDraft(null);
    setShowFinalizedTotal(false);
    setActiveTab("players");
    setMessage(t.memoryCleared);
  }

  function toggleSelectedGame(id) {
    setSelectedForTotal((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setShowFinalizedTotal(false);
  }

  function selectAllGames() {
    if (selectedForTotal.length === savedMatches.length) {
      setSelectedForTotal([]);
    } else {
      setSelectedForTotal(savedMatches.map((match) => match.id));
    }
    setShowFinalizedTotal(false);
  }

  function finalizeSelectedGames() {
    if (selectedForTotal.length === 0) {
      setMessage(t.selectGamesHint);
      return;
    }
    setShowFinalizedTotal(true);
    setActiveTab("saved");
  }

  function TotalCard({ item }) {
    const isWin = item.total >= 0;
    return (
      <div style={{ ...styles.totalBox, background: isWin ? "#dcfce7" : "#fee2e2", color: isWin ? "#15803d" : "#dc2626" }}>
        <div style={{ whiteSpace: "nowrap",
                minHeight: 42, overflow: "hidden", textOverflow: "ellipsis" }}>{item.player}</div>
        <div>{isWin ? "+" : ""}{money(item.total)}</div>
      </div>
    );
  }

  function PaymentCard({ payment }) {
    return (
      <div style={styles.paymentBox}>
        <div style={{ fontSize: 11, opacity: 0.75 }}>{t.payments}</div>
        <div style={{ color: "#fca5a5", fontSize: 14, fontWeight: 900, margin: "4px 0" }}>{payment.from} → {payment.to}</div>
        <div style={{ fontSize: 18, fontWeight: 950 }}>{money(payment.amount)}</div>
      </div>
    );
  }

  function MatchDetails({ match }) {
    return (
      <div style={{ marginTop: 8 }}>
        <strong style={{ fontSize: 13 }}>{t.winLose}</strong>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          {match.totals.map((item) => <TotalCard key={item.player} item={item} />)}
        </div>
        {match.directDebts?.length > 0 && (
          <>
            <strong style={{ display: "block", fontSize: 13, marginTop: 8 }}>{t.debts}</strong>
            <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
              {match.directDebts.map((debt, index) => (
                <div key={`${debt.from}-${debt.to}-${index}`} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: "6px 8px", fontSize: 12 }}>
                  {debt.from} → {debt.to}: {money(debt.amount)}
                </div>
              ))}
            </div>
          </>
        )}
        <strong style={{ display: "block", fontSize: 13, marginTop: 8 }}>{t.payments}</strong>
        {match.settlements.length === 0 ? (
          <div style={{ color: "#737373", fontSize: 13, marginTop: 6 }}>{t.noPayments}</div>
        ) : (
          <div style={{ ...styles.paymentGrid, marginTop: 6 }}>
            {match.settlements.map((payment, index) => <PaymentCard key={`${payment.from}-${payment.to}-${index}`} payment={payment} />)}
          </div>
        )}
      </div>
    );
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

  function PlayerBubble({ name }) {
    const seated = seatPlayers.includes(name);
    const disabled = !seated && seatPlayers.length >= 4;
    return (
      <button
        onClick={() => togglePlayerSelection(name)}
        disabled={disabled}
        style={{
          ...styles.chip,
          background: seated ? "#171717" : "white",
          color: seated ? "white" : "#171717",
          opacity: disabled ? 0.35 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {name}
      </button>
    );
  }

  function TallyCounter() {
    const tallyPlayers = seatPlayers.length > 0 ? seatPlayers : players;
    const chipValues = [100, 50, 20, 10];
    const selectedPlayer = tallyPlayers[tallyPlayerIndex] || tallyPlayers[0] || "—";
    const selectedValue = Number(draft.values?.[tallyPlayerIndex] || 0);

    return (
      <div style={{ ...styles.tableWrap, overflow: "hidden" }}>
        <div style={styles.row}>
          <div>
            <strong style={{ fontSize: 14 }}>{t.mahjongTable}</strong>
            <p style={{ margin: "3px 0 0", color: "#737373", fontSize: 12 }}>{t.tableHint}</p>
          </div>
          <button onClick={applySeats} style={{ ...styles.button, minHeight: 34 }}>{t.useSeats}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
          {tallyPlayers.map((player, index) => (
            <button
              key={`${player}-${index}`}
              onClick={() => setTallyPlayerIndex(index)}
              style={{
                ...styles.chip,
                background: tallyPlayerIndex === index ? "#171717" : "white",
                color: tallyPlayerIndex === index ? "white" : "#171717",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                width: "100%",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 44 }}>{player}</span>
              <span style={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }}>
                {Number(draft.values?.[index] || 0) >= 0 ? "+" : ""}{money(draft.values?.[index] || 0)}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 6, background: "white", borderRadius: 16, padding: 8, border: "1px solid #eeeeee" }}>
          <div style={styles.row}>
            <div>
              <div style={{ fontSize: 11, color: "#737373" }}>{t.chooseTallyPlayer}</div>
              <strong style={{ fontSize: 18 }}>{selectedPlayer}</strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#737373" }}>{t.tally}</div>
              <strong style={{ fontSize: 22, color: selectedValue >= 0 ? "#15803d" : "#dc2626" }}>
                {selectedValue >= 0 ? "+" : ""}{money(selectedValue)}
              </strong>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            <button
              onClick={() => clearTallyPlayer(tallyPlayerIndex)}
              style={{ ...styles.dangerButton, width: "100%", minHeight: 30 }}
            >
              {t.clearTally}
            </button>
            <button
              onClick={() => setLostAll(tallyPlayerIndex)}
              style={{ ...styles.dangerButton, width: "100%", minHeight: 30 }}
            >
              {t.lostAll}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
            {chipValues.map((value) => (
              <div key={value} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button onClick={() => changeTallyAmount(tallyPlayerIndex, value)} style={styles.button}>{t.addChip}{value}</button>
                <button onClick={() => changeTallyAmount(tallyPlayerIndex, -value)} style={styles.secondaryButton}>{t.removeChip}{value}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function PlayersPage() {
    return (
      <section style={{ ...styles.card, flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{t.players}</h2>
        <p style={{ margin: "3px 0 6px", color: "#737373", fontSize: 11 }}>{t.choosePlayers}</p>
        <div style={{ background: "#171717", color: "white", borderRadius: 15, padding: 7, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
          {t.me}: {mePlayer || "—"}
        </div>
        <strong style={{ fontSize: 12 }}>{t.playerBubbles}</strong>
        <div style={styles.pool}>{allNames.map((name) => <PlayerBubble key={name} name={name} />)}</div>
        <div style={{ marginTop: 5, fontSize: 11, color: "#737373" }}>{seatPlayers.length}/4 {t.selected}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginTop: 6 }}>
          <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={t.customName} style={styles.input} />
          <button onClick={addCustomName} style={styles.button}>{t.add}</button>
        </div>
        <TallyCounter />
      </section>
    );
  }

  function DirectDebtBox() {
    const debtPlayers = players.length === 4 ? players : seatPlayers;
    return (
      <div style={{ marginTop: 10, background: "#fafafa", borderRadius: 16, padding: 10, border: "1px solid #eeeeee" }}>
        <strong style={{ fontSize: 14 }}>{t.directDebt}</strong>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
          <select value={debtFrom} onChange={(event) => setDebtFrom(event.target.value)} style={styles.input}>
            <option value="">{t.owes}</option>
            {debtPlayers.map((player) => <option key={`from-${player}`} value={player}>{player}</option>)}
          </select>
          <select value={debtTo} onChange={(event) => setDebtTo(event.target.value)} style={styles.input}>
            <option value="">{t.receives}</option>
            {debtPlayers.map((player) => <option key={`to-${player}`} value={player}>{player}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginTop: 6 }}>
          <input
            value={debtAmount}
            onChange={(event) => setDebtAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={t.amount}
            inputMode="decimal"
            style={styles.input}
          />
          <button onClick={addDirectDebt} style={styles.button}>{t.addDebt}</button>
        </div>
        {directDebts.length > 0 && (
          <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
            {directDebts.map((debt) => (
              <div key={debt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, background: "white", borderRadius: 12, padding: "6px 8px", fontSize: 12 }}>
                <span><strong>{debt.from}</strong> → <strong>{debt.to}</strong>: {money(debt.amount)}</span>
                <button onClick={() => removeDirectDebt(debt.id)} style={{ ...styles.dangerButton, minHeight: 24, fontSize: 10 }}>{t.delete}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function RoundPage() {
    return (
      <section style={{ ...styles.card, flex: "1 1 auto", overflow: "auto" }}>
        <div style={styles.row}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t.currentGame}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: Math.abs(draftTotal) < 0.000001 ? "#15803d" : "#dc2626" }}>
              {t.total} {money(draftTotal)} {Math.abs(draftTotal) < 0.000001 ? "✓" : t.needsZero}
            </p>
          </div>
          <button onClick={undoLastInput} style={styles.secondaryButton}>{t.clear}</button>
        </div>

        <div style={styles.playerGrid}>
          {players.map((player, index) => {
            const isWin = currentRound.statuses[index] === "win";
            const amount = Math.abs(Number(currentRound.values[index] || 0));
            return (
              <div key={`${player}-${index}`} onClick={() => toggleStatus(index)} style={{ ...styles.playerBlock, background: isWin ? "#dcfce7" : "#fee2e2", borderColor: isWin ? "#86efac" : "#fca5a5" }}>
                <div style={{ marginBottom: 7, textAlign: "center" }}>
                  <strong style={{ display: "block", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player}</strong>
                  <span style={{ ...styles.pill, background: isWin ? "#16a34a" : "#dc2626" }}>{isWin ? t.win : t.lose}</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount || ""}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onChange={(event) => updateValue(index, event.target.value)}
                  placeholder="0"
                  style={styles.numberInput}
                />
              </div>
            );
          })}
        </div>

        <DirectDebtBox />

        {message && (
          <div style={{ marginTop: 8, borderRadius: 15, padding: 9, fontSize: 13, background: /not|Enter|least|failed|尚未|請先|平衡|undo|復原/i.test(message) ? "#fef2f2" : "#ecfdf5", color: /not|Enter|least|failed|尚未|請先|平衡|undo|復原/i.test(message) ? "#b91c1c" : "#15803d" }}>
            {message}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <div style={styles.row}>
            <strong style={{ fontSize: 15 }}>{t.previewResult}</strong>
            <span style={{ color: "#737373", fontSize: 12 }}>{previewMatches.length}</span>
          </div>
          {previewMatches.length === 0 ? (
            <div style={{ marginTop: 8, background: "#fafafa", color: "#737373", borderRadius: 15, padding: 10, fontSize: 13 }}>{t.noPreview}</div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {previewMatches.map((match, index) => (
                <div key={match.id} style={{ background: index === 0 ? "#171717" : "#fafafa", color: index === 0 ? "white" : "#171717", borderRadius: 16, padding: 10 }}>
                  <div style={styles.row}>
                    <strong>{t.game} {previewMatches.length - index}</strong>
                    <span style={{ fontSize: 12, color: index === 0 ? "#d4d4d4" : "#737373" }}>{dateTime(match.createdAt, language)}</span>
                  </div>
                  <MatchDetails match={match} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function SavedPage() {
    return (
      <section style={{ ...styles.card, flex: "1 1 auto", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ ...styles.row, marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>{t.savedMatches}</h2>
            <p style={{ margin: "3px 0 0", color: "#737373", fontSize: 12 }}>{selectedForTotal.length} {t.selectedGames}</p>
          </div>
          <button onClick={selectAllGames} style={{ ...styles.secondaryButton, minHeight: 34 }}>{t.all}</button>
        </div>

        {showFinalizedTotal && selectedForTotal.length > 0 && (
          <div style={{ background: "#fafafa", borderRadius: 16, padding: 10, marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{t.totalResult}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              {totalSelectedTotals.map((item) => <TotalCard key={item.player} item={item} />)}
            </div>
            <strong style={{ display: "block", fontSize: 13, marginTop: 8 }}>{t.payments}</strong>
            {totalSelectedPayments.length === 0 ? (
              <div style={{ color: "#737373", fontSize: 13, marginTop: 6 }}>{t.noPayments}</div>
            ) : (
              <div style={{ ...styles.paymentGrid, marginTop: 6 }}>
                {totalSelectedPayments.map((payment, index) => <PaymentCard key={`${payment.from}-${payment.to}-${index}`} payment={payment} />)}
              </div>
            )}
          </div>
        )}

        <div style={styles.scroll}>
          {savedMatches.length === 0 ? (
            <div style={{ background: "#fafafa", borderRadius: 16, padding: 12, color: "#737373", fontSize: 13 }}>{t.noSaved}</div>
          ) : savedMatches.map((match, index) => {
            const open = selectedMatchId === match.id;
            const selected = selectedForTotal.includes(match.id);
            return (
              <div key={match.id} style={{ background: open ? "#171717" : "#fafafa", color: open ? "white" : "#171717", borderRadius: 16, padding: 10 }}>
                <div style={styles.row}>
                  <div onClick={() => setSelectedMatchId(open ? null : match.id)} style={{ flex: 1, cursor: "pointer" }}>
                    <strong>{t.game} {index + 1}</strong>
                    <div style={{ fontSize: 12, color: open ? "#d4d4d4" : "#737373", marginTop: 2 }}>{dateTime(match.createdAt, language)}</div>
                  </div>
                  <button onClick={() => toggleSelectedGame(match.id)} style={{ ...styles.secondaryButton, minHeight: 30, fontSize: 11, background: selected ? "#16a34a" : "white", color: selected ? "white" : "#171717", borderColor: selected ? "#16a34a" : "#d4d4d4" }}>{selected ? "✓" : t.select}</button>
                  <button onClick={() => deleteMatch(match.id)} style={{ ...styles.dangerButton, minHeight: 30, fontSize: 11 }}>{t.delete}</button>
                </div>
                {open && <MatchDetails match={match} />}
              </div>
            );
          })}
        </div>
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
                <p style={styles.eyebrow}>{t.mahjong}</p>
                <h1 style={styles.title}>{t.title}</h1>
                <p style={styles.hint}>{dateTime(new Date().toISOString(), language)} · {t.saved}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setLanguage(language === "en" ? "zh" : "en")} style={styles.langToggle}>
                  <span style={{ ...styles.langOption, background: language === "en" ? "white" : "transparent", color: language === "en" ? "#171717" : "#d4d4d4" }}>EN</span>
                  <span style={{ ...styles.langOption, background: language === "zh" ? "white" : "transparent", color: language === "zh" ? "#171717" : "#d4d4d4" }}>CN</span>
                </button>
                <button onClick={clearMemory} style={styles.iconButton}>{t.clearMemory}</button>
              </div>
            </div>
            <div style={styles.stats}>
              <div style={styles.stat}><div style={styles.statLabel}>{t.savedPage}</div><div style={styles.statValue}>{savedMatches.length}</div></div>
              <div style={styles.stat}><div style={styles.statLabel}>{t.round}</div><div style={{ ...styles.statValue, color: Math.abs(draftTotal) < 0.000001 ? "#86efac" : "#fca5a5" }}>{money(draftTotal)}</div></div>
              <div style={styles.stat}><div style={styles.statLabel}>{t.me}</div><div style={styles.statValue}>{mePlayer || "—"}</div></div>
            </div>
          </div>
        </div>

        <main style={styles.main}>
          {activeTab === "players" && <PlayersPage />}
          {activeTab === "round" && <RoundPage />}
          {activeTab === "saved" && <SavedPage />}
        </main>

        <footer style={styles.footer}>
          {activeTab === "round" && (
            <div style={styles.footerActions}>
              <button onClick={previewSettlement} style={styles.button}>{t.preview}</button>
              <button onClick={savePreview} disabled={previewMatches.length === 0} style={{ ...styles.button, opacity: previewMatches.length ? 1 : 0.35 }}>{t.saveGame}</button>
            </div>
          )}
          {activeTab === "saved" && (
            <div style={{ marginBottom: 8 }}>
              <button onClick={finalizeSelectedGames} style={{ ...styles.button, width: "100%", opacity: selectedForTotal.length ? 1 : 0.45 }}>{t.finalize}</button>
            </div>
          )}
          <nav style={styles.nav}>
            <NavButton id="players" icon="👥" label={t.players} />
            <NavButton id="round" icon="🀄" label={t.round} />
            <NavButton id="saved" icon="🧾" label={t.savedPage} />
          </nav>
        </footer>
      </div>
    </div>
  );
}
