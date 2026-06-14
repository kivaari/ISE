import { state } from './state.js';

export async function loadProfile() {
    try {
        const res = await fetch(`${state.API_URL}/profile`); const data = await res.json();
        document.getElementById('header-balance').innerText = `${data.balance.toFixed(0)} ₽`;
        document.getElementById('prof-balance').innerText = `${data.balance.toFixed(2)} ₽`;
        document.getElementById('prof-frozen').innerText = `${data.frozen.toFixed(2)} ₽`;
    } catch(e) {}
}

export async function loadProviderProfile() {
    try {
        const res = await fetch(`${state.API_URL}/provider/profile`); const data = await res.json();
        document.getElementById('prov-balance').innerText = `${data.balance.toFixed(2)} ₽`;
    } catch(e) {}
}

export async function topUp() {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    await fetch(`${state.API_URL}/topup`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount}) });
    loadProfile();
}

export async function loadCatalog() {
    const res = await fetch(`${state.API_URL}/catalog`); state.allNodes = await res.json();
}

export async function connectNode() {
    const res = await fetch(`${state.API_URL}/agent/connect`, { method: 'POST' }); const data = await res.json();
    alert(`✅ Нода подключена: ${data.specs.gpu_model}`);
    loadCatalog(); loadProviderProfile();
}

export async function bookNode(nodeId) {
    const hoursInput = document.getElementById(`modal_hours_${nodeId}`);
    const hours = hoursInput ? parseInt(hoursInput.value) : 2;
    const node = state.allNodes.find(n => n.id === nodeId);
    const res = await fetch(`${state.API_URL}/book`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ node_id: nodeId, hours }) });
    const data = await res.json();
    if (data.error) { alert(`❌ ${data.error}`); return; }
    state.localBookings.push({ id: data.booking_id, hours, total_amount: data.total_amount, ssh_login: data.ssh_login, ssh_pass: data.ssh_pass, ssh_ip: data.ssh_ip, status: 'pending', nodeGpu: node?.gpu || 'Server', endTime: null });
}

export async function startSession(bookingId) {
    await fetch(`${state.API_URL}/start-session`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ booking_id: bookingId }) });
    const booking = state.localBookings.find(b => b.id === bookingId);
    if (booking) { booking.status = 'active'; booking.endTime = new Date().getTime() + booking.hours * 10 * 1000; state.sessionStartTime[bookingId] = new Date().getTime(); }
}

export async function completeSession(bookingId) {
    await fetch(`${state.API_URL}/complete-session`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ booking_id: bookingId }) });
    const booking = state.localBookings.find(b => b.id === bookingId);
    if (booking) { booking.status = 'completed'; if(state.activeTimers[bookingId]) clearInterval(state.activeTimers[bookingId]); }
    loadProfile(); loadProviderProfile(); loadCatalog();
}

export async function reportIssue(bookingId) {
    if (!confirm("Сообщить о сбое?")) return;
    const booking = state.localBookings.find(b => b.id === bookingId); if(state.activeTimers[bookingId]) clearInterval(state.activeTimers[bookingId]); booking.status = 'dispute';
    let metricsPayload = [];
    if (state.chartData[bookingId] && state.chartData[bookingId].labels && state.chartData[bookingId].labels.length > 0) {
        metricsPayload = state.chartData[bookingId].labels.map((label, i) => ({ sec: parseInt(label), cpu: state.chartData[bookingId].cpu[i]||0, ram: state.chartData[bookingId].ram[i]||0, gpu_temp: state.chartData[bookingId].gpu_temp[i]||0, disk_io: state.chartData[bookingId].disk_io[i]||0 }));
    }
    await fetch(`${state.API_URL}/report-issue`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ booking_id: bookingId, metrics: metricsPayload }) });
}

export async function loadAdminDisputes() {
    const res = await fetch(`${state.API_URL}/admin/disputes`); return await res.json();
}

export async function getDisputeDetails(id) {
    const res = await fetch(`${state.API_URL}/admin/dispute/${id}`); return await res.json();
}

export async function resolveDispute(id, dec) {
    await fetch(`${state.API_URL}/admin/resolve`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ dispute_id: id, decision: dec }) });
    const detailRes = await fetch(`${state.API_URL}/admin/dispute/${id}`); const detailData = await detailRes.json();
    const booking = state.localBookings.find(b => b.id === detailData.booking_id);
    if (booking) booking.status = dec === 'refund' ? 'refunded' : 'dispute_lost';
    loadProfile(); loadProviderProfile(); loadCatalog();
}

export async function loadClientBookings() {
    const res = await fetch('/api/client/bookings');
    const bookings = await res.json();

    state.localBookings = bookings.map(b => {
        return {
            id: b.booking_id,
            node_id: b.node_id,
            status: b.status,
            total_amount: b.total_amount,
            nodeGpu: b.gpu_model,
            ssh_login: b.ssh_login,
            ssh_pass: b.ssh_pass,
            ssh_ip: b.ip_address,
            hours: Math.round(b.total_amount / b.price_per_hour)
        };
    });

    state.localBookings.forEach(b => {
        if (b.status === 'active' && !b.endTime) {
            b.endTime = new Date().getTime() + b.hours * 10 * 1000;
            state.sessionStartTime[b.id] = new Date().getTime();

            if (!state.chartData[b.id]) {
                state.chartData[b.id] = { labels: [], cpu: [], ram: [], gpu_temp: [], disk_io: [] };
            }
        }
    });
}