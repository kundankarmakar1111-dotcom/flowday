import { save, getAll, remove } from '../db.js';
import { generateUUID } from '../utils.js';

export default async function BacklogView(container) {
    container.innerHTML = `
        <div class="planner-header" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <p style="color: var(--text-secondary); font-size: 0.875rem;">Someday / Backlog</p>
            </div>
        </div>
        
        <div id="add-backlog-container" class="card" style="margin-bottom: 24px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="backlog-title" placeholder="Idea or future task..." style="flex: 1;">
                <button id="add-backlog-btn" class="primary" style="width: auto; padding: 8px 16px;">Save</button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                 <select id="backlog-tab" style="width: auto; padding: 6px; font-size: 0.875rem;">
                     <option value="">Any category</option>
                     <option value="education">Education</option>
                     <option value="company">Company</option>
                     <option value="job">Job</option>
                     <option value="others">Life</option>
                 </select>
            </div>
        </div>

        <div id="backlog-list">
            <div style="text-align: center; padding: 20px;">Loading...</div>
        </div>
    `;

    const titleInput = container.querySelector('#backlog-title');
    const tabSelect = container.querySelector('#backlog-tab');
    const addBtn = container.querySelector('#add-backlog-btn');
    const list = container.querySelector('#backlog-list');

    addBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        if (!title) return;

        const newItem = {
            id: generateUUID(),
            title: title,
            tab: tabSelect.value || null,
            notes: ''
        };

        try {
            await save('backlog', newItem);
            titleInput.value = '';
            renderList();
        } catch (e) {
            console.error("Failed to add backlog item", e);
        }
    });

    async function renderList() {
        try {
            const items = await getAll('backlog');
            
            if (items.length === 0) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
                        <p>Your backlog is empty.</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = items.map(item => `
                <div class="backlog-row card" data-id="${item.id}" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 1rem; font-weight: 500;">
                            ${item.title}
                        </div>
                        ${item.tab ? `<div style="margin-top: 6px; font-size: 0.75rem;"><span style="text-transform: capitalize; background: var(--bg-color); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">Tab: ${item.tab}</span></div>` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button class="activate-btn" style="background: var(--accent-color); border: none; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Schedule</button>
                        <button class="delete-btn" style="background: none; border: none; color: var(--text-secondary); padding: 4px; font-size: 0.75rem; cursor: pointer;">Drop</button>
                    </div>
                </div>
            `).join('');

            attachListeners();
        } catch (e) {
            list.innerHTML = `<div style="color: red;">Error loading backlog.</div>`;
        }
    }

    function attachListeners() {
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const row = e.target.closest('.backlog-row');
                await remove('backlog', row.dataset.id);
                renderList();
            });
        });

        list.querySelectorAll('.activate-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const row = e.target.closest('.backlog-row');
                const dateStr = prompt("Enter a date to schedule this task (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
                if (dateStr) {
                    try {
                        const { getById } = await import('../db.js');
                        const item = await getById('backlog', row.dataset.id);
                        if (item) {
                            // Move to tasks
                            await save('tasks', {
                                id: item.id, // reuse id or generate new
                                tab: item.tab || 'others',
                                title: item.title,
                                notes: item.notes,
                                date: dateStr,
                                time: null,
                                done: false,
                                doneAt: null,
                                quadrant: null,
                                important: false,
                                energy: null,
                                recurring: null
                            });
                            // Remove from backlog
                            await remove('backlog', item.id);
                            renderList();
                            alert("Moved to planner!");
                        }
                    } catch(err) {
                        console.error("Error activating", err);
                    }
                }
            });
        });
    }

    await renderList();
}
