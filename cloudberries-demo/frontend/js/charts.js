import { state } from './state.js';

const Chart = window.Chart;

export function initCharts(id) {
    const cfg = (l, c, bg, max, suf) => ({ type: 'line', data: { labels: [], datasets: [{ label: l, data: [], borderColor: c, backgroundColor: bg, borderWidth: 1, tension: 0.4, fill: true, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: max, ticks: { callback: v => v+suf, font:{size:9} } }, x: { display: true, ticks: { maxTicksLimit: 5, font: {size: 9} } } }, plugins: { legend: { display: false } } } });
    state.activeCharts[id] = {
        cpu: new Chart(document.getElementById(`chart-cpu-${id}`), cfg('CPU','rgb(124,58,237)','rgba(124,58,237,0.1)',100,'%')),
        ram: new Chart(document.getElementById(`chart-ram-${id}`), cfg('RAM','rgb(249,115,22)','rgba(249,115,22,0.1)',32768,'MB')),
        gpu_temp: new Chart(document.getElementById(`chart-gputemp-${id}`), cfg('GPU','rgb(59,130,246)','rgba(59,130,246,0.1)',100,'°C')),
        disk_io: new Chart(document.getElementById(`chart-diskio-${id}`), cfg('Disk','rgb(239,68,68)','rgba(239,68,68,0.1)',500,'MB/s'))
    };
}

export function updateChartData(id) {
    if (!state.activeCharts[id] || !state.chartData[id]) return;
    const d = state.chartData[id]; d.labels.push(`${Math.round((new Date().getTime()-state.sessionStartTime[id])/1000)}с`);
    const last = (arr, def) => arr.length > 0 ? arr[arr.length - 1] : def;
    d.cpu.push(Math.round(Math.max(10, Math.min(95, last(d.cpu,20) + (Math.random()-0.5)*15))));
    d.ram.push(Math.round(Math.max(2000, Math.min(30000, last(d.ram,8000) + (Math.random()-0.5)*1000))));
    d.gpu_temp.push(Math.round(Math.max(40, Math.min(85, last(d.gpu_temp,55) + (Math.random()-0.5)*5))));
    d.disk_io.push(Math.round(Math.max(50, Math.min(500, last(d.disk_io,150) + (Math.random()-0.5)*50))));
    if (d.labels.length > 30) { d.labels.shift(); d.cpu.shift(); d.ram.shift(); d.gpu_temp.shift(); d.disk_io.shift(); }
    const ch = state.activeCharts[id];
    ch.cpu.data.labels=d.labels; ch.cpu.data.datasets[0].data=d.cpu; ch.cpu.update('none');
    ch.ram.data.labels=d.labels; ch.ram.data.datasets[0].data=d.ram; ch.ram.update('none');
    ch.gpu_temp.data.labels=d.labels; ch.gpu_temp.data.datasets[0].data=d.gpu_temp; ch.gpu_temp.update('none');
    ch.disk_io.data.labels=d.labels; ch.disk_io.data.datasets[0].data=d.disk_io; ch.disk_io.update('none');
}

export function initAdminChart(canvasId, label, color, bgColor, yMax, suffix, labels, dataPoints) {
    const ctx = document.getElementById(canvasId); if (!ctx) return;
    new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: label, data: dataPoints, borderColor: color, backgroundColor: bgColor, borderWidth: 2, tension: 0.4, fill: true, pointRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: yMax, ticks: { callback: v => v + suffix, font: {size: 10} } }, x: { display: true, ticks: { maxTicksLimit: 5, font: {size: 9} } } }, plugins: { legend: { display: false } } } });
}

export function destroyCharts(id) {
    if (state.activeCharts[id]) {
        state.activeCharts[id].cpu.destroy();
        state.activeCharts[id].ram.destroy();
        state.activeCharts[id].gpu_temp.destroy();
        state.activeCharts[id].disk_io.destroy();
        
        delete state.activeCharts[id];
    }
}