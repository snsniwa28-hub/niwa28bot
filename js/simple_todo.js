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
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast } from './ui.js';

let unsubscribe = null;

export function initSimpleTodo() {
    // Optional initialization if needed
}

export function openSimpleTodoModal() {
    const modal = document.getElementById('simple-todo-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Focus input
    setTimeout(() => {
        document.getElementById('todo-input')?.focus();
    }, 100);

    // Start Realtime Listener
    subscribeTodos();
}

export function closeSimpleTodoModal() {
    const modal = document.getElementById('simple-todo-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
}

function subscribeTodos() {
    if (unsubscribe) return;

    const q = query(collection(db, 'simple_todos'), orderBy('createdAt', 'asc'));

    unsubscribe = onSnapshot(q, (snapshot) => {
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

    const activeTodos = todos.filter(t => !t.isCompleted);
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

    // Text
    const text = document.createElement('p');
    text.className = `flex-1 text-sm font-bold leading-relaxed break-words ${
        todo.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'
    }`;
    text.textContent = todo.text;

    // Delete Button (visible on hover)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "text-slate-300 hover:text-rose-500 transition opacity-0 group-hover:opacity-100 p-1";
    deleteBtn.innerHTML = '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('このタスクを削除しますか？')) {
            deleteTodo(todo.id);
        }
    };

    div.appendChild(checkbox);
    div.appendChild(text);
    div.appendChild(deleteBtn);

    return div;
}

export async function addSimpleTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        input.value = ''; // Clear immediately
        await addDoc(collection(db, 'simple_todos'), {
            text: text,
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
    try {
        const ref = doc(db, 'simple_todos', id);
        await updateDoc(ref, {
            isCompleted: !currentStatus
        });
    } catch (error) {
        console.error("Error toggling todo:", error);
        showToast('更新に失敗しました', true);
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
        const q = query(collection(db, 'simple_todos'), where('isCompleted', '==', true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showToast('完了済みのタスクはありません');
            return;
        }

        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        showToast('完了済みタスクを一括削除しました');
    } catch (error) {
        console.error("Error clearing todos:", error);
        showToast('一括削除に失敗しました', true);
    }
}
