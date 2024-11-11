class ReminderManager {
    constructor() {
        this.checkPermission();
        // Wait for auth state before initializing
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.loadRemindersFromFirebase(user.uid);
                //check reminders
                setInterval(() => this.checkReminders(user.uid), 60000); // Check every minute
                this.checkReminders(user.uid); // Check immediately
            }
        });
    }

    checkPermission() {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications");
            return;
        }

        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    loadRemindersFromFirebase(userId) {
        firebase.database().ref(`users/${userId}/reminders`).once('value')
            .then(snapshot => {
                const reminders = snapshot.val();
                if (reminders) {
                    // Set the checkbox state
                    document.getElementById('enableReminders').checked = true;
                    
                    // Show the reminder settings
                    document.getElementById('reminderSettings').style.display = 'block';
                    
                    // Set the time values
                    document.getElementById('breakfastReminder').value = reminders.breakfast || '08:00';
                    document.getElementById('lunchReminder').value = reminders.lunch || '12:00';
                    document.getElementById('dinnerReminder').value = reminders.dinner || '18:00';
                    document.getElementById('exerciseReminder').value = reminders.exercise || '17:00';

                    // Show welcome message with active reminders
                    const messages = [];
                    if (reminders.breakfast) messages.push(`Breakfast at ${reminders.breakfast}`);
                    if (reminders.lunch) messages.push(`Lunch at ${reminders.lunch}`);
                    if (reminders.dinner) messages.push(`Dinner at ${reminders.dinner}`);
                    if (reminders.exercise) messages.push(`Exercise at ${reminders.exercise}`);
                    
                    if (messages.length > 0) {
                        showAlert(`Your active reminders: ${messages.join(', ')}`, 'info');
                    }
                }
            })
            .catch(error => {
                console.error('Error loading reminders:', error);
            });
    }

    saveReminders() {
        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        const enabled = document.getElementById('enableReminders').checked;
        
        if (enabled) {
            // If enabled, save all reminder settings
            const reminders = {
                breakfast: document.getElementById('breakfastReminder').value,
                lunch: document.getElementById('lunchReminder').value,
                dinner: document.getElementById('dinnerReminder').value,
                exercise: document.getElementById('exerciseReminder').value
            };

            firebase.database().ref(`users/${userId}/reminders`).set(reminders)
                .then(() => {
                    showAlert('Reminders updated successfully', 'success');
                })
                .catch(error => {
                    console.error('Error saving reminders:', error);
                    showAlert('Failed to save reminders', 'danger');
                });
        } else {
            // If disabled, remove reminders from Firebase
            firebase.database().ref(`users/${userId}/reminders`).remove()
                .then(() => {
                    showAlert('Reminders disabled', 'success');
                })
                .catch(error => {
                    console.error('Error disabling reminders:', error);
                    showAlert('Failed to disable reminders', 'danger');
                });
        }
    }

    checkReminders(userId) {
        firebase.database().ref(`users/${userId}/reminders`).once('value')
            .then(snapshot => {
                const reminders = snapshot.val();
                if (!reminders) return;

                const now = new Date();
                const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                // Store last notification times in localStorage to prevent duplicates
                const lastNotifications = JSON.parse(localStorage.getItem('lastNotifications') || '{}');
                const today = now.toDateString();

                if (reminders.breakfast === currentTime && lastNotifications.breakfast !== today) {
                    this.showNotification('Breakfast Reminder', 'Time to log your breakfast! 🍳');
                    lastNotifications.breakfast = today;
                }
                if (reminders.lunch === currentTime && lastNotifications.lunch !== today) {
                    this.showNotification('Lunch Reminder', 'Time to log your lunch! 🥗');
                    lastNotifications.lunch = today;
                }
                if (reminders.dinner === currentTime && lastNotifications.dinner !== today) {
                    this.showNotification('Dinner Reminder', 'Time to log your dinner! 🍽️');
                    lastNotifications.dinner = today;
                }
                if (reminders.exercise === currentTime && lastNotifications.exercise !== today) {
                    this.showNotification('Exercise Reminder', 'Time for your daily exercise! 💪');
                    lastNotifications.exercise = today;
                }

                localStorage.setItem('lastNotifications', JSON.stringify(lastNotifications));
            });
    }

    showNotification(title, message) {
        // Browser notification
        if (Notification.permission === "granted") {
            new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                requireInteraction: true // Makes the notification stay until user interacts
            });
        }

        // In-app alert (more noticeable)
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-primary alert-dismissible fade show position-fixed top-50 start-50 translate-middle`;
        alertDiv.style.zIndex = "9999";
        alertDiv.style.minWidth = "300px";
        alertDiv.style.textAlign = "center";
        alertDiv.innerHTML = `
            <strong>${title}</strong><br>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);

        // Remove the alert after 10 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 10000);

        // Also play a notification sound (optional)
        const audio = new Audio('notification.mp3'); // You'll need to add this sound file
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
}

// Initialize reminders when document loads
document.addEventListener('DOMContentLoaded', () => {
    const reminderManager = new ReminderManager();

    // Add event listeners
    document.getElementById('enableReminders').addEventListener('change', (e) => {
        document.getElementById('reminderSettings').style.display = 
            e.target.checked ? 'block' : 'none';
        reminderManager.saveReminders();
    });

    // Save reminders when time inputs change
    const timeInputs = ['breakfastReminder', 'lunchReminder', 'dinnerReminder', 'exerciseReminder'];
    timeInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            reminderManager.saveReminders();
        });
    });
});