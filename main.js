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

// --- Global Helpers Compatibility (Exposing to Window) ---
// Many inline HTML onclick handlers expect these to be global.

// Utils
window.getTodayDateString = getTodayDateString;
window.getYesterdayDateString = getYesterdayDateString;
window.getTaskColorClass = getTaskColorClass;

// UI
window.switchView = UI.switchView;
window.showToast = UI.showToast;
window.showPasswordModal = UI.showPasswordModal;
window.closePasswordModal = UI.closePasswordModal;
window.showConfirmModal = UI.showConfirmModal;
window.closeConfirmModal = UI.closeConfirmModal;
window.closeModal = UI.closeModal;

// Customer
window.fetchCustomerData = Customer.fetchCustomerData;
window.renderToday = Customer.renderToday;
window.openNewOpening = Customer.openNewOpening;
window.closeNewOpeningModal = Customer.closeNewOpeningModal;
window.closeDetailModal = Customer.closeDetailModal;
window.openNewOpeningEditAuth = Customer.openNewOpeningEditAuth;
window.openNewOpeningEdit = Customer.openNewOpeningEdit;
window.closeNewOpeningEditView = Customer.closeNewOpeningEditView;
window.saveNewOpeningItem = Customer.saveNewOpeningItem;
window.handleNewOpeningImageSelect = Customer.handleNewOpeningImageSelect;
window.handleAddNewUrl = Customer.handleAddNewUrl;

// Map Update
window.openMapUpdateModal = Customer.openMapUpdateModal;
window.closeMapUpdateModal = Customer.closeMapUpdateModal;
window.saveMapUpdate = Customer.saveMapUpdate;
window.handleMapFileSelect = Customer.handleMapFileSelect;

// Internal Shared Modal
// window.openInternalSharedModal is defined in js/strategy.js to handle categories

window.closeInternalSharedModal = function() {
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    // Also reset admin mode via Strategy module if needed, but Strategy.openInternalSharedModal(category) resets it to false.
    // However, if we close it and reopen via user click, it resets.
    // If we just hide it here, the state remains until reopened.
};
// Strategy Admin Auth
window.openStrategyAdminAuth = Strategy.openStrategyAdminAuth;


// Slideshow
window.changeStrategySlide = changeStrategySlide;

// Operations
window.subscribeOperations = Operations.subscribeOperations;
window.renderOperationsBoard = Operations.renderOperationsBoard;
window.openMonthlyCalendar = Operations.openMonthlyCalendar;
window.closeMonthlyCalendar = Operations.closeMonthlyCalendar;
window.openOpInput = Operations.openOpInput;
window.closeOpInput = Operations.closeOpInput;
window.saveOpData = Operations.saveOpData;
window.openMachineDetailsEdit = Operations.openMachineDetailsEdit;
window.closeMachineDetailsEdit = Operations.closeMachineDetailsEdit;
window.saveMachineDetails = Operations.saveMachineDetails;
window.changeMachineViewDate = Operations.changeMachineViewDate;
window.openMachineCalendar = Operations.openMachineCalendar;

// QSC
window.subscribeQSC = QSC.subscribeQSC;
window.renderQSCList = QSC.renderQSCList;
window.addQscItem = QSC.addQscItem;
window.deleteQscItem = QSC.deleteQscItem;
window.openQSCModal = QSC.openQSCModal; // Replaced specific inline code
window.closeQSCModal = QSC.closeQSCModal;
window.closeQscEditModal = QSC.closeQscEditModal;
window.saveQscEdit = QSC.saveQscEdit;
// Handle QSC tab switching specifically to avoid complex inline JS
window.handleQscTab = (tab) => QSC.setQscTab(tab);
// Note: We need to bind specific QSC actions from HTML if they are complex

// Shift
window.injectShiftButton = Shift.injectShiftButton;
window.createShiftModals = Shift.createShiftModals;
window.openShiftUserModal = Shift.openShiftUserModal;
window.closeShiftModal = Shift.closeShiftModal;
window.switchShiftView = Shift.switchShiftView;
window.renderShiftStaffList = Shift.renderShiftStaffList;
window.selectShiftStaff = Shift.selectShiftStaff;
window.backToShiftList = Shift.backToShiftList;
window.loadAllShiftData = Shift.loadAllShiftData;
window.renderShiftCalendar = Shift.renderShiftCalendar;
window.toggleShiftOffDay = Shift.toggleShiftOffDay;
window.changeShiftMonth = Shift.changeShiftMonth;
window.saveShiftSubmission = Shift.saveShiftSubmission;
window.renderShiftAdminTable = Shift.renderShiftAdminTable;
window.checkShiftAdminPassword = Shift.checkShiftAdminPassword;

// Member Race
window.switchMemberTab = MemberRace.switchMemberTab;
window.updateMemberCount = MemberRace.updateMemberCount;
window.changeMemberMonth = MemberRace.changeMemberMonth;
window.openMemberSettings = MemberRace.openMemberSettings;
window.closeMemberTargetModal = MemberRace.closeMemberTargetModal;
window.saveMemberTargets = MemberRace.saveMemberTargets;
window.editMemberTarget = MemberRace.editMemberTarget;
window.renderMemberRaceBoard = MemberRace.renderMemberRaceBoard;

// --- Main Initialization ---

window.checkPassword = function() {
    const input = document.getElementById('password-input');
    if(Auth.check(input.value)) {
        UI.closePasswordModal();
        Auth.executeCallback();
    } else {
        document.getElementById('password-error').classList.remove('hidden');
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // 0. Render Static Components
    renderModals();
    renderInfoSections();

    // 1. Initial Data Load
    Customer.fetchCustomerData();
    Deadlines.initDeadlines();

    // Expose Deadlines modal functions
    window.openDeadlineManagementModal = Deadlines.openDeadlineManagementModal;
    window.closeDeadlineManagementModal = Deadlines.closeDeadlineManagementModal;
    window.addDeadlineDirectly = Deadlines.addDeadlineDirectly;

    // Expose Simple ToDo functions
    window.openSimpleTodoModal = SimpleTodo.openSimpleTodoModal;
    window.closeSimpleTodoModal = SimpleTodo.closeSimpleTodoModal;
    window.addSimpleTodo = SimpleTodo.addSimpleTodo;
    window.clearCompletedTodos = SimpleTodo.clearCompletedTodos;
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

    // Switch View callback integration
    window.switchView = (view) => UI.switchView(view);

    // Shift Button Setup (Static HTML)
    Shift.injectShiftButton();
});
