import { state } from './state.js';
import * as charts from './charts.js'; 
import * as api from './api.js';

export async function showView(viewName) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
    document.getElementById(`nav-${viewName}`).classList.add('active');
    
    if (viewName === 'profile') {
        await api.loadClientBookings();
        renderClientDashboard();
    }
    if (viewName === 'provider') {
        renderProviderDashboard();
    }
    if (viewName === 'admin') {
        loadAndRenderAdminDisputes();
    }
}

export function filterCatalog(cat) {
    state.currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    renderCatalog(cat);
}

export function renderCatalog(filter) {
    const filtered = filter === 'all' ? state.allNodes : state.allNodes.filter(n => n.category === filter);
    const container = document.getElementById('catalog-grid');
    if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><h3>Нет серверов</h3></div>'; return; }
    const catNames = {"ml": "Обучение ML", "web": "Хостинг сайтов", "game": "Игровые серверы"};
    container.innerHTML = filtered.map(node => {
        const isBusy = node.status === 'busy';
        return `<div class="product-card" style="${isBusy ? 'opacity: 0.5; pointer-events:none;' : ''}" onclick="window.ui.openNodeModal('${node.id}')">
            <div class="card-img">🖥️<div class="category-tag">${catNames[node.category] || node.category}</div></div>
            <div class="card-content">
                <div class="card-title">${node.gpu} <span class="rating">⭐ ${node.rating}</span></div>
                <div class="card-specs">CPU: ${node.cpu} | RAM: ${node.ram}GB</div>
                <div class="card-footer">
                    <div class="price">${node.price} <small>₽/час</small></div>
                    ${isBusy ? '<div style="color:red; font-weight:bold; font-size:12px;">В аренде</div>' : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

export function openNodeModal(nodeId) {
    const node = state.allNodes.find(n => n.id === nodeId); if(!node) return;
    const reviews = Array(3).fill(0).map((_, i) => state.reviewsPool[(parseInt(nodeId.substr(5,1), 16)+i) % state.reviewsPool.length]);
    document.getElementById('modal-body').innerHTML = `
        <h2>${node.gpu}</h2>
        <div style="color:var(--wb-orange); font-weight:bold; margin-bottom:10px;">⭐ ${node.rating} | ${reviews.length} отзывов</div>
        <p style="color:#666; line-height:1.5;">${node.description}</p>
        <h4 style="margin-top:20px;">Характеристики:</h4>
        <ul><li>CPU: ${node.cpu}</li><li>RAM: ${node.ram} GB</li><li>VRAM: ${node.vram} GB</li><li>SSD: ${node.ssd} GB</li></ul>
        <h4 style="margin-top:20px;">Отзывы:</h4>
        ${reviews.map(r => `<div class="review-item"><strong>${r.author}</strong> (${'⭐'.repeat(r.r)})<p style="margin:5px 0 0; font-size:14px; color:#333;">${r.text}</p></div>`).join('')}
        <div style="margin-top: 25px; display: flex; gap: 10px; align-items: center;">
            <input type="number" id="modal_hours_${node.id}" value="2" min="1" class="rent-input">
            <button class="btn btn-primary" onclick="window.ui.handleBookNode('${node.id}'); window.ui.closeModal();">Арендовать</button>
        </div>
    `;
    document.getElementById('node-modal').style.display = 'flex';
}

export function closeModal() { document.getElementById('node-modal').style.display = 'none'; }

export async function handleBookNode(nodeId) {
    await api.bookNode(nodeId);
    await api.loadProfile(); await api.loadProviderProfile(); await api.loadCatalog();
    showView('profile');
}

export async function renderProviderDashboard() {
    const container = document.getElementById('provider-dashboard');
    container.innerHTML = '<div class="empty-state">Загрузка истории аренд...</div>';

    try {
        const res = await fetch('/api/provider/bookings');
        const bookings = await res.json();

        const bookingsByNode = {};
        bookings.forEach(b => {
            if (!bookingsByNode[b.node_id]) bookingsByNode[b.node_id] = [];
            bookingsByNode[b.node_id].push(b);
        });

        state.providerNodes = state.allNodes.filter(n => n.status === 'online' || n.status === 'busy');
        
        if (state.providerNodes.length === 0 && bookings.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>У вас пока нет серверов и аренд</h3></div>';
            return;
        }

        container.innerHTML = '';

        state.providerNodes.forEach(n => {
            const nodeBookings = bookingsByNode[n.id] || [];
            const bookingCountHTML = nodeBookings.length > 0 ? `<span style="font-size:12px; color:var(--apple-gray-medium); margin-left:8px;">(${nodeBookings.length} аренд)</span>` : '';

            let bookingsHTML = '';
            if (nodeBookings.length === 0) {
                bookingsHTML = '<div style="padding:15px; color:var(--apple-gray-medium); font-size:13px; text-align:center;">Истории аренд пока нет</div>';
            } else {
                nodeBookings.forEach(b => {
                    let statusTextProvider = b.status;
                    if (b.status === 'pending') statusTextProvider = 'Ожидание';
                    if (b.status === 'active') statusTextProvider = 'В аренде';
                    if (b.status === 'completed') statusTextProvider = 'Завершена';
                    if (b.status === 'dispute') statusTextProvider = 'Открыт спор';
                    if (b.status === 'refunded') statusTextProvider = 'Возврат';
                    if (b.status === 'dispute_lost') statusTextProvider = 'Спор выигран';

                    let statusBadge = `<span class="status-badge status-${b.status}">${statusTextProvider}</span>`;
                    let disputeInfo = '';
                    
                    if (b.dispute_status === 'resolved') {
                        const verdict = b.dispute_resolution === 'refund' ? 'Возврат клиенту' : 'Выплата вам';
                        const verdictClass = b.dispute_resolution === 'refund' ? 'verdict-refund' : 'verdict-payout';
                        disputeInfo = `<div class="dispute-verdict ${verdictClass}">🛡️ Спор решен: ${verdict}</div>`;
                    } else if (b.dispute_status === 'open') {
                        disputeInfo = `<div class="dispute-verdict verdict-open">⚠️ Спор открыт</div>`;
                    }

                    const chatButton = b.status === 'active' 
                        ? `<button class="btn btn-secondary btn-sm" onclick="window.chat.openProviderChat('${b.node_id}')">💬 Чат</button>` 
                        : '';

                    bookingsHTML += `
                    <div class="provider-booking-item">
                        <div class="booking-top">
                            <div>
                                ${statusBadge}
                                <span style="font-size:12px; color:var(--apple-gray-medium); margin-left:5px;">от ${b.created_at}</span>
                            </div>
                            <div style="font-weight:600;">${b.total_amount.toFixed(2)} ₽</div>
                        </div>
                        ${disputeInfo}
                        <div style="display: flex; gap: 10px; margin-top:10px;">
                            <button class="btn btn-secondary btn-sm" onclick="window.ui.loadBookingMetrics('${b.booking_id}', this)">📊 Телеметрика</button>
                            ${chatButton}
                        </div>
                        <div class="booking-metrics-container" id="metrics-${b.booking_id}" style="display:none; margin-top:15px;"></div>
                    </div>
                    `;
                });
            }

            const nodeHTML = `
                <div class="provider-node-card" id="pnode-${n.id}">
                    <div class="node-header" onclick="window.ui.toggleProviderNode('${n.id}')">
                        <div>
                            <strong>${n.gpu}</strong><br>
                            <small class="node-status-text" style="color: ${n.status === 'online' ? 'var(--wb-green)' : 'var(--wb-orange)'}; font-weight:bold;">
                                ${n.status === 'online' ? '● Свободна' : '● В аренде'}
                            </small>
                            ${bookingCountHTML}
                        </div>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="node-bookings-list">
                        ${bookingsHTML}
                    </div>
                </div>
            `;
            container.innerHTML += nodeHTML;
        });

    } catch (e) {
        container.innerHTML = '<div class="empty-state">Ошибка загрузки данных поставщика</div>';
        console.error(e);
    }
}

export function updateProviderNodeStatuses() {
    const currentNodes = state.allNodes.filter(n => n.status === 'online' || n.status === 'busy');
    const container = document.getElementById('provider-dashboard');

    if (container.querySelectorAll('.provider-node-card').length !== currentNodes.length) {
        renderProviderDashboard();
        return;
    }

    currentNodes.forEach(n => {
        const card = document.getElementById(`pnode-${n.id}`);
        if (!card) return;

        const statusEl = card.querySelector('.node-status-text');
        if (statusEl) {
            statusEl.style.color = n.status === 'online' ? 'var(--wb-green)' : 'var(--wb-orange)';
            statusEl.innerText = n.status === 'online' ? '● Свободна' : '● В аренде';
        }
    });
}

export function toggleProviderNode(nodeId) {
    const card = document.getElementById(`pnode-${nodeId}`);
    if (card) card.classList.toggle('expanded');
}

export async function loadBookingMetrics(bookingId, btn) {
    const container = document.getElementById(`metrics-${bookingId}`);
    if (container.innerHTML !== '') {
        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? '📊 Скрыть телеметрику' : '📊 Телеметрика';
        return;
    }

    btn.textContent = 'Загрузка...';
    try {
        const res = await fetch(`/api/provider/booking/${bookingId}/metrics`);
        const metrics = await res.json();
        
        if (metrics.length === 0) {
            container.innerHTML = '<div style="font-size:13px; color:var(--apple-gray-medium); padding:10px 0;">Нет данных телеметрии</div>';
            container.style.display = 'block';
            btn.textContent = '📊 Нет данных';
            return;
        }

        const labels = metrics.map(m => m.sec + 'с');
        const cpuData = metrics.map(m => m.cpu);
        const ramData = metrics.map(m => m.ram);
        const gpuData = metrics.map(m => m.gpu_temp);
        const diskData = metrics.map(m => m.disk_io);

        container.innerHTML = `
            <div class="charts-grid">
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">CPU (%)</div><div class="chart-container"><canvas id="p-cpu-${bookingId}"></canvas></div></div>
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">RAM (MB)</div><div class="chart-container"><canvas id="p-ram-${bookingId}"></canvas></div></div>
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">GPU Temp (°C)</div><div class="chart-container"><canvas id="p-gpu-${bookingId}"></canvas></div></div>
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">Disk I/O (MB/s)</div><div class="chart-container"><canvas id="p-disk-${bookingId}"></canvas></div></div>
            </div>
        `;
        container.style.display = 'block';
        btn.textContent = '📊 Скрыть телеметрику';

        charts.initAdminChart(`p-cpu-${bookingId}`, 'CPU', 'rgb(124,58,237)', 'rgba(124,58,237,0.1)', 100, '%', labels, cpuData);
        charts.initAdminChart(`p-ram-${bookingId}`, 'RAM', 'rgb(249,115,22)', 'rgba(249,115,22,0.1)', 32768, 'MB', labels, ramData);
        charts.initAdminChart(`p-gpu-${bookingId}`, 'GPU Temp', 'rgb(59,130,246)', 'rgba(59,130,246,0.1)', 100, '°C', labels, gpuData);
        charts.initAdminChart(`p-disk-${bookingId}`, 'Disk IO', 'rgb(239,68,68)', 'rgba(239,68,68,0.1)', 500, 'MB/s', labels, diskData);

    } catch(e) {
        container.innerHTML = '<div style="color:red;">Ошибка загрузки метрик</div>';
        container.style.display = 'block';
        btn.textContent = '📊 Ошибка';
    }
}

export function renderClientDashboard() {
    const container = document.getElementById('client-dashboard');
    if (state.localBookings.length === 0) { container.innerHTML = '<div class="empty-state"><h3>Нет аренд</h3></div>'; return; }
    container.innerHTML = state.localBookings.map(b => {
        let bodyHtml = '';
        const sshCmd = `ssh ${b.ssh_login}@${b.ssh_ip}`;
        const sshBlock = `<div class="ssh-container">
            <div class="ssh-grid">
                <span class="ssh-label">IP Адрес:</span> <span class="ssh-value">${b.ssh_ip}</span>
                <span class="ssh-label">Логин:</span> <span class="ssh-value">${b.ssh_login}</span>
                <span class="ssh-label">Пароль:</span> <span class="ssh-value">${b.ssh_pass}</span>
            </div>
            <div style="font-size: 12px; color: #9CA3AF; margin-bottom: 5px;">Команда для подключения:</div>
            <div class="ssh-cmd-row"><code class="ssh-cmd-code">${sshCmd}</code><button class="btn-copy" onclick="navigator.clipboard.writeText('${sshCmd}')">КОПИРОВАТЬ</button></div>
        </div>`;

        if (b.status === 'pending') {
            bodyHtml = `${sshBlock}
            <button class="btn btn-primary" onclick="window.ui.handleStartSession('${b.id}')" style="width:100%; margin-top:10px;">🖥️ Начать сессию</button>`;
        } else if (b.status === 'active') {
            bodyHtml = `<div style="opacity: 0.6; margin-bottom: 10px;">${sshBlock.replace('<div class="ssh-container">', '<div class="ssh-container" style="background:#111827;">')}</div>
            <div class="timer-digits" id="timer-${b.id}">00:00:00</div>
            <button class="btn btn-danger btn-sm" onclick="window.ui.handleReportIssue('${b.id}')" style="width:100%; margin-bottom:10px;">⚠️ Connection trouble</button>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><strong>Чат с поставщиком:</strong> <button class="btn btn-secondary btn-sm" onclick="window.chat.openClientChat('${b.id}')">💬 Открыть</button></div>
            <div class="charts-grid">
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">CPU (%)</div><div class="chart-container"><canvas id="chart-cpu-${b.id}"></canvas></div></div>
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">RAM (MB)</div><div class="chart-container"><canvas id="chart-ram-${b.id}"></canvas></div></div>
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">GPU Temp (°C)</div><div class="chart-container"><canvas id="chart-gputemp-${b.id}"></canvas></div></div>
                <div class="chart-item"><div style="font-size:10px; font-weight:bold;">Disk I/O (MB/s)</div><div class="chart-container"><canvas id="chart-diskio-${b.id}"></canvas></div></div>
            </div>`;
        } else if (b.status === 'dispute') {
            bodyHtml = `<div style="text-align:center; color: #B91C1C; font-weight:bold;">⚠️ Аренда заморожена. Идет арбитраж.</div>`;
        } else if (b.status === 'refunded') {
            bodyHtml = `<div style="text-align:center; color: var(--wb-green); font-weight:bold;">✅ Средства возвращены, извините за неудобства.</div>`;
        } else if (b.status === 'dispute_lost') {
            bodyHtml = `<div style="text-align:center; color: var(--wb-red); font-weight:bold;">🚫 Средства отправлены поставщику.</div>`;
        } else {
            bodyHtml = `<div style="text-align:center; color: var(--wb-green); font-weight:bold;">✅ Сессия завершена успешно</div>`;
        }
        
            // Маппинг статусов для клиента
        let statusTextClient = b.status;
        if (b.status === 'pending') statusTextClient = 'Ожидание';
        if (b.status === 'active') statusTextClient = 'Активна';
        if (b.status === 'completed') statusTextClient = 'Завершена';
        if (b.status === 'dispute') statusTextClient = 'Спор';
        if (b.status === 'refunded') statusTextClient = 'Возврат';
        if (b.status === 'dispute_lost') statusTextClient = 'Спор проигран';

        return `<div class="order-card"><div class="order-header"><strong>${b.nodeGpu}</strong><span class="status-badge status-${b.status}">${statusTextClient}</span></div><div>Сумма: ${b.total_amount.toFixed(2)} ₽</div>${bodyHtml}</div>`;

    }).join('');
    
    state.localBookings.filter(b => b.status === 'active').forEach(b => { 
        if(!state.chartData[b.id]) state.chartData[b.id] = { labels: [], cpu: [], ram: [], gpu_temp: [], disk_io: [] }; 
        
        requestAnimationFrame(() => {
            if (state.activeCharts[b.id]) {
                charts.destroyCharts(b.id);
            }
            charts.initCharts(b.id); 
            
            startTimer(b.id); 
        });
    });
}

function startTimer(bookingId) {
    if(state.activeTimers[bookingId]) clearInterval(state.activeTimers[bookingId]);
    state.activeTimers[bookingId] = setInterval(() => {
        const b = state.localBookings.find(b => b.id === bookingId);
        if (!b || b.status !== 'active' || !b.endTime) { clearInterval(state.activeTimers[bookingId]); return; }
        const distance = b.endTime - new Date().getTime();
        const timerEl = document.getElementById(`timer-${bookingId}`); if (!timerEl) return;
        if (distance <= 0) { clearInterval(state.activeTimers[bookingId]); timerEl.innerText = "00:00:00"; api.completeSession(bookingId).then(() => renderClientDashboard()); return; }
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((distance % (1000 * 60)) / 1000);
        timerEl.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        charts.updateChartData(bookingId); 
    }, 1000);
}

export async function handleStartSession(id) { 
    await api.startSession(id); 

    const booking = state.localBookings.find(b => b.id === id);
    if (booking) {
        booking.status = 'active';
        booking.endTime = new Date().getTime() + booking.hours * 10 * 1000; 
        state.sessionStartTime[id] = new Date().getTime();

        if(!state.chartData[id]) {
            state.chartData[id] = { labels: [], cpu: [], ram: [], gpu_temp: [], disk_io: [] }; 
        }
    }
    
    renderClientDashboard(); 
}

export async function handleReportIssue(id) { 
    await api.reportIssue(id); 

    const booking = state.localBookings.find(b => b.id === id);
    if (booking) {
        booking.status = 'dispute';
        if(state.activeTimers[id]) clearInterval(state.activeTimers[id]);
    }
    
    renderClientDashboard(); 
}

export async function loadAndRenderAdminDisputes() {
    const disputes = await api.loadAdminDisputes();
    const container = document.getElementById('admin-list');
    if (disputes.length === 0) { container.innerHTML = '<div class="empty-state">Нет споров</div>'; return; }
    container.innerHTML = disputes.map(d => `
        <div class="dispute-item" onclick="window.ui.openAdminDispute('${d.id}')">
            <div><strong>Инцидент #${d.id.substring(0,8)}</strong><br><small>Клиент: ${d.client_email} | Нода: ${d.node_ip}</small></div>
            <span class="status-badge status-${d.status}">${d.status}</span>
        </div>
    `).join('');
}

export async function openAdminDispute(id) {
    const data = await api.getDisputeDetails(id);
    const isResolved = data.dispute_status === 'resolved';
    document.getElementById('modal-body').innerHTML = `
        <h2>Арбитраж #${id.substring(0,8)}</h2>
        <p><strong>Сумма в Эскроу:</strong> ${data.total_amount.toFixed(2)} ₽</p>
        <p><strong>Характеристики ноды:</strong> ${data.specs.cpu}, ${data.specs.gpu}, RAM ${data.specs.ram}GB, VRAM ${data.specs.vram}GB</p>
        <h4 style="margin-top:20px;">Чат с участниками</h4>
        <div class="chat-box">
            <div class="msg msg-client"><strong>Клиент:</strong> Соединение оборвалось! Температура GPU выросла!</div>
            <div class="msg msg-provider"><strong>Поставщик:</strong> У меня всё работало, это у вас интернет слабый.</div>
            <div class="msg msg-client"><strong>Клиент:</strong> Логи Disk I/O показывали сбой, отвалился диск!</div>
        </div>
        <h4>Телеметрия перед сбоем</h4>
        <div class="charts-grid">
            <div class="chart-item"><div style="font-size:10px; font-weight:bold;">CPU (%)</div><div class="chart-container"><canvas id="admin-chart-cpu"></canvas></div></div>
            <div class="chart-item"><div style="font-size:10px; font-weight:bold;">RAM (MB)</div><div class="chart-container"><canvas id="admin-chart-ram"></canvas></div></div>
            <div class="chart-item"><div style="font-size:10px; font-weight:bold;">GPU Temp (°C)</div><div class="chart-container"><canvas id="admin-chart-gputemp"></canvas></div></div>
            <div class="chart-item"><div style="font-size:10px; font-weight:bold;">Disk I/O (MB/s)</div><div class="chart-container"><canvas id="admin-chart-diskio"></canvas></div></div>
        </div>
        ${isResolved ? `<div style="text-align:center; font-weight:bold; font-size:18px; color:${data.dispute_resolution==='refund'?'var(--wb-green)':'var(--wb-red)'}; margin-top:20px; padding:20px;">ВЕРДИКТ: ${data.dispute_resolution==='refund'?'Возврат клиенту':'Оплата провайдеру'}</div>` : `
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn btn-danger" onclick="window.ui.handleResolve('${id}','refund')">↩️ Вернуть клиенту</button>
            <button class="btn btn-success" onclick="window.ui.handleResolve('${id}','pay_provider')">✅ Оплатить провайдеру</button>
        </div>`}
    `;
    document.getElementById('node-modal').style.display = 'flex';

    const labels = data.metrics.map(m => `${m.sec}с`);
    charts.initAdminChart('admin-chart-cpu', 'CPU', 'rgb(124,58,237)', 'rgba(124,58,237,0.1)', 100, '%', labels, data.metrics.map(m => m.cpu)); 
    charts.initAdminChart('admin-chart-ram', 'RAM', 'rgb(249,115,22)', 'rgba(249,115,22,0.1)', 32768, 'MB', labels, data.metrics.map(m => m.ram));
    charts.initAdminChart('admin-chart-gputemp', 'GPU', 'rgb(59,130,246)', 'rgba(59,130,246,0.1)', 100, '°C', labels, data.metrics.map(m => m.gpu_temp));
    charts.initAdminChart('admin-chart-diskio', 'Disk', 'rgb(239,68,68)', 'rgba(239,68,68,0.1)', 500, 'MB/s', labels, data.metrics.map(m => m.disk_io));
};

export async function handleResolve(id, dec) {
    await api.resolveDispute(id, dec);
    loadAndRenderAdminDisputes(); closeModal();
}