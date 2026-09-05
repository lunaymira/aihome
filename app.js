const tg = window.Telegram.WebApp;

tg.expand();
tg.ready();

const STORAGE_KEY = 'home_meters_readings';
const PRICES_KEY = 'home_meters_prices';

let readings = [];
let savedPrices = {};

function loadData() {
    try {
        const readingsData = localStorage.getItem(STORAGE_KEY);
        const pricesData = localStorage.getItem(PRICES_KEY);
        
        readings = readingsData ? JSON.parse(readingsData) : [];
        savedPrices = pricesData ? JSON.parse(pricesData) : {};
        
        console.log('Загружено показаний:', readings.length);
        console.log('Загружены цены:', savedPrices);
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
        readings = [];
        savedPrices = {};
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
        localStorage.setItem(PRICES_KEY, JSON.stringify(savedPrices));
        console.log('Данные сохранены');
    } catch (e) {
        console.error('Ошибка сохранения:', e);
    }
}

const form = document.getElementById('meter-form');
const historyList = document.getElementById('history-list');

const electricityDateInput = document.getElementById('electricity-date');
const waterDateInput = document.getElementById('water-date');

const electricityT1ReadingInput = document.getElementById('electricity-t1-reading');
const electricityT1PriceInput = document.getElementById('electricity-t1-price');
const electricityT2ReadingInput = document.getElementById('electricity-t2-reading');
const electricityT2PriceInput = document.getElementById('electricity-t2-price');

const coldWaterReadingInput = document.getElementById('cold-water-reading');
const coldWaterPriceInput = document.getElementById('cold-water-price');
const hotWaterReadingInput = document.getElementById('hot-water-reading');
const hotWaterPriceInput = document.getElementById('hot-water-price');

electricityDateInput.valueAsDate = new Date();
waterDateInput.valueAsDate = new Date();

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function formatShortDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function updateStatus(text, isSuccess = true) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const headerStatus = document.querySelector('.header-status');
    
    statusText.textContent = text;
    
    if (isSuccess) {
        headerStatus.style.background = 'var(--success-tint)';
        headerStatus.style.color = 'var(--success)';
        statusDot.style.background = 'var(--success)';
    } else {
        headerStatus.style.background = 'var(--terracotta-tint)';
        headerStatus.style.color = 'var(--terracotta)';
        statusDot.style.background = 'var(--terracotta)';
    }
    
    setTimeout(() => {
        statusText.textContent = 'Готово';
        headerStatus.style.background = 'var(--success-tint)';
        headerStatus.style.color = 'var(--success)';
        statusDot.style.background = 'var(--success)';
    }, 2000);
}

function loadSavedPrices() {
    if (savedPrices.electricityT1) electricityT1PriceInput.value = savedPrices.electricityT1;
    if (savedPrices.electricityT2) electricityT2PriceInput.value = savedPrices.electricityT2;
    if (savedPrices.coldWater) coldWaterPriceInput.value = savedPrices.coldWater;
    if (savedPrices.hotWater) hotWaterPriceInput.value = savedPrices.hotWater;
}

function savePrices() {
    savedPrices = {
        electricityT1: parseFloat(electricityT1PriceInput.value) || 0,
        electricityT2: parseFloat(electricityT2PriceInput.value) || 0,
        coldWater: parseFloat(coldWaterPriceInput.value) || 0,
        hotWater: parseFloat(hotWaterPriceInput.value) || 0
    };
    localStorage.setItem(PRICES_KEY, JSON.stringify(savedPrices));
}

function getPreviousReading(date, type) {
    const sortedReadings = [...readings].sort((a, b) => {
        const dateA = new Date(type === 'electricity' ? a.electricityDate : a.waterDate);
        const dateB = new Date(type === 'electricity' ? b.electricityDate : b.waterDate);
        return dateB - dateA;
    });
    
    const currentDate = new Date(date);
    
    for (let reading of sortedReadings) {
        const readingDate = new Date(type === 'electricity' ? reading.electricityDate : reading.waterDate);
        if (readingDate < currentDate) {
            return reading;
        }
    }
    
    return null;
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    console.log('Форма отправлена');
    
    const electricityDate = electricityDateInput.value;
    const waterDate = waterDateInput.value;
    
    const electricityT1Reading = parseFloat(electricityT1ReadingInput.value);
    const electricityT1Price = parseFloat(electricityT1PriceInput.value);
    const electricityT2Reading = parseFloat(electricityT2ReadingInput.value);
    const electricityT2Price = parseFloat(electricityT2PriceInput.value);
    
    const coldWaterReading = parseFloat(coldWaterReadingInput.value);
    const coldWaterPrice = parseFloat(coldWaterPriceInput.value);
    const hotWaterReading = parseFloat(hotWaterReadingInput.value);
    const hotWaterPrice = parseFloat(hotWaterPriceInput.value);
    
    savePrices();
    
    const previousElectricity = getPreviousReading(electricityDate, 'electricity');
    const previousWater = getPreviousReading(waterDate, 'water');
    
    const electricityT1Consumption = previousElectricity 
        ? Math.max(0, electricityT1Reading - previousElectricity.electricityT1Reading)
        : 0;
    const electricityT2Consumption = previousElectricity 
        ? Math.max(0, electricityT2Reading - previousElectricity.electricityT2Reading)
        : 0;
    
    const coldWaterConsumption = previousWater 
        ? Math.max(0, coldWaterReading - previousWater.coldWaterReading)
        : 0;
    const hotWaterConsumption = previousWater 
        ? Math.max(0, hotWaterReading - previousWater.hotWaterReading)
        : 0;
    
    const electricityT1Cost = electricityT1Consumption * electricityT1Price;
    const electricityT2Cost = electricityT2Consumption * electricityT2Price;
    const electricityTotalCost = electricityT1Cost + electricityT2Cost;
    
    const coldWaterCost = coldWaterConsumption * coldWaterPrice;
    const hotWaterCost = hotWaterConsumption * hotWaterPrice;
    const waterTotalCost = coldWaterCost + hotWaterCost;
    
    const totalCost = electricityTotalCost + waterTotalCost;
    
    const reading = {
        id: Date.now(),
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
        totalCost
    };
    
    console.log('Новое показание:', reading);
    
    readings.push(reading);
    saveData();
    
    renderHistory();
    updateStatus('Показания сохранены!');
    
    form.reset();
    electricityDateInput.valueAsDate = new Date();
    waterDateInput.valueAsDate = new Date();
    loadSavedPrices();
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
    
    document.getElementById('history-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function renderHistory() {
    console.log('Отрисовка истории:', readings.length, 'записей');
    
    if (readings.length === 0) {
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
    
    const sortedReadings = [...readings].sort((a, b) => {
        const dateA = new Date(Math.max(new Date(a.electricityDate), new Date(a.waterDate)));
        const dateB = new Date(Math.max(new Date(b.electricityDate), new Date(b.waterDate)));
        return dateB - dateA;
    });
    
    historyList.innerHTML = sortedReadings.map(reading => {
        const hasConsumption = reading.electricityTotalConsumption > 0 || reading.coldWaterConsumption > 0 || reading.hotWaterConsumption > 0;
        
        return `
            <div class="history-item" data-id="${reading.id}">
                <div class="history-item-header">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span class="history-date">⚡ ${formatShortDate(reading.electricityDate)}</span>
                        <span class="history-date" style="font-size: 0.875rem; color: var(--muted);">💧 ${formatShortDate(reading.waterDate)}</span>
                    </div>
                    <span class="history-total">${formatCurrency(reading.totalCost)}</span>
                </div>
                ${hasConsumption ? `
                    <div class="history-details">
                        <div class="history-detail">
                            <span class="history-detail-label">Электричество</span>
                            <span class="history-detail-value">${reading.electricityTotalConsumption.toFixed(1)} кВт·ч</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">Холодная</span>
                            <span class="history-detail-value">${reading.coldWaterConsumption.toFixed(2)} м³</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">Горячая</span>
                            <span class="history-detail-value">${reading.hotWaterConsumption.toFixed(2)} м³</span>
                        </div>
                    </div>
                ` : `
                    <div style="padding-top: 0.75rem; border-top: 1px solid var(--border); font-size: 0.875rem; color: var(--muted);">
                        Первое показание
                    </div>
                `}
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            const reading = readings.find(r => r.id === id);
            if (reading) {
                showReadingDetails(reading);
            }
        });
    });
}

function showReadingDetails(reading) {
    const hasConsumption = reading.electricityTotalConsumption > 0 || reading.coldWaterConsumption > 0 || reading.hotWaterConsumption > 0;
    
    let message = `📊 ДЕТАЛИ ПОКАЗАНИЙ\n\n`;
    
    message += `⚡ ЭЛЕКТРИЧЕСТВО (${formatShortDate(reading.electricityDate)})\n`;
    if (hasConsumption && reading.electricityTotalConsumption > 0) {
        message += `Т1 (день): ${reading.electricityT1Consumption.toFixed(2)} кВт·ч × ${reading.electricityT1Price.toFixed(2)} ₽ = ${formatCurrency(reading.electricityT1Cost)}\n`;
        message += `Т2 (ночь): ${reading.electricityT2Consumption.toFixed(2)} кВт·ч × ${reading.electricityT2Price.toFixed(2)} ₽ = ${formatCurrency(reading.electricityT2Cost)}\n`;
        message += `Итого: ${formatCurrency(reading.electricityTotalCost)}\n\n`;
    } else {
        message += `Т1: ${reading.electricityT1Reading.toFixed(2)} кВт·ч\n`;
        message += `Т2: ${reading.electricityT2Reading.toFixed(2)} кВт·ч\n`;
        message += `(первое показание)\n\n`;
    }
    
    message += `💧 ВОДА (${formatShortDate(reading.waterDate)})\n`;
    if (hasConsumption && (reading.coldWaterConsumption > 0 || reading.hotWaterConsumption > 0)) {
        message += `Холодная: ${reading.coldWaterConsumption.toFixed(3)} м³ × ${reading.coldWaterPrice.toFixed(2)} ₽ = ${formatCurrency(reading.coldWaterCost)}\n`;
        message += `Горячая: ${reading.hotWaterConsumption.toFixed(3)} м³ × ${reading.hotWaterPrice.toFixed(2)} ₽ = ${formatCurrency(reading.hotWaterCost)}\n`;
        message += `Итого: ${formatCurrency(reading.waterTotalCost)}\n\n`;
    } else {
        message += `Холодная: ${reading.coldWaterReading.toFixed(3)} м³\n`;
        message += `Горячая: ${reading.hotWaterReading.toFixed(3)} м³\n`;
        message += `(первое показание)\n\n`;
    }
    
    message += `💰 Общая сумма: ${formatCurrency(reading.totalCost)}`;
    
    tg.showAlert(message);
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.classList.contains('tab-disabled')) return;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('tab-content-active'));
        
        tab.classList.add('tab-active');
        const tabName = tab.dataset.tab;
        document.getElementById(`${tabName}-tab`).classList.add('tab-content-active');
        
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    });
});

loadData();
loadSavedPrices();
renderHistory();

console.log('Приложение инициализировано');
