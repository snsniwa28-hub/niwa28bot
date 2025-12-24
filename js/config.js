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
export const MEMBER_TARGET = 120;
