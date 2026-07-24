// state.js
import { getAllSettings } from './db.js';

const _state = {
  currentView: 'dashboard',
  currentTab: null,        
  selectedDate: null,      
  viewMode: 'timeline',    
  modalOpen: null,         
  briefingShown: false,    
  accentColor: '#6366F1',
  todayStr: '',            
};

const _listeners = {};

export function getState(key) {
  return _state[key];
}

export function setState(key, value) {
  if (_state[key] !== value) {
    _state[key] = value;
    if (_listeners[key]) {
      _listeners[key].forEach(callback => callback(value));
    }
  }
}

export function subscribe(key, callback) {
  if (!_listeners[key]) {
    _listeners[key] = new Set();
  }
  _listeners[key].add(callback);
  
  // Return unsubscribe function
  return () => {
    if (_listeners[key]) {
      _listeners[key].delete(callback);
    }
  };
}

export function getFullState() {
  return { ..._state };
}

export async function initState() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  _state.todayStr = `${year}-${month}-${day}`;
  _state.selectedDate = _state.todayStr;

  try {
    const settings = await getAllSettings();
    if (settings.accentColor) {
      _state.accentColor = settings.accentColor;
    }
    // Load other settings if needed
  } catch (error) {
    console.error('Failed to load settings', error);
  }
}
