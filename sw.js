// Service Worker per PWA

const CACHE_NAME = 'mytube-v2';
const urlsToCache = [
    './',                // <--- Canviat '/' per './'
    './index.html',      // <--- Canviat '/index.html' per './index.html'
    './css/styles.css',  // <--- Etc...
    './js/app.js',
    './js/config.js',
    './js/data.js',
    './js/youtube.js',   // <--- Afegeix també aquest que faltava a la llista original!
    './manifest.json'
];

// Instal·lació
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache obert');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activació
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminant cache antic:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    // IGNORAR peticions que no siguin http o https (com extensions de Chrome)
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retornar cache si existeix, sinó fer petició
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then((response) => {
                    // No cachear si no és una resposta vàlida
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clonar la resposta
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
    );
});
