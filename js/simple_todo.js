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
    arrayUnion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui.js';

let unsubscribeTodos = null;
let unsubscribeCategories = null;
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
                const view = document.getElementById('todo-view');
                if (view && view.classList.contains('active') && !currentCategory) {
                    renderCategoryView();
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
    renderCategoryView();
}

export function closeSimpleTodoModal() {
    const view = document.getElementById('todo-view');
    if (view) {
        view.classList.remove('active');
    }
    if (unsubscribeTodos) {
        unsubscribeTodos();
        unsubscribeTodos = null;
    }
}

function subscribeTodos(category) {
    if (unsubscribeTodos) {
        unsubscribeTodos();
        unsubscribeTodos = null;
    }

    let q;
    if (category) {
        // Note: Client-side sorting is performed in renderTodos, so we can omit orderBy here
        // to avoid requiring a composite index (category + createdAt) immediately.
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

    const completedTodos = todos.filter(t => t.isCompleted);

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
            createdAt: serverTimestamp()
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
                completionImage: null    // Clear report
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

export function renderCategoryView() {
    const viewCategories = document.getElementById('simple-todo-view-categories');
    const viewTasks = document.getElementById('simple-todo-view-tasks');
    if (!viewCategories || !viewTasks) return;

    // Unsubscribe from todos as we are in menu
    if (unsubscribeTodos) {
        unsubscribeTodos();
        unsubscribeTodos = null;
    }

    viewTasks.classList.add('hidden');
    viewCategories.classList.remove('hidden');

    updateHeader('チームToDoリスト');

    viewCategories.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-3';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-500 transition text-left flex flex-col gap-2 group';
        btn.innerHTML = `
            <span class="text-2xl">📁</span>
            <span class="font-bold text-slate-700 group-hover:text-blue-600">${cat}</span>
        `;
        btn.onclick = () => {
            currentCategory = cat;
            renderTaskView();
        };
        grid.appendChild(btn);
    });

    // Add Category Button
    const addBtn = document.createElement('button');
    addBtn.className = 'bg-slate-100 border border-slate-200 border-dashed rounded-xl p-4 text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 hover:text-slate-600 transition';
    addBtn.innerHTML = `<span>＋</span> カテゴリ追加`;
    addBtn.onclick = addNewCategory;

    grid.appendChild(addBtn);
    viewCategories.appendChild(grid);
}

export function renderTaskView() {
    const viewCategories = document.getElementById('simple-todo-view-categories');
    const viewTasks = document.getElementById('simple-todo-view-tasks');
    if (!viewCategories || !viewTasks) return;

    viewCategories.classList.add('hidden');
    viewTasks.classList.remove('hidden');

    updateHeader(null, true);

    setTimeout(() => {
        document.getElementById('todo-input')?.focus();
    }, 100);

    subscribeTodos(currentCategory);
}

function updateHeader(titleText, showBack = false) {
    const h2 = document.getElementById('todo-view-title');
    if (!h2) return;

    if (showBack) {
        h2.innerHTML = `
            <button id="todo-back-btn" class="mr-2 text-slate-400 hover:text-blue-600 transition">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span>${currentCategory}</span>
        `;
        const backBtn = h2.querySelector('#todo-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                currentCategory = null;
                renderCategoryView();
            };
        }
    } else {
        h2.innerHTML = `<span>✅</span> ${titleText}`;
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
            completionImage: imageBase64 || null
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
