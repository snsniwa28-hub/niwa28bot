// Event Listeners for index.html (Part 1)

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.getElementById('nav-top')?.addEventListener('click', (e) => {
        e.preventDefault(); // href="#"
        document.documentElement.scrollTo({top:0, behavior:'smooth'});
    });

    document.getElementById('nav-internal-shared')?.addEventListener('click', () => {
        window.toggleAIChat('unified', '社内共有・戦略（全体）');
    });

    // Views
    document.getElementById('switch-view-customer-btn')?.addEventListener('click', () => {
        window.switchView('customer');
    });

    // Chat / Strategy
    document.getElementById('open-unified-chat-btn')?.addEventListener('click', () => {
        window.openCategoryChat('unified', '社内共有・戦略');
    });

    document.getElementById('open-strategy-admin-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.openStrategyAdminAuth('strategy');
    });

    // Deadlines
    document.getElementById('open-deadline-management-btn')?.addEventListener('click', () => {
        window.showPasswordModal(window.openDeadlineManagementModal);
    });

    // Simple ToDo
    document.getElementById('open-simple-todo-btn')?.addEventListener('click', () => {
        window.openSimpleTodoModal();
    });

    // Member Race
    document.getElementById('prev-member-month-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.changeMemberMonth(-1);
    });

    document.getElementById('next-member-month-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.changeMemberMonth(1);
    });

    document.getElementById('open-member-settings-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openMemberSettings();
    });

    document.getElementById('btn-member-early')?.addEventListener('click', () => {
        window.switchMemberTab('early');
    });
    document.getElementById('btn-member-late')?.addEventListener('click', () => {
        window.switchMemberTab('late');
    });
    document.getElementById('btn-member-employee')?.addEventListener('click', () => {
        window.switchMemberTab('employee');
    });

    // Map
    document.getElementById('open-map-update-btn')?.addEventListener('click', () => {
        window.showPasswordModal(window.openMapUpdateModal);
    });

    // --- Part 2: Modals ---

    // Deadline Management Modal
    document.getElementById('close-deadline-view-btn')?.addEventListener('click', () => {
        window.closeDeadlineManagementModal();
    });

    document.getElementById('add-deadline-directly-btn')?.addEventListener('click', () => {
        window.addDeadlineDirectly();
    });

    // Simple ToDo Modal
    document.getElementById('close-todo-view-btn')?.addEventListener('click', () => {
        window.closeSimpleTodoModal();
    });

    document.getElementById('add-todo-btn')?.addEventListener('click', () => {
        window.addSimpleTodo();
    });

    document.getElementById('todo-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
             window.addSimpleTodo();
        }
    });

    document.getElementById('clear-completed-todos-btn')?.addEventListener('click', () => {
        window.clearCompletedTodos();
    });

    // Map Update Modal
    document.getElementById('map-file-input')?.addEventListener('change', function() {
        window.handleMapFileSelect(this);
    });

    document.getElementById('close-map-update-view-btn')?.addEventListener('click', () => {
        window.closeMapUpdateModal();
    });

    document.getElementById('btn-save-map')?.addEventListener('click', () => {
        window.saveMapUpdate();
    });

    // Internal Shared Modal
    document.getElementById('btn-open-knowledge-add')?.addEventListener('click', () => {
        window.openKnowledgeAddModal();
    });

    document.getElementById('close-internal-shared-view-btn')?.addEventListener('click', () => {
        document.getElementById('internal-shared-view').classList.remove('active');
    });

    // Knowledge Add Modal
    document.getElementById('close-knowledge-add-modal')?.addEventListener('click', () => {
        window.closeKnowledgeAddModal();
    });

    document.getElementById('btn-save-knowledge')?.addEventListener('click', () => {
        window.saveKnowledge();
    });

    document.getElementById('ka-file')?.addEventListener('change', function() {
        window.handleContextFileUpload(this);
    });

    // Member Target Modal
    document.getElementById('close-member-target-modal-btn')?.addEventListener('click', () => {
        window.closeMemberTargetModal();
    });

    document.getElementById('save-member-targets-btn')?.addEventListener('click', () => {
        window.saveMemberTargets();
    });

    // QSC Edit Modal
    document.getElementById('close-qsc-edit-modal-btn')?.addEventListener('click', () => {
        window.closeQscEditModal();
    });

    document.getElementById('save-qsc-edit-btn')?.addEventListener('click', () => {
        window.saveQscEdit();
    });

    // Deadline Modal (Simple)
    document.getElementById('close-deadline-modal-btn')?.addEventListener('click', () => {
        window.closeDeadlineModal();
    });

    document.getElementById('add-deadline-btn')?.addEventListener('click', () => {
        window.addDeadline();
    });

    // AI Chat Modal
    document.getElementById('ai-chat-overlay')?.addEventListener('click', () => {
        window.toggleAIChat();
    });

    document.getElementById('close-ai-chat-btn')?.addEventListener('click', () => {
        window.toggleAIChat();
    });

    document.getElementById('ai-input')?.addEventListener('keydown', (event) => {
        if(event.key === 'Enter' && !event.shiftKey){
             event.preventDefault();
             window.sendAIMessage();
        }
    });

    document.getElementById('send-ai-message-btn')?.addEventListener('click', () => {
        window.sendAIMessage();
    });

    // --- Part 3: Dynamic Content Delegation ---

    // Internal Shared Modal Body Delegation (Strategies, etc.)
    document.getElementById('internal-shared-view')?.addEventListener('click', (e) => {
        // Knowledge Filter
        const filterBtn = e.target.closest('[data-action="filter-knowledge"]');
        if (filterBtn) {
            window.setKnowledgeFilter(filterBtn.dataset.filter);
            return;
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('js-calc-trigger')) {
             window.calcOpTotal(e.target.dataset.time);
        }
    });

    // --- Dynamic Modal Delegation (via #modals-container) ---
    const modalsContainer = document.getElementById('modals-container');
    if (modalsContainer) {
        modalsContainer.addEventListener('click', (e) => {
            const target = e.target;

            // Operations Modal handled in operations.js

            // Calendar Modal
            if (target.closest('#btn-close-calendar')) window.closeMonthlyCalendar();

            // QSC Modal
            // Note: QSC View is now static in HTML, but dynamic content might still be delegated if added here?
            // Actually, we moved QSC View OUT of #modals-container. So these listeners won't fire for QSC View elements if they are in QSC View.
            // But QSC Modal (Edit) might still be in modals container? No, we replaced QSC Modal.
            // We need to move these listeners to direct attachment or document body delegation if needed.
            // For now, removing them from here and adding direct listeners below.

            // Machine Detail Modal
            if (target.closest('#closeDetailModal')) window.closeDetailModal();

            // Password Modal
            if (target.id === 'btn-cancel-password') window.closePasswordModal();
            if (target.id === 'btn-check-password') window.checkPassword();
        });
    }

    // --- Static View Event Listeners (Moved from Delegation) ---

    // QSC View
    document.getElementById('btn-add-qsc-item')?.addEventListener('click', () => window.addQscItem());
    document.getElementById('qscEditButton')?.addEventListener('click', () => window.openQSCModal()); // In header
    document.getElementById('close-qsc-view-btn')?.addEventListener('click', () => window.closeQSCModal());
    document.getElementById('qscTabUnfinished')?.addEventListener('click', () => window.handleQscTab('未実施'));
    document.getElementById('qscTabFinished')?.addEventListener('click', () => window.handleQscTab('完了'));

    // New Opening Card (Dashboard)
    document.getElementById('newOpeningCard')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.openNewOpening();
    });

    // New Opening View
    document.getElementById('close-new-opening-view-btn')?.addEventListener('click', () => window.closeNewOpeningModal());

    // New Opening View - Admin Button
    document.getElementById('btn-open-new-opening-admin')?.addEventListener('click', () => {
        window.openNewOpeningEditAuth();
    });

    // New Opening Edit - Close (Back)
    document.getElementById('close-new-opening-edit-view-btn')?.addEventListener('click', () => {
        window.closeNewOpeningEditView();
    });

    document.getElementById('no-edit-save-btn')?.addEventListener('click', () => {
        window.saveNewOpeningItem();
    });

    document.getElementById('no-edit-clear-btn')?.addEventListener('click', () => {
        window.openNewOpeningEdit(); // Re-opens (resets) form
    });

    document.getElementById('no-edit-image-upload')?.addEventListener('change', function() {
        window.handleNewOpeningImageSelect(this);
    });

    document.getElementById('no-edit-add-url-btn')?.addEventListener('click', () => {
        window.handleAddNewUrl();
    });

    // QSC Edit Buttons (Delegation for dynamic list items inside #qsc-view)
    document.getElementById('qsc-view')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit-qsc')) {
            // Logic handled in renderQSCList by attaching onclick directly to element creation
            // So no delegation needed here if js/qsc.js does it.
            // Checking js/qsc.js: Yes, d.querySelector('.btn-edit-qsc').onclick = ...
        }
    });
});
