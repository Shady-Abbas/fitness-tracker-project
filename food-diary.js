const USDA_API_KEY = 'vnjroyiLPgMKRfIVSVDpKjnyGSIIj3kvpcNzgiL7';

// Global variables to store current state
let currentMeal = '';
let selectedDate = new Date();
let CUSTOM_FOODS = [];

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
            loadCustomFoods();  // Add this line here
            initializeFoodDiary();
            loadFoodEntries(selectedDate);
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

function initializeFoodDiary() {
    // Initialize modals
    const addFoodModal = document.getElementById('addFoodModal');
    const createFoodModal = document.getElementById('createFoodModal');
    
    if (addFoodModal) {
        // Initialize Bootstrap modals
        const addModal = new bootstrap.Modal(addFoodModal);
        const createModal = createFoodModal ? new bootstrap.Modal(createFoodModal) : null;
        
        // Add meal buttons event listeners
        document.querySelectorAll('.add-food-btn').forEach(button => {
            button.addEventListener('click', function() {
                currentMeal = this.dataset.meal;
                const mealTitle = document.getElementById('currentMealTitle');
                if (mealTitle) {
                    mealTitle.textContent = currentMeal;
                }
                addModal.show();
            });
        });
    }

        // Add form submission handler for custom foods
        document.getElementById('createFoodForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const userId = firebase.auth().currentUser.uid;
            const foodData = {
                name: document.getElementById('foodName').value,
                servingSize: parseFloat(document.getElementById('servingSize').value),
                servingUnit: document.getElementById('servingUnit').value,
                calories: parseFloat(document.getElementById('calories').value),
                protein: parseFloat(document.getElementById('protein').value),
                carbs: parseFloat(document.getElementById('carbs').value),
                fat: parseFloat(document.getElementById('fat').value),
                isCustom: true,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
        
            // Add to Firebase
            firebase.database().ref(`customFoods/${userId}`).push(foodData)
                .then(() => {
                    // Hide create food modal
                    bootstrap.Modal.getInstance(document.getElementById('createFoodModal')).hide();
                    
                    // Show the add food modal again
                    const addModal = new bootstrap.Modal(document.getElementById('addFoodModal'));
                    addModal.show();
                    
                    // Show success message
                    showAlert('Custom food created successfully!', 'success');
                    
                    // Clear the form
                    e.target.reset();
                    
                    // Reload custom foods
                    loadCustomFoods();
                    
                    // Trigger a search to show the newly added food
                    const searchInput = document.getElementById('foodSearch');
                    if (searchInput.value) {
                        searchFoods(searchInput.value);
                    }
                })
                .catch(error => {
                    console.error('Error creating custom food:', error);
                    showAlert('Failed to create custom food. Please try again.', 'danger');
                });
        });

    // Set up search functionality
    const foodSearch = document.getElementById('foodSearch');
    if (foodSearch) {
        foodSearch.addEventListener('input', debounce(function(e) {
            searchFoods(e.target.value);
        }, 300));
    }
}

function loadCustomFoods() {
    const userId = firebase.auth().currentUser.uid;
    firebase.database().ref(`customFoods/${userId}`).once('value')
        .then((snapshot) => {
            CUSTOM_FOODS = [];
            snapshot.forEach((childSnapshot) => {
                CUSTOM_FOODS.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
        })
        .catch(error => {
            console.error('Error loading custom foods:', error);
        });
}

async function searchFoods(query) {
    if (!query) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }

    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';

    try {
        // First, search custom foods
        const customResults = CUSTOM_FOODS.filter(food => 
            food.name.toLowerCase().includes(query.toLowerCase())
        );

        // Then, search USDA database
        const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=10`);
        const data = await response.json();
        
        // Combine and display results
        const usdaFoods = data.foods.map(food => ({
            name: food.description,
            servingSize: 100,
            servingUnit: 'g',
            calories: food.foodNutrients.find(n => n.nutrientId === 1008)?.value || 0,
            protein: food.foodNutrients.find(n => n.nutrientId === 1003)?.value || 0,
            carbs: food.foodNutrients.find(n => n.nutrientId === 1005)?.value || 0,
            fat: food.foodNutrients.find(n => n.nutrientId === 1004)?.value || 0,
            isCustom: false
        }));

        const allFoods = [...customResults, ...usdaFoods];
        displaySearchResults(allFoods);

    } catch (error) {
        console.error('Error searching foods:', error);
        searchResults.innerHTML = '<div class="alert alert-danger">Error searching foods. Please try again.</div>';
    }
}

function displaySearchResults(foods) {
    const searchResults = document.getElementById('searchResults');
    
    if (foods.length === 0) {
        searchResults.innerHTML = '<p class="text-muted">No foods found</p>';
        return;
    }

    const resultsHtml = foods.map(food => `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <button type="button" class="btn btn-link text-start p-0 border-0 flex-grow-1" 
                        onclick="selectFood(${JSON.stringify(food).replace(/"/g, '&quot;')})">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${food.name}</strong>
                            ${food.isCustom ? '<span class="badge bg-primary ms-2">Custom</span>' : ''}
                            <br>
                            <small class="text-muted">${food.servingSize} ${food.servingUnit}</small>
                        </div>
                        <div class="text-end">
                            <div>${Math.round(food.calories)} cal</div>
                            <small class="text-muted">
                                P: ${Math.round(food.protein)}g | C: ${Math.round(food.carbs)}g | F: ${Math.round(food.fat)}g
                            </small>
                        </div>
                    </div>
                </button>
                ${food.isCustom ? `
                    <button class="btn btn-sm btn-outline-danger ms-2" 
                            onclick="deleteCustomFood('${food.id}')" 
                            title="Delete custom food">
                        <i class="bi bi-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');

    searchResults.innerHTML = `<div class="list-group">${resultsHtml}</div>`;
}

function deleteCustomFood(foodId) {
    if (!confirm('Are you sure you want to delete this custom food?')) {
        return;
    }

    const userId = firebase.auth().currentUser.uid;
    firebase.database().ref(`customFoods/${userId}/${foodId}`).remove()
        .then(() => {
            showAlert('Custom food deleted successfully!', 'success');
            loadCustomFoods();
            const searchInput = document.getElementById('foodSearch');
            if (searchInput.value) {
                searchFoods(searchInput.value);
            }
        })
        .catch(error => {
            console.error('Error deleting custom food:', error);
            showAlert('Failed to delete custom food. Please try again.', 'danger');
        });
}

function selectFood(food) {
    const userId = firebase.auth().currentUser.uid;
    const dateKey = selectedDate.toISOString().split('T')[0];
    
    // Add the food entry to Firebase
    const foodEntryRef = firebase.database().ref(`foodEntries/${userId}/${dateKey}/${currentMeal}`);
    
    const entry = {
        ...food,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    foodEntryRef.push(entry)
        .then(() => {
            // Hide the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addFoodModal'));
            modal.hide();
            
            // Show success message
            showAlert('Food added successfully!', 'success');
            
            // Refresh the food entries display
            loadFoodEntries(selectedDate);
        })
        .catch(error => {
            console.error('Error adding food entry:', error);
            showAlert('Failed to add food. Please try again.', 'danger');
        });
}

function loadFoodEntries(date) {
    const userId = firebase.auth().currentUser.uid;
    const dateKey = date.toISOString().split('T')[0];
    const entriesRef = firebase.database().ref(`foodEntries/${userId}/${dateKey}`);
    
    entriesRef.once('value')
        .then(snapshot => {
            const entries = snapshot.val() || {};
            displayFoodEntries(entries);
            updateTotalNutrition(entries);
        })
        .catch(error => {
            console.error('Error loading food entries:', error);
            showAlert('Failed to load food entries. Please try again.', 'danger');
        });
}

function displayFoodEntries(entries) {
    const meals = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    meals.forEach(meal => {
        const mealEntries = entries[meal] || {};
        const mealList = document.getElementById(`${meal}List`);
        
        let html = '';
        Object.entries(mealEntries).forEach(([entryId, entry]) => {
            html += `
                <div class="food-entry d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>${entry.name}</strong>
                        <br>
                        <small class="text-muted">${entry.servingSize} ${entry.servingUnit}</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <div class="text-end me-3">
                            <div>${Math.round(entry.calories)} cal</div>
                            <small class="text-muted">
                                P: ${Math.round(entry.protein)}g | C: ${Math.round(entry.carbs)}g | F: ${Math.round(entry.fat)}g
                            </small>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteFood('${meal}', '${entryId}')" 
                                title="Delete food">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        mealList.innerHTML = html || '<p class="text-muted">No foods added yet</p>';
    });
}

function updateTotalNutrition(entries) {
    const totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };
    
    Object.values(entries).forEach(meal => {
        Object.values(meal).forEach(entry => {
            totals.calories += entry.calories;
            totals.protein += entry.protein;
            totals.carbs += entry.carbs;
            totals.fat += entry.fat;
        });
    });

    // Update the display
    document.getElementById('totalCalories').textContent = totals.calories;
    document.getElementById('totalProtein').textContent = `${totals.protein}g`;
    document.getElementById('totalCarbs').textContent = `${totals.carbs}g`;
    document.getElementById('totalFat').textContent = `${totals.fat}g`;
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

function showCreateFoodModal() {
    // Hide the add food modal
    const addFoodModal = bootstrap.Modal.getInstance(document.getElementById('addFoodModal'));
    addFoodModal.hide();
    
    // Show the create food modal
    const createFoodModal = new bootstrap.Modal(document.getElementById('createFoodModal'));
    createFoodModal.show();
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
    alertDiv.style.zIndex = "9999"; // Ensure it appears above other elements
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    // Auto dismiss after 3 seconds (reduced from 5 for better UX)
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
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
        loadFoodEntries(selectedDate);
    });

    // Next day button
    document.getElementById('nextDay').addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        currentDateElement.textContent = selectedDate.toLocaleDateString();
        loadFoodEntries(selectedDate);
    });
}

function deleteFood(meal, entryId) {
    if (confirm('Are you sure you want to delete this food entry?')) {
        const userId = firebase.auth().currentUser.uid;
        const dateKey = selectedDate.toISOString().split('T')[0];
        
        // Remove the food entry from Firebase
        firebase.database()
            .ref(`foodEntries/${userId}/${dateKey}/${meal}/${entryId}`)
            .remove()
            .then(() => {
                showAlert('Food entry deleted successfully!', 'success');
                loadFoodEntries(selectedDate); // Refresh the display
            })
            .catch(error => {
                console.error('Error deleting food entry:', error);
                showAlert('Failed to delete food entry. Please try again.', 'danger');
            });
    }
}

