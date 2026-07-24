import { getTasksByDate, save, saveSetting } from '../db.js';
import { getTodayDateString, formatTime, generateUUID } from '../utils.js';
import { checkMorningBriefing, detectConflicts } from '../assistant.js';

export default async function DashboardView(container) {
    const today = getTodayDateString();
    
    container.innerHTML = `
        <div id="briefing-container"></div>
        <div class="dashboard-header">
            <h2>Today's Flow</h2>
            <div style="display: flex; gap: 12px; align-items: center;">
                <a href="#backlog" style="font-size: 0.875rem; color: var(--text-secondary); text-decoration: none;">Backlog</a>
                <div class="view-toggles">
                    <button id="toggle-timeline" class="active">Timeline</button>
                    <button id="toggle-matrix">Matrix</button>
                </div>
            </div>
        </div>
        <div id="dashboard-content">
            <div style="text-align: center; padding: 20px;">Loading tasks...</div>
        </div>
    `;

    const contentArea = container.querySelector('#dashboard-content');
    const briefingArea = container.querySelector('#briefing-container');
    let viewMode = 'timeline';

    container.querySelector('#toggle-timeline').addEventListener('click', (e) => {
        viewMode = 'timeline';
        e.target.classList.add('active');
        container.querySelector('#toggle-matrix').classList.remove('active');
        renderContent();
    });

    container.querySelector('#toggle-matrix').addEventListener('click', (e) => {
        viewMode = 'matrix';
        e.target.classList.add('active');
        container.querySelector('#toggle-timeline').classList.remove('active');
        renderContent();
    });

    async function renderBriefing(tasks) {
        const briefing = await checkMorningBriefing();
        if (briefing) {
            briefingArea.innerHTML = `
                <div class="card" style="background: var(--accent-color); color: white; border: none; position: relative; margin-bottom: 24px;">
                    <button id="close-briefing" style="position: absolute; right: 8px; top: 8px; background: none; border: none; color: white; opacity: 0.8; cursor: pointer;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <h3 style="font-size: 1rem; margin-bottom: 8px;">Good morning!</h3>
                    <p style="font-size: 0.875rem; opacity: 0.9;">You have ${briefing.total} tasks scheduled for today. ${briefing.important > 0 ? `${briefing.important} are high priority.` : ''}</p>
                </div>
            `;
            
            briefingArea.querySelector('#close-briefing').addEventListener('click', async () => {
                briefingArea.innerHTML = '';
                await saveSetting('last_briefing_date', today);
            });
        }
        
        // Show conflicts
        const conflicts = detectConflicts(tasks);
        if (conflicts.length > 0) {
            // Append conflict banner below briefing
            const div = document.createElement('div');
            div.innerHTML = `
                <div class="card" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); margin-bottom: 24px;">
                    <div style="display: flex; gap: 8px; color: #ef4444;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <div style="font-size: 0.875rem;">
                            <strong>Schedule Conflict Detected</strong>
                            <p style="margin-top: 4px; opacity: 0.9;">You have overlapping tasks across tabs at ${formatTime(conflicts[0].task1.time)}.</p>
                        </div>
                    </div>
                </div>
            `;
            briefingArea.appendChild(div);
        }
    }

    async function renderContent() {
        try {
            const tasks = await getTasksByDate(today);
            
            await renderBriefing(tasks);
            
            if (tasks.length === 0) {
                contentArea.innerHTML = `
                    <div class="empty-state card" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <p>No tasks scheduled for today.</p>
                        <p style="font-size: 0.875rem; margin-top: 8px;">Check your planners to add some flow.</p>
                    </div>
                `;
                return;
            }

            if (viewMode === 'timeline') {
                renderTimeline(tasks, contentArea);
            } else {
                renderMatrix(tasks, contentArea);
            }
        } catch (e) {
            console.error("Error loading dashboard:", e);
            contentArea.innerHTML = `<div class="card" style="color: red;">Failed to load tasks.</div>`;
        }
    }

    function renderTimeline(tasks, containerElement) {
        // Separate scheduled and unscheduled
        const scheduled = tasks.filter(t => t.time).sort((a, b) => a.time.localeCompare(b.time));
        const unscheduled = tasks.filter(t => !t.time);

        let html = '<div class="timeline">';
        
        if (scheduled.length > 0) {
            html += scheduled.map(task => createTaskCard(task)).join('');
        }

        if (unscheduled.length > 0) {
            html += `<h3 style="margin: 24px 0 12px; font-size: 1rem; color: var(--text-secondary);">Unscheduled</h3>`;
            html += unscheduled.map(task => createTaskCard(task)).join('');
        }

        html += '</div>';
        containerElement.innerHTML = html;
        attachTaskListeners(containerElement);
    }

    function renderMatrix(tasks, containerElement) {
        // Group by quadrant
        const quadrants = {
            'do': tasks.filter(t => t.quadrant === 'do'),
            'schedule': tasks.filter(t => t.quadrant === 'schedule'),
            'delegate': tasks.filter(t => t.quadrant === 'delegate'),
            'eliminate': tasks.filter(t => t.quadrant === 'eliminate' || !t.quadrant) // dump unassigned here for now
        };

        const html = `
            <div class="matrix-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="matrix-quadrant card" style="background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2);">
                    <h4 style="font-size: 0.75rem; text-transform: uppercase; color: #10b981; margin-bottom: 8px;">Do First</h4>
                    ${quadrants['do'].map(t => createMiniTaskCard(t)).join('') || '<div style="font-size: 0.75rem; color: var(--text-secondary);">Empty</div>'}
                </div>
                <div class="matrix-quadrant card" style="background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2);">
                    <h4 style="font-size: 0.75rem; text-transform: uppercase; color: #3b82f6; margin-bottom: 8px;">Schedule</h4>
                    ${quadrants['schedule'].map(t => createMiniTaskCard(t)).join('') || '<div style="font-size: 0.75rem; color: var(--text-secondary);">Empty</div>'}
                </div>
                <div class="matrix-quadrant card" style="background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2);">
                    <h4 style="font-size: 0.75rem; text-transform: uppercase; color: #f59e0b; margin-bottom: 8px;">Delegate</h4>
                    ${quadrants['delegate'].map(t => createMiniTaskCard(t)).join('') || '<div style="font-size: 0.75rem; color: var(--text-secondary);">Empty</div>'}
                </div>
                <div class="matrix-quadrant card" style="background: rgba(100, 116, 139, 0.05); border-color: rgba(100, 116, 139, 0.2);">
                    <h4 style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Backlog</h4>
                    ${quadrants['eliminate'].map(t => createMiniTaskCard(t)).join('') || '<div style="font-size: 0.75rem; color: var(--text-secondary);">Empty</div>'}
                </div>
            </div>
        `;
        
        containerElement.innerHTML = html;
        attachTaskListeners(containerElement);
    }

    function getTabColor(tab) {
        const colors = {
            'education': 'var(--color-education)',
            'company': 'var(--color-company)',
            'job': 'var(--color-job)',
            'others': 'var(--color-others)'
        };
        return colors[tab] || 'var(--text-secondary)';
    }

    function createTaskCard(task) {
        return `
            <div class="task-card card ${task.done ? 'done' : ''}" data-id="${task.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; margin-bottom: 8px;">
                <button class="checkbox-btn" style="background: none; border: 2px solid ${task.done ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 6px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: ${task.done ? 'var(--accent-color)' : 'transparent'};">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 1rem; font-weight: 500; text-decoration: ${task.done ? 'line-through' : 'none'}; color: ${task.done ? 'var(--text-secondary)' : 'var(--text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${task.title}
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 4px; font-size: 0.75rem; align-items: center;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${getTabColor(task.tab)};"></span>
                        <span style="color: var(--text-secondary); text-transform: capitalize;">${task.tab}</span>
                        ${task.time ? `<span style="color: var(--text-secondary);">&bull; ${formatTime(task.time)}</span>` : '<span class="add-time-btn" style="color: var(--accent-color); cursor: pointer;">+ Add time</span>'}
                    </div>
                </div>
            </div>
        `;
    }

    function createMiniTaskCard(task) {
        return `
            <div class="mini-task ${task.done ? 'done' : ''}" data-id="${task.id}" style="padding: 6px 0; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px;">
                <button class="checkbox-btn" style="background: none; border: 1.5px solid ${task.done ? 'var(--accent-color)' : 'var(--border-color)'}; border-radius: 4px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: ${task.done ? 'var(--accent-color)' : 'transparent'};">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <div style="font-size: 0.85rem; text-decoration: ${task.done ? 'line-through' : 'none'}; color: ${task.done ? 'var(--text-secondary)' : 'var(--text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${task.title}
                </div>
            </div>
        `;
    }

    function attachTaskListeners(containerElement) {
        containerElement.querySelectorAll('.checkbox-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const card = e.target.closest('[data-id]');
                const taskId = card.dataset.id;
                
                // Optimistic UI update
                const isDone = !card.classList.contains('done');
                if (isDone) {
                    card.classList.add('done');
                    btn.style.borderColor = 'var(--accent-color)';
                    btn.style.color = 'var(--accent-color)';
                    const titleEl = card.querySelector('div > div:first-child') || card.querySelector('div:last-child');
                    titleEl.style.textDecoration = 'line-through';
                    titleEl.style.color = 'var(--text-secondary)';
                } else {
                    card.classList.remove('done');
                    btn.style.borderColor = 'var(--border-color)';
                    btn.style.color = 'transparent';
                    const titleEl = card.querySelector('div > div:first-child') || card.querySelector('div:last-child');
                    titleEl.style.textDecoration = 'none';
                    titleEl.style.color = 'var(--text-primary)';
                }

                // Update DB
                try {
                    const { getById } = await import('../db.js'); // dynamic import to avoid circular dep if any, though it's fine
                    const task = await getById('tasks', taskId);
                    if (task) {
                        task.done = isDone;
                        task.doneAt = isDone ? new Date().toISOString() : null;
                        await save('tasks', task);
                    }
                } catch (err) {
                    console.error("Failed to update task status", err);
                    // Could revert UI here on failure
                }
            });
        });
    }

    // Initial render
    await renderContent();
    
    // Add basic styles for the toggles injected here
    const style = document.createElement('style');
    style.textContent = `
        .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .dashboard-header h2 { font-size: 1.1rem; font-weight: 600; margin: 0; }
        .view-toggles { display: flex; background: var(--border-color); border-radius: var(--radius-pill); padding: 2px; }
        .view-toggles button { background: none; border: none; padding: 4px 12px; font-size: 0.75rem; font-weight: 500; border-radius: var(--radius-pill); color: var(--text-secondary); cursor: pointer; }
        .view-toggles button.active { background: var(--surface-color); color: var(--text-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    `;
    container.appendChild(style);
}
