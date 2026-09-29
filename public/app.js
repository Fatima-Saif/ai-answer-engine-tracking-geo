const API_BASE = "/api";
let currentTab = "dashboard";
let globalData = null;
let chartInstance = null;

// Theme Toggle & State Management (Default: Light Mode with pure white background)
function initTheme() {
    const savedTheme = localStorage.getItem("geo_theme_v3") || "light";
    applyTheme(savedTheme, false);
}

function applyTheme(theme, shouldRerenderChart = true) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("geo_theme_v3", theme);

    const toggleText = document.getElementById("theme-toggle-text");
    if (toggleText) {
        toggleText.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    }

    if (shouldRerenderChart && globalData && globalData.time_series) {
        renderCharts(globalData.time_series);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    showToast(`Switched to ${nextTheme === "dark" ? "Dark Mode" : "Light Mode"}`, "info");
}

// Non-blocking Toast Notification Helper
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = '<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
        iconSvg = '<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
        iconSvg = '<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    toast.innerHTML = `<span class="toast-icon-wrap">${iconSvg}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Mobile Navigation Toggle
function toggleSidebar(show) {
    const sidebar = document.getElementById("app-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!sidebar || !backdrop) return;
    if (show === undefined) {
        sidebar.classList.toggle("open");
        backdrop.classList.toggle("active");
    } else if (show) {
        sidebar.classList.add("open");
        backdrop.classList.add("active");
    } else {
        sidebar.classList.remove("open");
        backdrop.classList.remove("active");
    }
}

// Tab Routing
function switchTab(tabId) {
    currentTab = tabId;
    
    // Manage Sidebar active state
    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.remove("active");
        if (el.getAttribute("href") === `#${tabId}`) {
            el.classList.add("active");
        }
    });

    // Toggle View Panels
    document.querySelectorAll(".tab-view").forEach(el => {
        el.classList.remove("active");
    });
    const activeTabEl = document.getElementById(`tab-${tabId}`);
    if (activeTabEl) {
        activeTabEl.classList.add("active");
    }

    // Ensure chart resizes smoothly when switching back to dashboard tab
    if (tabId === "dashboard" && chartInstance) {
        requestAnimationFrame(() => {
            chartInstance.resize();
        });
    }

    // Set page header title
    const titles = {
        dashboard: "AI Answer Engine Tracking (GEO) — Overview",
        prompts: "AI Answer Engine Tracking (GEO) — Tracked Queries",
        citations: "AI Answer Engine Tracking (GEO) — Citation Audit",
        settings: "AI Answer Engine Tracking (GEO) — Project Settings"
    };
    const titleEl = document.getElementById("page-title");
    if (titleEl) {
        titleEl.textContent = titles[tabId] || "AI Answer Engine Tracking (GEO)";
    }
}

// Fetch dashboard data summary & prompts
async function refreshData() {
    const refreshBtn = document.getElementById("btn-refresh");
    if (refreshBtn) refreshBtn.classList.add("is-loading");

    try {
        const response = await fetch(`${API_BASE}/dashboard-summary`);
        if (!response.ok) throw new Error("Failed to load dashboard statistics");
        globalData = await response.json();
        if (globalData) {
            updateDashboardMetrics(globalData);
            renderCharts(globalData.time_series);
            renderEngineBreakdown(globalData.engine_breakdown);
            renderCitationsTable(globalData.citations);
        }
        await loadPromptsTable();
    } catch (err) {
        console.error(err);
        showToast("Server communication error. Check backend connection.", "error");
    } finally {
        if (refreshBtn) refreshBtn.classList.remove("is-loading");
    }
}

// Update Top Metrics Row
function updateDashboardMetrics(data) {
    document.getElementById("metric-total-prompts").textContent = data.metrics.total_prompts;
    document.getElementById("metric-sov").textContent = data.metrics.share_of_voice;
    document.getElementById("metric-citations").textContent = data.metrics.total_citations;
    document.getElementById("metric-gap").textContent = data.metrics.visibility_gap_index;
    
    const targetBrandEl = document.getElementById("target-brand-name");
    if (targetBrandEl) targetBrandEl.textContent = data.target_brand;
    const targetDomainEl = document.getElementById("target-domain-name");
    if (targetDomainEl) targetDomainEl.textContent = data.target_domain;
}

// Render Time Series Chart
function renderCharts(timeSeries) {
    const canvas = document.getElementById("sovChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Destroy existing instance if active
    if (chartInstance) {
        chartInstance.destroy();
    }

    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const labels = (timeSeries || []).map(item => item.date);
    const datasetData = (timeSeries || []).map(item => item.sov);

    const lineColor = isLight ? '#790D16' : '#E5D3AF';
    const pointBg = isLight ? '#FFFFFF' : '#790D16';
    const pointBorder = isLight ? '#790D16' : '#E5D3AF';
    const gridColor = isLight ? 'rgba(229, 211, 175, 0.45)' : 'rgba(255, 255, 255, 0.07)';
    const ticksColor = isLight ? '#5C4A4D' : '#AEC4D4';

    // Rich luxury vertical gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    if (isLight) {
        gradient.addColorStop(0, 'rgba(121, 13, 22, 0.28)');
        gradient.addColorStop(0.55, 'rgba(229, 211, 175, 0.16)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    } else {
        gradient.addColorStop(0, 'rgba(229, 211, 175, 0.32)');
        gradient.addColorStop(0.55, 'rgba(121, 13, 22, 0.16)');
        gradient.addColorStop(1, 'rgba(19, 7, 9, 0.0)');
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Share of Voice (%)',
                data: datasetData,
                borderColor: lineColor,
                backgroundColor: gradient,
                borderWidth: 2.75,
                fill: true,
                tension: 0.38,
                pointBackgroundColor: pointBg,
                pointBorderColor: pointBorder,
                pointBorderWidth: 2,
                pointRadius: 4.5,
                pointHoverRadius: 6.5,
                pointHoverBackgroundColor: lineColor,
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { 
                        color: ticksColor,
                        font: { family: "'Outfit', sans-serif", size: 12 },
                        callback: value => value + '%'
                    }
                },
                x: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { 
                        color: ticksColor,
                        font: { family: "'Outfit', sans-serif", size: 12 }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isLight ? '#240F12' : '#F5EFE1',
                    titleColor: isLight ? '#E5D3AF' : '#240F12',
                    bodyColor: isLight ? '#FFFFFF' : '#130709',
                    borderColor: isLight ? '#790D16' : '#E5D3AF',
                    borderWidth: 1.2,
                    padding: 10,
                    boxPadding: 6,
                    cornerRadius: 8,
                    titleFont: { family: "'Outfit', sans-serif", size: 12, weight: '600' },
                    bodyFont: { family: "'Outfit', sans-serif", size: 13, weight: '500' },
                    callbacks: {
                        label: function(context) {
                            return ` Share of Voice: ${context.parsed.y}%`;
                        }
                    }
                }
            }
        }
    });
}

// Render engine breakdown cards with progress bars and badges
function renderEngineBreakdown(breakdown) {
    const container = document.getElementById("engine-breakdown-container");
    if (!container) return;
    container.innerHTML = "";

    const engineIcons = {
        "Perplexity": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v18M3 12h18"></path></svg>',
        "ChatGPT Search": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10c0 4.418-2.865 8.166-6.839 9.49"></path><circle cx="12" cy="12" r="4"></circle></svg>',
        "Google AI Overviews": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path><polyline points="21 3 21 9 15 9"></polyline></svg>',
        "Claude": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M8 12h8M12 8v8"></path></svg>',
        "Gemini": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2"></polygon></svg>'
    };

    for (const [engine, stats] of Object.entries(breakdown || {})) {
        const card = document.createElement("div");
        card.className = "engine-card";

        const isGood = stats.sov > 50;
        const iconSvg = engineIcons[engine] || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>';

        card.innerHTML = `
            <div class="engine-title-flex">
                <div class="engine-identity">
                    <span class="engine-icon-badge">${iconSvg}</span>
                    <span class="engine-name">${escapeHtml(engine)}</span>
                </div>
                <span class="badge ${isGood ? 'badge-brand' : 'badge-general'}">${isGood ? 'Strong' : 'Low'}</span>
            </div>
            
            <div class="engine-stats-body">
                <div class="stat-block">
                    <div class="stat-row">
                        <span class="engine-metric-label">Share of Voice</span>
                        <span class="engine-metric-value ${isGood ? '' : 'neutral'}">${stats.sov}%</span>
                    </div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width: ${Math.min(stats.sov, 100)}%;"></div>
                    </div>
                </div>

                <div class="stat-block">
                    <div class="stat-row">
                        <span class="engine-metric-label">Positive Sentiment</span>
                        <span class="engine-metric-value sentiment-metric">${stats.positive_sentiment_pct}%</span>
                    </div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-fill sentiment-fill" style="width: ${Math.min(stats.positive_sentiment_pct, 100)}%;"></div>
                    </div>
                </div>

                <div class="engine-card-footer">
                    <span class="query-count-pill">${stats.total_queries} queries analyzed</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}

// Load and render all live tracked prompts
async function loadPromptsTable() {
    const tbody = document.getElementById("prompts-table-body");
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE}/prompts`);
        if (!response.ok) throw new Error("Failed to load prompts table");
        const prompts = await response.json();
        
        tbody.innerHTML = "";
        
        if (!prompts || prompts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state-cell">No queries currently tracked. Add a query to start monitoring.</td></tr>`;
            return;
        }

        prompts.forEach(p => {
            const tr = document.createElement("tr");
            let catClass = 'badge-cat';
            if (p.category === 'Commercial') catClass = 'badge-general';
            else if (p.category === 'Brand Comparison') catClass = 'badge-brand';
            else catClass = 'badge-competitor';

            tr.innerHTML = `
                <td><strong>${escapeHtml(p.query_text)}</strong></td>
                <td><span class="badge ${catClass}">${escapeHtml(p.category)}</span></td>
                <td><span class="interval-pill">${p.frequency_hours}h interval</span></td>
                <td>
                    <div class="row-actions">
                        <button class="btn btn-action" onclick="runPromptNow(${p.id})" title="Check query now">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            <span>Run</span>
                        </button>
                        <button class="btn btn-danger" onclick="deletePrompt(${p.id})" title="Delete query">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            <span>Delete</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// Add prompt handler
async function handleAddPrompt(event) {
    event.preventDefault();
    const queryInput = document.getElementById("query_text");
    const categorySelect = document.getElementById("category");
    const freqSelect = document.getElementById("frequency");

    const payload = {
        query_text: queryInput.value,
        category: categorySelect.value,
        frequency_hours: parseInt(freqSelect.value, 10)
    };

    try {
        const response = await fetch(`${API_BASE}/prompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            showToast(errData.detail || "Failed to add query", "error");
            return;
        }

        queryInput.value = "";
        showToast("Query added successfully", "success");
        await refreshData();
    } catch (err) {
        console.error(err);
        showToast("Error adding query", "error");
    }
}

// Run single prompt trigger
async function runPromptNow(id) {
    try {
        showToast("Checking query across engines...", "info");
        const response = await fetch(`${API_BASE}/prompts/${id}/run`, { method: 'POST' });
        if (response.ok) {
            showToast("Check completed", "success");
            setTimeout(refreshData, 1200);
        } else {
            showToast("Failed to run check", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error running query", "error");
    }
}

// Delete prompt handler
async function deletePrompt(id) {
    if (!confirm("Are you sure you want to delete this query?")) return;
    try {
        const response = await fetch(`${API_BASE}/prompts/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showToast("Query deleted", "info");
            await refreshData();
        } else {
            showToast("Failed to delete query", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error deleting query", "error");
    }
}

// Render Citations deep-dive
function renderCitationsTable(citations) {
    const tbody = document.getElementById("citations-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filterVal = document.getElementById("citation-filter").value;
    const citationList = citations || [];
    
    let renderedCount = 0;

    citationList.forEach(c => {
        let typeBadge = '<span class="badge badge-general">General</span>';
        const isCompetitor = Boolean(c.is_competitor);

        if (c.is_brand) {
            typeBadge = '<span class="badge badge-brand">Brand Domain</span>';
        } else if (isCompetitor) {
            typeBadge = '<span class="badge badge-competitor">Competitor</span>';
        }

        // Apply filters
        if (filterVal === "brand" && !c.is_brand) return;
        if (filterVal === "competitor" && !isCompetitor) return;

        renderedCount++;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="citation-link" title="${escapeHtml(c.url)}">
                    <span class="url-text">${escapeHtml(c.url)}</span>
                    <svg class="external-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
            </td>
            <td><span class="domain-tag">${escapeHtml(c.domain)}</span></td>
            <td><span class="rank-pill">#${c.rank}</span></td>
            <td>${typeBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    if (renderedCount === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state-cell">No citations matching the filter criteria.</td></tr>`;
    }
}

// Filter citations list
function filterCitations() {
    if (globalData && globalData.citations) {
        renderCitationsTable(globalData.citations);
    }
}

// Escape helper
function escapeHtml(text) {
    if (!text) return "";
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Load Active Configurations into UI Settings
async function loadSettings() {
    try {
        const res = await fetch(`${API_BASE}/settings`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById("settings_brand_name").value = data.brand_name || "";
            document.getElementById("settings_target_domain").value = data.target_domain || "";
            document.getElementById("settings_serp_api_key").value = data.serp_api_key || "";
            if (document.getElementById("settings_competitors")) {
                document.getElementById("settings_competitors").value = data.competitors || "";
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// Update settings handler
async function handleUpdateSettings(event) {
    event.preventDefault();
    const brandName = document.getElementById("settings_brand_name").value;
    const targetDomain = document.getElementById("settings_target_domain").value;
    const serpApiKey = document.getElementById("settings_serp_api_key").value;
    const competitorsInput = document.getElementById("settings_competitors") ? document.getElementById("settings_competitors").value : "";

    try {
        const res = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brand_name: brandName,
                target_domain: targetDomain,
                serp_api_key: serpApiKey,
                competitors: competitorsInput
            })
        });
        if (res.ok) {
            showToast("Settings saved successfully", "success");
            await refreshData();
        } else {
            showToast("Failed to save settings", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error saving settings", "error");
    }
}

// Initial boot
window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    refreshData();
    loadSettings();
});
