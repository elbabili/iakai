document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const toggle = document.getElementById('contactToggle');
    const successMessage = document.getElementById('successMessage');

    // Toggle du formulaire
    toggle.addEventListener('click', function() {
        const isOpen = form.classList.contains('open');
        form.classList.toggle('open');
        toggle.setAttribute('aria-expanded', !isOpen);
    });

    // Afficher le message de succès si retour depuis Web3Forms
    if (window.location.search.includes('success=true')) {
        form.style.display = 'none';
        successMessage.classList.add('show');
        toggle.style.display = 'none';
        
        // Nettoyer l'URL
        history.replaceState({}, document.title, window.location.pathname);
    }
});
