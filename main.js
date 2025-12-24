// Imports from new modules
import * as UI from './js/ui.js';
import * as Customer from './js/customer.js';
import * as Operations from './js/operations.js';
import * as QSC from './js/qsc.js';
import * as Shift from './js/shift.js';
import * as Tasks from './js/tasks.js';
import * as MemberRace from './js/member_race.js';
import * as Deadlines from './js/deadlines.js';
import * as Strategy from './js/strategy.js';
import { renderModals, renderInfoSections, changeStrategySlide } from './js/components.js';
import { getTodayDateString, getYesterdayDateString, getTaskColorClass } from './js/utils.js';
import { EDIT_PASSWORD } from './js/config.js';

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
window.selectOption = Tasks.selectOption; // Tasks manages the select logic
window.confirmSelection = Tasks.confirmSelection;
window.closeSelectModal = Tasks.closeSelectModal;
window.closeModal = UI.closeModal;

// Customer
window.fetchCustomerData = Customer.fetchCustomerData;
window.renderToday = Customer.renderToday;
window.openNewOpening = Customer.openNewOpening;
window.closeNewOpeningModal = Customer.closeNewOpeningModal;
window.closeDetailModal = Customer.closeDetailModal;

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

// QSC
window.subscribeQSC = QSC.subscribeQSC;
window.renderQSCList = QSC.renderQSCList;
window.addQscItem = QSC.addQscItem;
window.deleteQscItem = QSC.deleteQscItem;
window.openQSCModal = QSC.openQSCModal; // Replaced specific inline code
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

// Tasks (Staff App)
window.fetchMasterData = Tasks.fetchMasterData;
window.handleDateChange = Tasks.handleDateChange;
window.changeDate = function(offset) {
    const picker = document.getElementById('date-picker');
    if (!picker) return;
    const currentVal = picker.value || window.getTodayDateString();
    if (!currentVal) return;

    const date = new Date(currentVal);
    date.setDate(date.getDate() + offset);

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const newVal = `${y}-${m}-${d}`;

    picker.value = newVal;
    Tasks.handleDateChange(newVal);
};
window.refreshCurrentView = Tasks.refreshCurrentView;
window.setupInitialView = Tasks.setupInitialView;
window.saveStaffListToFirestore = Tasks.saveStaffListToFirestore;
window.showSubTab = Tasks.showSubTab;
window.setEditingMode = Tasks.setEditingMode;
window.autoAssignSection = Tasks.autoAssignSection;
window.autoAssignTasks = Tasks.autoAssignTasks;
window.openFixedStaffSelect = Tasks.openFixedStaffSelect;
window.setFixed = Tasks.setFixed;
window.updateRemark = Tasks.updateRemark;
window.addTask = Tasks.addTask;
window.addS = Tasks.addS;
window.openStaffSelect = Tasks.openStaffSelect;
window.openTimeSelect = Tasks.openTimeSelect;
window.openTaskSelect = Tasks.openTaskSelect;
window.confirmDeleteRequest = Tasks.confirmDeleteRequest;
window.openBulkDeleteMenu = Tasks.openBulkDeleteMenu;
window.closeBulkDeleteModal = Tasks.closeBulkDeleteModal;
window.requestBulkDelete = Tasks.requestBulkDelete;
window.cancelDelete = Tasks.cancelDelete;
window.confirmDelete = Tasks.confirmDelete;
window.showRemarksModal = Tasks.showRemarksModal;
window.closeRemarksModal = Tasks.closeRemarksModal;

// --- Main Initialization ---

window.checkPassword = function() {
    const input = document.getElementById('password-input');
    if(input.value.trim().toLowerCase() === EDIT_PASSWORD) {
        UI.closePasswordModal();
        const ctx = UI.getAuthContext();
        
        // Handle Strategy Admin
        if (ctx && ctx.startsWith('strategy_admin_')) {
            const category = ctx.replace('strategy_admin_', '');
            Strategy.openStrategyAdmin(category);
            return;
        }

        if (ctx === 'admin') {
            Tasks.activateAdminMode();
            Deadlines.openDeadlineManagementModal();
            // Removed global Strategy admin activation
        } else if (ctx === 'qsc') {
            QSC.activateQscEditMode();
        } else if (ctx === 'shift_admin') {
            Shift.activateShiftAdminMode();
        } else if (ctx === 'member_admin') {
            MemberRace.showMemberTargetModal();
        }
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

    // ★追加: 戦略共有の初期化
    Strategy.initStrategy();

    QSC.subscribeQSC();
    Tasks.fetchMasterData().then(() => {
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

    // Tasks / Staff
    const editModeBtn = document.getElementById('edit-mode-button');
    if(editModeBtn) editModeBtn.onclick = Tasks.toggleAdminEdit;
    
    // Switch View callback integration
    window.switchView = (view) => UI.switchView(view, {
        onStaffView: () => {
             Tasks.setupInitialView();
             if(!window.taskDocRef) { // Check if initialized (Tasks logic handles this mostly)
                 Tasks.handleDateChange(getTodayDateString());
             }
        }
    });

    // Check Hash
    if(window.location.hash === '#staff') {
        UI.switchView('staff', {
             onStaffView: () => {
                 Tasks.setupInitialView();
                 Tasks.handleDateChange(getTodayDateString());
             }
        });
    }

    // Shift Button Setup (Static HTML)
    Shift.injectShiftButton();
});

window.filterTasks = (type) => {
    // 1. Update Button Styles
    const buttons = {
        all: document.getElementById('filter-btn-all'),
        employee: document.getElementById('filter-btn-employee'),
        byte: document.getElementById('filter-btn-byte')
    };

    Object.keys(buttons).forEach(key => {
        const btn = buttons[key];
        if (btn) {
            if (key === type) {
                btn.className = "filter-btn px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-sm transition-all";
            } else {
                btn.className = "filter-btn px-4 py-1.5 rounded-full text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all";
            }
        }
    });

    // 2. Toggle Visibility using Partial Matches
    const toggle = (selector, show) => {
        document.querySelectorAll(selector).forEach(el => {
            if(show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
    };

    const setVisibility = (isEmployee, isVisible) => {
         const infix = isEmployee ? 'employee' : 'alba';
         const selector = `[id*="summary-open-${infix}-container"], [id*="summary-close-${infix}-container"]`;
         toggle(selector, isVisible);
    };

    if (type === 'all') {
        setVisibility(true, true);  // Employee
        setVisibility(false, true); // Byte
    } else if (type === 'employee') {
        setVisibility(true, true);
        setVisibility(false, false);
    } else if (type === 'byte') {
        setVisibility(true, false);
        setVisibility(false, true);
    }
};
