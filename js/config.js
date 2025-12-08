// ★ 12月 目標値データ
export const TARGET_DATA_DEC = {
    1: { t15: 205, t19: 250 }, 2: { t15: 210, t19: 257 }, 3: { t15: 204, t19: 248 },
    4: { t15: 0, t19: 237 }, 5: { t15: 222, t19: 270 }, 6: { t15: 418, t19: 324 },
    7: { t15: 499, t19: 377 }, 8: { t15: 237, t19: 290 }, 9: { t15: 234, t19: 288 },
    10: { t15: 218, t19: 266 }, 11: { t15: 205, t19: 250 }, 12: { t15: 241, t19: 295 },
    13: { t15: 420, t19: 327 }, 14: { t15: 519, t19: 394 }, 15: { t15: 214, t19: 262 },
    16: { t15: 207, t19: 252 }, 17: { t15: 201, t19: 245 }, 18: { t15: 233, t19: 286 },
    19: { t15: 220, t19: 270 }, 20: { t15: 423, t19: 329 }, 21: { t15: 506, t19: 383 },
    22: { t15: 377, t19: 472 }, 23: { t15: 223, t19: 366 }, 24: { t15: 275, t19: 453 },
    25: { t15: 0, t19: 0 }, 26: { t15: 301, t19: 369 }, 27: { t15: 571, t19: 450 },
    28: { t15: 608, t19: 479 }, 29: { t15: 493, t19: 389 }, 30: { t15: 500, t19: 395 },
    31: { t15: 316, t19: 317 }
};

// --- Task Definitions ---
export const TASKS_COMMON = ["朝礼", "個人業務、自由時間", "環境整備・5M", "島上・イーゼル清掃"];
export const TASKS_EMPLOYEE = [
    ...TASKS_COMMON,
    "金銭業務", "抽選（準備、片付け）", "外販出し、新聞、岡持", "販促確認、全体確認",
    "P台チェック(社員)", "S台チェック(社員)",
    "立駐（社員）", "施錠・工具箱チェック", "引継ぎ・事務所清掃",
    "金銭回収", "倉庫整理", "カウンター業務", "QSC"
];
export const TASKS_ALBA = [
    ...TASKS_COMMON,
    "カウンター開設準備",
    "P台チェック(アルバイト)", "S台チェック(アルバイト)",
    "ローラー交換",
    "カウンター業務", "倉庫番(特景)", "立駐（アルバイト）",
    "飲み残し・フラッグ確認", "島上清掃・カード補充", "倉庫整理", "QSC"
];
export const MANUAL_TASK_LIST = [...new Set([...TASKS_EMPLOYEE, ...TASKS_ALBA])];

// Default State
export const DEFAULT_STAFF = {
    early: [], late: [], closing_employee: [], closing_alba: [],
    fixed_money_count: "", fixed_open_warehouse: "", fixed_open_counter: "",
    fixed_money_collect: "", fixed_warehouses: "", fixed_counters: ""
};

export const latestKeywords = ["アズールレーン", "北斗の拳11", "地獄少女7500", "海物語極", "化物語", "プリズムナナ", "バーニングエキスプレス"];

export const EDIT_PASSWORD = "admin";
