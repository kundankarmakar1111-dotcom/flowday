import { save, getAll, remove } from '../db.js';
import { generateUUID, formatDate } from '../utils.js';

export default async function ImportantDatesView(container) {
    container.innerHTML = `
        <div class="planner-header" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <p style="color: var(--text-secondary); font-size: 0.875rem;">Landmark Dates & Deadlines</p>
            </div>
        </div>
        
        <div id="add-date-container" class="card" style="margin-bottom: 24px;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="date-title" placeholder="e.g., Final Exam, Company Filing..." style="flex: 1;">
                <button id="add-date-btn" class="primary" style="width: auto; padding: 8px 16px;">Add</button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                 <input type="date" id="date-value" style="width: auto; padding: 6px;">
                 <select id="date-tab" style="width: auto; padding: 6px; font-size: 0.875rem;">
                     <option value="">Link to Tab (Opt)</option>
                     <option value="education">Education</option>
                     <option value="company">Company</option>
                     <option value="job">Job</option>
                     <option value="others">Life</option>
                 </select>
            </div>
        </div>

        <div id="dates-list">
            <div style="text-align: center; padding: 20px;">Loading dates...</div>
        </div>
    `;

    const titleInput = container.querySelector('#date-title');
    const dateInput = container.querySelector('#date-value');
    const tabSelect = container.querySelector('#date-tab');
    const addBtn = container.querySelector('#add-date-btn');
    const datesList = container.querySelector('#dates-list');

    // Default to a week from now for new date
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    dateInput.value = nextWeek.toISOString().split('T')[0];

    addBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const date = dateInput.value;
        if (!title || !date) return;

        const newDate = {
            id: generateUUID(),
            title: title,
            date: date,
            tab: tabSelect.value || null,
            notes: ''
        };

        try {
            await save('importantDates', newDate);
            titleInput.value = '';
            
            // Suggest prep task
            if (newDate.tab) {
                if (confirm(`Would you like to auto-generate a prep task in ${newDate.tab} 3 days before this deadline?`)) {
                    const prepDate = new Date(date);
                    prepDate.setDate(prepDate.getDate() - 3);
                    
                    await save('tasks', {
                        id: generateUUID(),
                        tab: newDate.tab,
                        title: `Prep: ${title}`,
                        notes: `Generated prep for deadline on ${date}`,
                        date: prepDate.toISOString().split('T')[0],
                        time: null,
                        done: false,
                        doneAt: null,
                        quadrant: 'schedule',
                        important: true,
                        energy: 'deep',
                        recurring: null
                    });
                    alert('Prep task added!');
                }
            }

            renderDates();
        } catch (e) {
            console.error("Failed to add date", e);
            alert("Failed to save date.");
        }
    });

    async function renderDates() {
        try {
            let dates = await getAll('importantDates');
            
            if (dates.length === 0) {
                datesList.innerHTML = `
                    <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
                        <p>No important dates tracked.</p>
                    </div>
                `;
                return;
            }

            // Sort by upcoming date
            dates.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Filter out old dates (older than 1 day)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            dates = dates.filter(d => new Date(d.date) >= yesterday);

            datesList.innerHTML = dates.map(d => {
                const diffTime = new Date(d.date) - new Date();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let colorClass = 'var(--text-secondary)';
                if (diffDays <= 3) colorClass = '#ef4444'; // Red
                else if (diffDays <= 7) colorClass = '#f59e0b'; // Amber

                return `
                <div class="date-row card" data-id="${d.id}" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-left: 4px solid ${colorClass};">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 1rem; font-weight: 500;">
                            ${d.title}
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.75rem; color: var(--text-secondary);">
                            <span>${formatDate(d.date)}</span>
                            <span style="font-weight: 600; color: ${colorClass};">${diffDays <= 0 ? 'Today' : `In ${diffDays} day${diffDays > 1 ? 's' : ''}`}</span>
                            ${d.tab ? `<span style="text-transform: capitalize; background: var(--bg-color); padding: 2px 6px; border-radius: 4px;">Tab: ${d.tab}</span>` : ''}
                        </div>
                    </div>
                    <button class="delete-btn" style="background: none; border: none; color: var(--text-secondary); padding: 4px; cursor: pointer;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                `;
            }).join('');

            datesList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(confirm('Remove this important date?')) {
                        const row = e.target.closest('.date-row');
                        const id = row.dataset.id;
                        await remove('importantDates', id);
                        renderDates();
                    }
                });
            });

        } catch (e) {
            console.error("Failed to render dates", e);
            datesList.innerHTML = `<div style="color: red;">Error loading dates.</div>`;
        }
    }

    await renderDates();
}
