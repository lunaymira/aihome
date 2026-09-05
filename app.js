const tg = window.Telegram.WebApp;

tg.expand();
tg.ready();

const STORAGE_KEY = 'home_meters_readings';

let readings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

const form = document.getElementById('meter-form');
const calculationSection = document.getElementById('calculation-section');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const actualAmountInput = document.getElementById('actual-amount');
const verificationResult = document.getElementById('verification-result');

document.getElementById('reading-date').valueAsDate = new Date();

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

function calculateConsumption(current, previous) {
    if (!previous) return null;
    return Math.max(0, current - previous);
}

function getPreviousReading() {
    return readings.length > 0 ? readings[0] : null;
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
        statusText.textContent = 'Сохранено';
        headerStatus.style.background = 'var(--success-tint)';
        headerStatus.style.color = 'var(--success)';
        statusDot.style.background = 'var(--success)';
    }, 2000);
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const date = document.getElementById('reading-date').value;
    const electricityReading = parseFloat(document.getElementById('electricity-reading').value);
    const electricityPrice = parseFloat(document.getElementById('electricity-price').value);
    const coldWaterReading = parseFloat(document.getElementById('cold-water-reading').value);
    const coldWaterPrice = parseFloat(document.getElementById('cold-water-price').value);
    const hotWaterReading = parseFloat(document.getElementById('hot-water-reading').value);
    const hotWaterPrice = parseFloat(document.getElementById('hot-water-price').value);
    
    const previous = getPreviousReading();
    
    const electricityConsumption = previous 
        ? calculateConsumption(electricityReading, previous.electricity.reading)
        : 0;
    const coldWaterConsumption = previous 
        ? calculateConsumption(coldWaterReading, previous.coldWater.reading)
        : 0;
    const hotWaterConsumption = previous 
        ? calculateConsumption(hotWaterReading, previous.hotWater.reading)
        : 0;
    
    const electricityCost = electricityConsumption * electricityPrice;
    const coldWaterCost = coldWaterConsumption * coldWaterPrice;
    const hotWaterCost = hotWaterConsumption * hotWaterPrice;
    const totalCost = electricityCost + coldWaterCost + hotWaterCost;
    
    const reading = {
        id: Date.now(),
        date,
        electricity: {
            reading: electricityReading,
            price: electricityPrice,
            consumption: electricityConsumption,
            cost: electricityCost
        },
        coldWater: {
            reading: coldWaterReading,
            price: coldWaterPrice,
            consumption: coldWaterConsumption,
            cost: coldWaterCost
        },
        hotWater: {
            reading: hotWaterReading,
            price: hotWaterPrice,
            consumption: hotWaterConsumption,
            cost: hotWaterCost
        },
        totalCost
    };
    
    readings.unshift(reading);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
    
    displayCalculation(reading, previous);
    renderHistory();
    updateStatus('Расчёт выполнен');
    
    calculationSection.style.display = 'block';
    calculationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
});

function displayCalculation(reading, previous) {
    const electricityText = previous
        ? `${reading.electricity.consumption.toFixed(2)} кВт·ч × ${reading.electricity.price.toFixed(2)} ₽ = ${formatCurrency(reading.electricity.cost)}`
        : `${formatCurrency(reading.electricity.cost)} (первое показание)`;
    
    const coldWaterText = previous
        ? `${reading.coldWater.consumption.toFixed(3)} м³ × ${reading.coldWater.price.toFixed(2)} ₽ = ${formatCurrency(reading.coldWater.cost)}`
        : `${formatCurrency(reading.coldWater.cost)} (первое показание)`;
    
    const hotWaterText = previous
        ? `${reading.hotWater.consumption.toFixed(3)} м³ × ${reading.hotWater.price.toFixed(2)} ₽ = ${formatCurrency(reading.hotWater.cost)}`
        : `${formatCurrency(reading.hotWater.cost)} (первое показание)`;
    
    document.getElementById('calc-electricity').textContent = electricityText;
    document.getElementById('calc-cold-water').textContent = coldWaterText;
    document.getElementById('calc-hot-water').textContent = hotWaterText;
    document.getElementById('calc-total').textContent = formatCurrency(reading.totalCost);
    
    actualAmountInput.value = '';
    verificationResult.className = 'verification-result';
    verificationResult.textContent = '';
}

actualAmountInput.addEventListener('input', () => {
    const actualAmount = parseFloat(actualAmountInput.value);
    
    if (!actualAmount || isNaN(actualAmount)) {
        verificationResult.className = 'verification-result';
        verificationResult.textContent = '';
        return;
    }
    
    const calculatedAmount = readings[0].totalCost;
    const difference = actualAmount - calculatedAmount;
    const percentDiff = (Math.abs(difference) / calculatedAmount * 100).toFixed(1);
    
    if (Math.abs(difference) < 0.01) {
        verificationResult.className = 'verification-result match';
        verificationResult.textContent = '✓ Суммы совпадают';
    } else if (difference > 0) {
        verificationResult.className = 'verification-result mismatch';
        verificationResult.textContent = `⚠ Переплата ${formatCurrency(Math.abs(difference))} (${percentDiff}%)`;
    } else {
        verificationResult.className = 'verification-result mismatch';
        verificationResult.textContent = `⚠ Недоплата ${formatCurrency(Math.abs(difference))} (${percentDiff}%)`;
    }
});

function renderHistory() {
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
    
    historyList.innerHTML = readings.map((reading, index) => {
        const previous = readings[index + 1];
        const showConsumption = previous !== undefined;
        
        return `
            <div class="history-item" data-id="${reading.id}">
                <div class="history-item-header">
                    <span class="history-date">${formatDate(reading.date)}</span>
                    <span class="history-total">${formatCurrency(reading.totalCost)}</span>
                </div>
                ${showConsumption ? `
                    <div class="history-details">
                        <div class="history-detail">
                            <span class="history-detail-label">Электричество</span>
                            <span class="history-detail-value">${reading.electricity.consumption.toFixed(1)} кВт·ч</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">Холодная</span>
                            <span class="history-detail-value">${reading.coldWater.consumption.toFixed(2)} м³</span>
                        </div>
                        <div class="history-detail">
                            <span class="history-detail-label">Горячая</span>
                            <span class="history-detail-value">${reading.hotWater.consumption.toFixed(2)} м³</span>
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
    const index = readings.findIndex(r => r.id === reading.id);
    const previous = readings[index + 1];
    
    let message = `📅 ${formatDate(reading.date)}\n\n`;
    
    if (previous) {
        message += `⚡ Электричество:\n`;
        message += `   ${previous.electricity.reading.toFixed(2)} → ${reading.electricity.reading.toFixed(2)} кВт·ч\n`;
        message += `   Расход: ${reading.electricity.consumption.toFixed(2)} кВт·ч × ${reading.electricity.price.toFixed(2)} ₽ = ${formatCurrency(reading.electricity.cost)}\n\n`;
        
        message += `💧 Холодная вода:\n`;
        message += `   ${previous.coldWater.reading.toFixed(3)} → ${reading.coldWater.reading.toFixed(3)} м³\n`;
        message += `   Расход: ${reading.coldWater.consumption.toFixed(3)} м³ × ${reading.coldWater.price.toFixed(2)} ₽ = ${formatCurrency(reading.coldWater.cost)}\n\n`;
        
        message += `🔥 Горячая вода:\n`;
        message += `   ${previous.hotWater.reading.toFixed(3)} → ${reading.hotWater.reading.toFixed(3)} м³\n`;
        message += `   Расход: ${reading.hotWater.consumption.toFixed(3)} м³ × ${reading.hotWater.price.toFixed(2)} ₽ = ${formatCurrency(reading.hotWater.cost)}\n\n`;
    } else {
        message += `⚡ Электричество: ${reading.electricity.reading.toFixed(2)} кВт·ч\n`;
        message += `💧 Холодная вода: ${reading.coldWater.reading.toFixed(3)} м³\n`;
        message += `🔥 Горячая вода: ${reading.hotWater.reading.toFixed(3)} м³\n\n`;
        message += `(Первое показание, расход не рассчитывается)\n\n`;
    }
    
    message += `💰 Итого: ${formatCurrency(reading.totalCost)}`;
    
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

renderHistory();
