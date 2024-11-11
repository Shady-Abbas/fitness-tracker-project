document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Check for session messages
    checkSessionMessages();

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        
        // Clear previous error messages
        errorMessage.classList.add('d-none');
        
        // Show loading state
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.classList.add('btn-loading');
        submitButton.disabled = true;

        // Attempt login
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Get username from database
                return firebase.database().ref('users/' + userCredential.user.uid).once('value');
            })
            .then((snapshot) => {
                const userData = snapshot.val();
                if (userData && userData.username) {
                    localStorage.setItem('username', userData.username);
                }
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                // Remove loading state
                submitButton.classList.remove('btn-loading');
                submitButton.disabled = false;

                // Show error message
                let errorText = 'Failed to log in. Please try again.';
                
                switch (error.code) {
                    case 'auth/invalid-email':
                        errorText = 'Invalid email address.';
                        break;
                    case 'auth/user-disabled':
                        errorText = 'This account has been disabled.';
                        break;
                    case 'auth/user-not-found':
                        errorText = 'No account found with this email.';
                        break;
                    case 'auth/wrong-password':
                        errorText = 'Incorrect password.';
                        break;
                }
                
                showError(errorText);
            });
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
    }

    function checkSessionMessages() {
        // Check for registration success message
        const registrationSuccess = sessionStorage.getItem('registrationSuccess');
        if (registrationSuccess) {
            showAlert(registrationSuccess, 'success');
            sessionStorage.removeItem('registrationSuccess');
        }

        // Check for password reset success message
        const resetSuccess = sessionStorage.getItem('passwordResetSuccess');
        if (resetSuccess) {
            showAlert(resetSuccess, 'success');
            sessionStorage.removeItem('passwordResetSuccess');
        }
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.textContent = message;
        loginForm.parentNode.insertBefore(alertDiv, loginForm);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
});