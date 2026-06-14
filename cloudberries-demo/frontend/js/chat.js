export function openProviderChat(nodeId) {
    document.getElementById('modal-body').innerHTML = `
        <h2>💬 Чат с клиентом</h2>
        <p style="font-size:14px; color:#666;">Нода: ${nodeId.substring(0,8)}...</p>
        <div class="chat-box" id="prov-chat-box">
            <div class="msg msg-client"><strong>Клиент:</strong> Здравствуйте! Сервер работает отлично, спасибо!</div>
        </div>
        <div class="chat-input-group">
            <input type="text" class="chat-input" id="prov-chat-input" placeholder="Введите ответ...">
            <button class="btn btn-primary btn-sm" onclick="window.chat.sendProviderMsg()">Отправить</button>
        </div>
    `;
    document.getElementById('node-modal').style.display = 'flex';
}

export function sendProviderMsg() {
    const input = document.getElementById('prov-chat-input'); const box = document.getElementById('prov-chat-box');
    if (!input.value.trim()) return;
    box.innerHTML += `<div class="msg msg-provider"><strong>Вы:</strong> ${input.value}</div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => { box.innerHTML += `<div class="msg msg-client"><strong>Клиент:</strong> Понял, спасибо!</div>`; box.scrollTop = box.scrollHeight; }, 1000);
}

export function openClientChat(bookingId) {
    document.getElementById('modal-body').innerHTML = `
        <h2>💬 Поддержка</h2>
        <div class="chat-box" id="client-chat-box">
            <div class="msg msg-provider"><strong>Поддержка:</strong> Чем можем помочь?</div>
        </div>
        <div class="chat-input-group">
            <input type="text" class="chat-input" id="client-chat-input" placeholder="Введите сообщение...">
            <button class="btn btn-primary btn-sm" onclick="window.chat.sendClientMsg()">Отправить</button>
        </div>
    `;
    document.getElementById('node-modal').style.display = 'flex';
}

export function sendClientMsg() {
    const input = document.getElementById('client-chat-input'); const box = document.getElementById('client-chat-box');
    if (!input.value.trim()) return;
    box.innerHTML += `<div class="msg msg-client"><strong>Вы:</strong> ${input.value}</div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => { box.innerHTML += `<div class="msg msg-provider"><strong>Поддержка:</strong> Мы уже работаем над этим, подождите немного.</div>`; box.scrollTop = box.scrollHeight; }, 1500);
}