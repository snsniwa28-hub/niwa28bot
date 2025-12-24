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
import * as Auth from './js/auth.js';

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
    // Ensure that we only execute the callback and close modal if password is correct.
    // The previous large branching logic (if any) is removed/replaced by this simple callback execution.
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

    // ★追加: 戦略共有の初期化
    Strategy.initStrategy();

    QSC.subscribeQSC();
    Tasks.fetchMasterData().then(() => {
        MemberRace.subscribeMemberRace();
    });
    Operations.subscribeOperations();

    // 2. Event Listeners Setup (Replacement of onclick attributes)

    // Navigation
    const navBtnTop = document.getElementById('nav-btn-top');
    if(navBtnTop) navBtnTop.addEventListener('click', (e) => {
        e.preventDefault();
        document.documentElement.scrollTo({top:0, behavior:'smooth'});
    });

    const navBtnShared = document.getElementById('nav-btn-shared');
    if(navBtnShared) navBtnShared.addEventListener('click', () => window.openInternalSharedModal());

    // Dashboard Cards
    const cardTodaysTasks = document.getElementById('card-todays-tasks');
    if(cardTodaysTasks) cardTodaysTasks.addEventListener('click', () => window.switchView('staff'));

    // Shared Strategy Cards & Admin Buttons
    const setupSharedCard = (cardId, adminBtnId, category) => {
        const card = document.getElementById(cardId);
        if(card) card.addEventListener('click', () => window.openInternalSharedModal(category));

        const btn = document.getElementById(adminBtnId);
        if(btn) btn.addEventListener('click', (e) => {
            e.stopPropagation();
            Strategy.openStrategyAdminAuth(category);
        });
    };

    setupSharedCard('card-shared-pachinko', 'btn-admin-pachinko', 'pachinko');
    setupSharedCard('card-shared-slot', 'btn-admin-slot', 'slot');
    setupSharedCard('card-shared-cs', 'btn-admin-cs', 'cs');
    setupSharedCard('card-shared-strategy', 'btn-admin-strategy', 'strategy');

    // Deadline Section
    const btnDeadlineAdmin = document.getElementById('btn-deadline-admin');
    if(btnDeadlineAdmin) btnDeadlineAdmin.addEventListener('click', () => {
        // Fix: Use callback to open ONLY the deadline management modal
        UI.showPasswordModal(Deadlines.openDeadlineManagementModal);
    });

    // Member Acquisition Section
    const btnMemberPrev = document.getElementById('btn-member-prev');
    if(btnMemberPrev) btnMemberPrev.addEventListener('click', (e) => {
        e.preventDefault();
        MemberRace.changeMemberMonth(-1);
    });

    const btnMemberNext = document.getElementById('btn-member-next');
    if(btnMemberNext) btnMemberNext.addEventListener('click', (e) => {
        e.preventDefault();
        MemberRace.changeMemberMonth(1);
    });

    const btnMemberSettings = document.getElementById('btn-member-settings');
    if(btnMemberSettings) btnMemberSettings.addEventListener('click', (e) => {
        e.preventDefault();
        MemberRace.openMemberSettings();
    });

    const btnMemberEarly = document.getElementById('btn-member-early');
    if(btnMemberEarly) btnMemberEarly.addEventListener('click', () => MemberRace.switchMemberTab('early'));

    const btnMemberLate = document.getElementById('btn-member-late');
    if(btnMemberLate) btnMemberLate.addEventListener('click', () => MemberRace.switchMemberTab('late'));

    const btnMemberEmployee = document.getElementById('btn-member-employee');
    if(btnMemberEmployee) btnMemberEmployee.addEventListener('click', () => MemberRace.switchMemberTab('employee'));


    // Staff View Controls
    const btnStaffBack = document.getElementById('btn-staff-back');
    if(btnStaffBack) btnStaffBack.addEventListener('click', () => UI.switchView('customer'));

    const btnDatePrev = document.getElementById('btn-date-prev');
    if(btnDatePrev) btnDatePrev.addEventListener('click', () => window.changeDate(-1));

    const btnDateNext = document.getElementById('btn-date-next');
    if(btnDateNext) btnDateNext.addEventListener('click', () => window.changeDate(1));

    const editModeBtn = document.getElementById('edit-mode-button');
    if(editModeBtn) editModeBtn.addEventListener('click', Tasks.toggleAdminEdit);

    const tabOpen = document.getElementById('tab-open');
    if(tabOpen) tabOpen.addEventListener('click', () => Tasks.showSubTab('open'));

    const tabClose = document.getElementById('tab-close');
    if(tabClose) tabClose.addEventListener('click', () => Tasks.showSubTab('close'));

    // Filters
    const filterBtnAll = document.getElementById('filter-btn-all');
    if(filterBtnAll) filterBtnAll.addEventListener('click', () => window.filterTasks('all'));

    const filterBtnEmp = document.getElementById('filter-btn-employee');
    if(filterBtnEmp) filterBtnEmp.addEventListener('click', () => window.filterTasks('employee'));

    const filterBtnByte = document.getElementById('filter-btn-byte');
    if(filterBtnByte) filterBtnByte.addEventListener('click', () => window.filterTasks('byte'));

    const btnBulkDelete = document.getElementById('btn-bulk-delete');
    if(btnBulkDelete) btnBulkDelete.addEventListener('click', Tasks.openBulkDeleteMenu);

    // Auto Assign Buttons
    const btnAutoAssignOpen = document.getElementById('btn-auto-assign-open');
    if(btnAutoAssignOpen) btnAutoAssignOpen.addEventListener('click', () => Tasks.autoAssignSection('open'));

    const btnAutoAssignClose = document.getElementById('btn-auto-assign-close');
    if(btnAutoAssignClose) btnAutoAssignClose.addEventListener('click', () => Tasks.autoAssignSection('close'));

    // Fixed Position Buttons (Open)
    const btnFixedMoneyCount = document.getElementById('fixed-money_count-btn');
    if(btnFixedMoneyCount) btnFixedMoneyCount.addEventListener('click', () => Tasks.openFixedStaffSelect('fixed_money_count','open_early','金銭業務 (早番)'));

    const btnFixedOpenWarehouse = document.getElementById('fixed_open_warehouse-btn');
    if(btnFixedOpenWarehouse) btnFixedOpenWarehouse.addEventListener('click', () => Tasks.openFixedStaffSelect('fixed_open_warehouse','open_early','倉庫番 (特景)'));

    const btnFixedOpenCounter = document.getElementById('fixed-open_counter-btn');
    if(btnFixedOpenCounter) btnFixedOpenCounter.addEventListener('click', () => Tasks.openFixedStaffSelect('fixed_open_counter','open_late','カウンター開設'));

    // Fixed Position Buttons (Close)
    const btnFixedMoneyCollect = document.getElementById('fixed-money_collect-btn');
    if(btnFixedMoneyCollect) btnFixedMoneyCollect.addEventListener('click', () => Tasks.openFixedStaffSelect('fixed_money_collect','close_emp','金銭回収'));

    const btnFixedWarehouses = document.getElementById('fixed-warehouses-btn');
    if(btnFixedWarehouses) btnFixedWarehouses.addEventListener('click', () => Tasks.openFixedStaffSelect('fixed_warehouses','close_all','倉庫整理'));

    const btnFixedCounters = document.getElementById('fixed-counters-btn');
    if(btnFixedCounters) btnFixedCounters.addEventListener('click', () => Tasks.openFixedStaffSelect('fixed_counters','close_all','カウンター'));

    // Add Staff Buttons
    const btnAddStaffOpenEmp = document.getElementById('btn-add-staff-open-emp');
    if(btnAddStaffOpenEmp) btnAddStaffOpenEmp.addEventListener('click', () => Tasks.openStaffSelect('early','employees'));

    const btnAddStaffOpenAlba = document.getElementById('btn-add-staff-open-alba');
    if(btnAddStaffOpenAlba) btnAddStaffOpenAlba.addEventListener('click', () => Tasks.openStaffSelect('late','alba_early'));

    const btnAddStaffCloseEmp = document.getElementById('btn-add-staff-close-emp');
    if(btnAddStaffCloseEmp) btnAddStaffCloseEmp.addEventListener('click', () => Tasks.openStaffSelect('closing_employee','employees'));

    const btnAddStaffCloseAlba = document.getElementById('btn-add-staff-close-alba');
    if(btnAddStaffCloseAlba) btnAddStaffCloseAlba.addEventListener('click', () => Tasks.openStaffSelect('closing_alba','alba_late'));

    // Modals Close/Save Buttons
    const btnCloseDeadlineMgmt = document.getElementById('btn-close-deadline-mgmt');
    if(btnCloseDeadlineMgmt) btnCloseDeadlineMgmt.addEventListener('click', Deadlines.closeDeadlineManagementModal);

    const btnDeadlineAdd = document.getElementById('btn-deadline-add');
    if(btnDeadlineAdd) btnDeadlineAdd.addEventListener('click', Deadlines.addDeadlineDirectly);

    const btnCloseSharedModal = document.getElementById('btn-close-shared-modal');
    if(btnCloseSharedModal) btnCloseSharedModal.addEventListener('click', window.closeInternalSharedModal);

    // Strategy Editor Buttons
    const btnCloseStrategyEditor = document.getElementById('btn-close-strategy-editor');
    if(btnCloseStrategyEditor) btnCloseStrategyEditor.addEventListener('click', Strategy.closeStrategyEditor);

    const btnAddBlockImgTop = document.getElementById('btn-add-block-img-top');
    if(btnAddBlockImgTop) btnAddBlockImgTop.addEventListener('click', () => Strategy.addEditorBlock('img_top'));

    const btnAddBlockText = document.getElementById('btn-add-block-text');
    if(btnAddBlockText) btnAddBlockText.addEventListener('click', () => Strategy.addEditorBlock('text'));

    const btnAddBlockImgBottom = document.getElementById('btn-add-block-img-bottom');
    if(btnAddBlockImgBottom) btnAddBlockImgBottom.addEventListener('click', () => Strategy.addEditorBlock('img_bottom'));

    const btnSaveStrategy = document.getElementById('btn-save-strategy');
    if(btnSaveStrategy) btnSaveStrategy.addEventListener('click', Strategy.saveStrategy);

    // Member Target Modal
    const btnCloseMemberTarget = document.getElementById('btn-close-member-target');
    if(btnCloseMemberTarget) btnCloseMemberTarget.addEventListener('click', MemberRace.closeMemberTargetModal);

    const btnSaveMemberTarget = document.getElementById('btn-save-member-target');
    if(btnSaveMemberTarget) btnSaveMemberTarget.addEventListener('click', MemberRace.saveMemberTargets);

    // QSC Edit Modal
    const btnCloseQsc = document.getElementById('btn-close-qsc');
    if(btnCloseQsc) btnCloseQsc.addEventListener('click', QSC.closeQscEditModal);

    const btnSaveQsc = document.getElementById('btn-save-qsc');
    if(btnSaveQsc) btnSaveQsc.addEventListener('click', QSC.saveQscEdit);

    // Remarks Modal
    const btnCloseRemarks = document.getElementById('btn-close-remarks');
    if(btnCloseRemarks) btnCloseRemarks.addEventListener('click', Tasks.closeRemarksModal);

    // Deadline Add Modal (Bottom)
    const btnCloseDeadlineAdd = document.getElementById('btn-close-deadline-add');
    if(btnCloseDeadlineAdd) btnCloseDeadlineAdd.addEventListener('click', Deadlines.closeDeadlineModal);

    const btnSubmitDeadlineAdd = document.getElementById('btn-submit-deadline-add');
    if(btnSubmitDeadlineAdd) btnSubmitDeadlineAdd.addEventListener('click', Deadlines.addDeadline);

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
