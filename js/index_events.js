import * as UI from './ui.js';
import * as Customer from './customer.js';
import * as Operations from './operations.js';
import * as QSC from './qsc.js';
import * as Shift from './shift.js';
import * as MemberRace from './member_race.js';
import * as Deadlines from './deadlines.js';
import * as Strategy from './strategy.js';
import * as SimpleTodo from './simple_todo.js';
import * as Auth from './auth.js';
import * as AI from './ai.js';

// Helper for Password Check (formerly global window.checkPassword in main.js)
function checkPassword() {
    const input = document.getElementById('password-input');
    if (Auth.check(input.value)) {
        UI.closePasswordModal();
        Auth.executeCallback();
    } else {
        document.getElementById('password-error').classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.getElementById('nav-top')?.addEventListener('click', (e) => {
        e.preventDefault(); // href="#"
        document.documentElement.scrollTo({top:0, behavior:'smooth'});
    });

    document.getElementById('nav-internal-shared')?.addEventListener('click', () => {
        AI.toggleAIChat('unified', '社内共有・戦略（全体）');
    });

    // Views
    document.getElementById('switch-view-customer-btn')?.addEventListener('click', () => {
        UI.switchView('customer');
    });

    // Chat / Strategy
    document.getElementById('open-unified-chat-btn')?.addEventListener('click', () => {
        AI.toggleAIChat('unified', '社内共有・戦略');
    });

    document.getElementById('open-strategy-admin-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        Strategy.openStrategyAdminAuth('strategy');
    });

    // Deadlines
    document.getElementById('open-deadline-management-btn')?.addEventListener('click', () => {
        UI.showPasswordModal(Deadlines.openDeadlineManagementModal);
    });

    // Simple ToDo
    document.getElementById('open-simple-todo-btn')?.addEventListener('click', () => {
        SimpleTodo.openSimpleTodoModal();
    });

    // Member Race
    document.getElementById('prev-member-month-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        MemberRace.changeMemberMonth(-1);
    });

    document.getElementById('next-member-month-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        MemberRace.changeMemberMonth(1);
    });

    document.getElementById('open-member-settings-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        MemberRace.openMemberSettings();
    });

    document.getElementById('btn-member-early')?.addEventListener('click', () => {
        MemberRace.switchMemberTab('early');
    });
    document.getElementById('btn-member-late')?.addEventListener('click', () => {
        MemberRace.switchMemberTab('late');
    });
    document.getElementById('btn-member-employee')?.addEventListener('click', () => {
        MemberRace.switchMemberTab('employee');
    });

    // Map
    document.getElementById('open-map-update-btn')?.addEventListener('click', () => {
        UI.showPasswordModal(Customer.openMapUpdateModal);
    });

    // --- Part 2: Modals ---

    // Deadline Management Modal
    document.getElementById('close-deadline-view-btn')?.addEventListener('click', () => {
        Deadlines.closeDeadlineManagementModal();
    });

    document.getElementById('add-deadline-directly-btn')?.addEventListener('click', () => {
        Deadlines.addDeadlineDirectly();
    });

    // Simple ToDo Modal
    document.getElementById('close-todo-view-btn')?.addEventListener('click', () => {
        SimpleTodo.closeSimpleTodoModal();
    });

    document.getElementById('add-todo-btn')?.addEventListener('click', () => {
        SimpleTodo.addSimpleTodo();
    });

    document.getElementById('todo-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
             SimpleTodo.addSimpleTodo();
        }
    });

    document.getElementById('clear-completed-todos-btn')?.addEventListener('click', () => {
        SimpleTodo.clearCompletedTodos();
    });

    // Map Update Modal
    document.getElementById('map-file-input')?.addEventListener('change', function() {
        Customer.handleMapFileSelect(this);
    });

    document.getElementById('close-map-update-view-btn')?.addEventListener('click', () => {
        Customer.closeMapUpdateModal();
    });

    document.getElementById('btn-save-map')?.addEventListener('click', () => {
        Customer.saveMapUpdate();
    });

    // Internal Shared Modal
    document.getElementById('btn-open-knowledge-add')?.addEventListener('click', () => {
        Strategy.openKnowledgeAddModal();
    });

    document.getElementById('btn-refresh-knowledge')?.addEventListener('click', () => {
        Strategy.manualUpdateSummary();
    });

    document.getElementById('close-internal-shared-view-btn')?.addEventListener('click', () => {
        document.getElementById('internal-shared-view').classList.remove('active');
    });

    // Knowledge Add Modal
    document.getElementById('close-knowledge-add-modal')?.addEventListener('click', () => {
        Strategy.closeKnowledgeAddModal();
    });

    document.getElementById('btn-save-knowledge')?.addEventListener('click', () => {
        Strategy.saveKnowledge();
    });

    document.getElementById('ka-file')?.addEventListener('change', function() {
        Strategy.handleContextFileUpload(this);
    });

    // Knowledge Detail Modal
    document.getElementById('btn-cancel-strategy-detail')?.addEventListener('click', () => {
        Strategy.closeStrategyDetailModal();
    });
    document.getElementById('btn-cancel-strategy-detail-2')?.addEventListener('click', () => {
        Strategy.closeStrategyDetailModal();
    });
    document.getElementById('btn-save-strategy-detail')?.addEventListener('click', () => {
        Strategy.updateStrategyDetail();
    });

    // Member Target Modal
    document.getElementById('close-member-target-modal-btn')?.addEventListener('click', () => {
        MemberRace.closeMemberTargetModal();
    });

    document.getElementById('save-member-targets-btn')?.addEventListener('click', () => {
        MemberRace.saveMemberTargets();
    });

    // QSC Edit Modal
    document.getElementById('close-qsc-edit-modal-btn')?.addEventListener('click', () => {
        QSC.closeQscEditModal();
    });

    document.getElementById('save-qsc-edit-btn')?.addEventListener('click', () => {
        QSC.saveQscEdit();
    });

    // Deadline Modal (Simple)
    document.getElementById('close-deadline-modal-btn')?.addEventListener('click', () => {
        Deadlines.closeDeadlineModal();
    });

    document.getElementById('add-deadline-btn')?.addEventListener('click', () => {
        Deadlines.addDeadline();
    });

    // AI Chat Modal
    document.getElementById('ai-chat-overlay')?.addEventListener('click', () => {
        AI.toggleAIChat();
    });

    document.getElementById('close-ai-chat-btn')?.addEventListener('click', () => {
        AI.toggleAIChat();
    });

    document.getElementById('ai-input')?.addEventListener('keydown', (event) => {
        if(event.key === 'Enter' && !event.shiftKey){
             event.preventDefault();
             AI.sendAIMessage();
        }
    });

    document.getElementById('send-ai-message-btn')?.addEventListener('click', () => {
        AI.sendAIMessage();
    });

    // --- Part 3: Dynamic Content Delegation ---

    // Internal Shared Modal Body Delegation (Strategies, etc.)
    document.getElementById('internal-shared-view')?.addEventListener('click', (e) => {
        // Knowledge Filter
        const filterBtn = e.target.closest('[data-action="filter-knowledge"]');
        if (filterBtn) {
            // Strategy.setKnowledgeFilter(filterBtn.dataset.filter); // Not implemented
            return;
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('js-calc-trigger')) {
             Operations.calcOpTotal(e.target.dataset.time);
        }
    });

    // --- Dynamic Modal Delegation (via #modals-container) ---
    const modalsContainer = document.getElementById('modals-container');
    if (modalsContainer) {
        modalsContainer.addEventListener('click', (e) => {
            const target = e.target;

            // Operations Modal handled in operations.js

            // Calendar Modal
            if (target.closest('#btn-close-calendar')) Operations.closeMonthlyCalendar();

            // Machine Detail Modal
            if (target.closest('#closeDetailModal')) Customer.closeDetailModal();

            // Password Modal
            if (target.id === 'btn-cancel-password') UI.closePasswordModal();
            if (target.id === 'btn-check-password') checkPassword();
        });
    }

    // Password Input Enter Key
    document.getElementById('password-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkPassword();
        }
    });

    // --- Static View Event Listeners (Moved from Delegation) ---

    // QSC View
    document.getElementById('btn-add-qsc-item')?.addEventListener('click', () => QSC.addQscItem());
    document.getElementById('qscEditButton')?.addEventListener('click', () => QSC.openQSCModal()); // In header
    document.getElementById('close-qsc-view-btn')?.addEventListener('click', () => QSC.closeQSCModal());
    document.getElementById('qscTabUnfinished')?.addEventListener('click', () => QSC.setQscTab('未実施'));
    document.getElementById('qscTabFinished')?.addEventListener('click', () => QSC.setQscTab('完了'));

    // New Opening Card (Dashboard)
    document.getElementById('newOpeningCard')?.addEventListener('click', (e) => {
        e.preventDefault();
        Customer.openNewOpening();
    });

    // New Opening View
    document.getElementById('close-new-opening-view-btn')?.addEventListener('click', () => Customer.closeNewOpeningModal());

    // New Opening View - Admin Button
    document.getElementById('btn-open-new-opening-admin')?.addEventListener('click', () => {
        Customer.openNewOpeningEditAuth();
    });

    // New Opening Edit - Close (Back)
    document.getElementById('close-new-opening-edit-view-btn')?.addEventListener('click', () => {
        Customer.closeNewOpeningEditView();
    });

    document.getElementById('no-edit-save-btn')?.addEventListener('click', () => {
        Customer.saveNewOpeningItem();
    });

    document.getElementById('no-edit-clear-btn')?.addEventListener('click', () => {
        Customer.openNewOpeningEdit(); // Re-opens (resets) form
    });

    document.getElementById('no-edit-image-upload')?.addEventListener('change', function() {
        Customer.handleNewOpeningImageSelect(this);
    });

    document.getElementById('no-edit-add-url-btn')?.addEventListener('click', () => {
        Customer.handleAddNewUrl();
    });

    // Delegated Slideshow (New Opening)
    document.getElementById('newOpeningInfo')?.addEventListener('click', (e) => {
        const prevBtn = e.target.closest('.btn-slide-prev');
        const nextBtn = e.target.closest('.btn-slide-next');

        if (prevBtn) {
            Customer.changeSlide(prevBtn.dataset.id, -1);
        } else if (nextBtn) {
            Customer.changeSlide(nextBtn.dataset.id, 1);
        }
    });

    // Delegated Image Removal (New Opening Edit)
    document.getElementById('no-edit-images-preview')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-image');
        if (removeBtn) {
            Customer.removeNewOpeningImage(parseInt(removeBtn.dataset.idx));
        }
    });

    // --- Restored oninput handlers for Operations Inputs ---
    const opInputs = [
        { id: 'in_4p_15', time: '15' },
        { id: 'in_1p_15', time: '15' },
        { id: 'in_20s_15', time: '15' },
        { id: 'in_4p_19', time: '19' },
        { id: 'in_1p_19', time: '19' },
        { id: 'in_20s_19', time: '19' }
    ];
    opInputs.forEach(item => {
        const el = document.getElementById(item.id);
        if(el) el.addEventListener('input', () => Operations.calcOpTotal(item.time));
    });
});
