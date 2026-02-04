// Imports from new modules
import * as UI from './js/ui.js';
import * as Customer from './js/customer.js';
import * as Operations from './js/operations.js';
import * as QSC from './js/qsc.js';
import * as Shift from './js/shift.js';
import * as MemberRace from './js/member_race.js';
import * as Deadlines from './js/deadlines.js';
import * as Strategy from './js/strategy.js';
import * as SimpleTodo from './js/simple_todo.js';
import { renderModals, renderInfoSections, changeStrategySlide } from './js/components.js';
import { getTodayDateString, getYesterdayDateString, getTaskColorClass } from './js/utils.js';
import * as Auth from './js/auth.js';
import * as AI from './js/ai.js';
import './js/index_events.js';

// --- Main Initialization ---

document.addEventListener("DOMContentLoaded", () => {
    // 0. Render Static Components
    renderModals();
    renderInfoSections();

    // 1. Initial Data Load
    Customer.fetchCustomerData();
    Deadlines.initDeadlines();

    SimpleTodo.initSimpleTodo();

    // ★追加: 戦略共有の初期化
    Strategy.initStrategy();
    // ★追加: 日次更新チェック (おはよう更新)
    Strategy.checkAndTriggerDailyUpdate();

    // AI Initialization
    AI.initAI();

    QSC.subscribeQSC();
    // Shiftモジュール経由でマスタデータを取得し、その後会員レースを開始
    Shift.initStaffData().then(() => {
        MemberRace.subscribeMemberRace();
        // ★追加: 名簿取得完了をDeadlinesに通知して再描画させる
        Deadlines.updateDeadlineStaffLists();
    });
    Operations.subscribeOperations();

    // 2. Event Listeners Setup (replacing some inline onclicks where possible or convenient)
    
    // QSC
    const qscEditBtn = document.getElementById('qscEditButton');
    if(qscEditBtn) qscEditBtn.onclick = () => QSC.toggleQscEditMode();
    
    const openQscBtn = document.getElementById('openQSCButton');
    if(openQscBtn) openQscBtn.onclick = QSC.openQSCModal;
    
    const closeQscBtn = document.getElementById('closeQscModal');
    if(closeQscBtn) closeQscBtn.onclick = QSC.closeQSCModal;

    const qscTabUnfinished = document.getElementById('qscTabUnfinished');
    if(qscTabUnfinished) qscTabUnfinished.onclick = () => QSC.setQscTab('未実施');
    
    const qscTabFinished = document.getElementById('qscTabFinished');
    if(qscTabFinished) qscTabFinished.onclick = () => QSC.setQscTab('完了');

    // Customer
    const newOpeningBtn = document.getElementById('newOpeningButton');
    if(newOpeningBtn) newOpeningBtn.onclick = Customer.openNewOpening;
    
    const closeNewOpeningBtn = document.getElementById('closeNewOpeningModal');
    if(closeNewOpeningBtn) closeNewOpeningBtn.onclick = Customer.closeNewOpeningModal;
    
    const closeDetailBtn = document.getElementById('closeDetailModal');
    if(closeDetailBtn) closeDetailBtn.onclick = Customer.closeDetailModal;

    // Shift Button Setup (Static HTML)
    Shift.injectShiftButton();
});
