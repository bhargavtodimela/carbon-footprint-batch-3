// Global variables
let pieChartInstance = null;
let barChartInstance = null;
let progressMeterCtx = null;
let currentScore = 0;
let currentVals = [];
let currentContributions = [];

// Category labels for charts
const categoryLabels = [
    'Transport', 'Electricity', 'Water', 'LPG', 'AC/Fan',
    'Meals', 'Plastic', 'Devices', 'Packaged Food', 'Public Transport'
];

// Question labels (shortened for charts)
const questionLabels = [
    'Daily KM', 'Electricity', 'Water', 'LPG', 'AC/Fan',
    'Meals', 'Plastic', 'Devices', 'Packaged', 'Public Trans'
];

// Expand labels to include new questions (Flights, Meat, Recycling)
categoryLabels.push('Flights', 'Meat', 'Recycling');
questionLabels.push('Flights', 'Meat', 'Recycling');

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeDarkMode();
    initializeAutoSave();
    initializeProgressTracking();
    setupDarkModeToggle();
    loadSavedData();
    attachButtonRipples();
});

// Dark Mode Functions
function initializeDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeIcon(savedTheme);
}

function setupDarkModeToggle() {
    const toggle = document.getElementById('darkModeToggle');
    toggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateDarkModeIcon(newTheme);
    });
}

function updateDarkModeIcon(theme) {
    const icon = document.querySelector('#darkModeToggle i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Auto-save Functions
let autoSaveTimeout = null;

function initializeAutoSave() {
    for (let i = 1; i <= 13; i++) {
        const input = document.getElementById('q' + i);
        if (input) {
            input.addEventListener('input', function() {
                clearTimeout(autoSaveTimeout);
                showAutoSaveStatus('saving');
                autoSaveTimeout = setTimeout(() => {
                    saveData();
                    showAutoSaveStatus('saved');
                }, 1000);
            });
        }
    }
}

function saveData() {
    const data = {};
    for (let i = 1; i <= 13; i++) {
        const input = document.getElementById('q' + i);
        if (input) {
            data['q' + i] = input.value;
        }
    }
    localStorage.setItem('carbonFootprintData', JSON.stringify(data));
}

function loadSavedData() {
    const saved = localStorage.getItem('carbonFootprintData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            for (let i = 1; i <= 13; i++) {
                const input = document.getElementById('q' + i);
                if (input && data['q' + i]) {
                    input.value = data['q' + i];
                }
            }
            updateProgress();
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
}

function clearSavedData() {
    localStorage.removeItem('carbonFootprintData');
}

function showAutoSaveStatus(status) {
    const statusEl = document.getElementById('autoSaveStatus');
    if (!statusEl) return;

    statusEl.classList.remove('show', 'saved');

    if (status === 'saving') {
        statusEl.textContent = 'Saving...';
        statusEl.classList.add('show');
    } else if (status === 'saved') {
        statusEl.textContent = '✓ Saved';
        statusEl.classList.add('show', 'saved');
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 2000);
    }
}

// Progress Tracking
function initializeProgressTracking() {
    updateProgress();
    for (let i = 1; i <= 13; i++) {
        const input = document.getElementById('q' + i);
        if (input) {
            input.addEventListener('input', updateProgress);
        }
    }
}

function updateProgress() {
    let filled = 0;
    for (let i = 1; i <= 13; i++) {
        const input = document.getElementById('q' + i);
        if (input && input.value && parseFloat(input.value) > 0) {
            filled++;
        }
    }

    const percentage = (filled / 13) * 100;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    if (progressText) {
        progressText.textContent = percentage.toFixed(0) + '%';
    }
}

// Calculate Function (Enhanced)
function calculate() {
    // Validate inputs
    let vals = [];
    let hasError = false;

    for (let i = 1; i <= 13; i++) {
        const input = document.getElementById('q' + i);
        let v = parseFloat(input.value) || 0;

        // Validate: no negative numbers
        if (v < 0) {
            v = 0;
            input.value = '';
            hasError = true;
            input.style.borderColor = '#f44336';
            setTimeout(() => {
                input.style.borderColor = '';
            }, 2000);
        }

        vals.push(v);
    }

    if (hasError) {
        alert('Please enter valid positive numbers only.');
        return;
    }

    currentVals = vals;

    // Emission factors are base values tied to the unit shown in the question.
    // We'll convert all inputs to a per-day contribution using the frequency map.
    // Base factors (kg CO2 per unit as described in each question):
    // q1: km driven (kg/km), q2: kWh (kg/kWh), q3: litres water (kg/litre),
    // q4: LPG cylinder (kg CO2 per cylinder), q5: AC hours (kg/hour),
    // q6: meals/day (kg/meal), q7: plastic items/week (kg/item), q8: device hours/week (kg/hour),
    // q9: packaged food units/week (kg/unit), q10: public transport km/week (kg/km),
    // q11: short flights per year (kg/flight), q12: meat-rich meals per week (kg/meal),
    // q13: recycling (kg/week) -> negative contribution (saves CO2)

    const baseFactors = [
        0.18, // q1: kg CO2 per km (car)
        0.475, // q2: kg CO2 per kWh
        0.0003, // q3: kg CO2 per litre of water (pumping/treatment)
        42.3, // q4: kg CO2 per LPG cylinder (approx)
        0.09, // q5: kg CO2 per hour of AC/fan usage
        0.5, // q6: kg CO2 per cooked meal
        0.02, // q7: kg CO2 per plastic item
        0.02, // q8: kg CO2 per device-hour
        0.3, // q9: kg CO2 per packaged food unit
        0.05, // q10: kg CO2 per public transport km
        150.0, // q11: kg CO2 per short flight (one-way/short-haul estimate)
        3.0, // q12: kg CO2 per meat-rich meal
        -0.2 // q13: kg CO2 saved per kg recycled per week (negative)
    ];

    const frequency = [
        'daily', 'daily', 'daily', 'monthly', 'daily', 'daily', 'weekly', 'weekly', 'weekly', 'weekly', 'yearly', 'weekly', 'weekly'
    ];

    // Calculate per-day contributions
    currentContributions = [];
    let score = 0;

    for (let i = 0; i < baseFactors.length; i++) {
        const raw = vals[i] || 0;
        const factor = baseFactors[i] || 0;
        let dailyContribution = 0;

        switch (frequency[i]) {
            case 'daily':
                dailyContribution = raw * factor;
                break;
            case 'weekly':
                dailyContribution = (raw * factor) / 7;
                break;
            case 'monthly':
                dailyContribution = (raw * factor) / 30;
                break;
            case 'yearly':
                dailyContribution = (raw * factor) / 365;
                break;
            default:
                dailyContribution = raw * factor;
        }

        // Round small noise
        dailyContribution = Math.max(-9999, dailyContribution);
        currentContributions.push(dailyContribution);
        score += dailyContribution;
    }

    currentScore = score;

    // Hide form, show result with animation
    const formCard = document.getElementById('formCard');
    const resultCard = document.getElementById('resultCard');

    formCard.classList.add('hide');
    setTimeout(() => {
        resultCard.classList.remove('hide');
        displayResults(score);
        createCharts();
        drawProgressMeter(score);
    }, 300);
}

function displayResults(score) {
    let zone = "";
    let text = "";
    let color = "";

    if (score <= 10) {
        zone = "green-zone";
        text = "Low emissions — Excellent! 🌱";
        color = "#4caf50";
    } else if (score <= 25) {
        zone = "yellow-zone";
        text = "Moderate emissions — Improve habits. ⚠️";
        color = "#ff9800";
    } else {
        zone = "red-zone";
        text = "High emissions — Take serious action. 🚨";
        color = "#f44336";
    }

    const scoreBox = document.getElementById('scoreBox');
    scoreBox.className = `scoreBox ${zone}`;
    scoreBox.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 8px;">${text}</div>
        <div style="font-size: 28px;">${score.toFixed(2)} kg CO₂/day</div>
        <div style="font-size: 14px; font-weight: 400; margin-top: 8px; opacity: 0.8;">
            ≈ ${(score * 365).toFixed(1)} kg/year
        </div>
    `;

    // Get top contributors
    const topContributors = currentContributions
        .map((val, idx) => ({ val, idx, label: categoryLabels[idx] }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 3)
        .map(item => item.label);

    document.getElementById('recommendBox').innerHTML = `
        <strong><i class="fas fa-lightbulb"></i> Recommendations:</strong>
        <ul style="margin-left: 18px; margin-top: 10px;">
            ${topContributors.includes('Transport') ? '<li><i class="fas fa-bus"></i> Use public transport or carpool to reduce travel emissions.</li>' : ''}
            ${topContributors.includes('Electricity') ? '<li><i class="fas fa-bolt"></i> Switch to LED bulbs and energy-efficient appliances.</li>' : ''}
            ${topContributors.includes('Water') ? '<li><i class="fas fa-tint"></i> Take shorter showers and fix leaks immediately.</li>' : ''}
            ${topContributors.includes('LPG') ? '<li><i class="fas fa-fire"></i> Optimize cooking times and use pressure cookers.</li>' : ''}
            ${topContributors.includes('AC/Fan') ? '<li><i class="fas fa-snowflake"></i> Set AC to 24-26°C and use fans when possible.</li>' : ''}
            ${topContributors.includes('Plastic') || topContributors.includes('Packaged Food') ? '<li><i class="fas fa-recycle"></i> Avoid single-use plastics and opt for reusable containers.</li>' : ''}
            ${topContributors.includes('Devices') ? '<li><i class="fas fa-laptop"></i> Unplug devices when not in use to save energy.</li>' : ''}
            ${!topContributors.includes('Transport') && !topContributors.includes('Electricity') ? '<li><i class="fas fa-seedling"></i> Plant trees and support reforestation projects.</li>' : ''}
        </ul>
        <p style="margin-top: 12px; margin-bottom: 0;"><strong>Zone:</strong> ${text}</p>
    `;
}

// Button ripple effect helper
function attachButtonRipples() {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rect = btn.getBoundingClientRect();
            const ripple = document.createElement('span');
            const size = Math.max(rect.width, rect.height);
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            btn.appendChild(ripple);
            setTimeout(() => {
                ripple.remove();
            }, 700);
        });
    });
}

// Chart Functions
function createCharts() {
    createPieChart();
    createBarChart();
}

function createPieChart() {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    // Destroy existing chart if present
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    // Filter out zero values for better visualization
    const labels = [];
    const data = [];
    const colors = [
        '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
        '#ff9f40', '#8dd3c7', '#c9cbcf', '#4bc0c0', '#ff9aa2',
        '#a0c4ff', '#ffd166', '#b8e986'
    ];

    for (let i = 0; i < currentContributions.length; i++) {
        if (currentContributions[i] > 0) {
            labels.push(categoryLabels[i]);
            data.push(currentContributions[i]);
        }
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderColor: isDark ? '#1e1e1e' : '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: isDark ? '#ffffff' : '#212121',
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percentage = ((value / currentScore) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(2)} kg (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000
            }
        }
    });
}

function createBarChart() {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;

    // Destroy existing chart if present
    if (barChartInstance) {
        barChartInstance.destroy();
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: questionLabels,
            datasets: [{
                label: 'CO₂ Emissions (kg/day)',
                data: currentContributions,
                backgroundColor: currentContributions.map((val, idx) => {
                    if (val === 0) return '#e0e0e0';
                    const maxVal = Math.max(...currentContributions);
                    const intensity = val / maxVal;
                    return `rgba(25, 118, 210, ${0.5 + intensity * 0.5})`;
                }),
                borderColor: currentContributions.map((val, idx) => {
                    if (val === 0) return '#bdbdbd';
                    return '#1976d2';
                }),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDark ? '#b0b0b0' : '#616161'
                    },
                    grid: {
                        color: isDark ? '#424242' : '#e0e0e0'
                    }
                },
                x: {
                    ticks: {
                        color: isDark ? '#b0b0b0' : '#616161',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(2)} kg CO₂/day`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000
            }
        }
    });
}

// Circular Progress Meter
function drawProgressMeter(score) {
    const canvas = document.getElementById('progressMeter');
    if (!canvas) return;

    // Set canvas size
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight, 200);
    canvas.width = size;
    canvas.height = size;

    progressMeterCtx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Calculate percentage (assuming 25 is max recommended, 50 is critical)
    const maxRecommended = 25;
    const maxCritical = 50;
    let percentage = Math.min((score / maxRecommended) * 100, 100);

    // Determine color based on score
    let color = '#4caf50'; // green
    if (score > maxRecommended) {
        color = '#ff9800'; // yellow
    }
    if (score > maxCritical) {
        color = '#f44336'; // red
    }

    // Draw background circle
    progressMeterCtx.beginPath();
    progressMeterCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    progressMeterCtx.strokeStyle = '#e0e0e0';
    progressMeterCtx.lineWidth = 20;
    progressMeterCtx.stroke();

    // Update percentage text immediately
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
        progressPercentage.textContent = Math.min(Math.round(percentage), 100) + '%';
    }

    // Draw progress arc with animation
    let currentAngle = 0;
    const targetAngle = (Math.min(percentage, 100) / 100) * 2 * Math.PI;
    const speed = 0.05;

    function animate() {
        if (currentAngle < targetAngle) {
            currentAngle = Math.min(currentAngle + speed, targetAngle);

            progressMeterCtx.clearRect(0, 0, canvas.width, canvas.height);

            // Redraw background
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            progressMeterCtx.beginPath();
            progressMeterCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            progressMeterCtx.strokeStyle = isDark ? '#424242' : '#e0e0e0';
            progressMeterCtx.lineWidth = 20;
            progressMeterCtx.stroke();

            // Draw progress
            progressMeterCtx.beginPath();
            progressMeterCtx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + currentAngle);
            progressMeterCtx.strokeStyle = color;
            progressMeterCtx.lineWidth = 20;
            progressMeterCtx.lineCap = 'round';
            progressMeterCtx.stroke();

            requestAnimationFrame(animate);
        } else {
            // Final update
            if (progressPercentage) {
                progressPercentage.textContent = Math.min(Math.round(percentage), 100) + '%';
            }
        }
    }

    animate();
}

// PDF Export Function
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(25, 118, 210);
    doc.text('Carbon Footprint Report', 105, 20, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });

    // Score
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`Your Carbon Footprint: ${currentScore.toFixed(2)} kg CO₂/day`, 20, 45);
    doc.text(`Annual Estimate: ${(currentScore * 365).toFixed(1)} kg CO₂/year`, 20, 55);

    // Zone
    let zoneText = '';
    let zoneColor = [0, 0, 0];
    if (currentScore <= 10) {
        zoneText = 'Zone: Low emissions — Excellent!';
        zoneColor = [76, 175, 80];
    } else if (currentScore <= 25) {
        zoneText = 'Zone: Moderate emissions — Improve habits.';
        zoneColor = [255, 152, 0];
    } else {
        zoneText = 'Zone: High emissions — Take serious action.';
        zoneColor = [244, 67, 54];
    }

    doc.setFontSize(12);
    doc.setTextColor(zoneColor[0], zoneColor[1], zoneColor[2]);
    doc.text(zoneText, 20, 70);

    // Category Breakdown
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Category Breakdown:', 20, 85);

    let yPos = 95;
    doc.setFontSize(10);
    currentContributions.forEach((contribution, idx) => {
        if (contribution > 0) {
            doc.setTextColor(0, 0, 0);
            doc.text(`${categoryLabels[idx]}:`, 25, yPos);
            doc.text(`${contribution.toFixed(2)} kg CO₂/day`, 120, yPos);
            yPos += 8;

            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        }
    });

    // Recommendations
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Recommendations:', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    const recommendText = [
        '• Use public transport or carpool to reduce travel emissions.',
        '• Switch to LED bulbs and energy-efficient appliances.',
        '• Take shorter showers and fix leaks immediately.',
        '• Optimize cooking times and use pressure cookers.',
        '• Set AC to 24-26°C and use fans when possible.',
        '• Avoid single-use plastics and opt for reusable containers.',
        '• Unplug devices when not in use to save energy.',
        '• Plant trees and support reforestation projects.'
    ];

    recommendText.forEach(text => {
        doc.text(text, 25, yPos);
        yPos += 8;
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
    });

    // Save PDF
    doc.save(`carbon-footprint-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

// Restart Function
function restart() {
    const formCard = document.getElementById('formCard');
    const resultCard = document.getElementById('resultCard');

    // Destroy charts
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }

    // Clear inputs
    for (let i = 1; i <= 13; i++) {
        const input = document.getElementById('q' + i);
        if (input) {
            input.value = '';
        }
    }

    // Clear saved data
    clearSavedData();
    updateProgress();

    // Show form, hide result
    resultCard.classList.add('hide');
    setTimeout(() => {
        formCard.classList.remove('hide');
    }, 300);
}
