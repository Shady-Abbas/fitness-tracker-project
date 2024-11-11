// Global variables
let selectedDate = new Date();

const EXERCISE_CATEGORIES = {
    'cardio': [
        { name: 'Running', metValue: 8.0, category: 'cardio' },
        { name: 'Walking', metValue: 3.5, category: 'cardio' },
        { name: 'Cycling', metValue: 7.0, category: 'cardio' },
        { name: 'Swimming', metValue: 6.0, category: 'cardio' },
        { name: 'Jump Rope', metValue: 10.0, category: 'cardio' },
        { name: 'Elliptical', metValue: 5.0, category: 'cardio' },
        { name: 'Rowing', metValue: 7.0, category: 'cardio' },
        { name: 'Stair Climbing', metValue: 4.0, category: 'cardio' }
    ],
    'strength': [
        { name: 'Push-ups', category: 'strength', muscleGroup: 'chest' },
        { name: 'Pull-ups', category: 'strength', muscleGroup: 'back' },
        { name: 'Squats', category: 'strength', muscleGroup: 'legs' },
        { name: 'Deadlifts', category: 'strength', muscleGroup: 'back' },
        { name: 'Bench Press', category: 'strength', muscleGroup: 'chest' },
        { name: 'Shoulder Press', category: 'strength', muscleGroup: 'shoulders' },
        { name: 'Lunges', category: 'strength', muscleGroup: 'legs' },
        { name: 'Bicep Curls', category: 'strength', muscleGroup: 'arms' }
    ]
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Settings link handler
    document.querySelector('a[href="settings.html"]').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = 'settings.html';
    });

    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            loadUserData(user.uid);
            initializeExerciseTracker();
            loadExerciseEntries(selectedDate);
        } else {
            window.location.href = 'index.html';
        }
    });

    // Initialize date picker
    initializeDatePicker();

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

function initializeExerciseTracker() {
    // Initialize modal
    const addExerciseModal = document.getElementById('addExerciseModal');
    if (addExerciseModal) {
        const modal = new bootstrap.Modal(addExerciseModal);
        
        // Add exercise button event listener
        document.getElementById('addExerciseBtn').addEventListener('click', () => {
            modal.show();
        });

        // Clear search when modal is hidden
        addExerciseModal.addEventListener('hidden.bs.modal', function () {
            const exerciseSearch = document.getElementById('exerciseSearch');
            const searchResults = document.getElementById('searchResults');
            if (exerciseSearch) exerciseSearch.value = '';
            if (searchResults) searchResults.innerHTML = '';
        });
    }

    // Set up search functionality
    const exerciseSearch = document.getElementById('exerciseSearch');
    if (exerciseSearch) {
        exerciseSearch.addEventListener('input', debounce(function(e) {
            searchExercises(e.target.value);
        }, 300));
    }
}

function searchExercises(query) {
    const searchResults = document.getElementById('searchResults');
    
    // Clear results if query is empty
    if (!query.trim()) {
        searchResults.innerHTML = '';
        return;
    }

    // Search through all exercises
    const results = [];
    Object.values(EXERCISE_CATEGORIES).forEach(category => {
        category.forEach(exercise => {
            if (exercise.name.toLowerCase().includes(query.toLowerCase())) {
                results.push(exercise);
            }
        });
    });

    displaySearchResults(results);
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = '<p class="text-muted">No exercises found</p>';
        return;
    }

    let html = '<div class="list-group">';
    results.forEach(exercise => {
        html += `
            <button type="button" class="list-group-item list-group-item-action" 
                    onclick="selectExercise(${JSON.stringify(exercise).replace(/"/g, '&quot;')})">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${exercise.name}</strong>
                        <br>
                        <small class="text-muted">
                            ${exercise.category === 'cardio' 
                                ? `Cardio • MET ${exercise.metValue}` 
                                : `Strength • ${exercise.muscleGroup}`}
                        </small>
                    </div>
                    <i class="bi bi-chevron-right"></i>
                </div>
            </button>`;
    });
    html += '</div>';
    
    searchResults.innerHTML = html;
}

function selectExercise(exercise) {
    // Hide the search modal
    const addExerciseModal = bootstrap.Modal.getInstance(document.getElementById('addExerciseModal'));
    addExerciseModal.hide();
    
    // Show the details modal
    showExerciseDetailsModal(exercise);
}

function showExerciseDetailsModal(exercise) {
    // Set exercise details in hidden fields
    document.getElementById('exerciseType').value = exercise.category;
    document.getElementById('exerciseName').value = exercise.name;
    document.getElementById('exerciseCategory').value = exercise.category;

    // Update modal title
    document.getElementById('exerciseDetailTitle').textContent = `Log ${exercise.name}`;

    // Show/hide relevant fields based on exercise category
    const cardioFields = document.getElementById('cardioFields');
    const strengthFields = document.getElementById('strengthFields');

    if (exercise.category === 'cardio') {
        cardioFields.classList.remove('d-none');
        strengthFields.classList.add('d-none');
    } else {
        cardioFields.classList.add('d-none');
        strengthFields.classList.remove('d-none');
    }

    // Reset form
    document.getElementById('exerciseDetailsForm').reset();

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('exerciseDetailsModal'));
    modal.show();
}

function saveExercise() {
    const form = document.getElementById('exerciseDetailsForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const exerciseData = {
        name: document.getElementById('exerciseName').value,
        category: document.getElementById('exerciseCategory').value,
        duration: parseInt(document.getElementById('duration').value),
        notes: document.getElementById('exerciseNotes').value || null
    };

    // Add category-specific data
    if (exerciseData.category === 'cardio') {
        exerciseData.distance = document.getElementById('distance').value ? {
            value: parseFloat(document.getElementById('distance').value),
            unit: document.getElementById('distanceUnit').value
        } : null;
        exerciseData.intensity = document.getElementById('intensity').value;
        
        // Find the exercise in EXERCISE_CATEGORIES to get the MET value
        const exercise = EXERCISE_CATEGORIES.cardio.find(e => e.name === exerciseData.name);
        if (exercise) {
            exerciseData.metValue = exercise.metValue;
        }
    } else {
        exerciseData.sets = parseInt(document.getElementById('sets').value) || null;
        exerciseData.reps = parseInt(document.getElementById('reps').value) || null;
        exerciseData.weight = document.getElementById('weight').value ? {
            value: parseFloat(document.getElementById('weight').value),
            unit: document.getElementById('weightUnit').value
        } : null;
    }

    // Save to Firebase
    const userId = firebase.auth().currentUser.uid;
    const dateKey = selectedDate.toISOString().split('T')[0];
    
    firebase.database()
        .ref(`exerciseEntries/${userId}/${dateKey}`)
        .push(exerciseData)
        .then(() => {
            // Hide modal
            bootstrap.Modal.getInstance(document.getElementById('exerciseDetailsModal')).hide();
            
            // Show success message
            showAlert('Exercise logged successfully!', 'success');
            
            // Refresh exercise list
            loadExerciseEntries(selectedDate);
        })
        .catch(error => {
            console.error('Error saving exercise:', error);
            showAlert('Failed to save exercise. Please try again.', 'danger');
        });
}

function loadExerciseEntries(date) {
    const userId = firebase.auth().currentUser.uid;
    const dateKey = date.toISOString().split('T')[0];
    const entriesRef = firebase.database().ref(`exerciseEntries/${userId}/${dateKey}`);
    
    entriesRef.once('value')
        .then(snapshot => {
            const entries = snapshot.val() || {};
            displayExerciseEntries(entries);
            updateExerciseSummary(entries);
        })
        .catch(error => {
            console.error('Error loading exercise entries:', error);
            showAlert('Failed to load exercise entries. Please try again.', 'danger');
        });
}

function displayExerciseEntries(entries) {
    const exerciseList = document.getElementById('exerciseList');
    
    if (Object.keys(entries).length === 0) {
        exerciseList.innerHTML = '<p class="text-muted">No exercises logged yet</p>';
        return;
    }

    let html = '';
    Object.entries(entries).forEach(([id, exercise]) => {
        html += `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="card-title mb-1">${exercise.name}</h5>
                            <p class="card-text text-muted">
                                ${exercise.duration} minutes
                                ${exercise.category === 'cardio' 
                                    ? `• ${exercise.intensity} intensity${exercise.distance ? ` • ${exercise.distance.value} ${exercise.distance.unit}` : ''}`
                                    : `• ${exercise.sets} sets • ${exercise.reps} reps${exercise.weight ? ` • ${exercise.weight.value} ${exercise.weight.unit}` : ''}`
                                }
                            </p>
                            ${exercise.notes ? `<p class="card-text"><small class="text-muted">${exercise.notes}</small></p>` : ''}
                        </div>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteExercise('${id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    });
    
    exerciseList.innerHTML = html;
}

function updateExerciseSummary(entries) {
    let totalDuration = 0;
    let totalExercises = Object.keys(entries).length;
    let caloriesBurned = 0;

    Object.values(entries).forEach(exercise => {
        totalDuration += exercise.duration;
        
        if (exercise.category === 'cardio' && exercise.metValue) {
            // Cardio calculation: MET * weight * time(hours)
            caloriesBurned += (exercise.metValue * 70 * (exercise.duration / 60));
        } else if (exercise.category === 'strength') {
            // Strength training burns approximately 3-6 METs
            // Using 4.5 as a middle ground for strength training
            caloriesBurned += (4.5 * 70 * (exercise.duration / 60));
            
            // Add extra calories for higher intensity (more sets/reps/weight)
            if (exercise.sets && exercise.reps) {
                // Add 10% more calories for every 3 sets
                const setMultiplier = 1 + (Math.floor(exercise.sets / 3) * 0.1);
                caloriesBurned *= setMultiplier;
            }
        }
    });

    document.getElementById('totalDuration').textContent = `${totalDuration} min`;
    document.getElementById('totalCaloriesBurned').textContent = Math.round(caloriesBurned);
    document.getElementById('totalExercises').textContent = totalExercises;
}

function deleteExercise(exerciseId) {
    if (confirm('Are you sure you want to delete this exercise?')) {
        const userId = firebase.auth().currentUser.uid;
        const dateKey = selectedDate.toISOString().split('T')[0];
        
        firebase.database()
            .ref(`exerciseEntries/${userId}/${dateKey}/${exerciseId}`)
            .remove()
            .then(() => {
                showAlert('Exercise deleted successfully!', 'success');
                loadExerciseEntries(selectedDate);
            })
            .catch(error => {
                console.error('Error deleting exercise:', error);
                showAlert('Failed to delete exercise. Please try again.', 'danger');
            });
    }
}

function showCreateExerciseModal() {
    // Hide the add exercise modal
    bootstrap.Modal.getInstance(document.getElementById('addExerciseModal')).hide();
    
    // Reset form
    document.getElementById('createExerciseForm').reset();
    
    // Show create exercise modal
    const modal = new bootstrap.Modal(document.getElementById('createExerciseModal'));
    modal.show();

    // Set up category change handler
    document.getElementById('customExerciseCategory').addEventListener('change', function(e) {
        const cardioFields = document.getElementById('customCardioFields');
        const strengthFields = document.getElementById('customStrengthFields');
        
        if (e.target.value === 'cardio') {
            cardioFields.classList.remove('d-none');
            strengthFields.classList.add('d-none');
        } else if (e.target.value === 'strength') {
            cardioFields.classList.add('d-none');
            strengthFields.classList.remove('d-none');
        } else {
            cardioFields.classList.add('d-none');
            strengthFields.classList.add('d-none');
        }
    });
}

function saveCustomExercise() {
    const form = document.getElementById('createExerciseForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const name = document.getElementById('customExerciseName').value;
    const category = document.getElementById('customExerciseCategory').value;
    
    let exerciseData = {
        name: name,
        category: category,
        isCustom: true
    };

    if (category === 'cardio') {
        exerciseData.metValue = parseFloat(document.getElementById('customMetValue').value) || 5.0;
    } else {
        exerciseData.muscleGroup = document.getElementById('customMuscleGroup').value;
    }

    // Add to appropriate category
    if (!EXERCISE_CATEGORIES[category]) {
        EXERCISE_CATEGORIES[category] = [];
    }
    EXERCISE_CATEGORIES[category].push(exerciseData);

    // Save to Firebase (optional - if you want to persist custom exercises)
    const userId = firebase.auth().currentUser.uid;
    firebase.database()
        .ref(`customExercises/${userId}`)
        .push(exerciseData)
        .then(() => {
            // Hide modal
            bootstrap.Modal.getInstance(document.getElementById('createExerciseModal')).hide();
            
            // Show success message
            showAlert('Custom exercise created successfully!', 'success');
            
            // Show the exercise details modal to log the exercise
            showExerciseDetailsModal(exerciseData);
        })
        .catch(error => {
            console.error('Error saving custom exercise:', error);
            showAlert('Failed to create custom exercise. Please try again.', 'danger');
        });
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...

    // Load custom exercises
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            loadCustomExercises(user.uid);
        }
    });
});

function loadCustomExercises(userId) {
    firebase.database()
        .ref(`customExercises/${userId}`)
        .once('value')
        .then(snapshot => {
            const customExercises = snapshot.val() || {};
            
            // Add custom exercises to the categories
            Object.values(customExercises).forEach(exercise => {
                if (!EXERCISE_CATEGORIES[exercise.category].some(e => e.name === exercise.name)) {
                    EXERCISE_CATEGORIES[exercise.category].push(exercise);
                }
            });
        })
        .catch(error => {
            console.error('Error loading custom exercises:', error);
        });
}

function initializeDatePicker() {
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        currentDateElement.textContent = selectedDate.toLocaleDateString();
    }

    // Previous day button
    document.getElementById('prevDay').addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        currentDateElement.textContent = selectedDate.toLocaleDateString();
        loadExerciseEntries(selectedDate);
    });

    // Next day button
    document.getElementById('nextDay').addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        currentDateElement.textContent = selectedDate.toLocaleDateString();
        loadExerciseEntries(selectedDate);
    });
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

// Utility function to prevent too many search requests
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to show alerts
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-50 start-50 translate-middle text-center`;
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