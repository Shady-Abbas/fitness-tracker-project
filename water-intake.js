document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Load theme preference from database
            firebase.database().ref(`users/${user.uid}/preferences/theme`).once('value')
                .then((snapshot) => {
                    const dbTheme = snapshot.val();
                    if (dbTheme) {
                        localStorage.setItem('theme', dbTheme);
                        applyTheme(dbTheme);
                    }
                });

            // Set username
            document.getElementById('username').textContent = user.displayName || 'User';
            
            // Load user's water data
            loadWaterData(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    // Add logout handler
    document.getElementById('logoutBtn').addEventListener('click', function() {
        firebase.auth().signOut()
            .then(() => {
                window.location.href = 'index.html';
            })
            .catch(error => {
                console.error('Error signing out:', error);
                showAlert('Failed to log out. Please try again.', 'danger');
            });
    });

    // Add event listeners for water tracking buttons
    document.getElementById('saveGoalBtn').addEventListener('click', saveWaterGoal);
    document.getElementById('addWaterBtn').addEventListener('click', addWater);
    document.getElementById('decreaseWaterBtn').addEventListener('click', decreaseWater);
    document.getElementById('resetWaterBtn').addEventListener('click', resetWater);
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

function loadWaterData(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    // Load water goal
    firebase.database().ref(`users/${userId}/waterGoal`).once('value')
        .then((snapshot) => {
            const goal = snapshot.val() || 8; // Default to 8 glasses if not set
            document.getElementById('waterGoal').value = goal;
            document.getElementById('targetWater').textContent = goal;
            
            // Load today's water intake
            return firebase.database().ref(`waterIntake/${userId}/${today}`).once('value');
        })
        .then((snapshot) => {
            const intake = snapshot.val()?.glasses || 0;
            updateWaterDisplay(intake);
        })
        .catch(error => {
            console.error('Error loading water data:', error);
            showAlert('Error loading water data', 'danger');
        });

    // Load water history
    loadWaterHistory(userId);
}

function saveWaterGoal() {
    const userId = firebase.auth().currentUser.uid;
    const goal = parseInt(document.getElementById('waterGoal').value);
    
    if (goal < 1 || goal > 20) {
        showAlert('Please enter a goal between 1 and 20 glasses', 'warning');
        return;
    }

    firebase.database().ref(`users/${userId}/waterGoal`).set(goal)
        .then(() => {
            document.getElementById('targetWater').textContent = goal;
            showAlert('Water goal updated successfully', 'success');
            updateProgress();
        })
        .catch(error => {
            console.error('Error saving water goal:', error);
            showAlert('Failed to save water goal', 'danger');
        });
}

function addWater() {
    const userId = firebase.auth().currentUser.uid;
    const today = new Date().toISOString().split('T')[0];
    const currentWater = parseInt(document.getElementById('currentWater').textContent);
    const targetWater = parseInt(document.getElementById('targetWater').textContent);

    if (currentWater >= targetWater) {
        showAlert('Daily goal already reached!', 'info');
        return;
    }

    firebase.database().ref(`waterIntake/${userId}/${today}`).set({
        glasses: currentWater + 1,
        lastUpdated: new Date().toISOString()
    })
    .then(() => {
        updateWaterDisplay(currentWater + 1);
        showAlert('Water intake updated', 'success');
    })
    .catch(error => {
        console.error('Error updating water intake:', error);
        showAlert('Failed to update water intake', 'danger');
    });
}

function decreaseWater() {
    const userId = firebase.auth().currentUser.uid;
    const today = new Date().toISOString().split('T')[0];
    const currentWater = parseInt(document.getElementById('currentWater').textContent);

    if (currentWater <= 0) {
        showAlert('Water intake cannot be negative', 'warning');
        return;
    }

    firebase.database().ref(`waterIntake/${userId}/${today}`).set({
        glasses: currentWater - 1,
        lastUpdated: new Date().toISOString()
    })
    .then(() => {
        updateWaterDisplay(currentWater - 1);
        showAlert('Water intake updated', 'success');
    })
    .catch(error => {
        console.error('Error updating water intake:', error);
        showAlert('Failed to update water intake', 'danger');
    });
}

function resetWater() {
    const userId = firebase.auth().currentUser.uid;
    const today = new Date().toISOString().split('T')[0];

    firebase.database().ref(`waterIntake/${userId}/${today}`).set({
        glasses: 0,
        lastUpdated: new Date().toISOString()
    })
    .then(() => {
        updateWaterDisplay(0);
        showAlert('Water intake reset', 'success');
    })
    .catch(error => {
        console.error('Error resetting water intake:', error);
        showAlert('Failed to reset water intake', 'danger');
    });
}

function updateWaterDisplay(glasses) {
    document.getElementById('currentWater').textContent = glasses;
    updateProgress();
}

function updateProgress() {
    const current = parseInt(document.getElementById('currentWater').textContent);
    const target = parseInt(document.getElementById('targetWater').textContent);
    const percentage = Math.min((current / target) * 100, 100);
    
    const progressBar = document.getElementById('waterProgress');
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
}

function loadWaterHistory(userId) {
    const historyContainer = document.getElementById('waterHistory');
    const today = new Date();
    
    firebase.database().ref(`waterIntake/${userId}`).orderByKey().limitToLast(7).once('value')
        .then((snapshot) => {
            const history = [];
            snapshot.forEach((childSnapshot) => {
                const date = childSnapshot.key;
                const data = childSnapshot.val();
                history.unshift({ date, ...data });
            });

            historyContainer.innerHTML = history.map(entry => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">${formatDate(entry.date)}</h6>
                            <small class="text-muted">Last updated: ${formatTime(entry.lastUpdated)}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-info rounded-pill">${entry.glasses} glasses</span>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteWaterLog('${entry.date}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('') || '<p class="text-muted text-center">No history available</p>';
        })
        .catch(error => {
            console.error('Error loading water history:', error);
            historyContainer.innerHTML = '<p class="text-danger">Error loading history</p>';
        });
}

// Add this new function for deleting water logs
function deleteWaterLog(date) {
    const userId = firebase.auth().currentUser.uid;
    
    if (confirm('Are you sure you want to delete this water intake log?')) {
        firebase.database().ref(`waterIntake/${userId}/${date}`).remove()
            .then(() => {
                showAlert('Water log deleted successfully', 'success');
                loadWaterData(userId); // Reload the data
            })
            .catch(error => {
                console.error('Error deleting water log:', error);
                showAlert('Failed to delete water log', 'danger');
            });
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateString === today.toISOString().split('T')[0]) {
        return 'Today';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
        return 'Yesterday';
    }
    return date.toLocaleDateString();
}

function formatTime(timeString) {
    return new Date(timeString).toLocaleTimeString();
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-50 start-50 translate-middle`;
    alertDiv.style.zIndex = "9999";
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
} 