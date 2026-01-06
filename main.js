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
import * as AI from './js/ai.js';

// --- Global Helpers Compatibility (Exposing to Window) ---
// Note: We keep these for now to support any dynamic HTML that might still rely on them,
// but for static index.html elements, we now use addEventListener.

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
window.selectOption = Tasks.selectOption;
window.confirmSelection = Tasks.confirmSelection;
window.closeSelectModal = Tasks.closeSelectModal;
window.closeModal = UI.closeModal;

// Customer
window.fetchCustomerData = Customer.fetchCustomerData;
window.renderToday = Customer.renderToday;
window.openNewOpening = Customer.openNewOpening;
window.closeNewOpeningModal = Customer.closeNewOpeningModal;
window.closeDetailModal = Customer.closeDetailModal;
// Map Update
window.openMapUpdateModal = Customer.openMapUpdateModal;
window.closeMapUpdateModal = Customer.closeMapUpdateModal;
window.saveMapUpdate = Customer.saveMapUpdate;
window.handleMapFileSelect = Customer.handleMapFileSelect;

// Internal Shared Modal
window.openInternalSharedModal = Strategy.openInternalSharedModal;
window.closeInternalSharedModal = function () {
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};
window.openStrategyAdminAuth = Strategy.openStrategyAdminAuth;
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
window.openQSCModal = QSC.openQSCModal;
window.closeQscEditModal = QSC.closeQscEditModal;
window.saveQscEdit = QSC.saveQscEdit;
window.handleQscTab = (tab) => QSC.setQscTab(tab);

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
window.changeDate = function (offset) {
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

// Deadlines
window.openDeadlineManagementModal = Deadlines.openDeadlineManagementModal;
window.closeDeadlineManagementModal = Deadlines.closeDeadlineManagementModal;
window.addDeadlineDirectly = Deadlines.addDeadlineDirectly;

// AI
window.toggleAIChat = AI.toggleAIChat;
window.closeAIChat = AI.closeAIChat;
window.sendAIMessage = AI.sendAIMessage;

// --- Main Initialization ---

window.checkPassword = function () {
    const input = document.getElementById('password-input');
    if (Auth.check(input.value)) {
        UI.closePasswordModal();
        Auth.executeCallback();
    } else {
        document.getElementById('password-error').classList.remove('hidden');
    }
};

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
            if (show) el.classList.remove('hidden');
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

document.addEventListener("DOMContentLoaded", () => {
    // 0. Render Static Components
    renderModals();
    renderInfoSections();

    // 1. Initialize Event Listeners (Refactored from inline onclick)
    initEventListeners();

    // 2. Initial Data Load
    Customer.fetchCustomerData();
    Deadlines.initDeadlines();
    Strategy.initStrategy();
    AI.initAI();
    QSC.subscribeQSC();
    Tasks.fetchMasterData().then(() => {
        MemberRace.subscribeMemberRace();
    });
    Operations.subscribeOperations();

    // Shift Button Setup
    Shift.injectShiftButton();

    // Initial View Logic
    if (window.location.hash === '#staff') {
        UI.switchView('staff', {
            onStaffView: () => {
                Tasks.setupInitialView();
                Tasks.handleDateChange(getTodayDateString());
            }
        });
    }

    // Override switchView for hash handling
    const originalSwitchView = window.switchView;
    window.switchView = (view) => UI.switchView(view, {
        onStaffView: () => {
            Tasks.setupInitialView();
            if (!window.taskDocRef) {
                Tasks.handleDateChange(getTodayDateString());
            }
        }
    });
});

function initEventListeners() {
    // --- Helper for safe binding ---
    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // --- Header & Nav ---
    bind('nav-top', 'click', (e) => {
        e.preventDefault();
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    });
    bind('nav-shared', 'click', () => Strategy.openInternalSharedModal());
    bind('nav-ai', 'click', () => AI.toggleAIChat());

    // --- Dashboard Cards ---
    bind('card-staff', 'click', () => window.switchView('staff'));

    // Strategy Cards
    ['pachinko', 'slot', 'cs', 'strategy'].forEach(category => {
        bind(`card-${category}`, 'click', () => Strategy.openInternalSharedModal(category));
        bind(`admin-${category}`, 'click', (e) => {
            e.stopPropagation();
            Strategy.openStrategyAdminAuth(category);
        });
    });

    // --- Sections ---
    // Deadlines
    bind('btn-deadline-settings', 'click', () => UI.showPasswordModal(Deadlines.openDeadlineManagementModal));

    // Member Race
    bind('btn-member-prev', 'click', (e) => { e.preventDefault(); MemberRace.changeMemberMonth(-1); });
    bind('btn-member-next', 'click', (e) => { e.preventDefault(); MemberRace.changeMemberMonth(1); });
    bind('btn-member-settings', 'click', (e) => { e.preventDefault(); MemberRace.openMemberSettings(); });
    bind('btn-member-early', 'click', () => MemberRace.switchMemberTab('early'));
    bind('btn-member-late', 'click', () => MemberRace.switchMemberTab('late'));
    bind('btn-member-employee', 'click', () => MemberRace.switchMemberTab('employee'));

    // Map
    bind('btn-map-update', 'click', () => UI.showPasswordModal(Customer.openMapUpdateModal));

    // --- Staff View ---
    bind('btn-staff-back', 'click', () => window.switchView('customer'));
    bind('btn-staff-date-prev', 'click', () => window.changeDate(-1));
    bind('btn-staff-date-next', 'click', () => window.changeDate(1));
    bind('date-picker', 'change', (e) => Tasks.handleDateChange(e.target.value));

    bind('tab-open', 'click', () => Tasks.showSubTab('open'));
    bind('tab-close', 'click', () => Tasks.showSubTab('close'));

    bind('filter-btn-all', 'click', () => window.filterTasks('all'));
    bind('filter-btn-employee', 'click', () => window.filterTasks('employee'));
    bind('filter-btn-byte', 'click', () => window.filterTasks('byte'));

    bind('edit-mode-button', 'click', Tasks.toggleAdminEdit);

    // --- Modals ---
    // Deadline Management
    bind('btn-close-deadline-modal', 'click', Deadlines.closeDeadlineManagementModal);
    bind('btn-add-deadline', 'click', Deadlines.addDeadlineDirectly);

    // Map Update
    bind('btn-close-map-modal', 'click', Customer.closeMapUpdateModal);
    bind('btn-save-map', 'click', Customer.saveMapUpdate);

    // Internal Shared
    bind('btn-close-shared', 'click', () => {
        document.getElementById('internalSharedModal').classList.add('hidden');
    });
    bind('btn-create-strategy-mobile', 'click', Strategy.openStrategyEditor);

    // Strategy Editor
    bind('btn-cancel-strategy', 'click', Strategy.closeStrategyEditor);
    bind('btn-save-strategy', 'click', Strategy.saveStrategy);
    bind('btn-add-block-img-top', 'click', () => Strategy.addEditorBlock('img_top'));
    bind('btn-add-block-text', 'click', () => Strategy.addEditorBlock('text'));
    bind('btn-add-block-img-bottom', 'click', () => Strategy.addEditorBlock('img_bottom'));

    // Member Target
    bind('btn-close-member-target', 'click', MemberRace.closeMemberTargetModal);
    bind('btn-save-member-target', 'click', MemberRace.saveMemberTargets);

    // QSC Edit
    bind('btn-close-qsc-edit', 'click', QSC.closeQscEditModal);
    bind('btn-save-qsc-edit', 'click', QSC.saveQscEdit);
    bind('openQSCButton', 'click', QSC.openQSCModal);

    // Remarks
    bind('btn-close-remarks', 'click', Tasks.closeRemarksModal);

    // AI Chat
    bind('ai-overlay', 'click', () => AI.toggleAIChat());
    bind('btn-ai-close', 'click', () => AI.toggleAIChat());
    bind('btn-ai-send', 'click', () => AI.sendAIMessage());
    bind('btn-ai-fab', 'click', () => AI.toggleAIChat());

    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                AI.sendAIMessage();
            }
        });
    }

    // Customer Detail Modals (if buttons exist)
    bind('newOpeningButton', 'click', Customer.openNewOpening);
    bind('closeNewOpeningModal', 'click', Customer.closeNewOpeningModal);
    bind('closeDetailModal', 'click', Customer.closeDetailModal);

    // --- Edit Mode & Fixed Staff ---
    bind('btn-bulk-delete', 'click', Tasks.openBulkDeleteMenu);
    bind('btn-auto-open', 'click', () => Tasks.autoAssignSection('open'));
    bind('btn-auto-close', 'click', () => Tasks.autoAssignSection('close'));

    // Fixed Position Buttons (Early)
    bind('fixed-money_count-btn', 'click', () => Tasks.openFixedStaffSelect('fixed_money_count','open_early','金銭業務 (早番)'));
    bind('fixed_open_warehouse-btn', 'click', () => Tasks.openFixedStaffSelect('fixed_open_warehouse','open_early','倉庫番 (特景)'));
    bind('fixed-open_counter-btn', 'click', () => Tasks.openFixedStaffSelect('fixed_open_counter','open_late','カウンター開設'));

    // Fixed Position Buttons (Late)
    bind('fixed-money_collect-btn', 'click', () => Tasks.openFixedStaffSelect('fixed_money_collect','close_emp','金銭回収'));
    bind('fixed-warehouses-btn', 'click', () => Tasks.openFixedStaffSelect('fixed_warehouses','close_all','倉庫整理'));
    bind('fixed-counters-btn', 'click', () => Tasks.openFixedStaffSelect('fixed_counters','close_all','カウンター'));

    // Add Staff Buttons
    bind('btn-add-staff-open-early', 'click', () => Tasks.openStaffSelect('early','employees'));
    bind('btn-add-staff-open-late', 'click', () => Tasks.openStaffSelect('late','alba_early'));
    bind('btn-add-staff-close-emp', 'click', () => Tasks.openStaffSelect('closing_employee','employees'));
    bind('btn-add-staff-close-alba', 'click', () => Tasks.openStaffSelect('closing_alba','alba_late'));

    // Legacy Deadline Modal (if used)
    bind('btn-cancel-legacy-deadline', 'click', Deadlines.closeDeadlineModal);
    bind('btn-add-legacy-deadline', 'click', Deadlines.addDeadline);
}
