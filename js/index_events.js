// Event Listeners for index.html (Part 1)

document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.getElementById('nav-top')?.addEventListener('click', (e) => {
        e.preventDefault(); // href="#"
        document.documentElement.scrollTo({top:0, behavior:'smooth'});
    });

    document.getElementById('nav-internal-shared')?.addEventListener('click', () => {
        window.openInternalSharedModal();
    });

    // Views
    document.getElementById('switch-view-staff-btn')?.addEventListener('click', () => {
        window.switchView('staff');
    });

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

    // Staff Header
    document.getElementById('prev-date-btn')?.addEventListener('click', () => {
        window.changeDate(-1);
    });

    document.getElementById('next-date-btn')?.addEventListener('click', () => {
        window.changeDate(1);
    });

    document.getElementById('date-picker')?.addEventListener('change', function() {
        window.handleDateChange(this.value);
    });

    // Staff Tabs
    document.getElementById('tab-open')?.addEventListener('click', () => {
        window.showSubTab('open');
    });

    document.getElementById('tab-close')?.addEventListener('click', () => {
        window.showSubTab('close');
    });

    // Filter Buttons
    document.getElementById('filter-btn-all')?.addEventListener('click', () => {
        window.filterTasks('all');
    });
    document.getElementById('filter-btn-employee')?.addEventListener('click', () => {
        window.filterTasks('employee');
    });
    document.getElementById('filter-btn-byte')?.addEventListener('click', () => {
        window.filterTasks('byte');
    });

    // Bulk Delete
    document.getElementById('open-bulk-delete-menu-btn')?.addEventListener('click', () => {
        window.openBulkDeleteMenu();
    });

    // Auto Assign
    document.getElementById('auto-assign-open-btn')?.addEventListener('click', () => {
        window.autoAssignSection('open');
    });
    document.getElementById('auto-assign-close-btn')?.addEventListener('click', () => {
        window.autoAssignSection('close');
    });

    // Fixed Staff Select (Open)
    document.getElementById('fixed-money_count-btn')?.addEventListener('click', () => {
        window.openFixedStaffSelect('fixed_money_count','open_early','金銭業務 (早番)');
    });
    document.getElementById('fixed_open_warehouse-btn')?.addEventListener('click', () => {
        window.openFixedStaffSelect('fixed_open_warehouse','open_early','倉庫番 (特景)');
    });
    document.getElementById('fixed-open_counter-btn')?.addEventListener('click', () => {
        window.openFixedStaffSelect('fixed_open_counter','open_late','カウンター開設');
    });

    // Add Staff (Open)
    document.getElementById('add-staff-early-employee-btn')?.addEventListener('click', () => {
        window.openStaffSelect('early','employees');
    });
    document.getElementById('add-staff-late-alba-btn')?.addEventListener('click', () => {
        window.openStaffSelect('late','alba_early');
    });

    // Fixed Staff Select (Close)
    document.getElementById('fixed-money_collect-btn')?.addEventListener('click', () => {
        window.openFixedStaffSelect('fixed_money_collect','close_emp','金銭回収');
    });
    document.getElementById('fixed-warehouses-btn')?.addEventListener('click', () => {
        window.openFixedStaffSelect('fixed_warehouses','close_all','倉庫整理');
    });
    document.getElementById('fixed-counters-btn')?.addEventListener('click', () => {
        window.openFixedStaffSelect('fixed_counters','close_all','カウンター');
    });

    // Add Staff (Close)
    document.getElementById('add-staff-close-employee-btn')?.addEventListener('click', () => {
        window.openStaffSelect('closing_employee','employees');
    });
    document.getElementById('add-staff-close-alba-btn')?.addEventListener('click', () => {
        window.openStaffSelect('closing_alba','alba_late');
    });

    // --- Part 2: Modals ---

    // Deadline Management Modal
    document.getElementById('close-deadline-management-modal-btn')?.addEventListener('click', () => {
        window.closeDeadlineManagementModal();
    });

    document.getElementById('add-deadline-directly-btn')?.addEventListener('click', () => {
        window.addDeadlineDirectly();
    });

    // Map Update Modal
    document.getElementById('map-file-input')?.addEventListener('change', function() {
        window.handleMapFileSelect(this);
    });

    document.getElementById('close-map-update-modal-btn')?.addEventListener('click', () => {
        window.closeMapUpdateModal();
    });

    document.getElementById('btn-save-map')?.addEventListener('click', () => {
        window.saveMapUpdate();
    });

    // Internal Shared Modal
    document.getElementById('btn-knowledge-list')?.addEventListener('click', () => {
        window.toggleKnowledgeList();
    });

    document.getElementById('btn-create-strategy-mobile')?.addEventListener('click', () => {
        window.openStrategyEditor();
    });

    document.getElementById('close-internal-shared-modal-btn')?.addEventListener('click', () => {
        document.getElementById('internalSharedModal').classList.add('hidden');
    });

    // Strategy Editor Modal
    document.getElementById('cancel-strategy-editor-btn')?.addEventListener('click', () => {
        window.closeStrategyEditor();
    });

    document.getElementById('add-block-img-top-btn')?.addEventListener('click', () => {
        window.addEditorBlock('img_top');
    });

    document.getElementById('add-block-text-btn')?.addEventListener('click', () => {
        window.addEditorBlock('text');
    });

    document.getElementById('add-block-img-bottom-btn')?.addEventListener('click', () => {
        window.addEditorBlock('img_bottom');
    });

    document.getElementById('save-strategy-btn')?.addEventListener('click', () => {
        window.saveStrategy();
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

    // Remarks Modal
    document.getElementById('close-remarks-modal-btn')?.addEventListener('click', () => {
        window.closeRemarksModal();
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
});
