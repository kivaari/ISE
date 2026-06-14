export const state = {
    API_URL: 'http://localhost:8080/api',
    allNodes: [],
    localBookings: [],
    providerNodes: [],
    activeTimers: {},
    activeCharts: {},
    chartData: {},
    sessionStartTime: {},
    currentFilter: 'all',
    reviewsPool: [
        {author: "Алексей", text: "Отличный сервер, всё летает! Поддержка отвечает быстро.", r: 5},
        {author: "Мария", text: "Был небольшой лаг в часы пик, но в целом неплохо для этой цены.", r: 4},
        {author: "Игорь", text: "Идеально подошел для рендера, рекомендую.", r: 5},
        {author: "Олег", text: "Сервер падал пару раз, но деньги вернули без проблем.", r: 3},
        {author: "Анна", text: "Очень дешево для такого GPU, буду арендовать еще.", r: 5}
    ]
};