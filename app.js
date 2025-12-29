// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://auwucgomaoibtrcfghmp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3VjZ29tYW9pYnRyY2ZnaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMTUzMzYsImV4cCI6MjA4MDU5MTMzNn0.dVrYPiSEbvXP2Ur-PhOlOe6e9NWhub_993CTm6ZXREI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATE
// ============================================
let currentUser = null;
let activities = [];
let currentLeaderboardWeek = null;
let currentDashboardWeek = null; 
let weeklyChart = null;
let leaderboardChart = null;
let selectedActivity = null;
let selectedDate = null;
let loggedActivitiesForDate = [];

// ============================================
// ACTIVITY ICONS CONFIGURATION
// ============================================
const activityIcons = {
    'Reading': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    'Writing': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    'Meditation': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>`,
    'Water': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    'Screen Time': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    'Sleep': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    'Walking': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 6l4 12 4-8 4 8 4-12"/>
</svg>
`
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getWeekDisplay(weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDate(weekStart)} - ${formatDate(end.toISOString().split('T')[0])}`;
}

function showToast(message) {
    const toast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function getGoogleDriveDirectLink(driveUrl) {
    if (!driveUrl) return null;
    
    if (driveUrl.includes('drive.google.com')) {
        let fileId = null;
        
        let match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            fileId = match[1];
        }
        
        if (!fileId) {
            match = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                fileId = match[1];
            }
        }
        
        if (fileId) {
            // Alternative: Use the uc endpoint with export=download
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }
    }
    
    return driveUrl;
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    //await loadParticipants();
    await loadActivities();
    setTodayDate();
    
    // Check for stored user session - redirect to login if not found
        const storedUserId = localStorage.getItem('currentUserId');
        if (!storedUserId) {
            window.location.href = 'index.html';
            return;
        }

        // Load user data
        const { data, error } = await supabaseClient
            .from('participants')
            .select('*')
            .eq('id', storedUserId)
            .single();

        if (error || !data) {
            localStorage.removeItem('currentUserId');
            window.location.href = 'index.html';
            return;
        }

        currentUser = data;
        document.getElementById('currentUserName').textContent = data.nick_name || data.name;
        document.getElementById('mainContent').classList.add('active');
        document.getElementById('fabButton').style.display = 'flex';

        currentLeaderboardWeek = getWeekStart(new Date());
        currentDashboardWeek = getWeekStart(new Date());
        await loadDashboard();
}

async function loadParticipants() {
    const { data, error } = await supabaseClient
        .from('participants')
        .select('*')
        .eq('active', true)
        .order('name');

    if (error) {
        console.error('Error loading participants:', error);
        return;
    }

    const select = document.getElementById('participantSelect');
    data.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
    });
}

async function loadActivities() {
    const { data, error } = await supabaseClient
        .from('activities')
        .select('*')
        .eq('active', true)
        .order('id');

    if (error) {
        console.error('Error loading activities:', error);
        return;
    }

    activities = data;
}



// ============================================
// LOGIN/LOGOUT
// ============================================


function logout() {
    // Clear all stored data
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear IndexedDB if used
    if (window.indexedDB) {
        indexedDB.databases().then(dbs => {
            dbs.forEach(db => indexedDB.deleteDatabase(db.name));
        });
    }
    
    currentUser = null;
    
    // Redirect to login page
    window.location.href = 'index.html';
}

// ============================================
// TABS
// ============================================
function showTab(tabName) {
    // Update desktop tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    // Update bottom navigation
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Find and activate the correct bottom nav button
    const bottomNavBtns = document.querySelectorAll('.bottom-nav-btn');
    bottomNavBtns.forEach(btn => {
        const btnText = btn.querySelector('span').textContent.toLowerCase();
        if (btnText === tabName.toLowerCase()) {
            btn.classList.add('active');
        }
    });
    
    // Activate desktop tab if exists
    const desktopTab = document.querySelector(`.tab[onclick*="${tabName}"]`);
    if (desktopTab) {
        desktopTab.classList.add('active');
    }
    
    document.getElementById(tabName + 'Tab').classList.add('active');

    if (tabName === 'dashboard') {
        loadDashboard();
    } else if (tabName === 'leaderboard') {
        loadLeaderboard();
    }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    document.getElementById('currentWeekDisplay').textContent = getWeekDisplay(currentDashboardWeek);
    
    const today = getWeekStart(new Date());
    document.getElementById('dashboardNextWeekBtn').disabled = currentDashboardWeek >= today;
    
    await loadStatsGrid(currentDashboardWeek);
    await populateCompareDropdown();
    await loadWeeklyChart(currentDashboardWeek);
    await loadRecentActivity();
}

async function populateCompareDropdown() {
    const compareSelect = document.getElementById('compareAgainstSelect');
    if (!compareSelect) return;
    
    // Only populate if empty (check if it has only 1 option or less)
    if (compareSelect.options.length > 1) return;
    
    compareSelect.innerHTML = '<option value="">Compare Against: None</option>';
    
    const { data: participants } = await supabaseClient
        .from('participants')
        .select('id, name, nick_name')
        .eq('active', true)
        .neq('id', currentUser.id)
        .order('name');

    if (participants) {
        participants.forEach(participant => {
            const option = document.createElement('option');
            option.value = participant.id;
            option.textContent = participant.nick_name || participant.name;
            compareSelect.appendChild(option);
        });
    }
}

async function changeDashboardWeek(direction) {
    const currentDate = new Date(currentDashboardWeek);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    currentDashboardWeek = getWeekStart(currentDate);
    
    await loadDashboard();
}

// REPLACE YOUR EXISTING loadStatsGrid FUNCTION WITH THIS:

async function loadStatsGrid(weekStart) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';

    // ✅ STEP 1: Fetch ALL activity logs in ONE query (instead of 7 separate queries)
    const { data: allLogs, error } = await supabaseClient
        .from('activity_logs')
        .select('value, log_date, activity_id')
        .eq('participant_id', currentUser.id)
        .eq('week_start_date', weekStart);

    if (error) {
        console.error('Error loading stats:', error);
        return;
    }

    // ✅ STEP 2: Group logs by activity_id in JavaScript
    const logsByActivity = {};
    if (allLogs) {
        allLogs.forEach(log => {
            if (!logsByActivity[log.activity_id]) {
                logsByActivity[log.activity_id] = [];
            }
            logsByActivity[log.activity_id].push(log);
        });
    }

    // ✅ STEP 3: Create all cards in memory (don't append yet)
    const cardsToAppend = [];

    for (const activity of activities) {
        // Get logs for this specific activity
        const data = logsByActivity[activity.id] || [];

        let total = 0;
        let displayValue = '';
        let progressPercent = 0;
        let goalText = '';
        let hasGoal = false;
        let weeklyGoal = 0;

        if (activity.activity_type === 'accumulative') {
            total = data.reduce((sum, log) => sum + parseFloat(log.value), 0);
            weeklyGoal = parseFloat(activity.min_threshold);
            
            if (activity.name === 'Walking') {
                displayValue = total.toLocaleString();
                goalText = 'steps';
            } else if (activity.name === 'Reading' || activity.name === 'Writing') {
                displayValue = total;
                goalText = 'pages';
            } else {
                displayValue = total;
                goalText = 'units';
            }
            
            progressPercent = Math.min((total / weeklyGoal) * 100, 100);
            hasGoal = true;
        } else {
            // Daily boolean activities
            total = data.length;
            displayValue = total;
            weeklyGoal = parseFloat(activity.min_threshold);
            goalText = `of ${weeklyGoal} days`;
            progressPercent = (total / weeklyGoal) * 100;
            hasGoal = true;
        }

        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const isComplete = progressPercent >= 100;
        
        card.innerHTML = `
            <div class="stat-header">
                <div class="stat-icon">
                    ${activityIcons[activity.name] || ''}
                </div>
                <div class="stat-info">
                    <h3>${activity.name}</h3>
                </div>
            </div>
            ${isComplete ? `
                <div class="activity-check" style="position: absolute; top: 0.75rem; right: 0.75rem;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
            ` : ''}
            <div class="stat-value">${displayValue}</div>
            ${hasGoal ? `
                <div class="stat-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-label">
                        <span>${goalText}</span>
                        <span>${Math.round(progressPercent)}%</span>
                    </div>
                </div>
            ` : ''}
            ${!isComplete ? `
                <div class="stat-min-threshold">
                    Min: ${activity.name === 'Walking' ? weeklyGoal.toLocaleString() + ' steps' : activity.activity_type === 'accumulative' ? weeklyGoal + ' pages' : weeklyGoal + ' days'}
                </div>
            ` : ''}
        `;
        
        // ✅ Store card instead of appending immediately
        cardsToAppend.push(card);
    }

    // ✅ STEP 4: Append all cards at once (makes them appear together)
    cardsToAppend.forEach(card => {
        statsGrid.appendChild(card);
    });
    
    // Initialize carousel on mobile
    setTimeout(() => {
        initStatsCarousel();
    }, 100);
}

// ============================================
// STATS CAROUSEL (MOBILE) - Manual Control
// ============================================
function initStatsCarousel() {
    // Only run on mobile
    if (window.innerWidth > 768) return;
    
    const statsGrid = document.getElementById('statsGrid');
    const iconsContainer = document.getElementById('statsNavDots');
    
    if (!statsGrid || !iconsContainer) return;
    
    const cards = Array.from(statsGrid.querySelectorAll('.stat-card'));
    if (cards.length === 0) return;
    
    // Clear existing icons
    iconsContainer.innerHTML = '';
    
    // Create navigation icons using activity SVGs
    const icons = [];
    activities.forEach((activity, index) => {
        const iconBtn = document.createElement('button');
        iconBtn.className = 'stat-icon-nav';
        if (index === 0) iconBtn.classList.add('active');
        iconBtn.innerHTML = activityIcons[activity.name] || '';
        iconBtn.onclick = () => scrollToCard(index);
        iconBtn.setAttribute('aria-label', `View ${activity.name} stats`);
        iconsContainer.appendChild(iconBtn);
        icons.push(iconBtn);
    });
    
    // ✅ NEW: Use Intersection Observer instead of scroll listener
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                const index = cards.indexOf(entry.target);
                if (index !== -1) {
                    statsCarouselCurrentIndex = index;
                    
                    // Update icons efficiently (no DOM queries)
                    icons.forEach((icon, i) => {
                        if (i === index) {
                            icon.classList.add('active');
                        } else {
                            icon.classList.remove('active');
                        }
                    });
                    
                    updateNavButtons();
                }
            }
        });
    }, {
        root: statsGrid,
        threshold: 0.5,
        rootMargin: '0px'
    });
    
    // Observe all cards
    cards.forEach(card => observer.observe(card));
    
    // Store observer for cleanup
    if (window.statsCarouselObserver) {
        window.statsCarouselObserver.disconnect();
    }
    window.statsCarouselObserver = observer;
    
    // Initial button state
    updateNavButtons();
}

function scrollToCard(index) {
    const statsGrid = document.getElementById('statsGrid');
    const cards = statsGrid.querySelectorAll('.stat-card');
    
    if (cards[index]) {
        cards[index].scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest'
        });
        
        statsCarouselCurrentIndex = index;
        updateActiveIcon();
        updateNavButtons();
    }
}



function scrollCarouselLeft() {
    const statsGrid = document.getElementById('statsGrid');
    const cards = statsGrid.querySelectorAll('.stat-card');
    
    if (statsCarouselCurrentIndex > 0) {
        scrollToCard(statsCarouselCurrentIndex - 1);
    } else {
        // Loop to last card
        scrollToCard(cards.length - 1);
    }
}

function scrollCarouselRight() {
    const statsGrid = document.getElementById('statsGrid');
    const cards = statsGrid.querySelectorAll('.stat-card');
    
    if (statsCarouselCurrentIndex < cards.length - 1) {
        scrollToCard(statsCarouselCurrentIndex + 1);
    } else {
        // Loop to first card
        scrollToCard(0);
    }
}

function updateNavButtons() {
    // Note: With looping enabled, buttons are never truly hidden
    // But we keep this function for potential future use
    const leftBtn = document.getElementById('carouselNavLeft');
    const rightBtn = document.getElementById('carouselNavRight');
    
    if (!leftBtn || !rightBtn) return;
    
    // Always show buttons since we have looping
    leftBtn.classList.remove('hidden');
    rightBtn.classList.remove('hidden');
}

function stopCarousel() {
    // Reset state when switching to desktop
    statsCarouselCurrentIndex = 0;
    
    // Clean up Intersection Observer
    if (window.statsCarouselObserver) {
        window.statsCarouselObserver.disconnect();
        window.statsCarouselObserver = null;
    }
}

async function loadWeeklyChart(weekStart) {
    // Get data for the entire week
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*, activities(name)')
        .eq('participant_id', currentUser.id)
        .eq('week_start_date', weekStart)
        .order('log_date');

    if (error) {
        console.error('Error loading chart data:', error);
        return;
    }

    // Prepare data structure
    const weekDays = [];
    const startDate = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        weekDays.push(date.toISOString().split('T')[0]);
    }

    // Group by activity
    const activityData = {};
    activities.forEach(activity => {
        activityData[activity.name] = weekDays.map(() => 0);
    });

    // Fill in the data
    data.forEach(log => {
        const dayIndex = weekDays.indexOf(log.log_date);
        if (dayIndex !== -1 && activityData[log.activities.name]) {
            if (log.activities.name === 'Walking') {
                activityData[log.activities.name][dayIndex] += parseFloat(log.value) / 1000; // Convert to thousands
            } else {
                activityData[log.activities.name][dayIndex] += parseFloat(log.value);
            }
        }
    });

    // Create datasets - show selected activity and optionally compared participant
    const selectedActivity = document.getElementById('activityChartSelect')?.value || 'Walking';
    const compareParticipantId = document.getElementById('compareAgainstSelect')?.value || '';

    let datasets = [];

    // Add current user's dataset
    const colorIndex = Object.keys(activityData).indexOf(selectedActivity);
    datasets.push({
        label: `${currentUser.nick_name || currentUser.name} - ${selectedActivity}`,
        data: activityData[selectedActivity],
        borderColor: '#FC4C02',
        backgroundColor: 'rgba(252, 76, 2, 0.05)',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#FC4C02',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        fill: false
    });

    // Add comparison participant's dataset if selected
    if (compareParticipantId) {
        const { data: compareData, error: compareError } = await supabaseClient
            .from('activity_logs')
            .select('*, activities(name)')
            .eq('participant_id', compareParticipantId)
            .eq('week_start_date', weekStart)
            .order('log_date');

        if (!compareError && compareData) {
            const compareActivityData = weekDays.map(() => 0);
            
            compareData.forEach(log => {
                const dayIndex = weekDays.indexOf(log.log_date);
                if (dayIndex !== -1 && log.activities.name === selectedActivity) {
                    if (log.activities.name === 'Walking') {
                        compareActivityData[dayIndex] += parseFloat(log.value) / 1000;
                    } else {
                        compareActivityData[dayIndex] += parseFloat(log.value);
                    }
                }
            });

            const { data: participantData } = await supabaseClient
                .from('participants')
                .select('name, nick_name')
                .eq('id', compareParticipantId)
                .single();

            const compareName = participantData ? (participantData.nick_name || participantData.name) : 'Other';

            datasets.push({
                label: `${compareName} - ${selectedActivity}`,
                data: compareActivityData,
                borderColor: '#ffffffff',  // Using your new accent color
                backgroundColor: 'rgba(45, 45, 45, 0.05)', 
                borderWidth: 3,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#71fb07ff',  // ← CHANGE: Match line
                pointBorderColor: '#ffffffff',
                pointBorderWidth: 2,
                fill: false
            });
        }
    }

    // Render chart
    const ctx = document.getElementById('weeklyChart');
    if (weeklyChart) {
        weeklyChart.destroy();
    }

    const labels = weekDays.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    });

    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1F2937',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    boxWidth: 12,
                    boxHeight: 12,
                    usePointStyle: true,
                    titleFont: {
                        family: 'Inter',
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 13
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 217, 255, 0.2)',  // ← Changed from '#F3F4F6' to cyan with 0.2 opacity
                        drawBorder: false
                    },
                    ticks: {
                        color: '#B8BFD8',  // ← Changed to match dark theme text
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 217, 255, 0.15)',  // ← Changed from 'display: false' to show with 0.15 opacity
                        drawBorder: false
                    },
                    ticks: {
                        color: '#B8BFD8',  // ← Changed to match dark theme text
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Populate dropdown with all activities
    const selectElement = document.getElementById('activityChartSelect');
    if (selectElement) {
        selectElement.innerHTML = '';
        Object.keys(activityData).forEach(activityName => {
            const option = document.createElement('option');
            option.value = activityName;
            option.textContent = activityName;
            if (activityName === selectedActivity) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });

        // Add change listener to reload chart (remove old listener first)
        selectElement.onchange = () => loadWeeklyChart(weekStart);
    }

    
}

let recentActivityOffset = 0;
let recentActivityLimit = 3;
let hasMoreActivity = true;

async function loadRecentActivity() {
    // Reset state
    recentActivityOffset = 0;
    hasMoreActivity = true;
    
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select(`
            *,
            participants (name, nick_name),
            activities (name)
        `)
        .order('created_at', { ascending: false })
        .limit(recentActivityLimit);

    if (error) {
        console.error('Error loading recent activity:', error);
        return;
    }

    const feed = document.getElementById('recentActivityFeed');
    const showMoreBtn = document.getElementById('showMoreActivityBtn');
    feed.innerHTML = '';

    if (data.length === 0) {
        feed.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-tertiary);">No recent activity</p>';
        showMoreBtn.style.display = 'none';
        return;
    }

    data.forEach(log => {
        const item = createActivityItem(log);
        feed.appendChild(item);
    });
    
    // Update offset
    recentActivityOffset = data.length;
    
    // Show "Load More" button if we got exactly the limit (means there might be more)
    if (data.length === recentActivityLimit) {
        showMoreBtn.style.display = 'block';
        showMoreBtn.textContent = 'Load More Activity';
    } else {
        showMoreBtn.style.display = 'none';
    }
}

async function loadMoreActivity() {
    const showMoreBtn = document.getElementById('showMoreActivityBtn');
    
    // Show loading state
    showMoreBtn.textContent = 'Loading...';
    showMoreBtn.disabled = true;
    
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select(`
            *,
            participants (name, nick_name),
            activities (name)
        `)
        .order('created_at', { ascending: false })
        .range(recentActivityOffset, recentActivityOffset + 4); // Load 5 more (0-4)

    if (error) {
        console.error('Error loading more activity:', error);
        showMoreBtn.textContent = 'Load More Activity';
        showMoreBtn.disabled = false;
        return;
    }

    const feed = document.getElementById('recentActivityFeed');

    if (data.length === 0) {
        showMoreBtn.textContent = "That's all!";
        showMoreBtn.disabled = true;
        setTimeout(() => {
            showMoreBtn.style.display = 'none';
        }, 2000);
        return;
    }

    // Append new items with animation
    data.forEach((log, index) => {
        const item = createActivityItem(log);
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        feed.appendChild(item);
        
        // Animate in
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 50);
    });
    
    // Update offset
    recentActivityOffset += data.length;
    
    // Reset button state
    showMoreBtn.disabled = false;
    
    // If we got less than 5, hide button (no more data)
    if (data.length < 5) {
        showMoreBtn.textContent = "That's all!";
        setTimeout(() => {
            showMoreBtn.style.display = 'none';
        }, 2000);
    } else {
        showMoreBtn.textContent = 'Load More Activity';
    }
}

function createActivityItem(log) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    let valueDisplay = log.value;
    if (log.activities.name === 'Walking') {
        valueDisplay = `${log.value.toLocaleString()} steps`;
    } else if (['Reading', 'Writing'].includes(log.activities.name)) {
        valueDisplay = `${log.value} pages`;
    } else {
        valueDisplay = 'completed';
    }
    
    const timeAgo = getTimeAgo(new Date(log.created_at));
    
    item.innerHTML = `
        <div class="activity-item-icon">
            ${activityIcons[log.activities.name] || ''}
        </div>
        <div class="activity-item-content">
            <div class="activity-item-text">
                <strong>${log.participants.nick_name || log.participants.name}</strong> logged ${log.activities.name}: ${valueDisplay}
            </div>
            <div class="activity-item-time">${timeAgo}</div>
        </div>
    `;
    
    return item;
}

// ============================================
// LEADERBOARD
// ============================================
async function loadLeaderboard() {
    document.getElementById('leaderboardWeekDisplay').textContent = getWeekDisplay(currentLeaderboardWeek);
    
    const today = getWeekStart(new Date());
    document.getElementById('nextWeekBtn').disabled = currentLeaderboardWeek >= today;

    await calculateWeekScores(currentLeaderboardWeek);

    const { data: scores, error } = await supabaseClient
        .from('weekly_scores')
        .select(`
            *,
            participants (name, nick_name, photo)
        `)
        .eq('week_start_date', currentLeaderboardWeek);

    if (error) {
        console.error('Error loading leaderboard:', error);
        return;
    }

    // Sort alphabetically by full name after fetching
    scores.sort((a, b) => {
        const nameA = a.participants.name.toLowerCase();
        const nameB = b.participants.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    renderLeaderboardChart(scores);
    renderLeaderboardList(scores);
}

async function renderLeaderboardChart(scores) {
    const canvas = document.getElementById('leaderboardChart');
    const emptyMessage = document.getElementById('leaderboardEmptyMessage');
    
    if (!canvas || !emptyMessage) {
        console.error('Chart elements not found');
        return;
    }

    // Destroy existing chart if it exists
    if (leaderboardChart) {
        leaderboardChart.destroy();
        leaderboardChart = null;
    }

    const eligibleScores = scores.filter(s => s.activities_completed >= 3);

    if (eligibleScores.length === 0) {
        canvas.style.display = 'none';
        emptyMessage.style.display = 'block';
        return;
    }
    
    // Show canvas and hide message
    canvas.style.display = 'block';
    emptyMessage.style.display = 'none';
    
    const ctx = canvas;

    // Sort by score for podium effect
    const sortedScores = [...eligibleScores].sort((a, b) => b.total_points - a.total_points);
    
    const labels = ['', ...sortedScores.map(s => s.participants.nick_name || s.participants.name), ''];
    const points = [null, ...sortedScores.map((s, idx) => {
        if (s.total_points === 0) {
            return null;
        }
        return s.total_points;
    }), null];
    
    // Preload images with size variation for top 3
    const pointImages = await Promise.all([
        Promise.resolve(null),
        ...sortedScores.map((s, idx) => {
            return new Promise((resolve) => {
                const size = idx === 0 ? 40 : idx === 1 ? 36 : idx === 2 ? 34 : 30;
                const img = new Image(size, size);
                img.crossOrigin = 'anonymous';
                
                const fallbackSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ddd"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
                
                img.onload = () => resolve(img);
                img.onerror = () => {
                    const fallbackImg = new Image(size, size);
                    fallbackImg.src = fallbackSvg;
                    fallbackImg.onload = () => resolve(fallbackImg);
                };
                
                const photoUrl = getGoogleDriveDirectLink(s.participants.photo);
                img.src = photoUrl || fallbackSvg;
            });
        }),
        Promise.resolve(null)
    ]);

    // Create custom point styles with aura effect
    const pointStyles = pointImages.map((img, idx) => {
        if (!img) return null;
        
        const canvas = document.createElement('canvas');
        const size = img.width;
        const padding = 8;
        canvas.width = size + padding * 2;
        canvas.height = size + padding * 2;
        const ctx = canvas.getContext('2d');
        
        // Draw aura based on rank
        if (idx >= 1 && idx <= 3) {
            const gradient = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, size / 2,
                canvas.width / 2, canvas.height / 2, size / 2 + padding
            );
            
            if (idx === 1) { // 1st place - gold aura
                gradient.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            } else if (idx === 2) { // 2nd place - silver aura
                gradient.addColorStop(0, 'rgba(192, 192, 192, 0.4)');
                gradient.addColorStop(1, 'rgba(192, 192, 192, 0)');
            } else if (idx === 3) { // 3rd place - bronze aura
                gradient.addColorStop(0, 'rgba(205, 127, 50, 0.4)');
                gradient.addColorStop(1, 'rgba(205, 127, 50, 0)');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw circular border
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, size / 2 + 2, 0, Math.PI * 2);
        if (idx === 1) ctx.strokeStyle = '#FFD700';
        else if (idx === 2) ctx.strokeStyle = '#C0C0C0';
        else if (idx === 3) ctx.strokeStyle = '#CD7F32';
        else ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Clip to circle and draw image
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, padding, padding, size, size);
        ctx.restore();
        
        return canvas;
    });

    leaderboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Points',
                data: points,
                pointStyle: pointStyles,
                pointRadius: pointImages.map((img, idx) => img ? img.width / 2 + 4 : 0),
                pointHoverRadius: pointImages.map((img, idx) => img ? img.width / 2 + 8 : 0),
                borderColor: 'rgba(14, 165, 233, 0.3)',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                showLine: true,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 1500,
                easing: 'easeOutQuart',
                delay: (context) => {
                    return context.dataIndex * 100;
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 16,
                    displayColors: false,
                    titleFont: {
                        family: 'Inter',
                        size: 15,
                        weight: '600'
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 14
                    },
                    callbacks: {
                        title: function(context) {
                            if (context[0].dataIndex === 0 || context[0].dataIndex === sortedScores.length + 1) {
                                return '';
                            }
                            const scoreIndex = context[0].dataIndex - 1;
                            return sortedScores[scoreIndex].participants.name;
                        },
                        label: function(context) {
                            if (context.dataIndex === 0 || context.dataIndex === sortedScores.length + 1) {
                                return '';
                            }
                            const scoreIndex = context.dataIndex - 1;
                            const actualPoints = sortedScores[scoreIndex].total_points;
                            return `Points: ${actualPoints.toFixed(1)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: (context) => {
                            const ratio = context.index / (context.chart.scales.y.ticks.length - 1);
                            const opacity = Math.sin(ratio * Math.PI) * 0.2;
                            return `rgba(0, 217, 255, ${opacity})`;
                        },
                        drawBorder: false,
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 217, 255, 0.15)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'point'
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            }
        }
    });
    
    // Add click interaction
    ctx.onclick = (event) => {
        const points = leaderboardChart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length > 0) {
            const dataIndex = points[0].index;
            if (dataIndex > 0 && dataIndex <= sortedScores.length) {
                const participant = sortedScores[dataIndex - 1];
                // Scroll to that participant in the list
                const listItem = document.querySelector(`#breakdown-${participant.participant_id}`);
                if (listItem) {
                    listItem.closest('.leaderboard-item').scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                    // Flash highlight
                    const item = listItem.closest('.leaderboard-item');
                    item.style.transition = 'all 0.3s ease';
                    item.style.transform = 'scale(1.02)';
                    item.style.boxShadow = '0 8px 24px rgba(14, 165, 233, 0.3)';
                    setTimeout(() => {
                        item.style.transform = '';
                        item.style.boxShadow = '';
                    }, 600);
                }
            }
        }
    };
}

function renderLeaderboardList(scores) {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';

    if (scores.length === 0) {
        list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">No scores yet for this week</p>';
        return;
    }

    // ✅ Separate participants into two groups
    const eligibleParticipants = scores.filter(s => s.activities_completed >= 3);
    const ineligibleParticipants = scores.filter(s => s.activities_completed < 3);
    
    // Sort eligible participants by score (descending)
    eligibleParticipants.sort((a, b) => b.total_points - a.total_points);
    
    // Sort ineligible participants alphabetically (they all get rank 0)
    ineligibleParticipants.sort((a, b) => {
        const nameA = a.participants.name.toLowerCase();
        const nameB = b.participants.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // ✅ Render eligible participants with proper ranks (1, 2, 3, ...)
    eligibleParticipants.forEach((score, index) => {
        const item = document.createElement('div');
        const rank = index + 1;
        
        if (score.total_points > 0) {
            item.className = `leaderboard-item rank-${rank}`;
        } else {
            item.className = 'leaderboard-item';
        }
        
        //const photoUrl = getGoogleDriveDirectLink(score.participants.photo) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ddd"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
        
        item.innerHTML = `
            <div class="rank-badge">${rank}</div>
            <div class="participant-details" style="flex: 1;">
                <div class="participant-name">${score.participants.name}</div>
                <div class="participant-stats">
                    ${score.activities_completed}/7 activities • ${score.bonus_points > 0 ? `+${score.bonus_points} bonus` : 'No bonus'}
                </div>
                <button class="toggle-breakdown-btn" onclick="toggleBreakdown(${score.participant_id}, '${currentLeaderboardWeek}', this)">
                    View Breakdown
                </button>
                <div class="activity-breakdown" id="breakdown-${score.participant_id}">
                    <div class="breakdown-title">Activity Points Breakdown</div>
                    <div class="breakdown-items" id="breakdown-items-${score.participant_id}">
                        Loading...
                    </div>
                </div>
            </div>
            <div class="participant-score">${score.total_points.toFixed(1)}</div>
        `;
        
        // Add mobile click handler
        item.addEventListener('click', function(e) {
            // Only on mobile
            if (window.innerWidth <= 768) {
                // Don't trigger if clicking the button itself (for safety)
                if (!e.target.classList.contains('toggle-breakdown-btn')) {
                    openBreakdownModal(score.participant_id, currentLeaderboardWeek);
                }
            }
        });

        list.appendChild(item);
    });

    // ✅ Render ineligible participants with rank "0" or "-"
    if (ineligibleParticipants.length > 0) {
        // Optional: Add a separator
        const separator = document.createElement('div');
        separator.style.cssText = `
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(255, 61, 113, 0.3), transparent);
            margin: 1.5rem 0;
        `;
        list.appendChild(separator);
        
        // Optional: Add a note
        const note = document.createElement('div');
        note.style.cssText = `
            text-align: center;
            padding: 1rem;
            color: var(--text-tertiary);
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        note.textContent = 'Need 3+ activities to rank';
        list.appendChild(note);
    }

    ineligibleParticipants.forEach((score) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item ineligible'; // Add special class
        
        //const photoUrl = getGoogleDriveDirectLink(score.participants.photo) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ddd"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
        
        item.innerHTML = `
            <div class="rank-badge" style="opacity: 0.5;">-</div>
            
            <div class="participant-details" style="flex: 1;">
                <div class="participant-name" style="opacity: 0.7;">${score.participants.name}</div>
                <div class="participant-stats">
                    ${score.activities_completed}/7 activities • ${score.bonus_points > 0 ? `+${score.bonus_points} bonus` : 'No bonus'}
                </div>
                <button class="toggle-breakdown-btn" onclick="toggleBreakdown(${score.participant_id}, '${currentLeaderboardWeek}', this)">
                    View Breakdown
                </button>
                <div class="activity-breakdown" id="breakdown-${score.participant_id}">
                    <div class="breakdown-title">Activity Points Breakdown</div>
                    <div class="breakdown-items" id="breakdown-items-${score.participant_id}">
                        Loading...
                    </div>
                </div>
            </div>
            <div class="participant-score" style="opacity: 0.7;">${score.total_points.toFixed(1)}</div>
        `;
        
        // Add mobile click handler
        item.addEventListener('click', function(e) {
            // Only on mobile
            if (window.innerWidth <= 768) {
                if (!e.target.classList.contains('toggle-breakdown-btn')) {
                    openBreakdownModal(score.participant_id, currentLeaderboardWeek);
                }
            }
        });

        // Add mobile click handler
        item.addEventListener('click', function(e) {
            // Only on mobile
            if (window.innerWidth <= 768) {
                if (!e.target.classList.contains('toggle-breakdown-btn')) {
                    openBreakdownModal(score.participant_id, currentLeaderboardWeek);
                }
            }
        });

        list.appendChild(item);
    });
}

async function toggleBreakdown(participantId, weekStart, button) {
    // Check if mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Open full-screen modal on mobile
        await openBreakdownModal(participantId, weekStart);
        return;
    }
    
    // Desktop behavior (existing code)
    const breakdownDiv = document.getElementById(`breakdown-${participantId}`);
    const itemsDiv = document.getElementById(`breakdown-items-${participantId}`);
    
    if (breakdownDiv.classList.contains('show')) {
        breakdownDiv.classList.remove('show');
        button.textContent = 'View Breakdown';
        return;
    }
    
    // Load breakdown data
    const { data: logs, error } = await supabaseClient
        .from('activity_logs')
        .select(`
            *,
            activities (name, activity_type, min_threshold, min_points, increment_threshold, increment_points, max_points)
        `)
        .eq('participant_id', participantId)
        .eq('week_start_date', weekStart);
    
    if (error) {
        console.error('Error loading breakdown:', error);
        itemsDiv.innerHTML = '<p style="color: var(--error);">Error loading data</p>';
        breakdownDiv.classList.add('show');
        return;
    }
    
    // Calculate points per activity
    const activityPoints = {};
    
    logs.forEach(log => {
        const activity = log.activities;
        if (!activityPoints[activity.name]) {
            activityPoints[activity.name] = { points: 0, value: 0, type: activity.activity_type };
        }
        
        if (activity.activity_type === 'accumulative') {
            activityPoints[activity.name].value += parseFloat(log.value);
        } else {
            activityPoints[activity.name].value += 1;
        }
    });
    
    // Calculate points based on thresholds
    Object.keys(activityPoints).forEach(activityName => {
        const activityData = activityPoints[activityName];
        const activity = logs.find(l => l.activities.name === activityName).activities;
        
        if (activity.activity_type === 'accumulative') {
            const value = activityData.value;
            if (value >= activity.min_threshold) {
                activityData.points = activity.min_points;
                const extraValue = value - activity.min_threshold;
                const increments = Math.floor(extraValue / activity.increment_threshold);
                activityData.points += increments * activity.increment_points;
                activityData.points = Math.min(activityData.points, activity.max_points);
            }
        } else {
            const daysCompleted = activityData.value;
            if (daysCompleted >= activity.min_threshold) {
                activityData.points = activity.min_points;
                const extraDays = daysCompleted - activity.min_threshold;
                activityData.points += extraDays * activity.increment_points;
                activityData.points = Math.min(activityData.points, activity.max_points);
            }
        }
    });
    
    // Render breakdown
    itemsDiv.innerHTML = '';
    let totalPoints = 0;
    
    Object.keys(activityPoints).forEach(activityName => {
        const data = activityPoints[activityName];
        const activity = logs.find(l => l.activities.name === activityName).activities;
        totalPoints += data.points;
        
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        
        let valueDisplay = '';
        let calculationBreakdown = '';
        
        if (data.type === 'accumulative') {
            if (activityName === 'Walking') {
                valueDisplay = `${data.value.toLocaleString()} steps`;
            } else {
                valueDisplay = `${data.value} pages`;
            }
            
            if (data.value >= activity.min_threshold) {
                const basePoints = activity.min_points;
                const extraValue = data.value - activity.min_threshold;
                const bonusPoints = Math.floor(extraValue / activity.increment_threshold) * activity.increment_points;
                const cappedBonusPoints = Math.min(bonusPoints, activity.max_points - basePoints);
                
                if (bonusPoints > 0) {
                    const extraUnits = activityName === 'Walking' ? 
                        `${(extraValue - (extraValue % activity.increment_threshold)).toLocaleString()} steps` : 
                        `${Math.floor(extraValue / activity.increment_threshold) * activity.increment_threshold} pages`;
                    calculationBreakdown = `<br><span style="font-size: 0.75rem; color: var(--gray-500);">(Base ${basePoints.toFixed(1)} pt at ${activity.min_threshold.toLocaleString()}${activityName === 'Walking' ? ' steps' : ' pages'} + ${cappedBonusPoints.toFixed(1)} pt for extra ${extraUnits})</span>`;
                } else {
                    calculationBreakdown = `<br><span style="font-size: 0.75rem; color: var(--gray-500);">(Base ${basePoints.toFixed(1)} pt at ${activity.min_threshold.toLocaleString()}${activityName === 'Walking' ? ' steps' : ' pages'})</span>`;
                }
            }
        } else {
            valueDisplay = `${data.value} days`;
            
            if (data.value >= activity.min_threshold) {
                const basePoints = activity.min_points;
                const extraDays = data.value - activity.min_threshold;
                const bonusPoints = extraDays * activity.increment_points;
                
                if (bonusPoints > 0) {
                    calculationBreakdown = `<br><span style="font-size: 0.75rem; color: var(--gray-500);">(Base ${basePoints.toFixed(1)} pt at ${activity.min_threshold} days + ${bonusPoints.toFixed(1)} pt for ${extraDays} extra days)</span>`;
                } else {
                    calculationBreakdown = `<br><span style="font-size: 0.75rem; color: var(--gray-500);">(Base ${basePoints.toFixed(1)} pt at ${activity.min_threshold} days)</span>`;
                }
            }
        }
        
        item.innerHTML = `
            <div style="flex: 1;">
                <div class="breakdown-activity">${activityName}: ${valueDisplay}</div>
                ${calculationBreakdown}
            </div>
            <span class="breakdown-points">${data.points.toFixed(1)} pts</span>
        `;
        itemsDiv.appendChild(item);
    });
    
    // Add bonus if any
    const { data: scoreData } = await supabaseClient
        .from('weekly_scores')
        .select('bonus_points')
        .eq('participant_id', participantId)
        .eq('week_start_date', weekStart)
        .single();
    
    if (scoreData && scoreData.bonus_points > 0) {
        const bonusItem = document.createElement('div');
        bonusItem.className = 'breakdown-item';
        bonusItem.innerHTML = `
            <span class="breakdown-activity">All Activities Bonus</span>
            <span class="breakdown-points" style="color: var(--success);">+${scoreData.bonus_points} pts</span>
        `;
        itemsDiv.appendChild(bonusItem);
        totalPoints += scoreData.bonus_points;
    }
    
    // Add total
    const totalItem = document.createElement('div');
    totalItem.className = 'breakdown-item';
    totalItem.style.borderTop = '2px solid var(--gray-300)';
    totalItem.style.marginTop = '0.5rem';
    totalItem.style.paddingTop = '0.75rem';
    totalItem.innerHTML = `
        <span class="breakdown-activity" style="font-weight: 600;">Total</span>
        <span class="breakdown-points" style="font-size: 1.125rem; font-weight: 700;">${totalPoints.toFixed(1)} pts</span>
    `;
    itemsDiv.appendChild(totalItem);
    
    breakdownDiv.classList.add('show');
    button.textContent = 'Hide Breakdown';
}


async function openBreakdownModal(participantId, weekStart) {
    const modal = document.getElementById('breakdownModal');
    const title = document.getElementById('breakdownModalTitle');
    const weekDisplay = document.getElementById('breakdownWeekDisplay');
    const summary = document.getElementById('breakdownSummary');
    const activitiesDiv = document.getElementById('breakdownActivities');
    const bonusDiv = document.getElementById('breakdownBonus');
    
    // Get participant info
    const { data: participant } = await supabaseClient
        .from('participants')
        .select('name, nick_name')
        .eq('id', participantId)
        .single();
    
    title.textContent = `${participant.name}'s Activity Breakdown`;
    weekDisplay.textContent = getWeekDisplay(weekStart);
    
    // Load breakdown data
    const { data: logs, error } = await supabaseClient
        .from('activity_logs')
        .select(`
            *,
            activities (name, activity_type, min_threshold, min_points, increment_threshold, increment_points, max_points)
        `)
        .eq('participant_id', participantId)
        .eq('week_start_date', weekStart);
    
    if (error) {
        console.error('Error loading breakdown:', error);
        return;
    }
    
    // Calculate points per activity
    const activityPoints = {};
    
    logs.forEach(log => {
        const activity = log.activities;
        if (!activityPoints[activity.name]) {
            activityPoints[activity.name] = { points: 0, value: 0, type: activity.activity_type, activity: activity };
        }
        
        if (activity.activity_type === 'accumulative') {
            activityPoints[activity.name].value += parseFloat(log.value);
        } else {
            activityPoints[activity.name].value += 1;
        }
    });
    
    // Calculate points based on thresholds
    Object.keys(activityPoints).forEach(activityName => {
        const activityData = activityPoints[activityName];
        const activity = activityData.activity;
        
        if (activity.activity_type === 'accumulative') {
            const value = activityData.value;
            if (value >= activity.min_threshold) {
                activityData.points = activity.min_points;
                activityData.basePoints = activity.min_points;
                const extraValue = value - activity.min_threshold;
                const increments = Math.floor(extraValue / activity.increment_threshold);
                const bonusPoints = increments * activity.increment_points;
                activityData.bonusPoints = Math.min(bonusPoints, activity.max_points - activity.min_points);
                activityData.points += activityData.bonusPoints;
                activityData.points = Math.min(activityData.points, activity.max_points);
            } else {
                activityData.basePoints = 0;
                activityData.bonusPoints = 0;
            }
        } else {
            const daysCompleted = activityData.value;
            if (daysCompleted >= activity.min_threshold) {
                activityData.basePoints = activity.min_points;
                activityData.points = activity.min_points;
                const extraDays = daysCompleted - activity.min_threshold;
                activityData.bonusPoints = extraDays * activity.increment_points;
                activityData.points += activityData.bonusPoints;
                activityData.points = Math.min(activityData.points, activity.max_points);
            } else {
                activityData.basePoints = 0;
                activityData.bonusPoints = 0;
            }
        }
    });
    
    let totalPoints = 0;
    const activitiesCompleted = Object.keys(activityPoints).length;
    
    // Render summary
    Object.values(activityPoints).forEach(data => {
        totalPoints += data.points;
    });
    
    // Get bonus
    const { data: scoreData } = await supabaseClient
        .from('weekly_scores')
        .select('bonus_points')
        .eq('participant_id', participantId)
        .eq('week_start_date', weekStart)
        .single();
    
    const bonusPoints = scoreData?.bonus_points || 0;
    
    summary.innerHTML = `
        <div class="breakdown-summary-row">
            <span class="breakdown-summary-label">Activities Completed</span>
            <span class="breakdown-summary-value">${activitiesCompleted} / 7</span>
        </div>
        <div class="breakdown-summary-row">
            <span class="breakdown-summary-label">Activity Points</span>
            <span class="breakdown-summary-value">${totalPoints.toFixed(1)} pts</span>
        </div>
        ${bonusPoints > 0 ? `
            <div class="breakdown-summary-row">
                <span class="breakdown-summary-label">All Activities Bonus</span>
                <span class="breakdown-summary-value">+${bonusPoints} pts</span>
            </div>
        ` : ''}
        <div class="breakdown-summary-row breakdown-summary-total">
            <span class="breakdown-summary-label">Total Points</span>
            <span class="breakdown-summary-value">${(totalPoints + bonusPoints).toFixed(1)} pts</span>
        </div>
    `;
    
    // Render activities
    activitiesDiv.innerHTML = '';
    
    Object.keys(activityPoints).forEach(activityName => {
        const data = activityPoints[activityName];
        const activity = data.activity;
        
        let valueDisplay = '';
        let baseInfo = '';
        let bonusInfo = '';
        
        if (data.type === 'accumulative') {
            if (activityName === 'Walking') {
                valueDisplay = `${data.value.toLocaleString()} steps`;
                baseInfo = `Base: ${data.basePoints.toFixed(1)} pts (${activity.min_threshold.toLocaleString()} steps)`;
                if (data.bonusPoints > 0) {
                    const extraSteps = data.value - activity.min_threshold;
                    bonusInfo = `Bonus: +${data.bonusPoints.toFixed(1)} pts (${extraSteps.toLocaleString()} extra steps)`;
                }
            } else {
                valueDisplay = `${data.value} pages`;
                baseInfo = `Base: ${data.basePoints.toFixed(1)} pts (${activity.min_threshold} pages)`;
                if (data.bonusPoints > 0) {
                    const extraPages = data.value - activity.min_threshold;
                    bonusInfo = `Bonus: +${data.bonusPoints.toFixed(1)} pts (${extraPages} extra pages)`;
                }
            }
        } else {
            valueDisplay = `${data.value} days completed`;
            baseInfo = `Base: ${data.basePoints.toFixed(1)} pts (${activity.min_threshold} days)`;
            if (data.bonusPoints > 0) {
                const extraDays = data.value - activity.min_threshold;
                bonusInfo = `Bonus: +${data.bonusPoints.toFixed(1)} pts (${extraDays} extra days)`;
            }
        }
        
        const card = document.createElement('div');
        card.className = 'breakdown-activity-card';
        card.innerHTML = `
            <div class="breakdown-activity-header">
                <div class="breakdown-activity-icon">
                    ${activityIcons[activityName] || ''}
                </div>
                <div style="flex: 1;">
                    <div class="breakdown-activity-name">${activityName}</div>
                    <div class="breakdown-activity-value">${valueDisplay}</div>
                </div>
            </div>
            <div class="breakdown-activity-points">
                ${data.basePoints > 0 ? `
                    <div class="breakdown-points-row">
                        <span class="breakdown-points-label">${baseInfo}</span>
                        <span class="breakdown-points-value">${data.basePoints.toFixed(1)} pts</span>
                    </div>
                ` : ''}
                ${data.bonusPoints > 0 ? `
                    <div class="breakdown-points-row">
                        <span class="breakdown-points-label">${bonusInfo}</span>
                        <span class="breakdown-points-value">+${data.bonusPoints.toFixed(1)} pts</span>
                    </div>
                ` : ''}
                <div class="breakdown-points-row breakdown-points-total">
                    <span class="breakdown-points-label">Activity Total</span>
                    <span class="breakdown-points-value">${data.points.toFixed(1)} pts</span>
                </div>
            </div>
        `;
        activitiesDiv.appendChild(card);
    });
    
    // Render bonus section
    if (bonusPoints > 0) {
        bonusDiv.innerHTML = `
            <div class="breakdown-bonus-label">All Activities Completed Bonus</div>
            <div class="breakdown-bonus-value">+${bonusPoints} pts</div>
        `;
        bonusDiv.style.display = 'flex';
    } else {
        bonusDiv.style.display = 'none';
    }
    
    modal.classList.add('active');
}

function closeBreakdownModal(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const modal = document.getElementById('breakdownModal');
    modal.classList.remove('active');
}

async function calculateWeekScores(weekStart) {
    const { data: existing } = await supabaseClient
        .from('weekly_scores')
        .select('id')
        .eq('week_start_date', weekStart)
        .limit(1);

    const today = getWeekStart(new Date());
    if (!existing || existing.length === 0 || weekStart === today) {
        const { error } = await supabaseClient.rpc('calculate_weekly_scores', {
            p_week_start_date: weekStart
        });

        if (error) {
            console.error('Error calculating scores:', error);
        }
    }
}

async function changeWeek(direction) {
    const currentDate = new Date(currentLeaderboardWeek);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    currentLeaderboardWeek = getWeekStart(currentDate);
    
    await loadLeaderboard();
}

// ============================================
// LOG MODAL
// ============================================
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('logDate');
    if (dateInput) {
        dateInput.value = today;
        dateInput.max = today;
    }
}

async function openLogModal() {
    const modal = document.getElementById('logModal');
    modal.classList.add('active');
    
    setTodayDate();
    selectedActivity = null;
    selectedDate = document.getElementById('logDate').value;
    
    await renderActivityIcons();
    
    document.getElementById('activityForm').style.display = 'none';
}

function closeLogModal(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const modal = document.getElementById('logModal');
    modal.classList.remove('active');
    selectedActivity = null;
}

async function renderActivityIcons() {
    const grid = document.getElementById('activityIconGrid');
    grid.innerHTML = '';
    
    const selectedDate = document.getElementById('logDate').value;
    
    // Get logged activities for selected date
    const { data: logs } = await supabaseClient
        .from('activity_logs')
        .select('activity_id')
        .eq('participant_id', currentUser.id)
        .eq('log_date', selectedDate);
    
    loggedActivitiesForDate = logs ? logs.map(l => l.activity_id) : [];
    
    activities.forEach(activity => {
        const isLogged = loggedActivitiesForDate.includes(activity.id);
        const isBoolean = activity.activity_type === 'daily_boolean';
        
        const button = document.createElement('button');
        button.className = 'activity-icon-btn';
        button.type = 'button';
        
        if (isLogged && isBoolean) {
            button.classList.add('completed');
        } else if (isLogged && !isBoolean) {
            // Accumulative activities can be logged multiple times
        }
        
        button.innerHTML = `
            ${activityIcons[activity.name] || ''}
            <span>${activity.name}</span>
            ${isLogged && isBoolean ? `
                <div class="activity-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
            ` : ''}
        `;
        
        button.onclick = () => selectActivity(activity, isLogged && isBoolean);
        
        grid.appendChild(button);
    });
}

function selectActivity(activity, isCompleted) {
    if (isCompleted) {
        showToast('Already logged for this date');
        return;
    }
    
    selectedActivity = activity;
    
    // Update selected state
    document.querySelectorAll('.activity-icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show form
    const form = document.getElementById('activityForm');
    const display = document.getElementById('selectedActivityDisplay');
    const inputArea = document.getElementById('activityInputArea');
    
    display.innerHTML = `
        ${activityIcons[activity.name] || ''}
        <span class="selected-activity-name">${activity.name}</span>
    `;
    
    if (activity.activity_type === 'accumulative') {
        let unit = activity.name === 'Walking' ? 'steps' : 'pages';
        let placeholder = activity.name === 'Walking' ? 'e.g., 10000' : 'e.g., 20';
        
        inputArea.innerHTML = `
            <div class="activity-input-group">
                <label for="activityValue" class="input-label">Enter ${unit}</label>
                <input type="number" id="activityValue" class="activity-input" 
                       placeholder="${placeholder}" min="1" required>
                <div class="input-hint">Enter the number of ${unit} you want to log</div>
            </div>
        `;
    } else {
        inputArea.innerHTML = `
            <div class="activity-input-group">
                <p style="color: var(--gray-600); font-size: 0.875rem;">
                    ${getActivityDescription(activity.name)}
                </p>
            </div>
        `;
    }
    
    form.style.display = 'block';
    setTimeout(() => {
        form.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end'  // or 'center' or 'end' depending on your preference
        });
    }, 100);
}



function getActivityDescription(activityName) {
    const descriptions = {
        'Meditation': 'Mark this activity as completed for the selected date.',
        'Water': 'Did you drink 2.5L of water?',
        'Screen Time': 'Were you under your screen time limit?',
        'Sleep': 'Did you sleep in the correct window (9-10pm to 4:30-5:30am)?'
    };
    return descriptions[activityName] || 'Mark this activity as completed.';
}

async function submitActivity() {
    if (!selectedActivity) {
        alert('Please select an activity');
        return;
    }
    
    const logDate = document.getElementById('logDate').value;
    const weekStart = getWeekStart(new Date(logDate));
    let value;
    
    if (selectedActivity.activity_type === 'accumulative') {
        const input = document.getElementById('activityValue');
        value = parseFloat(input.value);
        
        if (!value || value <= 0) {
            alert('Please enter a valid number');
            return;
        }
    } else {
        value = 1;
    }
    
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .insert({
            participant_id: currentUser.id,
            activity_id: selectedActivity.id,
            log_date: logDate,
            value: value,
            week_start_date: weekStart
        });
    
    if (error) {
        if (error.code === '23505') {
            alert('You already logged this activity for this date!');
        } else {
            console.error('Error logging activity:', error);
            alert('Error logging activity. Please try again.');
        }
        return;
    }
    
    showToast(`${selectedActivity.name} logged successfully!`);
    closeLogModal();
    
    // Refresh dashboard if we're on current week
    if (weekStart === getWeekStart(new Date())) {
        await loadDashboard();
    }
}

// Date change handler
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('logDate');
    if (dateInput) {
        dateInput.addEventListener('change', renderActivityIcons);
    }
});

// ============================================
// START APPLICATION
// ============================================
init();

// Handle window resize for carousel
// Debounce resize handler for performance
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (window.innerWidth > 768) {
            stopCarousel();
        } else {
            const statsGrid = document.getElementById('statsGrid');
            if (statsGrid && statsGrid.children.length > 0) {
                initStatsCarousel();
            }
        }
    }, 250);
});
