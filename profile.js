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
            
            // Set basic profile info
            document.getElementById('username').textContent = user.displayName || 'User';
            document.getElementById('profileDisplayName').textContent = user.displayName || 'User';
            
            // Set member since date
            const memberSince = new Date(user.metadata.creationTime);
            document.getElementById('memberSince').textContent = 
                `Member since: ${memberSince.toLocaleDateString()}`;

            // Load all user data
            loadUserData(user.uid);
            loadWeightProgress(user.uid);
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
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

function loadUserData(userId) {
    // Load weight progress
    loadWeightProgress(userId);
    // Load achievements
    loadAchievements(userId);
    // Load recent activity
    loadRecentActivity(userId);
}

function loadWeightProgress(userId) {
    Promise.all([
        firebase.database().ref(`users/${userId}`).once('value'),
        firebase.database().ref(`goals/${userId}`).once('value'),
        firebase.database().ref(`measurements/${userId}`)
            .orderByChild('timestamp')
            .limitToLast(1)
            .once('value')
    ]).then(([userSnapshot, goalsSnapshot, measurementsSnapshot]) => {
        const userData = userSnapshot.val();
        const goals = goalsSnapshot.val();
        let currentWeight = null;
        
        // Get current weight from measurements
        measurementsSnapshot.forEach(childSnapshot => {
            currentWeight = childSnapshot.val().weight;
        });

        if (userData && userData.weight && goals && goals.targetWeight && currentWeight) {
            const initialWeight = userData.weight; // Using weight from settings
            const targetWeight = goals.targetWeight;

            // Display values
            document.getElementById('currentWeight').textContent = `${currentWeight} kg`;
            document.getElementById('targetWeight').textContent = `${targetWeight} kg`;

            // Calculate progress
            const progress = calculateWeightProgress(currentWeight, targetWeight, initialWeight);
            
            document.getElementById('weightProgress').textContent = `${progress}%`;
            document.getElementById('weightProgressBar').style.width = `${progress}%`;
        } else {
            // Handle missing data
            document.getElementById('currentWeight').textContent = '-- kg';
            document.getElementById('targetWeight').textContent = '-- kg';
            document.getElementById('weightProgress').textContent = '--%';
            document.getElementById('weightProgressBar').style.width = '0%';
        }
    }).catch(error => {
        console.error('Error loading weight progress:', error);
        document.getElementById('currentWeight').textContent = '-- kg';
        document.getElementById('targetWeight').textContent = '-- kg';
        document.getElementById('weightProgress').textContent = '--%';
        document.getElementById('weightProgressBar').style.width = '0%';
    });
}

function loadAchievements(userId) {
    Promise.all([
        firebase.database().ref(`exerciseEntries/${userId}`).once('value'),
        firebase.database().ref(`goals/${userId}`).once('value'),
        firebase.database().ref(`measurements/${userId}`).once('value')
    ]).then(([exerciseSnapshot, goalsSnapshot, measurementsSnapshot]) => {
        const achievements = [];
        
        // Exercise completion achievements
        const exercises = exerciseSnapshot.val() || {};
        const exerciseCount = Object.keys(exercises).length;
        
        if (exerciseCount >= 1) achievements.push({
            icon: 'bi-trophy',
            title: 'First Workout',
            description: 'Completed your first exercise'
        });
        if (exerciseCount >= 10) achievements.push({
            icon: 'bi-trophy-fill',
            title: 'Dedicated Athlete',
            description: 'Completed 10 workouts'
        });
        if (exerciseCount >= 50) achievements.push({
            icon: 'bi-trophy-fill',
            title: 'Fitness Warrior',
            description: 'Completed 50 workouts'
        });

        // Weight goal achievements
        const goals = goalsSnapshot.val();
        const measurements = measurementsSnapshot.val() || {};
        const measurementArray = Object.values(measurements);
        
        if (goals && measurementArray.length > 0) {
            const targetWeight = goals.targetWeight;
            const currentWeight = measurementArray[measurementArray.length - 1].weight;
            const initialWeight = goals.initialWeight || measurementArray[0].weight;

            if (initialWeight > targetWeight) {
                // Weight loss achievements
                const weightLost = initialWeight - currentWeight;
                if (weightLost >= 5) achievements.push({
                    icon: 'bi-star-fill',
                    title: '5kg Down!',
                    description: 'Lost your first 5kg'
                });
                if (weightLost >= 10) achievements.push({
                    icon: 'bi-stars',
                    title: 'Major Progress',
                    description: 'Lost 10kg'
                });
            } else {
                // Weight gain achievements
                const weightGained = currentWeight - initialWeight;
                if (weightGained >= 5) achievements.push({
                    icon: 'bi-star-fill',
                    title: '5kg Gained!',
                    description: 'Gained your first 5kg'
                });
                if (weightGained >= 10) achievements.push({
                    icon: 'bi-stars',
                    title: 'Major Progress',
                    description: 'Gained 10kg'
                });
            }
        }

        // Display achievements
        const achievementsList = document.getElementById('achievementsList');
        achievementsList.innerHTML = achievements.map(achievement => `
            <div class="col-md-4 mb-3">
                <div class="card h-100">
                    <div class="card-body text-center">
                        <i class="bi ${achievement.icon} display-4 text-primary mb-2"></i>
                        <h5 class="card-title">${achievement.title}</h5>
                        <p class="card-text">${achievement.description}</p>
                    </div>
                </div>
            </div>
        `).join('');

        if (achievements.length === 0) {
            achievementsList.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No achievements yet. Keep working towards your goals!</p>
                </div>
            `;
        }
    }).catch(error => {
        console.error('Error loading achievements:', error);
    });
}

function loadRecentActivity(userId) {
    Promise.all([
        firebase.database().ref(`measurements/${userId}`).orderByKey().limitToLast(5).once('value'),
        firebase.database().ref(`goals/${userId}`).once('value')
    ]).then(([measurementsSnapshot, goalsSnapshot]) => {
        const measurements = measurementsSnapshot.val() || {};
        const goals = goalsSnapshot.val();
        const activities = [];

        // Add weight updates to activities
        Object.entries(measurements).forEach(([date, measurement]) => {
            activities.push({
                type: 'weight',
                date: new Date(date),
                value: measurement.weight,
                description: `Updated weight to ${measurement.weight}kg`
            });
        });

        // Add achievement activities based on weight progress
        if (goals && Object.keys(measurements).length > 0) {
            const targetWeight = goals.targetWeight;
            const initialWeight = goals.initialWeight || Object.values(measurements)[0].weight;
            const currentWeight = Object.values(measurements)[Object.values(measurements).length - 1].weight;

            if (initialWeight > targetWeight) {
                // Weight loss achievements
                const weightLost = initialWeight - currentWeight;
                if (weightLost >= 5) {
                    activities.push({
                        type: 'achievement',
                        date: new Date(),
                        description: 'Achievement: Lost 5kg!'
                    });
                }
                if (weightLost >= 10) {
                    activities.push({
                        type: 'achievement',
                        date: new Date(),
                        description: 'Achievement: Lost 10kg!'
                    });
                }
            } else {
                // Weight gain achievements
                const weightGained = currentWeight - initialWeight;
                if (weightGained >= 5) {
                    activities.push({
                        type: 'achievement',
                        date: new Date(),
                        description: 'Achievement: Gained 5kg!'
                    });
                }
                if (weightGained >= 10) {
                    activities.push({
                        type: 'achievement',
                        date: new Date(),
                        description: 'Achievement: Gained 10kg!'
                    });
                }
            }
        }

        // Sort activities by date
        activities.sort((a, b) => b.date - a.date);

        // Display activities
        const recentActivity = document.getElementById('recentActivity');
        recentActivity.innerHTML = activities.map(activity => `
            <div class="activity-item mb-3">
                <div class="d-flex align-items-center">
                    <i class="bi ${activity.type === 'weight' ? 'bi-clipboard-data' : 'bi-trophy'} 
                       text-primary me-3"></i>
                    <div>
                        <p class="mb-0">${activity.description}</p>
                        <small class="text-muted">${activity.date.toLocaleDateString()}</small>
                    </div>
                </div>
            </div>
        `).join('');

        if (activities.length === 0) {
            recentActivity.innerHTML = `
                <p class="text-muted text-center">No recent activity to show.</p>
            `;
        }
    }).catch(error => {
        console.error('Error loading recent activity:', error);
    });
}

function calculateWeightProgress(currentWeight, targetWeight, initialWeight) {
    // If losing weight
    if (initialWeight > targetWeight) {
        const totalChange = initialWeight - targetWeight;
        const currentChange = initialWeight - currentWeight;
        return Math.round((currentChange / totalChange) * 100);
    }
    // If gaining weight
    else {
        const totalChange = targetWeight - initialWeight;
        const currentChange = currentWeight - initialWeight;
        return Math.round((currentChange / totalChange) * 100);
    }
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