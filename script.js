/* ═══════════════════════════════════════════
   IAKAI — L'art de raconter autrement
   Script unique
   ═══════════════════════════════════════════

   STRUCTURE DES FICHIERS :
   ────────────────────────
   images/          → dessins et peintures
   images/muettes/  → planches BD « histoires muettes » (comics.json)
   images/porteurs/ → planches BD « Les Porteurs de Lumière » (porteurs.json)
   Le dossier de chaque série est indiqué par data-folder dans comics.html.
   images.json      → liste des dessins/peintures
   comics.json      → liste des épisodes BD (histoires muettes)
   porteurs.json    → planches BD « Les Porteurs de Lumière »
   videos.json      → liste des vidéos (quand prêt)

   DESSINS (images.json) :
   [{ "file": "mon_dessin.jpg", "alt": "Titre", "date": "2026-01-15" }]
   Préfixe "wide_" → pleine largeur.

   BD (comics.json) :
   [{
     "file": "ep01_fiha_khayr.jpg",
     "title_ar": "فيها خير",
     "title_tr": "Fīhā Khayr",
     "title_fr": "Il y a du bien en toute chose",
     "date": "2026-02-11"
   }]

   VIDÉOS (videos.json) :
   [{ "type": "local", "file": "vid.mp4", "title": "...", "date": "..." }]
   [{ "type": "youtube", "id": "xxxxxxxxxxx", "title": "...", "date": "..." }]

   ═══════════════════════════════════════════ */

// Changer cette valeur après chaque mise à jour des fichiers JSON
const DATA_VERSION = '2026-10-21';

document.addEventListener('DOMContentLoaded', () => {
    initHamburger();

    const page = document.body.dataset.page;
    if (page === 'dessins') initGallery();
    if (page === 'comics')  initComicsCarousels();
    if (page === 'videos')  initVideoGallery();
});

/* ═══ Hamburger ═══ */

function initHamburger() {
    const btn = document.getElementById('hamburgerBtn');
    const menu = document.getElementById('navMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = btn.classList.toggle('open');
        menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            btn.classList.remove('open');
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            btn.classList.remove('open');
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });
}

/* ═══ Galerie (Dessins) ═══ */

async function initGallery() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    try {
        const res = await fetch('images.json?' + Date.now());
        if (!res.ok) throw new Error('introuvable');
        const images = await res.json();

        if (!images.length) {
            gallery.innerHTML = '<p class="gallery-empty">Galerie en préparation…</p>';
            return;
        }

        images.sort((a, b) => new Date(b.date) - new Date(a.date));

        const normalCount = images.filter(img => !img.file.startsWith('wide_')).length;
        gallery.classList.remove('cols-1', 'cols-2');
        if (normalCount === 1) gallery.classList.add('cols-1');
        else if (normalCount === 2) gallery.classList.add('cols-2');

        images.forEach((img, i) => {
            const card = document.createElement('figure');
            card.className = 'artwork-card';
            card.style.animationDelay = `${0.15 * i}s`;
            if (img.file.startsWith('wide_')) card.classList.add('wide');

            const image = document.createElement('img');
            image.src = `images/${img.file}`;
            image.alt = img.alt || img.file;
            image.loading = 'lazy';

            card.appendChild(image);
            gallery.appendChild(card);
            card.addEventListener('click', () => openLightbox(image.src, image.alt));
        });

    } catch (err) {
        gallery.innerHTML = '<p class="gallery-empty">Galerie en préparation…</p>';
    }
}

/* ═══ Carrousels BD ═══
   Chaque bloc <div class="comic-series" data-source="xxx.json"> de comics.html
   devient un carrousel indépendant (comics.json, porteurs.json…).
   Les flèches du clavier pilotent le dernier carrousel survolé ou touché. */

let activeComicCarousel = null;

function initComicsCarousels() {
    const series = document.querySelectorAll('.comic-series[data-source]');
    series.forEach((el, i) => initComicsCarousel(el, i === 0));

    document.addEventListener('keydown', (e) => {
        if (!activeComicCarousel) return;
        if (e.key === 'ArrowLeft') activeComicCarousel.goTo(activeComicCarousel.index() - 1);
        if (e.key === 'ArrowRight') activeComicCarousel.goTo(activeComicCarousel.index() + 1);
    });
}

async function initComicsCarousel(root, isDefault) {
    const track = root.querySelector('.carousel-track');
    const viewport = root.querySelector('.carousel-viewport');
    const indicators = root.querySelector('.carousel-indicators');
    const prevBtn = root.querySelector('.carousel-prev');
    const nextBtn = root.querySelector('.carousel-next');
    const label = root.dataset.label || 'Épisode';
    const folder = root.dataset.folder || 'images/';
    if (!track) return;

    let currentIndex = 0;
    let episodes = [];

    try {
        const res = await fetch(root.dataset.source + '?' + Date.now());
        if (!res.ok) throw new Error('introuvable');
        episodes = await res.json();
    } catch (err) {
        track.innerHTML = '<div class="carousel-slide"><p class="gallery-empty">Épisodes en préparation…</p></div>';
        return;
    }

    if (!episodes.length) {
        track.innerHTML = '<div class="carousel-slide"><p class="gallery-empty">Épisodes en préparation…</p></div>';
        return;
    }

    episodes.sort((a, b) => (new Date(a.date) - new Date(b.date)) || ((a.order || 0) - (b.order || 0)));

    episodes.forEach((ep, i) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';

        const img = document.createElement('img');
        img.src = `${folder}${ep.file}`;
        img.alt = ep.title_fr || ep.title_en || ep.file;
        img.loading = i === 0 ? 'eager' : 'lazy';
        img.addEventListener('click', () => openLightbox(img.src, img.alt));

        slide.appendChild(img);
        track.appendChild(slide);
    });

    episodes.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `${label} ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        indicators.appendChild(dot);
    });

    function updateState() {
        indicators.querySelectorAll('.carousel-dot').forEach((d, i) => {
            d.classList.toggle('active', i === currentIndex);
        });
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === episodes.length - 1;
    }

    // La hauteur du carrousel suit la planche affichée (formats paysage et portrait mélangés)
    function fitHeight() {
        const slide = track.children[currentIndex];
        if (slide && slide.offsetHeight) viewport.style.height = slide.offsetHeight + 'px';
    }

    function goTo(index) {
        currentIndex = Math.max(0, Math.min(index, episodes.length - 1));
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        updateState();
        fitHeight();
    }

    track.querySelectorAll('img').forEach((img) => img.addEventListener('load', fitHeight));
    window.addEventListener('resize', fitHeight);

    const api = { goTo, index: () => currentIndex };
    if (isDefault && !activeComicCarousel) activeComicCarousel = api;
    ['mouseenter', 'touchstart', 'focusin'].forEach((evt) => {
        root.addEventListener(evt, () => { activeComicCarousel = api; }, { passive: true });
    });

    prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
    nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

    let touchStartX = 0;
    const swipeThreshold = 50;

    viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) goTo(currentIndex + 1);
            else goTo(currentIndex - 1);
        }
    }, { passive: true });

    updateState();
}

/* ═══ Vidéos ═══ */

async function initVideoGallery() {
    const gallery = document.getElementById('videoGallery');
    const comingSoon = document.getElementById('comingSoon');
    if (!gallery) return;

    let videos = [];

    try {
        const res = await fetch('videos.json?' + Date.now());
        if (!res.ok) throw new Error('introuvable');
        videos = await res.json();
    } catch (err) {
        return;
    }

    if (!videos.length) return;

    if (comingSoon) comingSoon.style.display = 'none';

    videos.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (videos.length === 1) {
        gallery.style.gridTemplateColumns = '1fr';
        gallery.style.maxWidth = '600px';
    }

    videos.forEach((vid, i) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.style.animationDelay = `${0.15 * i}s`;

        if (vid.type === 'youtube') {
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${vid.id}`;
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('frameborder', '0');
            card.appendChild(iframe);
        } else {
            const video = document.createElement('video');
            video.src = `videos/${vid.file}`;
            video.controls = true;
            video.preload = 'metadata';
            card.appendChild(video);
        }

        if (vid.title) {
            const title = document.createElement('p');
            title.className = 'video-card-title';
            title.textContent = vid.title;
            card.appendChild(title);
        }

        gallery.appendChild(card);
    });
}

/* ═══ Lightbox ═══ */

let lightbox = null;

function openLightbox(src, alt) {
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <button class="lightbox-close" aria-label="Fermer">&times;</button>
            <img src="" alt="">
        `;
        document.body.appendChild(lightbox);

        lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    const img = lightbox.querySelector('img');
    img.src = src;
    img.alt = alt;
    requestAnimationFrame(() => lightbox.classList.add('open'));
}

function closeLightbox() {
    if (lightbox) lightbox.classList.remove('open');
}
