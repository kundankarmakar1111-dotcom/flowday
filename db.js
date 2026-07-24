// IndexedDB wrapper for FlowDay

const DB_NAME = 'flowday_db';
const DB_VERSION = 1;

let dbInstance = null;

export async function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Tasks store
            if (!db.objectStoreNames.contains('tasks')) {
                const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                tasksStore.createIndex('date', 'date', { unique: false });
                tasksStore.createIndex('tab', 'tab', { unique: false });
                tasksStore.createIndex('done', 'done', { unique: false });
                tasksStore.createIndex('quadrant', 'quadrant', { unique: false });
                // Compound index (conceptually) - IndexedDB doesn't natively do compound exactly like SQL, 
                // but we can create one by storing an array or querying individually. We'll use individual for now.
            }

            // Important Dates store
            if (!db.objectStoreNames.contains('importantDates')) {
                const datesStore = db.createObjectStore('importantDates', { keyPath: 'id' });
                datesStore.createIndex('date', 'date', { unique: false });
            }

            // Settings store
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }

            // Reflections store
            if (!db.objectStoreNames.contains('reflections')) {
                const reflectionsStore = db.createObjectStore('reflections', { keyPath: 'id' });
                reflectionsStore.createIndex('date', 'date', { unique: false });
            }

            // Backlog store
            if (!db.objectStoreNames.contains('backlog')) {
                const backlogStore = db.createObjectStore('backlog', { keyPath: 'id' });
                backlogStore.createIndex('tab', 'tab', { unique: false });
            }
        };
    });
}

// Generic CRUD Operations
export async function getStore(storeName, mode = 'readonly') {
    const db = await initDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
}

export async function getAll(storeName) {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getByIndex(storeName, indexName, value) {
    const store = await getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getById(storeName, id) {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function save(storeName, item) {
    const store = await getStore(storeName, 'readwrite');
    // Ensure timestamps
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = now;
    
    return new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve(item);
        request.onerror = () => reject(request.error);
    });
}

export async function remove(storeName, id) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Specialized Queries
export async function getTasksByDate(date) {
    return getByIndex('tasks', 'date', date);
}

export async function getTasksByTabAndDate(tab, date) {
    const allForDate = await getTasksByDate(date);
    return allForDate.filter(task => task.tab === tab);
}

export async function getSetting(key, defaultValue = null) {
    const store = await getStore('settings');
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.value);
            } else {
                resolve(defaultValue);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function saveSetting(key, value) {
    const store = await getStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put({ key, value });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
