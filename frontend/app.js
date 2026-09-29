const API_BASE = "/api";
let currentTab = "dashboard";
let globalData = null;
let chartInstance = null;

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
        dashboard: "AI Answer Engine Tracking (GEO) — Dashboard",
        prompts: "AI Answer Engine Tracking (GEO) — Prompts Matrix",
        citations: "AI Answer Engine Tracking (GEO) — Citation Audit",
        settings: "AI Answer Engine Tracking (GEO) — Settings"
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

    const labels = (timeSeries || []).map(item => item.date);
    const datasetData = (timeSeries || []).map(item => item.sov);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Share of Voice (%)',
                data: datasetData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#818cf8',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f8fafc', font: { family: "'Outfit', sans-serif" } }
                }
            }
        }
    });
}

// Render engine breakdown cards
function renderEngineBreakdown(breakdown) {
    const container = document.getElementById("engine-breakdown-container");
    if (!container) return;
    container.innerHTML = "";

    for (const [engine, stats] of Object.entries(breakdown || {})) {
        const card = document.createElement("div");
        card.className = "engine-card";

        const isGood = stats.sov > 50;

        card.innerHTML = `
            <div class="engine-title-flex">
                <span class="engine-name">${escapeHtml(engine)}</span>
                <span class="badge ${isGood ? 'badge-brand' : 'badge-general'}">${isGood ? 'Optimal' : 'Low Visibility'}</span>
            </div>
            <p class="engine-metric-label">Share of Voice</p>
            <p class="engine-metric-value ${isGood ? '' : 'neutral'}">${stats.sov}%</p>
            <p class="engine-metric-label mt-2">Sentiment Score</p>
            <p class="engine-metric-value" style="color: #38bdf8">${stats.positive_sentiment_pct}% Positive</p>
            <p class="engine-metric-label mt-2">Logs Collected</p>
            <p class="engine-metric-value" style="color: #94a3b8">${stats.total_queries} queries</p>
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
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state-cell">No prompts currently monitored. Register a new query on the left to start tracking.</td></tr>`;
            return;
        }

        prompts.forEach(p => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${escapeHtml(p.query_text)}</strong></td>
                <td><span class="badge badge-cat">${escapeHtml(p.category)}</span></td>
                <td>${p.frequency_hours} hours</td>
                <td>
                    <button class="btn btn-action" onclick="runPromptNow(${p.id})">Run Now</button>
                    <button class="btn btn-danger" onclick="deletePrompt(${p.id})">Delete</button>
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
            showToast(errData.detail || "Failed to register new prompt query", "error");
            return;
        }

        queryInput.value = "";
        showToast("New prompt registered! Tracking jobs launched across engines.", "success");
        await refreshData();
    } catch (err) {
        console.error(err);
        showToast("Error registering prompt query", "error");
    }
}

// Run single prompt trigger
async function runPromptNow(id) {
    try {
        showToast("Launching tracking runs across engines...", "info");
        const response = await fetch(`${API_BASE}/prompts/${id}/run`, { method: 'POST' });
        if (response.ok) {
            showToast("Tracking snapshot completed!", "success");
            setTimeout(refreshData, 1200);
        } else {
            showToast("Failed to run prompt tracking job.", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error triggering prompt execution", "error");
    }
}

// Delete prompt handler
async function deletePrompt(id) {
    if (!confirm("Are you sure you want to stop tracking this prompt query?")) return;
    try {
        const response = await fetch(`${API_BASE}/prompts/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showToast("Prompt query deleted successfully", "info");
            await refreshData();
        } else {
            showToast("Failed to delete prompt query", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error deleting prompt", "error");
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
            typeBadge = '<span class="badge badge-brand">Target Brand</span>';
        } else if (isCompetitor) {
            typeBadge = '<span class="badge badge-competitor">Competitor</span>';
        }

        // Apply filters
        if (filterVal === "brand" && !c.is_brand) return;
        if (filterVal === "competitor" && !isCompetitor) return;

        renderedCount++;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><a href="${c.url}" target="_blank" rel="noopener noreferrer" style="color: #818cf8; text-decoration: none;">${escapeHtml(c.url)}</a></td>
            <td><strong>${escapeHtml(c.domain)}</strong></td>
            <td>Rank ${c.rank}</td>
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
            showToast("Settings and competitor targets saved successfully!", "success");
            await refreshData();
        } else {
            showToast("Failed to save configuration settings", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error updating configuration settings", "error");
    }
}

// Initial boot
window.addEventListener("DOMContentLoaded", () => {
    refreshData();
    loadSettings();
});
