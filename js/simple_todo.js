import { db } from './firebase.js';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    updateDoc,
    doc,
    deleteDoc,
    where,
    writeBatch,
    serverTimestamp,
    getDocs,
    getDoc,
    setDoc,
    arrayUnion,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, showPasswordModal } from './ui.js';

let unsubscribeTodos = null;
let unsubscribeCategories = null;
let unsubscribeDashboardActive = null;
let unsubscribeDashboardRecent = null;

export let categories = [];
export let currentCategory = null;

let currentPendingTodoId = null; // For modal handling

export async function initSimpleTodo() {
    try {
        ensureCompletionModals(); // Inject modals

        // Ensure Categories
        const todoDataRef = doc(db, 'masters', 'todo_data');
        const todoDataSnap = await getDoc(todoDataRef);

        if (!todoDataSnap.exists()) {
            await setDoc(todoDataRef, {
                categories: ['店内オペレーション', 'カウンター関係', '接客', '会員', '抽選']
            });
        }

        unsubscribeCategories = onSnapshot(todoDataRef, (doc) => {
            if (doc.exists()) {
                categories = doc.data().categories || [];
                // Only refresh if we are in the category/dashboard view
                const viewCategories = document.getElementById('simple-todo-view-categories');
                const view = document.getElementById('todo-view'); // Using full view check
                if (view && view.classList.contains('active') && viewCategories && !viewCategories.classList.contains('hidden')) {
                    renderDashboard();
                }
            }
        });

        const staffDocRef = doc(db, 'masters', 'staff_data');
        const staffSnap = await getDoc(staffDocRef);

        if (staffSnap.exists()) {
            const data = staffSnap.data();
            const allStaff = [
                ...(data.employees || []),
                ...(data.alba_early || []),
                ...(data.alba_late || [])
            ];

            // Deduplicate and filter empty
            const uniqueStaff = [...new Set(allStaff)].filter(name => name).sort();

            const select = document.getElementById('todo-assignee');
            if (select) {
                // Keep the first option "担当者未定"
                select.innerHTML = '<option value="">担当者未定</option>';

                uniqueStaff.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    select.appendChild(option);
                });
            }
        }

    } catch (error) {
        console.error("Error fetching staff for todo:", error);
    }
}

export function openSimpleTodoModal() {
    const view = document.getElementById('todo-view');
    if (!view) return;
    view.classList.add('active');

    currentCategory = null;
    renderDashboard();
}

export function closeSimpleTodoModal() {
    const view = document.getElementById('todo-view');
    if (view) {
        view.classList.remove('active');
    }
    // Unsubscribe all
    if (unsubscribeTodos) { unsubscribeTodos(); unsubscribeTodos = null; }
    if (unsubscribeDashboardActive) { unsubscribeDashboardActive(); unsubscribeDashboardActive = null; }
    if (unsubscribeDashboardRecent) { unsubscribeDashboardRecent(); unsubscribeDashboardRecent = null; }
}

function subscribeTodos(category) {
    if (unsubscribeTodos) {
        unsubscribeTodos();
        unsubscribeTodos = null;
    }

    let q;
    if (category) {
        // Note: Client-side sorting is performed in renderTodos
        q = query(collection(db, 'simple_todos'), where('category', '==', category));
    } else {
        q = query(collection(db, 'simple_todos'), orderBy('createdAt', 'asc'));
    }

    unsubscribeTodos = onSnapshot(q, (snapshot) => {
        const todos = [];
        snapshot.forEach((doc) => {
            todos.push({ id: doc.id, ...doc.data() });
        });
        renderTodos(todos);
    }, (error) => {
        console.error("Error fetching todos:", error);
        showToast('ToDoリストの読み込みに失敗しました', true);
    });
}

function renderTodos(todos) {
    const activeList = document.getElementById('todo-list-active');
    const completedList = document.getElementById('todo-list-completed');
    const completedContainer = document.getElementById('todo-list-completed-container');

    if (!activeList || !completedList) return;

    activeList.innerHTML = '';
    completedList.innerHTML = '';

    const activeTodos = todos
        .filter(t => !t.isCompleted)
        .sort((a, b) => {
            // 1. Due Date (ASC)
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;

            // 2. CreatedAt (ASC) - old to new
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
            return tA - tB;
        });

    // Completed: Sort by completedAt desc if available
    const completedTodos = todos
        .filter(t => t.isCompleted)
        .sort((a, b) => {
             const tA = a.completedAt?.toMillis ? a.completedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
             const tB = b.completedAt?.toMillis ? b.completedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
             return tB - tA; // Newest completed first
        });

    // Render Active
    activeTodos.forEach(todo => {
        const div = createTodoElement(todo);
        activeList.appendChild(div);
    });

    // Render Completed
    if (completedTodos.length > 0) {
        completedContainer.classList.remove('hidden');
        completedTodos.forEach(todo => {
            const div = createTodoElement(todo);
            completedList.appendChild(div);
        });
    } else {
        completedContainer.classList.add('hidden');
    }
}

function createTodoElement(todo) {
    const div = document.createElement('div');
    div.className = "flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md group";

    // Checkbox
    const checkbox = document.createElement('div');
    checkbox.className = `w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors shrink-0 mt-0.5 ${
        todo.isCompleted
        ? 'bg-blue-500 border-blue-500 text-white'
        : 'border-slate-300 hover:border-blue-500 text-transparent'
    }`;
    checkbox.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>';
    checkbox.onclick = () => toggleTodoStatus(todo.id, todo.isCompleted);

    // Content Container
    const content = document.createElement('div');
    content.className = "flex-1 min-w-0";

    // 1. Header Row (Title + Assignee)
    const header = document.createElement('div');
    header.className = "flex flex-wrap items-center gap-2 mb-1";

    const text = document.createElement('span');
    text.className = `text-sm font-bold leading-relaxed break-words ${
        todo.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'
    }`;
    text.textContent = todo.text;
    header.appendChild(text);

    if (todo.assignee) {
        const badge = document.createElement('span');
        badge.className = "bg-indigo-50 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100 whitespace-nowrap";
        badge.textContent = todo.assignee;
        header.appendChild(badge);
    }
    content.appendChild(header);

    // 2. Detail Text
    if (todo.detail) {
        const detail = document.createElement('p');
        detail.className = "text-xs text-slate-500 leading-relaxed whitespace-pre-wrap break-words mb-1";
        detail.textContent = todo.detail;
        content.appendChild(detail);
    }

    // 3. Due Date
    if (todo.dueDate) {
        const dateDiv = document.createElement('div');

        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(todo.dueDate);
        due.setHours(0,0,0,0);

        // Format M/D
        const dateStr = `${due.getMonth() + 1}/${due.getDate()}`;

        let dateClass = "text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full inline-flex items-center gap-1";
        let icon = "📅";
        let label = `${dateStr} まで`;

        if (due < today && !todo.isCompleted) {
            // Overdue
            dateClass = "text-xs font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1";
            icon = "⚠️";
            label = `${dateStr} (期限切れ)`;
        } else if (due.getTime() === today.getTime() && !todo.isCompleted) {
            // Today
            dateClass = "text-xs font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1";
            icon = "🔥";
            label = "今日まで";
        }

        dateDiv.innerHTML = `<span class="${dateClass}"><span>${icon}</span> ${label}</span>`;
        content.appendChild(dateDiv);
    }

    // 4. Completion Report (Image & Comment)
    if (todo.isCompleted) {
        const reportContainer = document.createElement('div');
        reportContainer.className = "mt-2 flex flex-col gap-2";

        if (todo.completionComment) {
            const comment = document.createElement('div');
            comment.className = "text-xs text-slate-600 bg-blue-50 border border-blue-100 p-2 rounded-lg";

            const labelSpan = document.createElement('span');
            labelSpan.className = "font-bold text-blue-500 mr-1";
            labelSpan.textContent = "📝 報告:";

            const textSpan = document.createElement('span');
            textSpan.textContent = todo.completionComment;

            comment.appendChild(labelSpan);
            comment.appendChild(textSpan);
            reportContainer.appendChild(comment);
        }

        if (todo.completionImage) {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = "relative inline-block group/img";

            const img = document.createElement('img');
            img.src = todo.completionImage;
            img.className = "h-20 w-auto rounded-lg border border-slate-200 object-cover cursor-zoom-in hover:opacity-90 transition shadow-sm";
            img.onclick = (e) => {
                e.stopPropagation();
                openImageModal(todo.completionImage);
            };

            imgWrapper.appendChild(img);
            reportContainer.appendChild(imgWrapper);
        }

        if (reportContainer.hasChildNodes()) {
            content.appendChild(reportContainer);
        }
    }


    // Delete Button (visible on hover)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100 p-1 shrink-0 self-start";
    deleteBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('このタスクを削除しますか？')) {
            deleteTodo(todo.id);
        }
    };

    div.appendChild(checkbox);
    div.appendChild(content);
    div.appendChild(deleteBtn);

    return div;
}

export async function addSimpleTodo() {
    const input = document.getElementById('todo-input');
    const assigneeInput = document.getElementById('todo-assignee');
    const dateInput = document.getElementById('todo-due-date');
    const detailInput = document.getElementById('todo-detail');

    const text = input.value.trim();
    const assignee = assigneeInput ? assigneeInput.value : '';
    const dueDate = dateInput ? dateInput.value : '';
    const detail = detailInput ? detailInput.value.trim() : '';

    if (!text) return;

    try {
        // Clear immediately
        input.value = '';
        if (assigneeInput) assigneeInput.value = '';
        if (dateInput) dateInput.value = '';
        if (detailInput) detailInput.value = '';

        await addDoc(collection(db, 'simple_todos'), {
            text: text,
            assignee: assignee,
            dueDate: dueDate,
            detail: detail,
            category: currentCategory,
            isCompleted: false,
            createdAt: serverTimestamp(),
            completedAt: null
        });
    } catch (error) {
        console.error("Error adding todo:", error);
        showToast('追加に失敗しました', true);
        input.value = text; // Restore if failed
    }
}

export async function toggleTodoStatus(id, currentStatus) {
    if (!currentStatus) {
        // Active -> Completed: Show Modal
        openCompletionModal(id);
    } else {
        // Completed -> Active: Revert immediately (clear report data)
        try {
            const ref = doc(db, 'simple_todos', id);
            await updateDoc(ref, {
                isCompleted: false,
                completionComment: null, // Clear report
                completionImage: null,   // Clear report
                completedAt: null        // Reset timestamp
            });
        } catch (error) {
            console.error("Error toggling todo:", error);
            showToast('更新に失敗しました', true);
        }
    }
}

export async function deleteTodo(id) {
    try {
        await deleteDoc(doc(db, 'simple_todos', id));
        showToast('削除しました');
    } catch (error) {
        console.error("Error deleting todo:", error);
        showToast('削除に失敗しました', true);
    }
}

export async function clearCompletedTodos() {
    if (!confirm('完了済みのタスクをすべて削除しますか？')) return;

    try {
        // Query all completed todos first (to avoid composite index requirement)
        const q = query(collection(db, 'simple_todos'), where('isCompleted', '==', true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showToast('完了済みのタスクはありません');
            return;
        }

        const batch = writeBatch(db);
        let count = 0;
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Filter by current category if set
            if (currentCategory && data.category !== currentCategory) {
                return;
            }
            batch.delete(doc.ref);
            count++;
        });

        if (count === 0) {
            showToast('このカテゴリに完了済みのタスクはありません');
            return;
        }

        await batch.commit();
        showToast('完了済みタスクを一括削除しました');
    } catch (error) {
        console.error("Error clearing todos:", error);
        showToast('一括削除に失敗しました', true);
    }
}

export function renderDashboard() {
    // Replaces renderCategoryView with Dashboard logic
    const viewCategories = document.getElementById('simple-todo-view-categories');
    const viewTasks = document.getElementById('simple-todo-view-tasks');
    if (!viewCategories || !viewTasks) return;

    // Unsubscribe from tasks view subscription
    if (unsubscribeTodos) {
        unsubscribeTodos();
        unsubscribeTodos = null;
    }

    viewTasks.classList.add('hidden');
    viewCategories.classList.remove('hidden');

    // Reset Close Button to "Close Modal" behavior
    const closeBtn = document.getElementById('close-todo-view-btn');
    if (closeBtn) {
        closeBtn.onclick = closeSimpleTodoModal;
    }

    updateHeader('チームToDoリスト');

    // Setup Header Actions (Settings)
    const headerTitle = document.getElementById('todo-view-title');
    if (headerTitle && !document.getElementById('todo-settings-btn')) {
         // This is handled in updateHeader, but we can ensure settings button logic here
    }

    viewCategories.innerHTML = `
        <div class="space-y-8">
            <!-- 1. Recent Achievements -->
            <section>
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>🏆</span> 最近の達成 (Recent)
                </h3>
                <div id="todo-dashboard-recent" class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide min-h-[80px]">
                    <div class="flex items-center justify-center w-full text-xs text-slate-400 font-bold bg-white rounded-xl py-6 border border-slate-100">
                        読み込み中...
                    </div>
                </div>
            </section>

            <hr class="border-slate-100">

            <!-- 2. Expired (Urgent) -->
            <section>
                <h3 class="text-xs font-bold text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>⚠️</span> 期限切れ (Expired)
                </h3>
                <div id="todo-dashboard-expired" class="space-y-2">
                     <div class="text-center text-xs text-slate-300 font-bold py-2">読み込み中...</div>
                </div>
            </section>

            <!-- 3. Upcoming (Priority) -->
            <section>
                <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>🔥</span> もうすぐ期限 (Upcoming)
                </h3>
                <div id="todo-dashboard-upcoming" class="space-y-2">
                     <div class="text-center text-xs text-slate-300 font-bold py-2">読み込み中...</div>
                </div>
            </section>

            <hr class="border-slate-100">

            <!-- 4. Categories -->
            <section>
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>📁</span> カテゴリ (Categories)
                </h3>
                <div id="todo-dashboard-categories" class="grid grid-cols-2 gap-3">
                     <!-- Categories will be injected here -->
                </div>
            </section>
        </div>
    `;

    fetchDashboardData();
}

function fetchDashboardData() {
    // 1. Unsubscribe old dashboard listeners
    if (unsubscribeDashboardActive) { unsubscribeDashboardActive(); unsubscribeDashboardActive = null; }
    if (unsubscribeDashboardRecent) { unsubscribeDashboardRecent(); unsubscribeDashboardRecent = null; }

    // 2. Fetch Active Tasks (All) - for Priority & Badges
    const qActive = query(collection(db, 'simple_todos'), where('isCompleted', '==', false));
    unsubscribeDashboardActive = onSnapshot(qActive, (snapshot) => {
        const activeTodos = [];
        snapshot.forEach(doc => activeTodos.push({ id: doc.id, ...doc.data() }));
        renderDashboardExpired(activeTodos);
        renderDashboardUpcoming(activeTodos);
        renderDashboardCategories(activeTodos);
    });

    // 3. Fetch Recent Completed (Limit 10)
    // Note: This requires composite index (isCompleted + completedAt).
    // If index is missing, it will error. We should handle that or rely on client side filtering if volume is low.
    // Given the prompt constraints, let's try strict query first. If it fails, we might need index creation.
    const qRecent = query(
        collection(db, 'simple_todos'),
        where('isCompleted', '==', true),
        orderBy('completedAt', 'desc'),
        limit(10)
    );

    unsubscribeDashboardRecent = onSnapshot(qRecent, (snapshot) => {
        const recentTodos = [];
        snapshot.forEach(doc => recentTodos.push({ id: doc.id, ...doc.data() }));
        renderDashboardRecent(recentTodos);
    }, (error) => {
        console.warn("Recent todos query failed (likely missing index). Falling back to basic query.", error);
        // Fallback: Fetch some completed and sort client side (not ideal but works without index)
        const qFallback = query(collection(db, 'simple_todos'), where('isCompleted', '==', true), limit(20));
        getDocs(qFallback).then(snap => {
            let recent = [];
            snap.forEach(doc => recent.push({ id: doc.id, ...doc.data() }));
            recent.sort((a, b) => {
                 const tA = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0;
                 const tB = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0;
                 return tB - tA;
            });
            renderDashboardRecent(recent.slice(0, 10));
        });
    });
}

function renderDashboardRecent(todos) {
    const container = document.getElementById('todo-dashboard-recent');
    if (!container) return;

    if (todos.length === 0) {
        container.innerHTML = `<div class="w-full text-center text-xs text-slate-300 font-bold py-4">最近の完了タスクはありません</div>`;
        return;
    }

    container.innerHTML = '';
    todos.forEach(todo => {
        const el = document.createElement('div');
        el.className = "flex-shrink-0 w-48 bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-blue-200 transition cursor-pointer";

        // Optional Image BG or Icon
        if (todo.completionImage) {
            el.innerHTML += `<div class="absolute top-0 right-0 w-12 h-12 opacity-10"><img src="${todo.completionImage}" class="w-full h-full object-cover rounded-bl-xl"></div>`;
        }

        const date = todo.completedAt?.toDate ? todo.completedAt.toDate() : new Date();
        const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        el.innerHTML += `
            <div class="flex items-center gap-1 mb-0.5">
                <span class="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">${dateStr}</span>
                ${todo.assignee ? `<span class="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[80px]">${todo.assignee}</span>` : ''}
            </div>
            <p class="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed">${todo.text}</p>
            ${todo.completionComment ? `<div class="mt-auto pt-1 text-[10px] text-slate-500 truncate">💬 ${todo.completionComment}</div>` : ''}
        `;

        // Click to see details
        el.onclick = () => showCompletedTaskDetail(todo);
        container.appendChild(el);
    });
}

function renderDashboardExpired(todos) {
    const container = document.getElementById('todo-dashboard-expired');
    if (!container) return;

    // Style the container for urgency
    container.className = "space-y-2 bg-rose-50 p-3 rounded-xl border border-rose-100";

    const today = new Date();
    today.setHours(0,0,0,0);

    const expiredList = todos.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0,0,0,0);
        return due < today;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (expiredList.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-rose-300 font-bold py-2">期限切れのタスクはありません ✅</div>`;
        return;
    }

    container.innerHTML = '';
    expiredList.forEach(todo => {
        const div = createDashboardTaskElement(todo, 'expired');
        container.appendChild(div);
    });
}

function renderDashboardUpcoming(todos) {
    const container = document.getElementById('todo-dashboard-upcoming');
    if (!container) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    const upcomingList = todos.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0,0,0,0);
        return due >= today && due <= dayAfter;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (upcomingList.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-slate-300 font-bold py-2">直近の期限のタスクはありません ✅</div>`;
        return;
    }

    container.innerHTML = '';
    upcomingList.forEach(todo => {
        const div = createDashboardTaskElement(todo, 'upcoming');
        container.appendChild(div);
    });
}

function createDashboardTaskElement(todo, type) {
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer group";
    div.onclick = () => {
        openCompletionModal(todo.id);
    };

    const due = new Date(todo.dueDate);
    due.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);

    let badgeClass = "bg-slate-100 text-slate-500";
    let badgeIcon = "📅";
    let badgeText = `${due.getMonth()+1}/${due.getDate()}`;

    if (type === 'expired') {
        badgeClass = "bg-rose-100 text-rose-600 font-bold";
        badgeIcon = "⚠️";
    } else if (due.getTime() === today.getTime()) {
        badgeClass = "bg-amber-100 text-amber-600 font-bold";
        badgeIcon = "🔥";
        badgeText = "今日まで";
    } else {
        badgeClass = "bg-indigo-50 text-indigo-600 font-bold";
        badgeIcon = "🔜";
    }

    div.innerHTML = `
        <div class="${badgeClass} px-2 py-1 rounded-lg text-[10px] whitespace-nowrap flex items-center gap-1 shrink-0">
            <span>${badgeIcon}</span> ${badgeText}
        </div>
        <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-slate-700 truncate">${todo.text}</p>
            <p class="text-[10px] text-slate-400 font-bold flex gap-2">
                <span>📁 ${todo.category}</span>
                ${todo.assignee ? `<span>👤 ${todo.assignee}</span>` : ''}
            </p>
        </div>
        <div class="opacity-0 group-hover:opacity-100 text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg transition">完了報告</div>
    `;
    return div;
}

function renderDashboardCategories(activeTodos) {
    const container = document.getElementById('todo-dashboard-categories');
    if (!container) return;

    container.innerHTML = '';

    // Count tasks per category
    const counts = {};
    activeTodos.forEach(t => {
        if (!counts[t.category]) counts[t.category] = 0;
        counts[t.category]++;
    });

    categories.forEach(cat => {
        const count = counts[cat] || 0;
        const btn = document.createElement('button');
        btn.className = 'bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-500 transition text-left flex flex-col gap-2 group relative overflow-hidden';

        btn.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="text-2xl">📁</span>
                ${count > 0 ? `<span class="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">${count}</span>` : ''}
            </div>
            <span class="font-bold text-slate-700 group-hover:text-blue-600 text-sm truncate w-full">${cat}</span>
        `;
        btn.onclick = () => {
            currentCategory = cat;
            renderTaskView();
        };
        container.appendChild(btn);
    });
}

export function renderTaskView() {
    const viewCategories = document.getElementById('simple-todo-view-categories');
    const viewTasks = document.getElementById('simple-todo-view-tasks');
    if (!viewCategories || !viewTasks) return;

    viewCategories.classList.add('hidden');
    viewTasks.classList.remove('hidden');

    // Reuse Close Button as "Back to Dashboard"
    const closeBtn = document.getElementById('close-todo-view-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            currentCategory = null;
            renderDashboard();
        };
    }

    updateHeader(currentCategory, true);

    setTimeout(() => {
        document.getElementById('todo-input')?.focus();
    }, 100);

    subscribeTodos(currentCategory);
}

function updateHeader(titleText, isTaskView = false) {
    const h2 = document.getElementById('todo-view-title');
    if (!h2) return;

    // Inject Settings Button in Header if not exists
    const headerContainer = h2.parentElement;
    if (!document.getElementById('todo-settings-btn')) {
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'todo-settings-btn';
        settingsBtn.className = "text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition ml-auto";
        settingsBtn.innerHTML = "⚙️ 管理";
        settingsBtn.onclick = () => {
            showPasswordModal(() => {
                 showCategoryManager();
            });
        };
        headerContainer.appendChild(settingsBtn);
    }

    const settingsBtn = document.getElementById('todo-settings-btn');

    if (isTaskView) {
        h2.innerHTML = `<span>${titleText}</span>`;
        if (settingsBtn) settingsBtn.classList.add('hidden'); // Hide settings in task view
    } else {
        h2.innerHTML = `<span>✅</span> ${titleText}`;
        if (settingsBtn) settingsBtn.classList.remove('hidden'); // Show settings in dashboard
    }
}

async function addNewCategory() {
    const name = prompt('新しいカテゴリ名を入力してください:');
    if (!name || !name.trim()) return;

    if (categories.includes(name.trim())) {
        showToast('そのカテゴリは既に存在します', true);
        return;
    }

    try {
        const todoDataRef = doc(db, 'masters', 'todo_data');
        await updateDoc(todoDataRef, {
            categories: arrayUnion(name.trim())
        });
        showToast(`カテゴリ「${name}」を追加しました`);
    } catch (error) {
        console.error("Error adding category:", error);
        showToast('カテゴリの追加に失敗しました', true);
    }
}

// --- Category Manager ---
function showCategoryManager() {
    // We can reuse the modal logic or inject a simple overlay
    if (document.getElementById('category-manager-modal')) {
        document.getElementById('category-manager-modal').classList.remove('hidden');
        renderCategoryManagerList();
        return;
    }

    const html = `
    <div id="category-manager-modal" class="modal-overlay" style="z-index: 105;">
        <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-slate-800">カテゴリ管理</h3>
                <button onclick="document.getElementById('category-manager-modal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div id="category-manager-list" class="flex-1 overflow-y-auto space-y-2 mb-4"></div>
            <button id="category-manager-add-btn" class="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition border border-indigo-100">＋ カテゴリを追加</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('category-manager-add-btn').onclick = async () => {
        await addNewCategory(); // Reuses existing function
        renderCategoryManagerList();
    };

    renderCategoryManagerList();
}

function renderCategoryManagerList() {
    const list = document.getElementById('category-manager-list');
    if (!list) return;
    list.innerHTML = '';

    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100";
        div.innerHTML = `
            <span class="font-bold text-slate-700">${cat}</span>
            <button class="text-rose-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition" title="削除">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        `;
        div.querySelector('button').onclick = () => deleteCategory(cat);
        list.appendChild(div);
    });
}

async function deleteCategory(categoryName) {
    if (!confirm(`カテゴリ「${categoryName}」を削除しますか？`)) return;

    // Check usage
    const q = query(collection(db, 'simple_todos'), where('category', '==', categoryName), limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
        showToast('タスクが残っているため削除できません', true);
        return;
    }

    try {
        const todoDataRef = doc(db, 'masters', 'todo_data');
        const newData = categories.filter(c => c !== categoryName);
        await updateDoc(todoDataRef, {
            categories: newData
        });
        showToast(`カテゴリ「${categoryName}」を削除しました`);
        // categories array will update via onSnapshot, but manual rerender of manager list needed?
        // onSnapshot updates 'categories' var, but we might need to wait or just optimistic update.
        // The onSnapshot will eventually trigger renderDashboard, but manager list needs refresh.
        // Let's rely on onSnapshot to update global 'categories', but since we are inside a function,
        // we might not see the update immediately.
        // Let's manually refresh list after short delay or fetch.
        setTimeout(renderCategoryManagerList, 500);

    } catch (error) {
        console.error("Error deleting category:", error);
        showToast('削除に失敗しました', true);
    }
}

// --- Completion Modal Logic ---

function ensureCompletionModals() {
    if (!document.getElementById('todo-completion-modal')) {
        const modalHtml = `
        <div id="todo-completion-modal" class="modal-overlay hidden" style="z-index: 100;">
            <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
                <h3 class="text-lg font-bold text-slate-800 mb-4">タスク完了報告</h3>
                <textarea id="todo-completion-comment" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none" rows="3" placeholder="対応内容を入力 (任意)"></textarea>

                <div class="mb-6">
                    <label class="block w-full cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-100 hover:border-blue-400 transition group">
                        <span id="todo-completion-file-label" class="text-sm font-bold text-slate-500 group-hover:text-blue-600">画像添付 (任意)</span>
                        <input type="file" id="todo-completion-image" accept="image/*" class="hidden">
                    </label>
                    <div id="todo-completion-preview" class="mt-2 hidden">
                        <img id="todo-completion-preview-img" class="h-24 rounded border border-slate-200 object-contain mx-auto">
                        <button id="todo-completion-clear-img" class="text-xs text-rose-500 font-bold mt-1 block mx-auto hover:underline">画像を削除</button>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button id="todo-completion-cancel" class="flex-1 py-2.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">キャンセル</button>
                    <button id="todo-completion-save" class="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200 hover:bg-blue-700 transition">完了にする</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup Events
        document.getElementById('todo-completion-cancel').onclick = closeCompletionModal;
        document.getElementById('todo-completion-save').onclick = handleCompletionSave;

        const fileInput = document.getElementById('todo-completion-image');
        const previewDiv = document.getElementById('todo-completion-preview');
        const previewImg = document.getElementById('todo-completion-preview-img');
        const clearImgBtn = document.getElementById('todo-completion-clear-img');
        const labelSpan = document.getElementById('todo-completion-file-label');

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    previewImg.src = ev.target.result;
                    previewDiv.classList.remove('hidden');
                    labelSpan.textContent = "画像を変更";
                };
                reader.readAsDataURL(file);
            }
        };

        clearImgBtn.onclick = () => {
            fileInput.value = '';
            previewDiv.classList.add('hidden');
            previewImg.src = '';
            labelSpan.textContent = "画像添付 (任意)";
        };
    }

    if (!document.getElementById('todo-image-modal')) {
        const imgModalHtml = `
        <div id="todo-image-modal" class="modal-overlay hidden" style="z-index: 110;">
            <div class="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onclick="document.getElementById('todo-image-modal').classList.add('hidden')">
                <img id="todo-image-full" class="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain">
                <button class="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center transition">✕</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', imgModalHtml);
    }

    // Completed Task Detail Modal
    if (!document.getElementById('todo-completed-detail-modal')) {
        const detailModalHtml = `
        <div id="todo-completed-detail-modal" class="modal-overlay hidden" style="z-index: 105;">
            <div class="modal-content p-6 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto relative">
                <button id="todo-completed-detail-close" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">完了タスク詳細</h3>

                <h2 id="detail-todo-text" class="text-lg font-bold text-slate-800 mb-3 leading-relaxed break-words"></h2>

                <div id="detail-todo-meta" class="flex flex-wrap gap-2 mb-6"></div>

                <div id="detail-todo-comment" class="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 hidden">
                    <h4 class="text-xs font-bold text-blue-500 mb-1">📝 完了報告コメント</h4>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"></p>
                </div>

                <div id="detail-todo-image-container" class="mb-4 hidden">
                    <h4 class="text-xs font-bold text-slate-400 mb-2">📷 添付画像</h4>
                    <img id="detail-todo-image" class="w-full rounded-lg border border-slate-200 cursor-zoom-in hover:opacity-95 transition">
                </div>

                <button onclick="document.getElementById('todo-completed-detail-modal').classList.add('hidden')" class="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition mt-auto">閉じる</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', detailModalHtml);

        document.getElementById('todo-completed-detail-close').onclick = () => {
            document.getElementById('todo-completed-detail-modal').classList.add('hidden');
        };
    }
}

export function showCompletedTaskDetail(todo) {
    const modal = document.getElementById('todo-completed-detail-modal');
    if (!modal) return;

    // Populate Data
    const titleEl = document.getElementById('detail-todo-text');
    const metaEl = document.getElementById('detail-todo-meta');
    const commentEl = document.getElementById('detail-todo-comment');
    const imageContainer = document.getElementById('detail-todo-image-container');
    const imageEl = document.getElementById('detail-todo-image');

    // Title
    titleEl.textContent = todo.text;

    // Meta (Assignee + Date)
    const date = todo.completedAt?.toDate ? todo.completedAt.toDate() : new Date();
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    metaEl.innerHTML = `
        <span class="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">📅 ${dateStr}</span>
        ${todo.assignee ? `<span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold">👤 ${todo.assignee}</span>` : ''}
    `;

    // Comment
    if (todo.completionComment) {
        commentEl.classList.remove('hidden');
        commentEl.querySelector('p').textContent = todo.completionComment;
    } else {
        commentEl.classList.add('hidden');
    }

    // Image
    if (todo.completionImage) {
        imageContainer.classList.remove('hidden');
        imageEl.src = todo.completionImage;
        imageEl.onclick = () => openImageModal(todo.completionImage);
    } else {
        imageContainer.classList.add('hidden');
    }

    // Show Modal
    modal.classList.remove('hidden');
}

function openCompletionModal(todoId) {
    currentPendingTodoId = todoId;

    // Reset inputs
    document.getElementById('todo-completion-comment').value = '';
    document.getElementById('todo-completion-image').value = '';
    document.getElementById('todo-completion-preview').classList.add('hidden');
    document.getElementById('todo-completion-file-label').textContent = "画像添付 (任意)";

    const modal = document.getElementById('todo-completion-modal');
    modal.classList.remove('hidden');
}

function closeCompletionModal() {
    const modal = document.getElementById('todo-completion-modal');
    modal.classList.add('hidden');
    currentPendingTodoId = null;
}

function openImageModal(src) {
    const modal = document.getElementById('todo-image-modal');
    const img = document.getElementById('todo-image-full');
    img.src = src;
    modal.classList.remove('hidden');
}

async function handleCompletionSave() {
    if (!currentPendingTodoId) return;

    const comment = document.getElementById('todo-completion-comment').value.trim();
    const fileInput = document.getElementById('todo-completion-image');
    const file = fileInput.files[0];

    // Show loading state if needed, or just toast
    const saveBtn = document.getElementById('todo-completion-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
        let imageBase64 = null;
        if (file) {
            imageBase64 = await compressImage(file);
        }

        const ref = doc(db, 'simple_todos', currentPendingTodoId);
        await updateDoc(ref, {
            isCompleted: true,
            completionComment: comment || null,
            completionImage: imageBase64 || null,
            completedAt: serverTimestamp() // Set timestamp
        });

        showToast('タスクを完了しました');
        closeCompletionModal();

    } catch (error) {
        console.error("Error completing todo:", error);
        showToast('完了処理に失敗しました', true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '完了にする';
    }
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const maxWidth = 1000;
        const maxHeight = 1000;
        const reader = new FileReader();

        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG 0.7
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
