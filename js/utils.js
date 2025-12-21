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

// --- Holiday Logic ---
// 簡易的な日本の祝日判定 (2024-2026対応)
// 必要に応じてAPIやライブラリに置き換え推奨
export function getHolidays(year, month) {
    const holidays = [];
    const add = (d) => holidays.push(d);

    // 固定祝日
    if (month === 1) { add(1); } // 元日
    if (month === 2) { add(11); if(year===2024) add(23); else add(23); } // 建国記念, 天皇誕生日
    if (month === 3) { if(year===2024) add(20); else if(year===2025) add(20); else add(21); } // 春分(概算)
    if (month === 4) { add(29); } // 昭和の日
    if (month === 5) { add(3); add(4); add(5); } // 憲法, みどりの日, こどもの日
    if (month === 8) { add(11); } // 山の日
    if (month === 9) { if(year===2024) add(22); else if(year===2025) add(23); else add(23); } // 秋分(概算)
    if (month === 11) { add(3); add(23); } // 文化, 勤労感謝

    // ハッピーマンデー (成人の日:1月第2月曜, 海の日:7月第3月曜, 敬老の日:9月第3月曜, スポーツの日:10月第2月曜)
    const getNthMonday = (n) => {
        let count = 0;
        for (let d = 1; d <= 31; d++) {
            const date = new Date(year, month - 1, d);
            if (date.getMonth() !== month - 1) break;
            if (date.getDay() === 1) {
                count++;
                if (count === n) return d;
            }
        }
        return null;
    };

    if (month === 1) { const d = getNthMonday(2); if(d) add(d); }
    if (month === 7) { const d = getNthMonday(3); if(d) add(d); }
    if (month === 9) { const d = getNthMonday(3); if(d) add(d); }
    if (month === 10) { const d = getNthMonday(2); if(d) add(d); }

    // 振替休日判定 (日曜と被っていたら翌日)
    // 簡易実装: 固定祝日が日曜の場合、翌日を休日とする
    const finalHolidays = [...holidays];
    holidays.forEach(d => {
        const date = new Date(year, month - 1, d);
        if (date.getDay() === 0) { // Sunday
            let next = d + 1;
            // 既に祝日ならさらに翌日 (ゴールデンウィーク等)
            while(finalHolidays.includes(next)) next++;
            finalHolidays.push(next);
        }
    });

    return finalHolidays.sort((a,b) => a-b);
}
