import { save, getTasksByTabAndDate, remove } from '../db.js';
import { generateUUID, getTodayDateString, formatTime, formatDate } from '../utils.js';
import { parseTaskInput } from '../nlp.js';

export default async function PlannerView(container, tabName) {
    const today = getTodayDateString();
    let currentDate = today;

    container.innerHTML = `
        <div class="planner-header" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <p style="color: var(--text-secondary); text-transform: capitalize; font-size: 0.875rem;">${tabName} Planner</p>
                <input type="date" id="date-picker" value="${today}" style="padding: 4px 8px; font-size: 0.875rem; border-radius: 4px; width: auto; background: var(--surface-color);">
            </div>
        </div>
        
        <div id="batch-add-container" class="card" style="margin-bottom: 24px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="quick-add-input" placeholder="e.g. Read chapter 4 tomorrow at 7pm" style="flex: 1;">
                <button id="quick-add-btn" class="primary" style="width: auto; padding: 8px 16px;">Add</button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                 <input type="time" id="quick-add-time" style="width: auto; padding: 6px;">
                 <select id="quick-add-quadrant" style="width: auto; padding: 6px; font-size: 0.875rem;">
                     <option value="">Priority (Opt)</option>
                     <option value="do">Do First</option>
                     <option value="schedule">Schedule</option>
                     <option value="delegate">Delegate</option>
                 </select>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">Tip: You can type times and days directly, like "Meeting 2pm"</div>
        </div>

        <div id="task-list">
            <div style="text-align: center; padding: 20px;">Loading tasks...</div>
        </div>
    `;

    const datePicker = container.querySelector('#date-picker');
    const quickAddInput = container.querySelector('#quick-add-input');
    const quickAddBtn = container.querySelector('#quick-add-btn');
    const quickAddTime = container.querySelector('#quick-add-time');
    const quickAddQuadrant = container.querySelector('#quick-add-quadrant');
    const taskList = container.querySelector('#task-list');

    datePicker.addEventListener('change', (e) => {
        currentDate = e.target.value;
        renderTasks();
    });

    quickAddBtn.addEventListener('click', async () => {
        const rawInput = quickAddInput.value.trim();
        if (!rawInput) return;

        const parsed = parseTaskInput(rawInput);

        const newTask = {
            id: generateUUID(),
            tab: tabName,
            title: parsed.title,
            notes: '',
            date: parsed.date || currentDate,
            time: parsed.time || quickAddTime.value || null,
            done: false,
            doneAt: null,
            quadrant: quickAddQuadrant.value || null,
            important: false,
            energy: null,
            recurring: parsed.recurring || null
        };

        try {
            await save('tasks', newTask);
            quickAddInput.value = '';
            quickAddTime.value = '';
            quickAddQuadrant.value = '';
            renderTasks();
        } catch (e) {
            console.error("Failed to add task", e);
            alert("Failed to save task.");
        }
    });
    
    quickAddInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            quickAddBtn.click();
        }
    });

    async function renderTasks() {
        try {
            const tasks = await getTasksByTabAndDate(tabName, currentDate);
            
            if (tasks.length === 0) {
                taskList.innerHTML = `
                    <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
                        <p>No tasks for ${formatDate(currentDate)} in this planner.</p>
                    </div>
                `;
                return;
            }

            // Sort by time, null times at the end
            tasks.sort((a, b) => {
                if (!a.time && !b.time) return 0;
                if (!a.time) return 1;
                if (!b.time) return -1;
                return a.time.localeCompare(b.time);
            });

            taskList.innerHTML = tasks.map(task => `
                <div class="task-row card" data-id="${task.id}" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px;">
                    <input type="checkbox" class="task-check" ${task.done ? 'checked' : ''} style="width: 20px; height: 20px; margin-top: 2px;">
                    <div style="flex: 1; min-width: 0;">
                        <div class="task-title" style="font-size: 1rem; font-weight: 500; text-decoration: ${task.done ? 'line-through' : 'none'}; color: ${task.done ? 'var(--text-secondary)' : 'var(--text-primary)'};">
                            ${task.title}
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.75rem; color: var(--text-secondary);">
                            ${task.time ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${formatTime(task.time)}</span>` : ''}
                            ${task.quadrant ? `<span style="text-transform: capitalize; background: var(--bg-color); padding: 2px 6px; border-radius: 4px;">Q: ${task.quadrant}</span>` : ''}
                        </div>
                    </div>
                    <button class="delete-btn" style="background: none; border: none; color: #ef4444; padding: 4px; cursor: pointer;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `).join('');

            attachListListeners();
        } catch (e) {
            console.error("Failed to render tasks", e);
            taskList.innerHTML = `<div style="color: red;">Error loading tasks.</div>`;
        }
    }

    function attachListListeners() {
        taskList.querySelectorAll('.task-check').forEach(check => {
            check.addEventListener('change', async (e) => {
                const row = e.target.closest('.task-row');
                const id = row.dataset.id;
                const isDone = e.target.checked;
                
                // update UI locally immediately
                const titleEl = row.querySelector('.task-title');
                titleEl.style.textDecoration = isDone ? 'line-through' : 'none';
                titleEl.style.color = isDone ? 'var(--text-secondary)' : 'var(--text-primary)';

                try {
                    const { getById } = await import('../db.js');
                    const task = await getById('tasks', id);
                    if (task) {
                        task.done = isDone;
                        task.doneAt = isDone ? new Date().toISOString() : null;
                        await save('tasks', task);
                    }
                } catch (err) {
                    console.error("Failed to update status", err);
                    e.target.checked = !isDone; // revert
                }
            });
        });

        taskList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Delete this task?')) {
                    const row = e.target.closest('.task-row');
                    const id = row.dataset.id;
                    try {
                        await remove('tasks', id);
                        renderTasks(); // Re-render
                    } catch(err) {
                        console.error('Delete failed', err);
                    }
                }
            });
        });
    }

    await renderTasks();
}
