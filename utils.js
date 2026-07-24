// Utility functions

export function generateUUID() {
    // Basic UUID generator for browser
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getTodayDateString() {
    const today = new Date();
    // Returns YYYY-MM-DD in local time
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date(getTodayDateString());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if dateString is today/tomorrow
    if (dateString === getTodayDateString()) {
        return 'Today';
    } else if (dateString === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`) {
        return 'Tomorrow';
    }
    
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHours = h % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
}

export function parseHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
}
