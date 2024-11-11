let weightChart = null;
let bodyFatChart = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            loadUserData(user.uid);
            loadMeasurements(user.uid);
            loadGoals(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    // Handle measurement form submission
    document.getElementById('measurementForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveMeasurement();
    });

    // Handle goals form submission
    document.getElementById('goalsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveGoals();
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

    // Set default date to today
    document.getElementById('measurementDate').value = new Date().toISOString().split('T')[0];
    
    // Set max date to today (prevent future dates)
    document.getElementById('measurementDate').max = new Date().toISOString().split('T')[0];
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

function loadUserData(userId) {
    const userRef = firebase.database().ref('users/' + userId);
    userRef.once('value').then((snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            document.getElementById('username').textContent = userData.username;
        }
    }).catch((error) => {
        console.error('Error loading user data:', error);
    });
}

function saveMeasurement() {
    const user = firebase.auth().currentUser;
    const weight = parseFloat(document.getElementById('weight').value);
    const bodyFat = parseFloat(document.getElementById('bodyFat').value) || null;
    // Get the selected date or use current date if none selected
    const selectedDate = document.getElementById('measurementDate').value || new Date().toISOString().split('T')[0];

    firebase.database().ref(`measurements/${user.uid}/${selectedDate}`).set({
        weight: weight,
        bodyFat: bodyFat,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showAlert('Measurement saved successfully!', 'success');
        loadMeasurements(user.uid);
        document.getElementById('measurementForm').reset();
        // Set the date input to today's date after reset
        document.getElementById('measurementDate').value = new Date().toISOString().split('T')[0];
    }).catch(error => {
        console.error('Error saving measurement:', error);
        showAlert('Failed to save measurement. Please try again.', 'danger');
    });
}

function loadMeasurements(userId) {
    firebase.database().ref(`measurements/${userId}`)
        .orderByChild('timestamp')
        .limitToLast(30) // Last 30 measurements
        .once('value')
        .then(snapshot => {
            const measurements = [];
            snapshot.forEach(childSnapshot => {
                measurements.push({
                    date: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            updateMeasurementHistory(measurements);
            updateCharts(measurements);
        })
        .catch(error => {
            console.error('Error loading measurements:', error);
            showAlert('Failed to load measurements', 'danger');
        });
}

function updateMeasurementHistory(measurements) {
    const tbody = document.getElementById('measurementHistory');
    tbody.innerHTML = '';

    measurements.sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(measurement => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(measurement.date).toLocaleDateString()}</td>
                <td>${measurement.weight.toFixed(1)}</td>
                <td>${measurement.bodyFat ? measurement.bodyFat.toFixed(1) : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteMeasurement('${measurement.date}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
}

function updateCharts(measurements) {
    // Sort measurements by date
    measurements.sort((a, b) => new Date(a.date) - new Date(b.date));

    const dates = measurements.map(m => new Date(m.date).toLocaleDateString());
    const weights = measurements.map(m => m.weight);
    const bodyFats = measurements.map(m => m.bodyFat);

    // Destroy existing charts if they exist
    if (weightChart) weightChart.destroy();
    if (bodyFatChart) bodyFatChart.destroy();

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
            },
            title: {
                color: textColor,
                display: true
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: {
                    color: gridColor
                },
                ticks: {
                    color: textColor
                },
                title: {
                    display: true,
                    color: textColor
                }
            },
            x: {
                grid: {
                    color: gridColor
                },
                ticks: {
                    color: textColor
                },
                title: {
                    display: true,
                    text: 'Date',
                    color: textColor
                }
            }
        }
    };

    // Weight Chart
    const weightCtx = document.getElementById('weightChart').getContext('2d');
    weightChart = new Chart(weightCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Weight (kg)',
                data: weights,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: {
                    ...commonOptions.plugins.title,
                    text: 'Weight Progress'
                }
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        ...commonOptions.scales.y.title,
                        text: 'Weight (kg)'
                    }
                }
            }
        }
    });

    // Body Fat Chart
    const bodyFatCtx = document.getElementById('bodyFatChart').getContext('2d');
    bodyFatChart = new Chart(bodyFatCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Body Fat %',
                data: bodyFats,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            ...commonOptions,
            plugins: {
                ...commonOptions.plugins,
                title: {
                    ...commonOptions.plugins.title,
                    text: 'Body Fat % Progress'
                }
            },
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        ...commonOptions.scales.y.title,
                        text: 'Body Fat %'
                    }
                }
            }
        }
    });
}

function deleteMeasurement(date) {
    if (confirm('Are you sure you want to delete this measurement?')) {
        const user = firebase.auth().currentUser;
        firebase.database().ref(`measurements/${user.uid}/${date}`).remove()
            .then(() => {
                showAlert('Measurement deleted successfully!', 'success');
                loadMeasurements(user.uid);
            })
            .catch(error => {
                console.error('Error deleting measurement:', error);
                showAlert('Failed to delete measurement', 'danger');
            });
    }
}

function saveGoals() {
    const user = firebase.auth().currentUser;
    const targetWeight = parseFloat(document.getElementById('targetWeight').value);
    const goalType = document.getElementById('goalType').value;

    firebase.database().ref(`goals/${user.uid}`).set({
        targetWeight: targetWeight,
        goalType: goalType,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showAlert('Goals saved successfully!', 'success');
        loadGoals(user.uid);
    }).catch(error => {
        console.error('Error saving goals:', error);
        showAlert('Failed to save goals. Please try again.', 'danger');
    });
}

function loadGoals(userId) {
    firebase.database().ref(`goals/${userId}`).once('value')
        .then(snapshot => {
            const goals = snapshot.val();
            if (goals) {
                document.getElementById('targetWeight').value = goals.targetWeight;
                document.getElementById('goalType').value = goals.goalType;
            }
        })
        .catch(error => {
            console.error('Error loading goals:', error);
            showAlert('Failed to load goals', 'danger');
        });
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