import { getTasksByDate, save, getSetting } from './db.js';
import { getTodayDateString } from './utils.js';

export async function checkMorningBriefing() {
    const today = getTodayDateString();
    const lastBriefing = await getSetting('last_briefing_date');
    
    if (lastBriefing === today) {
        return null; // Already shown today
    }
    
    try {
        const tasks = await getTasksByDate(today);
        
        const summary = {
            total: tasks.length,
            education: tasks.filter(t => t.tab === 'education').length,
            company: tasks.filter(t => t.tab === 'company').length,
            job: tasks.filter(t => t.tab === 'job').length,
            others: tasks.filter(t => t.tab === 'others').length,
            important: tasks.filter(t => t.quadrant === 'do').length
        };
        
        // Mark as shown (we'll save this after the UI actually displays it if needed, but safe to mark now)
        // For simplicity, we just return the data here and let the UI handle showing it.
        return summary;
    } catch(e) {
        console.error("Failed to generate briefing", e);
        return null;
    }
}

export function detectConflicts(tasks) {
    // Only look at scheduled tasks for today
    const scheduled = tasks.filter(t => t.time && !t.done);
    
    // Sort by time
    scheduled.sort((a, b) => a.time.localeCompare(b.time));
    
    const conflicts = [];
    
    for (let i = 0; i < scheduled.length - 1; i++) {
        const current = scheduled[i];
        const next = scheduled[i+1];
        
        // Simple conflict check: exact same time, different tabs
        if (current.time === next.time && current.tab !== next.tab) {
            conflicts.push({ task1: current, task2: next });
        }
    }
    
    return conflicts;
}

export async function checkEveningSlips() {
    // Determine if it's evening based on settings
    const reviewTimeStr = await getSetting('review_time', '21:00');
    const [revH, revM] = reviewTimeStr.split(':');
    const now = new Date();
    
    if (now.getHours() > parseInt(revH) || (now.getHours() === parseInt(revH) && now.getMinutes() >= parseInt(revM))) {
        
        const today = getTodayDateString();
        const lastReview = await getSetting('last_review_date');
        
        if (lastReview === today) {
            return null; // already reviewed today
        }
        
        const tasks = await getTasksByDate(today);
        const undone = tasks.filter(t => !t.done);
        
        if (undone.length > 0) {
            return undone;
        }
    }
    
    return null;
}
