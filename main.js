// Imports from new modules
import * as UI from './js/ui.js';
import * as Customer from './js/customer.js';
import * as Operations from './js/operations.js';
import * as QSC from './js/qsc.js';
import * as Shift from './js/shift.js';
import * as Tasks from './js/tasks.js';
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
window.openInternalSharedModal = function() {
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeInternalSharedModal = function() {
    const modal = document.getElementById('internalSharedModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

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

// Tasks (Staff App)
window.fetchMasterData = Tasks.fetchMasterData;
window.handleDateChange = Tasks.handleDateChange;
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
        
        if (ctx === 'admin') {
            Tasks.activateAdminMode();
        } else if (ctx === 'qsc') {
            QSC.activateQscEditMode();
        } else if (ctx === 'shift_admin') {
            Shift.activateShiftAdminMode();
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
    QSC.subscribeQSC();
    Tasks.fetchMasterData();
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
