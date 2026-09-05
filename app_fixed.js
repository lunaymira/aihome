// Дом · Счётчики — стабильная версия v4
// Исправлено: сохранение, история, совместимость с Telegram и обычным браузером

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

if (tg) {
    tg.expand();
    tg.ready();
}

const STORAGE_KEY = 'aihome_meters_readings_v4';
const PRICES_KEY = 'aihome_meters_prices_v4';

let readings = [];
let savedPrices = {};

function $(id) {
    return document.getElementById(id);
}

function safeNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const normalized = String(value).replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
}

function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function formatShortDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString + 'T00:00:00');
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function showAlert(message) {
    if (tg && typeof tg.showAlert === 'function') {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

function haptic(type = 'success') {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
    }
}

function updateStatus(text, ok = true) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const headerStatus = document.querySelector('.header-status');

    if (!statusText || !headerStatus || !statusDot) return;

    statusText.textContent = text;
    headerStatus.style.background = ok ? 'var(--success-tint)' : 'var(--error-tint)';
    headerStatus.style.color = ok ? 'var(--success)' : 'var(--error)';
    statusDot.style.background = ok ? 'var(--success)' : 'var(--error)';

    setTimeout(() => {
        statusText.textContent = 'Готово';
        headerStatus.style.background = 'var(--success-tint)';
        headerStatus.style.color = 'var(--success)';
        statusDot.style.background = 'var(--success)';
    }, 2500);
}

function loadData() {
    try {
        const rawReadings = localStorage.getItem(STORAGE_KEY);
        const rawPrices = localStorage.getItem(PRICES_KEY);
        readings = rawReadings ? JSON.parse(rawReadings) : [];
        savedPrices = rawPrices ? JSON.parse(rawPrices) : {};

        if (!Array.isArray(readings)) readings = [];
        if (!savedPrices || typeof savedPrices !== 'object') savedPrices = {};
    } catch (error) {
        readings = [];
        savedPrices = {};
        console.error('Ошибка загрузки:', error);
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
        localStorage.setItem(PRICES_KEY, JSON.stringify(savedPrices));
        return true;
    } catch (error) {
        console.error('Ошибка localStorage:', error);
        showAlert('Не удалось сохранить данные. Возможно, Telegram/браузер запретил хранилище. Попробуйте открыть приложение заново.');
        return false;
    }
}

function savePricesFromForm() {
    savedPrices = {
        electricityT1: safeNumber($('electricity-t1-price').value),
        electricityT2: safeNumber($('electricity-t2-price').value),
        coldWater: safeNumber($('cold-water-price').value),
        hotWater: safeNumber($('hot-water-price').value)
    };
}

function fillSavedPrices() {
    if (savedPrices.electricityT1) $('electricity-t1-price').value = savedPrices.electricityT1;
    if (savedPrices.electricityT2) $('electricity-t2-price').value = savedPrices.electricityT2;
    if (savedPrices.coldWater) $('cold-water-price').value = savedPrices.coldWater;
    if (savedPrices.hotWater) $('hot-water-price').value = savedPrices.hotWater;
}

function getPreviousByDate(dateValue, type) {
    const key = type === 'electricity' ? 'electricityDate' : 'waterDate';
    const currentTime = new Date(dateValue + 'T00:00:00').getTime();

    return readings
        .filter(r => r[key] && new Date(r[key] + 'T00:00:00').getTime() < currentTime)
        .sort((a, b) => new Date(b[key] + 'T00:00:00') - new Date(a[key] + 'T00:00:00'))[0] || null;
}

function getSortTime(reading) {
    const e = reading.electricityDate ? new Date(reading.electricityDate + 'T00:00:00').getTime() : 0;
    const w = reading.waterDate ? new Date(reading.waterDate + 'T00:00:00').getTime() : 0;
    return Math.max(e, w);
}

function renderHistory() {
    const historyList = $('history-list');
    if (!historyList) return;

    if (!readings.length) {
        historyList.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
                </svg>
                <p>Пока нет сохранённых показаний</p>
            </div>
        `;
        return;
    }

    const sorted = [...readings].sort((a, b) => getSortTime(b) - getSortTime(a));

    historyList.innerHTML = sorted.map(r => {
        const isFirst = !r.hasPreviousElectricity && !r.hasPreviousWater;
        const electricText = r.hasPreviousElectricity
            ? `${r.electricityTotalConsumption.toFixed(2)} кВт·ч · ${formatCurrency(r.electricityTotalCost)}`
            : `показания сохранены`;
        const waterText = r.hasPreviousWater
            ? `${(r.coldWaterConsumption + r.hotWaterConsumption).toFixed(3)} м³ · ${formatCurrency(r.waterTotalCost)}`
            : `показания сохранены`;

        return `
            <div class="history-item" data-id="${r.id}">
                <div class="history-item-header">
                    <div style="display:flex;flex-direction:column;gap:0.25rem;">
                        <span class="history-date">⚡ ${formatShortDate(r.electricityDate)}</span>
                        <span class="history-date" style="font-size:0.875rem;color:var(--muted);">💧 ${formatShortDate(r.waterDate)}</span>
                    </div>
                    <span class="history-total">${isFirst ? 'База' : formatCurrency(r.totalCost)}</span>
                </div>
                <div class="history-details">
                    <div class="history-detail">
                        <span class="history-detail-label">Электричество</span>
                        <span class="history-detail-value">${electricText}</span>
                    </div>
                    <div class="history-detail">
                        <span class="history-detail-label">Холодная</span>
                        <span class="history-detail-value">${r.hasPreviousWater ? r.coldWaterConsumption.toFixed(3) + ' м³' : r.coldWaterReading.toFixed(3)}</span>
                    </div>
                    <div class="history-detail">
                        <span class="history-detail-label">Горячая</span>
                        <span class="history-detail-value">${r.hasPreviousWater ? r.hotWaterConsumption.toFixed(3) + ' м³' : r.hotWaterReading.toFixed(3)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = Number(item.dataset.id);
            const r = readings.find(x => x.id === id);
            if (r) showDetails(r);
        });
    });
}

function showDetails(r) {
    let msg = `Детали показаний\n\n`;
    msg += `⚡ Электричество: ${formatShortDate(r.electricityDate)}\n`;
    msg += `Т1 показание: ${r.electricityT1Reading.toFixed(2)}\n`;
    msg += `Т2 показание: ${r.electricityT2Reading.toFixed(2)}\n`;
    if (r.hasPreviousElectricity) {
        msg += `Т1 расход: ${r.electricityT1Consumption.toFixed(2)} × ${r.electricityT1Price.toFixed(2)} = ${formatCurrency(r.electricityT1Cost)}\n`;
        msg += `Т2 расход: ${r.electricityT2Consumption.toFixed(2)} × ${r.electricityT2Price.toFixed(2)} = ${formatCurrency(r.electricityT2Cost)}\n`;
        msg += `Электричество итого: ${formatCurrency(r.electricityTotalCost)}\n`;
    } else {
        msg += `Первое показание электричества — база для следующего расчёта\n`;
    }

    msg += `\n💧 Вода: ${formatShortDate(r.waterDate)}\n`;
    msg += `Холодная показание: ${r.coldWaterReading.toFixed(3)}\n`;
    msg += `Горячая показание: ${r.hotWaterReading.toFixed(3)}\n`;
    if (r.hasPreviousWater) {
        msg += `Холодная расход: ${r.coldWaterConsumption.toFixed(3)} × ${r.coldWaterPrice.toFixed(2)} = ${formatCurrency(r.coldWaterCost)}\n`;
        msg += `Горячая расход: ${r.hotWaterConsumption.toFixed(3)} × ${r.hotWaterPrice.toFixed(2)} = ${formatCurrency(r.hotWaterCost)}\n`;
        msg += `Вода итого: ${formatCurrency(r.waterTotalCost)}\n`;
    } else {
        msg += `Первое показание воды — база для следующего расчёта\n`;
    }

    msg += `\n💰 Итого за период: ${formatCurrency(r.totalCost)}`;
    showAlert(msg);
}

function addDebugButton() {
    const historySection = $('history-section');
    if (!historySection || $('debug-storage-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'debug-storage-btn';
    btn.type = 'button';
    btn.className = 'btn';
    btn.style.marginTop = '0.75rem';
    btn.style.background = 'var(--surface)';
    btn.style.color = 'var(--ink)';
    btn.style.border = '1px solid var(--border)';
    btn.textContent = 'Проверить сохранённые данные';
    btn.addEventListener('click', () => {
        loadData();
        renderHistory();
        showAlert(`Сохранено записей: ${readings.length}`);
    });
    historySection.appendChild(btn);
}

function init() {
    loadData();

    $('electricity-date').value = todayISO();
    $('water-date').value = todayISO();
    fillSavedPrices();

    const form = $('meter-form');
    if (!form) {
        showAlert('Ошибка: форма не найдена. Проверьте index.html.');
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const electricityDate = $('electricity-date').value;
            const waterDate = $('water-date').value;

            const electricityT1Reading = safeNumber($('electricity-t1-reading').value);
            const electricityT2Reading = safeNumber($('electricity-t2-reading').value);
            const coldWaterReading = safeNumber($('cold-water-reading').value);
            const hotWaterReading = safeNumber($('hot-water-reading').value);

            const electricityT1Price = safeNumber($('electricity-t1-price').value);
            const electricityT2Price = safeNumber($('electricity-t2-price').value);
            const coldWaterPrice = safeNumber($('cold-water-price').value);
            const hotWaterPrice = safeNumber($('hot-water-price').value);

            if (!electricityDate || !waterDate) {
                showAlert('Заполните даты для электричества и воды.');
                return;
            }

            if (!electricityT1Reading && !electricityT2Reading && !coldWaterReading && !hotWaterReading) {
                showAlert('Введите хотя бы одни показания.');
                return;
            }

            savePricesFromForm();

            const previousElectricity = getPreviousByDate(electricityDate, 'electricity');
            const previousWater = getPreviousByDate(waterDate, 'water');

            const hasPreviousElectricity = !!previousElectricity;
            const hasPreviousWater = !!previousWater;

            const electricityT1Consumption = hasPreviousElectricity ? Math.max(0, electricityT1Reading - previousElectricity.electricityT1Reading) : 0;
            const electricityT2Consumption = hasPreviousElectricity ? Math.max(0, electricityT2Reading - previousElectricity.electricityT2Reading) : 0;
            const coldWaterConsumption = hasPreviousWater ? Math.max(0, coldWaterReading - previousWater.coldWaterReading) : 0;
            const hotWaterConsumption = hasPreviousWater ? Math.max(0, hotWaterReading - previousWater.hotWaterReading) : 0;

            const electricityT1Cost = electricityT1Consumption * electricityT1Price;
            const electricityT2Cost = electricityT2Consumption * electricityT2Price;
            const electricityTotalCost = electricityT1Cost + electricityT2Cost;

            const coldWaterCost = coldWaterConsumption * coldWaterPrice;
            const hotWaterCost = hotWaterConsumption * hotWaterPrice;
            const waterTotalCost = coldWaterCost + hotWaterCost;
            const totalCost = electricityTotalCost + waterTotalCost;

            const reading = {
                id: Date.now(),
                createdAt: new Date().toISOString(),
                electricityDate,
                waterDate,
                electricityT1Reading,
                electricityT1Price,
                electricityT1Consumption,
                electricityT1Cost,
                electricityT2Reading,
                electricityT2Price,
                electricityT2Consumption,
                electricityT2Cost,
                electricityTotalConsumption: electricityT1Consumption + electricityT2Consumption,
                electricityTotalCost,
                coldWaterReading,
                coldWaterPrice,
                coldWaterConsumption,
                coldWaterCost,
                hotWaterReading,
                hotWaterPrice,
                hotWaterConsumption,
                hotWaterCost,
                waterTotalCost,
                totalCost,
                hasPreviousElectricity,
                hasPreviousWater
            };

            readings.push(reading);

            const saved = saveData();
            if (!saved) return;

            renderHistory();
            fillSavedPrices();
            updateStatus('Сохранено');
            haptic('success');

            // ВАЖНО: форму НЕ очищаем, чтобы пользователь видел введённые данные.
            // Даты и цены остаются на месте. Если нужно — потом добавим отдельную кнопку "Очистить".

            setTimeout(() => {
                const item = document.querySelector('.history-item');
                if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);

            showAlert(`Показания сохранены. Всего записей: ${readings.length}`);
        } catch (error) {
            console.error(error);
            updateStatus('Ошибка', false);
            showAlert('Произошла ошибка при сохранении: ' + error.message);
        }
    });

    renderHistory();
    addDebugButton();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
