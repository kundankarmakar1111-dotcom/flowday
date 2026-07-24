import { saveSetting, getSetting } from '../db.js';

export default async function SettingsView(container) {
    container.innerHTML = `
        <div class="card" style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px; font-size: 1rem;">Appearance</h3>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <span style="font-size: 0.875rem;">Theme Mode</span>
                <select id="theme-select" style="width: auto; padding: 4px 8px; font-size: 0.875rem;">
                    <option value="system">System Default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.875rem;">Accent Color</span>
                <input type="color" id="accent-color" value="#6366f1" style="width: 40px; height: 40px; padding: 0; border: none; border-radius: 4px; cursor: pointer;">
            </div>
        </div>
        
        <div class="card" style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px; font-size: 1rem;">Assistant</h3>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 12px;">The assistant runs locally on your device.</p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <span style="font-size: 0.875rem;">Evening Review Time</span>
                <input type="time" id="review-time" value="21:00" style="width: auto; padding: 4px 8px; font-size: 0.875rem;">
            </div>
        </div>

        <div class="card" style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px; font-size: 1rem; color: #ef4444;">Data & Storage</h3>
            <button id="export-data" style="width: 100%; background: var(--bg-color); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; font-size: 0.875rem; cursor: pointer; margin-bottom: 8px;">Export JSON Data</button>
            <button id="clear-data" style="width: 100%; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 8px; border-radius: 4px; font-size: 0.875rem; cursor: pointer;">Clear All Data</button>
        </div>
    `;

    // Load current settings
    const themeSelect = container.querySelector('#theme-select');
    const accentColor = container.querySelector('#accent-color');
    const reviewTime = container.querySelector('#review-time');
    
    const currentTheme = await getSetting('theme', 'system');
    const currentAccent = await getSetting('accent_color', '#6366f1');
    const currentReviewTime = await getSetting('review_time', '21:00');

    themeSelect.value = currentTheme;
    accentColor.value = currentAccent;
    reviewTime.value = currentReviewTime;

    // Event listeners
    themeSelect.addEventListener('change', async (e) => {
        await saveSetting('theme', e.target.value);
        // apply theme logic would go here in a real app, e.g. adding class to body
        alert('Theme saved. Refresh to apply (if overriding system).');
    });

    accentColor.addEventListener('change', async (e) => {
        const val = e.target.value;
        await saveSetting('accent_color', val);
        document.documentElement.style.setProperty('--accent-color', val);
    });

    reviewTime.addEventListener('change', async (e) => {
        await saveSetting('review_time', e.target.value);
    });

    container.querySelector('#clear-data').addEventListener('click', () => {
        if (confirm('Are you absolutely sure you want to clear all tasks and data? This cannot be undone.')) {
            // Delete DB
            const req = indexedDB.deleteDatabase('flowday_db');
            req.onsuccess = () => {
                alert('Data cleared. Reloading app.');
                window.location.reload();
            };
        }
    });

    container.querySelector('#export-data').addEventListener('click', async () => {
        // Simplified export
        const { getAll } = await import('../db.js');
        const tasks = await getAll('tasks');
        const dates = await getAll('importantDates');
        
        const data = { tasks, importantDates: dates, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowday_export_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}
