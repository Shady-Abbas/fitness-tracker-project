document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Set theme select to match current theme
    const themeSelect = document.getElementById('theme');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }

    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Load user's email and display name
            document.getElementById('currentEmail').value = user.email;
            document.getElementById('username').textContent = user.displayName || 'User';
            document.getElementById('displayName').value = user.displayName || '';

            // Check email verification status
            if (user.emailVerified) {
                document.getElementById('emailVerificationStatus').textContent = 'Email verified';
                document.getElementById('emailVerificationStatus').className = 'form-text text-success';
            } else {
                document.getElementById('emailVerificationStatus').textContent = 'Email not verified. Click here to resend verification email.';
                document.getElementById('emailVerificationStatus').className = 'form-text text-warning';
                document.getElementById('emailVerificationStatus').style.cursor = 'pointer';
                document.getElementById('emailVerificationStatus').onclick = resendVerification;
            }

            // Load other user data
            loadUserSettings(user.uid);
        } else {
            // Redirect to login if not authenticated
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

    // Handle Account Settings Form
    document.getElementById('accountSettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const displayName = document.getElementById('displayName').value;
        updateDisplayName(displayName);
    });

    // Handle Password Update
    document.getElementById('updatePasswordBtn').addEventListener('click', function() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        updatePassword(currentPassword, newPassword, confirmNewPassword);
    });

    // Handle Personal Information Form
    document.getElementById('personalInfoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const personalInfo = {
            age: document.getElementById('age').value,
            weight: document.getElementById('weight').value,
            height: document.getElementById('height').value
        };
        updatePersonalInfo(personalInfo);
    });

    // Handle Nutritional Goals Form
    document.getElementById('nutritionalGoalsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const goals = {
            calories: parseInt(document.getElementById('calorieGoal').value),
            protein: parseInt(document.getElementById('proteinGoal').value),
            carbs: parseInt(document.getElementById('carbsGoal').value),
            fat: parseInt(document.getElementById('fatGoal').value)
        };
        updateNutritionalGoals(goals);
    });

    // Handle Preferences Form
    document.getElementById('preferencesForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const preferences = {
            theme: document.getElementById('theme').value
        };
        updatePreferences(preferences);
    });

    // Add this to your DOMContentLoaded event listener
    document.getElementById('confirmDeleteAccount').addEventListener('click', function() {
        const password = document.getElementById('deleteAccountPassword').value;
        deleteAccount(password);
    });
});

function resendVerification() {
    const user = firebase.auth().currentUser;
    user.sendEmailVerification().then(() => {
        showAlert('Verification email sent. Please check your inbox.', 'success');
    }).catch(error => {
        console.error('Error sending verification:', error);
        showAlert('Failed to send verification email. Please try again.', 'danger');
    });
}

function loadUserSettings(userId) {
    const userRef = firebase.database().ref('users/' + userId);
    
    userRef.once('value')
        .then(snapshot => {
            const userData = snapshot.val();
            if (userData) {
                // Fill in the form fields with user data
                if (userData.age) document.getElementById('age').value = userData.age;
                if (userData.weight) document.getElementById('weight').value = userData.weight;
                if (userData.height) document.getElementById('height').value = userData.height;
                
                // Nutritional goals
                if (userData.nutritionalGoals) {
                    if (userData.nutritionalGoals.calories) document.getElementById('calorieGoal').value = userData.nutritionalGoals.calories;
                    if (userData.nutritionalGoals.protein) document.getElementById('proteinGoal').value = userData.nutritionalGoals.protein;
                    if (userData.nutritionalGoals.carbs) document.getElementById('carbsGoal').value = userData.nutritionalGoals.carbs;
                    if (userData.nutritionalGoals.fat) document.getElementById('fatGoal').value = userData.nutritionalGoals.fat;
                }
                
                // Theme preference
                if (userData.preferences && userData.preferences.theme) {
                    const theme = userData.preferences.theme;
                    document.getElementById('theme').value = theme;
                    localStorage.setItem('theme', theme);
                    applyTheme(theme);
                }
            }
        })
        .catch(error => {
            console.error('Error loading user settings:', error);
            showAlert('Failed to load user settings. Please refresh the page.', 'danger');
        });
}

function updateDisplayName(displayName) {
    const user = firebase.auth().currentUser;
    
    if (!user) {
        console.error('No user is currently signed in');
        showAlert('Please sign in to update your display name', 'danger');
        return;
    }
    
    console.log('Updating display name to:', displayName);
    
    user.updateProfile({
        displayName: displayName
    }).then(() => {
        console.log('Profile updated successfully');
        // Update in Firebase database
        return firebase.database().ref('users/' + user.uid).update({
            username: displayName
        });
    }).then(() => {
        console.log('Database updated successfully');
        document.getElementById('username').textContent = displayName;
        showAlert('Display name updated successfully!', 'success');
    }).catch(error => {
        console.error('Error updating display name:', error);
        showAlert('Failed to update display name. Please try again.', 'danger');
    });
}

function updatePassword(currentPassword, newPassword, confirmNewPassword) {
    if (newPassword !== confirmNewPassword) {
        showAlert('New passwords do not match!', 'danger');
        return;
    }

    const user = firebase.auth().currentUser;
    
    // Reauthenticate first
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    
    user.reauthenticateWithCredential(credential).then(() => {
        user.updatePassword(newPassword).then(() => {
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            
            // Close the collapse section
            bootstrap.Collapse.getInstance(document.getElementById('changePasswordSection')).hide();
            
            showAlert('Password updated successfully!', 'success');
        }).catch(error => {
            console.error('Error updating password:', error);
            showAlert(error.message, 'danger');
        });
    }).catch(error => {
        console.error('Error reauthenticating:', error);
        showAlert('Current password is incorrect. Please try again.', 'danger');
    });
}

function updatePersonalInfo(personalInfo) {
    const user = firebase.auth().currentUser;
    
    firebase.database().ref('users/' + user.uid).update({
        age: personalInfo.age,
        weight: personalInfo.weight,
        height: personalInfo.height
    }).then(() => {
        showAlert('Personal information updated successfully!', 'success');
    }).catch(error => {
        console.error('Error updating personal info:', error);
        showAlert('Failed to update personal information. Please try again.', 'danger');
    });
}

function updateNutritionalGoals(goals) {
    const user = firebase.auth().currentUser;
    
    // Update this part to save macro goals directly in user data
    firebase.database().ref('users/' + user.uid).update({
        nutritionalGoals: {
            calories: goals.calories,
            protein: goals.protein,
            carbs: goals.carbs,
            fat: goals.fat
        }         
    }).then(() => {
        showAlert('Nutritional goals updated successfully!', 'success');
    }).catch(error => {
        console.error('Error updating nutritional goals:', error);
        showAlert('Failed to update nutritional goals. Please try again.', 'danger');
    });
}

function updatePreferences(preferences) {
    const user = firebase.auth().currentUser;
    
    firebase.database().ref('users/' + user.uid).update({
        preferences: preferences
    }).then(() => {
        localStorage.setItem('theme', preferences.theme);
        applyTheme(preferences.theme);
        showAlert('Preferences updated successfully!', 'success');
    }).catch(error => {
        console.error('Error updating preferences:', error);
        showAlert('Failed to update preferences. Please try again.', 'danger');
    });
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

// function to handle account deletion
function deleteAccount(password) {
    const user = firebase.auth().currentUser;
    if (!user) {
        showAlert('No user is currently signed in', 'danger');
        return;
    }

    // First reauthenticate
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    
    user.reauthenticateWithCredential(credential)
        .then(() => {
            // Delete user data from Realtime Database
            const promises = [
                // Delete from users/
                firebase.database().ref(`users/${user.uid}`).remove(),
                // Delete from goals/
                firebase.database().ref(`goals/${user.uid}`).remove(),
                // Delete from measurements/
                firebase.database().ref(`measurements/${user.uid}`).remove(),
                // Delete the user account itself
                user.delete()
            ];

            return Promise.all(promises);
        })
        .then(() => {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteAccountModal'));
            modal.hide();
            
            // Clear any stored data
            localStorage.clear();
            
            // Show success message and redirect
            showAlert('Account successfully deleted', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        })
        .catch(error => {
            console.error('Error deleting account:', error);
            if (error.code === 'auth/wrong-password') {
                showAlert('Incorrect password. Please try again.', 'danger');
            } else {
                showAlert('Failed to delete account. Please try again.', 'danger');
            }
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