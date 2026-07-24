// router.js

let routes = {};
let currentCleanup = null;
let appContainer = null;

export function initRouter(routeMap, container) {
  routes = routeMap;
  appContainer = container;

  window.addEventListener('hashchange', handleRoute);
  
  // Initial route
  handleRoute();
}

async function handleRoute() {
  let hash = window.location.hash.slice(1);
  if (!hash) {
    hash = 'dashboard';
    window.location.hash = hash;
    return; // handleRoute will be called again by hashchange
  }

  // Basic routing logic matching route map
  const routeParts = hash.split('?');
  const routeName = routeParts[0];
  
  const route = routes[routeName] || routes['dashboard'];

  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  if (route && typeof route.render === 'function') {
    appContainer.innerHTML = '';
    currentCleanup = await route.render(appContainer);
  }
}

export function navigateTo(hash) {
  window.location.hash = hash;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1).split('?')[0] || 'dashboard';
}
