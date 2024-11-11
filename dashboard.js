document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Set username immediately from localStorage
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
        document.getElementById('username').textContent = savedUsername;
        document.getElementById('welcomeUsername').textContent = savedUsername;
    }

    // Check authentication state
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Load user data to ensure it's up to date
            loadUserData(user.uid);
            loadDashboardData(user.uid);

            const today = new Date().toISOString().split('T')[0];
            loadDailyProgress(user.uid, today);
            loadWeeklyProgress(user.uid);
        } else {
            // No user is signed in, redirect to login
            window.location.href = 'index.html';
        }
    });

    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        firebase.auth().signOut()
            .then(() => {
                // Clear stored data
                localStorage.removeItem('username');
                localStorage.removeItem('theme');
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('Logout Error:', error);
                showAlert('Failed to log out. Please try again.', 'danger');
            });
    });

    // Add settings link handler
    document.querySelector('a[href="settings.html"]').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = 'settings.html';
    });
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// Load user data from Firebase
function loadUserData(userId) {
    const userRef = firebase.database().ref('users/' + userId);
    userRef.once('value').then((snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            // Update stored username if it's different
            if (userData.username && userData.username !== localStorage.getItem('username')) {
                localStorage.setItem('username', userData.username);
                document.getElementById('username').textContent = userData.username;
                document.getElementById('welcomeUsername').textContent = userData.username;
            }
        }
    }).catch((error) => {
        console.error('Error loading user data:', error);
        showAlert('Failed to load user data', 'danger');
    });
}

// Load dashboard-specific data
function loadDashboardData(userId) {
    const today = new Date().toISOString().split('T')[0];
    console.log('Loading dashboard data for date:', today);
    
    Promise.all([
        loadUserGoals(userId),
        loadTodaysFoodEntries(userId, today),
        loadTodaysExerciseData(userId, today),
        loadWaterIntake(userId, today),
        loadMacronutrients(userId, today) 
    ]).catch(error => {
        console.error('Error loading dashboard data:', error);
        showAlert('Failed to load some dashboard data', 'danger');
    });
}

function loadUserGoals(userId) {
    return firebase.database().ref(`users/${userId}`).once('value')
        .then((snapshot) => {
            const userData = snapshot.val() || {};
            const nutritionalGoals = userData.nutritionalGoals || {};
            
            // Update calorie goal display
            if (document.getElementById('calorieGoal')) {
                document.getElementById('calorieGoal').textContent = 
                    nutritionalGoals.calories || '2000'; // Default to 2000 only if no goal is set
            }

            // Update remaining calories if needed
            updateRemainingCalories();
            return nutritionalGoals;
        })
        .catch(error => {
            console.error('Error loading user goals:', error);
            showAlert('Failed to load user goals', 'danger');
        });
}

function loadTodaysFoodEntries(userId, today) {
    return firebase.database().ref(`foodEntries/${userId}/${today}`).once('value')
        .then((snapshot) => {
            const entries = snapshot.val() || {};
            let totalCalories = 0;
            let totalProtein = 0;
            let totalCarbs = 0;
            let totalFat = 0;

            // Sum up all nutritional values from all meals
            Object.values(entries).forEach(meal => {
                if (meal) {
                    Object.values(meal).forEach(entry => {
                        totalCalories += entry.calories || 0;
                        totalProtein += entry.protein || 0;
                        totalCarbs += entry.carbs || 0;
                        totalFat += entry.fat || 0;
                    });
                }
            });

            // Update nutrition display
            if (document.getElementById('totalCalories')) {
                document.getElementById('totalCalories').textContent = Math.round(totalCalories);
            }

            // Update remaining calories
            updateRemainingCalories();
        });
}

function updateRemainingCalories() {
    const calorieGoal = parseInt(document.getElementById('calorieGoal')?.textContent || '0');
    const totalCaloriesConsumed = parseInt(document.getElementById('totalCalories')?.textContent || '0');
    
    const remaining = calorieGoal - totalCaloriesConsumed;
    
    if (document.getElementById('remainingCalories')) {
        document.getElementById('remainingCalories').textContent = Math.max(0, remaining);
    }

    // Update progress bar
    const progressBar = document.querySelector('.calories-remaining .calories-progress');
    if (progressBar) {
        const percentage = Math.min(100, (totalCaloriesConsumed / calorieGoal) * 100);
        progressBar.style.width = `${percentage || 0}%`;
        
        // Update color based on percentage
        progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
        if (percentage > 100) {
            progressBar.classList.add('bg-danger');
        } else if (percentage > 85) {
            progressBar.classList.add('bg-warning');
        } else {
            progressBar.classList.add('bg-success');
        }
    }
}

function loadTodaysExerciseData(userId, today) {
    console.log('Loading exercise data for:', today);
    
    return firebase.database().ref(`exerciseEntries/${userId}/${today}`).once('value')
        .then((snapshot) => {
            const exercises = snapshot.val() || {};
            console.log('Retrieved exercises:', exercises);
            
            let totalDuration = 0;
            let totalCalories = 0;
            let lastActivity = null;
            let lastActivityTimestamp = 0;

            // Calculate totals and find the most recent activity
            Object.entries(exercises).forEach(([key, exercise]) => {
                console.log('Processing exercise:', exercise);
                
                totalDuration += parseInt(exercise.duration) || 0;
                
                // Calculate calories based on exercise type
                if (exercise.category === 'cardio' && exercise.metValue) {
                    totalCalories += (exercise.metValue * 70 * (exercise.duration / 60));
                } else if (exercise.category === 'strength') {
                    // Use base MET value of 4.5 for strength training
                    totalCalories += (4.5 * 70 * (exercise.duration / 60));
                }

                // Track most recent activity using Firebase's push ID as timestamp
                // Firebase push IDs are chronological, so we can use them for ordering
                if (!lastActivity || key > lastActivityTimestamp) {
                    lastActivityTimestamp = key;
                    lastActivity = exercise;
                }
            });

            console.log('Total duration:', totalDuration);
            console.log('Total calories:', totalCalories);
            console.log('Last activity:', lastActivity);

            // Update exercise card on dashboard
            if (document.getElementById('exerciseDuration')) {
                const numExercises = Object.keys(exercises).length;
                document.getElementById('exerciseDuration').textContent = 
                    numExercises > 0 ? `${numExercises} activities` : '--';
            }

            if (document.getElementById('exerciseMinutes')) {
                document.getElementById('exerciseMinutes').textContent = `${totalDuration} min`;
            }

            if (document.getElementById('exerciseCalories')) {
                document.getElementById('exerciseCalories').textContent = `${Math.round(totalCalories)} kcal`;
            }

            if (document.getElementById('lastExercise')) {
                if (lastActivity) {
                    const activityText = `${lastActivity.name} - ${lastActivity.duration}min`;
                    document.getElementById('lastExercise').textContent = activityText;
                } else {
                    document.getElementById('lastExercise').textContent = 'No recent activity';
                }
            }
        })
        .catch(error => {
            console.error('Error loading exercise data:', error);
            showAlert('Failed to load exercise data', 'danger');
        });
}

function loadWaterIntake(userId, today) {
    // First get the user's water goal
    return firebase.database().ref(`users/${userId}/waterGoal`).once('value')
        .then((goalSnapshot) => {
            const waterGoal = goalSnapshot.val() || 8; // Default to 8 if not set
            
            // Then get today's water intake
            return firebase.database().ref(`waterIntake/${userId}/${today}`).once('value')
                .then((intakeSnapshot) => {
                    const waterData = intakeSnapshot.val() || { glasses: 0 };
                    
                    // Update water intake display
                    if (document.getElementById('waterIntake')) {
                        document.getElementById('waterIntake').textContent = 
                            `${waterData.glasses}/${waterGoal}`;
                    }

                    // Update progress bar
                    const progressBar = document.querySelector('.water-intake .water-progress');
                    if (progressBar) {
                        const percentage = Math.min(100, (waterData.glasses / waterGoal) * 100);
                        progressBar.style.width = `${percentage}%`;
                        
                        // Update progress bar color based on progress
                        progressBar.classList.remove('bg-danger', 'bg-warning', 'bg-info');
                        if (percentage < 33) {
                            progressBar.classList.add('bg-danger');
                        } else if (percentage < 66) {
                            progressBar.classList.add('bg-warning');
                        } else {
                            progressBar.classList.add('bg-info');
                        }
                    }
                });
        })
        .catch(error => {
            console.error('Error loading water data:', error);
            showAlert('Failed to load water intake data', 'danger');
        });
}

function loadMacronutrients(userId, today) {
    console.log('Loading macronutrients for:', today);
    
    // First get the user's macro goals
    return firebase.database().ref(`users/${userId}`).once('value')
        .then((userSnapshot) => {
            const userData = userSnapshot.val() || {};
            const goals = {
                protein: userData.proteinGoal || 150, // Default values if not set
                carbs: userData.carbsGoal || 200,
                fat: userData.fatGoal || 65
            };
            
            // Then get today's food entries
            return firebase.database().ref(`foodEntries/${userId}/${today}`).once('value')
                .then((foodSnapshot) => {
                    const foodEntries = foodSnapshot.val() || {};
                    
                    // Calculate totals from all meals
                    const consumed = {
                        protein: 0,
                        carbs: 0,
                        fat: 0
                    };

                    // Sum up all meals
                    Object.values(foodEntries).forEach(meal => {
                        if (meal) {
                            Object.values(meal).forEach(entry => {
                                consumed.protein += entry.protein || 0;
                                consumed.carbs += entry.carbs || 0;
                                consumed.fat += entry.fat || 0;
                            });
                        }
                    });

                    // Calculate remaining macros
                    const remaining = {
                        protein: Math.max(0, goals.protein - consumed.protein),
                        carbs: Math.max(0, goals.carbs - consumed.carbs),
                        fat: Math.max(0, goals.fat - consumed.fat)
                    };

                    console.log('Macro consumed:', consumed);
                    console.log('Macro goals:', goals);
                    console.log('Macro remaining:', remaining);

                    // Update the display
                    document.getElementById('proteinTotal').textContent = 
                        `${Math.round(remaining.protein)}g left`;
                    document.getElementById('carbsTotal').textContent = 
                        `${Math.round(remaining.carbs)}g left`;
                    document.getElementById('fatTotal').textContent = 
                        `${Math.round(remaining.fat)}g left`;

                    // Update progress bars (showing consumed percentage)
                    document.getElementById('proteinProgress').style.width = 
                        `${Math.min(100, (consumed.protein / goals.protein) * 100)}%`;
                    document.getElementById('carbsProgress').style.width = 
                        `${Math.min(100, (consumed.carbs / goals.carbs) * 100)}%`;
                    document.getElementById('fatProgress').style.width = 
                        `${Math.min(100, (consumed.fat / goals.fat) * 100)}%`;
                });
        })
        .catch(error => {
            console.error('Error loading macronutrient data:', error);
            showAlert('Failed to load macronutrient data', 'danger');
        });
}

function loadDailyProgress(userId, today) {
    Promise.all([
        firebase.database().ref(`foodEntries/${userId}/${today}`).once('value'),
        firebase.database().ref(`waterIntake/${userId}/${today}`).once('value'),
        firebase.database().ref(`users/${userId}`).once('value')  // Changed path to match loadMacronutrients
    ]).then(([foodSnapshot, waterSnapshot, userSnapshot]) => {
        const userData = userSnapshot.val() || {};
        const foodEntries = foodSnapshot.val() || {};
        const waterEntries = waterSnapshot.val() || {};

        // Calculate daily totals
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        Object.values(foodEntries).forEach(meal => {
            if (meal) {
                Object.values(meal).forEach(entry => {
                    totalCalories += entry.calories || 0;
                    totalProtein += entry.protein || 0;
                    totalCarbs += entry.carbs || 0;
                    totalFat += entry.fat || 0;
                });
            }
        });

        // Get water intake
        const totalWater = waterEntries.glasses || 0;

        const data = {
            labels: ['Calories', 'Water', 'Protein', 'Carbs', 'Fat'],
            values: [
                Math.min(100, Math.round((totalCalories / (userData.calorieGoal || 2000)) * 100)),
                Math.min(100, Math.round((totalWater / (userData.waterGoal || 8)) * 100)),
                Math.min(100, Math.round((totalProtein / (userData.proteinGoal || 150)) * 100)),
                Math.min(100, Math.round((totalCarbs / (userData.carbsGoal || 200)) * 100)),
                Math.min(100, Math.round((totalFat / (userData.fatGoal || 65)) * 100))
            ]
        };

        console.log('User Data:', userData); // Debug log
        console.log('Calculated values:', data.values); // Debug log

        renderDailyChart(data);
    });
}

function loadWeeklyProgress(userId) {
    const dates = getLast7Days();
    const promises = dates.map(date => 
        Promise.all([
            firebase.database().ref(`foodEntries/${userId}/${date}`).once('value'),
            firebase.database().ref(`waterIntake/${userId}/${date}`).once('value')
        ])
    );

    Promise.all(promises).then(results => {
        const weeklyData = dates.map((date, index) => {
            const [foodSnapshot, waterSnapshot] = results[index];
            const foodEntries = foodSnapshot.val() || {};
            const waterEntries = waterSnapshot.val() || {};

            // Calculate daily totals
            let calories = 0;
            let protein = 0;
            let carbs = 0;
            let fat = 0;
            Object.values(foodEntries).forEach(meal => {
                if (meal) {
                    Object.values(meal).forEach(entry => {
                        calories += entry.calories || 0;
                        protein += entry.protein || 0;
                        carbs += entry.carbs || 0;
                        fat += entry.fat || 0;
                    });
                }
            });

            let water = waterEntries.glasses || 0;

            return {
                date: formatDate(date),
                calories,
                water,
                protein,
                carbs,
                fat
            };
        });

        renderWeeklyChart(weeklyData);
    });
}

function renderDailyChart(data) {
    const ctx = document.getElementById('dailyProgressChart');
    if (!ctx) return;

    // Get current theme
    const isDarkMode = document.body.classList.contains('dark-theme');
    const gridColor = isDarkMode ? '#404040' : '#ddd';
    const textColor = isDarkMode ? '#e0e0e0' : '#666';

    // Common chart options for dark mode
    const commonOptions = {
        responsive: true,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            y: {
                grid: {
                    color: gridColor
                },
                ticks: {
                    color: textColor
                }
            },
            x: {
                grid: {
                    color: gridColor
                },
                ticks: {
                    color: textColor
                }
            }
        }
    };

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Progress (%)',
                data: data.values,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)'
                ]
            }]
        },
        options: commonOptions
    });
}

function renderWeeklyChart(data) {
    const ctx = document.getElementById('weeklyProgressChart');
    if (!ctx) return;

    const isDarkMode = document.body.classList.contains('dark-theme');
    const gridColor = isDarkMode ? '#404040' : '#ddd';
    const textColor = isDarkMode ? '#e0e0e0' : '#666';

    const commonOptions = {
        responsive: true,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            y: {
                grid: {
                    color: gridColor
                },
                ticks: {
                    color: textColor
                }
            },
            x: {
                grid: {
                    color: gridColor
                },
                ticks: {
                    color: textColor
                }
            }
        }
    };

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [
                {
                    label: 'Calories',
                    data: data.map(d => d.calories),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    fill: false
                },
                {
                    label: 'Water (glasses)',
                    data: data.map(d => d.water),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    fill: false
                },
                {
                    label: 'Protein (g)',
                    data: data.map(d => d.protein),
                    borderColor: 'rgba(153, 102, 255, 1)',
                    fill: false
                },
                {
                    label: 'Carbs (g)',
                    data: data.map(d => d.carbs),
                    borderColor: 'rgba(255, 206, 86, 1)',
                    fill: false
                },
                {
                    label: 'Fat (g)',
                    data: data.map(d => d.fat),
                    borderColor: 'rgba(255, 159, 64, 1)',
                    fill: false
                }
            ]
        },
        options: commonOptions
    });
}

// Helper functions
function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Function to show alerts
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