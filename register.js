document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const email = document.getElementById('email').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        // Reset messages
        errorMessage.classList.add('d-none');
        successMessage.classList.add('d-none');

        // Disable submit button to prevent double submission
        const submitButton = registerForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            // Basic validation
            if (!email || !username || !password || !confirmPassword) {
                throw new Error('All fields are required');
            }

            // Password match validation
            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }

            // Username validation (only letters, numbers, and underscores)
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                throw new Error('Username can only contain letters, numbers, and underscores');
            }

            // Create user with Firebase
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Send verification email
            await user.sendEmailVerification();

            // Store additional user data in Firebase Database
            await firebase.database().ref('users/' + user.uid).set({
                username: username,
                email: email,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: firebase.database.ServerValue.TIMESTAMP,
                settings: {
                    theme: 'light',
                    notifications: true
                }
            });

            // Show success message
            successMessage.classList.remove('d-none');
            successMessage.textContent = 'Account created successfully! Redirecting to login...';

            // Store success message for login page
            sessionStorage.setItem('registrationSuccess', 
                'Account created! Please check your email for verification and login.');

            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.replace('index.html');
            }, 2000);

        } catch (error) {
            let errorText = 'Registration failed. Please try again.';
            
            if (error.code) {
                // Firebase Auth errors
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorText = 'This email is already registered.';
                        break;
                    case 'auth/invalid-email':
                        errorText = 'Invalid email address.';
                        break;
                    case 'auth/weak-password':
                        errorText = 'Password should be at least 6 characters.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorText = 'Email/password accounts are not enabled. Please contact support.';
                        break;
                    default:
                        errorText = `Error: ${error.message}`;
                }
            } else {
                // Custom validation errors
                errorText = error.message;
            }
            
            showError(errorText);
            submitButton.disabled = false;
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
        // Scroll to error message
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Optional: Add password strength indicator
    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength++;
        // Contains number
        if (/\d/.test(password)) strength++;
        // Contains letter
        if (/[a-zA-Z]/.test(password)) strength++;
        // Contains special character
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        // Update password strength indicator (if you have one in your HTML)
        const strengthIndicator = document.getElementById('passwordStrength');
        if (strengthIndicator) {
            switch(strength) {
                case 0:
                case 1:
                    strengthIndicator.textContent = 'Weak';
                    strengthIndicator.className = 'text-danger';
                    break;
                case 2:
                case 3:
                    strengthIndicator.textContent = 'Medium';
                    strengthIndicator.className = 'text-warning';
                    break;
                case 4:
                    strengthIndicator.textContent = 'Strong';
                    strengthIndicator.className = 'text-success';
                    break;
            }
        }
    });
});