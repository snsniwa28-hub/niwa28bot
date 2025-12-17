// --- Helper Functions ---
export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const getTodayDateString = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };
export const getYesterdayDateString = () => { const t = new Date(); t.setDate(t.getDate() - 1); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function generateTimeSlots(startTime, endTime, intervalMinutes) {
    const slots = []; let [sH, sM] = startTime.split(':').map(Number); const [eH, eM] = endTime.split(':').map(Number);
    let cur = sH * 60 + sM; const end = eH * 60 + eM;
    while (cur <= end) { slots.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`); cur += intervalMinutes; }
    return slots;
}
export const openTimeSlots = generateTimeSlots('07:00', '10:00', 15);
export const openAlbaTimeSlots = generateTimeSlots('09:00', '10:00', 15);
export const closeTimeSlots = generateTimeSlots('22:45', '23:30', 15);
export const openTimeIndexMap = new Map(); openTimeSlots.forEach((t, i) => openTimeIndexMap.set(t, i));
export const closeTimeIndexMap = new Map(); closeTimeSlots.forEach((t, i) => closeTimeIndexMap.set(t, i));

export function getTaskColorClass(taskName) {
    if (!taskName) return "free-task";
    const n = taskName;
    if (n.includes("金銭")) return "money-task";
    if (n.includes("抽選") || n.includes("新台") || n.includes("新装")) return "pair-task";
    if (n.includes("カウンター") || n.includes("事務") || n.includes("日報")) return "parking-task";
    if (n.includes("朝礼") || n.includes("清掃") || n.includes("環境") || n.includes("外販") || n.includes("新聞") || n.includes("岡持") || n === "QSC") return "briefing-task";
    if (n.includes("倉庫") || n.includes("納品")) return "lock-task";
    if (n.includes("チェック") || n.includes("立駐") || n.includes("施錠") || n.includes("確認") || n.includes("巡回") || n.includes("交換")) return "staff-15min-task";
    if (n.includes("個人") || n.includes("自由")) return "free-task";
    return "color-gray";
}
