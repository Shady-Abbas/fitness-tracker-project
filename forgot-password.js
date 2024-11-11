document.addEventListener('DOMContentLoaded', function() {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const errorMessage = document.getElementById('errorMessage');

    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        
        try {
            // Send password reset email
            await firebase.auth().sendPasswordResetEmail(email);

            // Store success message for login page
            sessionStorage.setItem('passwordResetSuccess', 'Reset link sent! Check your email.');
            
            // Redirect to login page
            window.location.replace('index.html');

        } catch (error) {
            let errorText = 'Failed to send reset link. Please try again.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorText = 'No account found with this email address.';
                    break;
                case 'auth/invalid-email':
                    errorText = 'Invalid email address.';
                    break;
                case 'auth/too-many-requests':
                    errorText = 'Too many attempts. Please try again later.';
                    break;
            }
            
            errorMessage.textContent = errorText;
            errorMessage.classList.remove('d-none');
        }
    });
});