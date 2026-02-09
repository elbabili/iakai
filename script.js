/* ═══════════════════════════════════════════
   IAKAI — Script galerie dynamique
   ═══════════════════════════════════════════
   
   FONCTIONNEMENT :
   ─────────────────
   Le fichier images.json contient la liste des images.
   Le JS le charge, trie par date (récentes en haut),
   et génère la grille automatiquement.
   
   Pour ajouter une image :
   1. Dépose l'image dans le dossier /images/
   2. Ajoute une entrée dans images.json
   3. Actualise la page → l'image apparaît en haut
   
   Pour supprimer une image :
   1. Supprime l'entrée dans images.json
   2. (optionnel) Supprime le fichier du dossier /images/
   3. Actualise la page → la grille se réajuste
   
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
    initContact();
});

/* ─── Galerie ─── */

async function initGallery() {
    const gallery = document.getElementById('gallery');

    try {
        const response = await fetch('images.json?' + Date.now()); // cache-bust
        if (!response.ok) throw new Error('images.json introuvable');

        const images = await response.json();

        if (!images.length) {
            gallery.innerHTML = '<p class="gallery-empty">Galerie en préparation…</p>';
            return;
        }

        // Tri par date décroissante (les plus récentes en premier)
        images.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Adapter le nombre de colonnes au nombre d'images
        const count = images.length;
        gallery.classList.remove('cols-1', 'cols-2');
        if (count === 1) gallery.classList.add('cols-1');
        else if (count === 2) gallery.classList.add('cols-2');

        // Générer les cartes
        images.forEach((img, index) => {
            const card = document.createElement('figure');
            card.className = 'artwork-card';
            card.style.animationDelay = `${0.15 * index}s`;

            const image = document.createElement('img');
            image.src = `images/${img.file}`;
            image.alt = img.alt || img.file;
            image.loading = 'lazy';

            card.appendChild(image);
            gallery.appendChild(card);

            // Clic → lightbox
            card.addEventListener('click', () => openLightbox(image.src, image.alt));
        });

    } catch (err) {
        console.warn('Galerie :', err.message);
        gallery.innerHTML = '<p class="gallery-empty">Galerie en préparation…</p>';
    }
}

/* ─── Lightbox ─── */

let lightbox = null;

function openLightbox(src, alt) {
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <button class="lightbox-close" aria-label="Fermer">✕</button>
            <img src="" alt="">
        `;
        document.body.appendChild(lightbox);

        lightbox.addEventListener('click', closeLightbox);
        lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
        lightbox.querySelector('img').addEventListener('click', (e) => e.stopPropagation());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    const img = lightbox.querySelector('img');
    img.src = src;
    img.alt = alt;

    requestAnimationFrame(() => {
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
}

function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

/* ─── Contact toggle ─── */

function initContact() {
    const toggle = document.getElementById('contactToggle');
    const form = document.getElementById('contactForm');

    if (!toggle || !form) return;

    toggle.addEventListener('click', () => {
        const isOpen = form.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
    });
}
