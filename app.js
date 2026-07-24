import { initDB } from './db.js';
import DashboardView from './views/dashboard.js';
import PlannerView from './views/planner.js';
import ImportantDatesView from './views/important-dates.js';
import SettingsView from './views/settings.js';
import BacklogView from './views/backlog.js';

const appState = {
    currentRoute: '',
    dbReady: false
};

const routes = {
    'dashboard': { title: 'Dashboard', render: DashboardView },
    'education': { title: 'Education', render: (container) => PlannerView(container, 'education') },
    'company': { title: 'Company', render: (container) => PlannerView(container, 'company') },
    'job': { title: 'Job', render: (container) => PlannerView(container, 'job') },
    'others': { title: 'Life & Others', render: (container) => PlannerView(container, 'others') },
    'important-dates': { title: 'Important Dates', render: ImportantDatesView },
    'settings': { title: 'Settings', render: SettingsView },
    'backlog': { title: 'Backlog', render: BacklogView }
};

async function init() {
    try {
        await initDB();
        appState.dbReady = true;
        
        // Setup router
        window.addEventListener('hashchange', handleRoute);
        
        // Setup navigation clicks
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                // Remove active from all
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                // Add active to clicked
                e.currentTarget.classList.add('active');
            });
        });

        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            window.location.hash = 'settings';
        });

        // Trigger initial route
        if (!window.location.hash) {
            window.location.hash = 'dashboard';
        } else {
            handleRoute();
            
            // Sync bottom nav active state on reload
            const hash = window.location.hash.substring(1);
            if (['dashboard', 'education', 'company', 'job', 'others', 'important-dates'].includes(hash)) {
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                const activeNav = document.querySelector(`.nav-item[data-tab="${hash}"]`);
                if (activeNav) activeNav.classList.add('active');
            }
        }
        
    } catch (e) {
        console.error("Failed to initialize App:", e);
        document.getElementById('main-content').innerHTML = `<div class="card" style="color: red;">Error initializing app. Check console.</div>`;
    }
}

function handleRoute() {
    if (!appState.dbReady) return;
    
    let hash = window.location.hash.substring(1) || 'dashboard';
    
    const route = routes[hash];
    if (route) {
        appState.currentRoute = hash;
        document.getElementById('page-title').textContent = route.title;
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = ''; // Clear current view
        route.render(mainContent);
    } else {
        // Fallback
        window.location.hash = 'dashboard';
    }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
