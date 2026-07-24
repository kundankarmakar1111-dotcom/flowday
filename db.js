// db.js

let db = null;

function getDB() {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}

export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('flowday_db', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('tasks')) {
        const tasksOS = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        tasksOS.createIndex('by_date', 'date', { unique: false });
        tasksOS.createIndex('by_tab', 'tab', { unique: false });
        tasksOS.createIndex('by_status', 'status', { unique: false });
        tasksOS.createIndex('by_date_tab', ['date', 'tab'], { unique: false });
        tasksOS.createIndex('by_recurGroupId', 'recurGroupId', { unique: false });
      }

      if (!db.objectStoreNames.contains('importantDates')) {
        const impDatesOS = db.createObjectStore('importantDates', { keyPath: 'id', autoIncrement: true });
        impDatesOS.createIndex('by_date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains('backlog')) {
        db.createObjectStore('backlog', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('reflections')) {
        db.createObjectStore('reflections', { keyPath: 'date' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('reviews')) {
        const reviewsOS = db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        reviewsOS.createIndex('by_type', 'type', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("IndexedDB Error", event);
      reject(event.target.error);
    };
  });
}

function runTransaction(storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = getDB().transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = (event) => reject(event.target.error);

    result = callback(store, transaction);
  });
}

// Tasks CRUD
export async function addTask(task) {
  return runTransaction('tasks', 'readwrite', (store) => {
    const now = new Date().toISOString();
    const newTask = {
      ...task,
      status: task.status || 'pending',
      createdAt: now,
      updatedAt: now
    };
    const request = store.add(newTask);
    request.onsuccess = (e) => request.result;
    return new Promise((res, rej) => {
      request.onsuccess = (e) => res(e.target.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getTask(id) {
  return runTransaction('tasks', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.get(id);
      request.onsuccess = () => res(request.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getAllTasks() {
  return runTransaction('tasks', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.getAll();
      request.onsuccess = () => res(request.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getTasksForDate(dateStr) {
  return runTransaction('tasks', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const index = store.index('by_date');
      const request = index.getAll(dateStr);
      request.onsuccess = () => {
        const tasks = request.result;
        tasks.sort((a, b) => {
          if (!a.time && !b.time) return 0;
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time.localeCompare(b.time);
        });
        res(tasks);
      };
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getTasksByTab(tab) {
  return runTransaction('tasks', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const index = store.index('by_tab');
      const request = index.getAll(tab);
      request.onsuccess = () => res(request.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getTasksByDateRange(startDate, endDate) {
  return runTransaction('tasks', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const index = store.index('by_date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);
      request.onsuccess = () => res(request.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getOverdueTasks() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  return runTransaction('tasks', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const index = store.index('by_status');
      const request = index.getAll('pending');
      request.onsuccess = () => {
        const overdue = request.result.filter(t => t.date < todayStr);
        res(overdue);
      };
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function updateTask(id, updates) {
  return runTransaction('tasks', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) return rej(new Error('Task not found'));
        const updatedTask = {
          ...getReq.result,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        const putReq = store.put(updatedTask);
        putReq.onsuccess = () => res();
        putReq.onerror = (e) => rej(e.target.error);
      };
      getReq.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function deleteTask(id) {
  return runTransaction('tasks', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.delete(id);
      request.onsuccess = () => res();
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function markTaskDone(id) {
  return updateTask(id, { status: 'done' });
}

export async function markTaskDropped(id) {
  return updateTask(id, { status: 'dropped' });
}

export async function rescheduleTask(id, newDate) {
  return updateTask(id, { date: newDate, status: 'pending' });
}

// Important Dates CRUD
export async function addImportantDate(dateObj) {
  return runTransaction('importantDates', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.add({ ...dateObj, createdAt: new Date().toISOString() });
      request.onsuccess = (e) => res(e.target.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getImportantDates() {
  return runTransaction('importantDates', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const dates = request.result;
        dates.sort((a, b) => a.date.localeCompare(b.date));
        res(dates);
      };
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getUpcomingImportantDates(n) {
  const dates = await getImportantDates();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  const upcoming = dates.filter(d => d.date >= todayStr);
  return upcoming.slice(0, n);
}

export async function updateImportantDate(id, updates) {
  return runTransaction('importantDates', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) return rej(new Error('Important Date not found'));
        const putReq = store.put({ ...getReq.result, ...updates });
        putReq.onsuccess = () => res();
        putReq.onerror = (e) => rej(e.target.error);
      };
      getReq.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function deleteImportantDate(id) {
  return runTransaction('importantDates', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.delete(id);
      request.onsuccess = () => res();
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

// Backlog CRUD
export async function addBacklogItem(item) {
  return runTransaction('backlog', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.add({ ...item, createdAt: new Date().toISOString() });
      request.onsuccess = (e) => res(e.target.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getBacklogItems() {
  return runTransaction('backlog', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result;
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res(items);
      };
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function updateBacklogItem(id, updates) {
  return runTransaction('backlog', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (!getReq.result) return rej(new Error('Backlog item not found'));
        const putReq = store.put({ ...getReq.result, ...updates });
        putReq.onsuccess = () => res();
        putReq.onerror = (e) => rej(e.target.error);
      };
      getReq.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function deleteBacklogItem(id) {
  return runTransaction('backlog', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.delete(id);
      request.onsuccess = () => res();
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function activateBacklogItem(id, tab, date) {
  const item = await runTransaction('backlog', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.get(id);
      request.onsuccess = () => res(request.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
  
  if (!item) throw new Error("Item not found");
  
  const taskId = await addTask({
    title: item.title,
    notes: item.notes || '',
    tab: tab || item.tab || 'others',
    date: date
  });
  
  await deleteBacklogItem(id);
  return taskId;
}

// Reflections
export async function saveReflection(dateStr, text) {
  return runTransaction('reflections', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.put({ date: dateStr, text, updatedAt: new Date().toISOString() });
      request.onsuccess = () => res();
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getReflection(dateStr) {
  return runTransaction('reflections', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.get(dateStr);
      request.onsuccess = () => res(request.result ? request.result.text : null);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

// Settings
export async function getSetting(key) {
  return runTransaction('settings', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.get(key);
      request.onsuccess = () => res(request.result ? request.result.value : null);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function saveSetting(key, value) {
  return runTransaction('settings', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.put({ key, value });
      request.onsuccess = () => res();
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getAllSettings() {
  return runTransaction('settings', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const settings = {};
        request.result.forEach(s => settings[s.key] = s.value);
        res(settings);
      };
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

// Reviews
export async function addReview(review) {
  return runTransaction('reviews', 'readwrite', (store) => {
    return new Promise((res, rej) => {
      const request = store.add(review);
      request.onsuccess = (e) => res(e.target.result);
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

export async function getReviews(type) {
  return runTransaction('reviews', 'readonly', (store) => {
    return new Promise((res, rej) => {
      const index = store.index('by_type');
      const request = index.getAll(type);
      request.onsuccess = () => {
        const reviews = request.result;
        reviews.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
        res(reviews);
      };
      request.onerror = (e) => rej(e.target.error);
    });
  });
}

// Data export/import
export async function exportAllData() {
  const stores = ['tasks', 'importantDates', 'backlog', 'reflections', 'settings', 'reviews'];
  const exportData = {};
  
  for (const storeName of stores) {
    exportData[storeName] = await runTransaction(storeName, 'readonly', (store) => {
      return new Promise((res, rej) => {
        const request = store.getAll();
        request.onsuccess = () => res(request.result);
        request.onerror = (e) => rej(e.target.error);
      });
    });
  }
  
  return exportData;
}

export async function importAllData(data) {
  await clearAllData();
  const stores = ['tasks', 'importantDates', 'backlog', 'reflections', 'settings', 'reviews'];
  
  for (const storeName of stores) {
    if (data[storeName] && data[storeName].length > 0) {
      await runTransaction(storeName, 'readwrite', (store) => {
        return new Promise((res, rej) => {
          let count = 0;
          for (const item of data[storeName]) {
            const req = store.add(item);
            req.onsuccess = () => {
              count++;
              if (count === data[storeName].length) res();
            };
            req.onerror = (e) => rej(e.target.error);
          }
        });
      });
    }
  }
}

export async function clearAllData() {
  const stores = ['tasks', 'importantDates', 'backlog', 'reflections', 'settings', 'reviews'];
  
  for (const storeName of stores) {
    await runTransaction(storeName, 'readwrite', (store) => {
      return new Promise((res, rej) => {
        const request = store.clear();
        request.onsuccess = () => res();
        request.onerror = (e) => rej(e.target.error);
      });
    });
  }
}
