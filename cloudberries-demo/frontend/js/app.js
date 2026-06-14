import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as chat from './chat.js';

window.api = api;
window.ui = ui;
window.chat = chat;

async function init() {
    await api.loadProfile();
    await api.loadProviderProfile();
    await api.loadCatalog();
    ui.renderCatalog('all');
    startPolling();
}

async function syncGlobalState() {
    try {
        await api.loadProfile();
        await api.loadProviderProfile();
        await api.loadCatalog();

        const activeView = document.querySelector('.view.active')?.id;
        if (activeView === 'catalog-view') {
            ui.renderCatalog(state.currentFilter);
        } else if (activeView === 'provider-view') {
            ui.updateProviderNodeStatuses();
        } else if (activeView === 'admin-view') {
            ui.loadAndRenderAdminDisputes();
        }
    } catch (e) {
        console.error("Sync error:", e);
    }
}

function startPolling() {
    setInterval(syncGlobalState, 3000);
}

init();