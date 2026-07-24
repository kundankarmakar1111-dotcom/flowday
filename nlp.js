// Basic rule-based Natural Language Parser for tasks

export function parseTaskInput(input) {
    const result = {
        title: input,
        date: null,
        time: null,
        recurring: null
    };

    const text = input.toLowerCase();
    
    // Time matching (e.g. 7pm, 14:00, 9am)
    const timeMatch = text.match(/\b([1-9]|1[0-2])(:[0-5][0-9])?\s*(am|pm)\b/i) || text.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
    if (timeMatch) {
        if (timeMatch[3]) {
            // AM/PM format
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? timeMatch[2].substring(1) : '00';
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            result.time = `${String(hours).padStart(2, '0')}:${minutes}`;
        } else {
            // 24h format
            result.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }
        // Remove time from title
        result.title = result.title.replace(timeMatch[0], '').trim();
    }

    // Day matching (e.g., tomorrow, today, next monday)
    const today = new Date();
    
    if (text.includes('tomorrow')) {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        result.date = d.toISOString().split('T')[0];
        result.title = result.title.replace(/tomorrow/i, '').trim();
    } else if (text.includes('today')) {
        result.date = today.toISOString().split('T')[0];
        result.title = result.title.replace(/today/i, '').trim();
    }

    // Recurrence matching (e.g. every monday, daily)
    if (text.includes('daily') || text.includes('every day')) {
        result.recurring = { type: 'daily' };
        result.title = result.title.replace(/daily|every day/i, '').trim();
    } else if (text.match(/every\s+(mon|tue|wed|thu|fri|sat|sun)/i)) {
        result.recurring = { type: 'weekly' };
        // Clean title
        result.title = result.title.replace(/every\s+[a-z]+/i, '').trim();
    }

    // Cleanup title (remove extra spaces, capitalize first letter)
    result.title = result.title.replace(/\s+/g, ' ').trim();
    if (result.title.length > 0) {
        result.title = result.title.charAt(0).toUpperCase() + result.title.slice(1);
    }

    return result;
}
