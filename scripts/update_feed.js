const fs = require('fs');
const https = require('https');

// Configuració
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNELS_FILE = 'js/channels-ca.json';
const OUTPUT_FILE = 'feed.json';

const parseDurationSeconds = (isoDuration) => {
    if (!isoDuration) return null;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;

    const hours = parseInt(match[1] || 0, 10);
    const minutes = parseInt(match[2] || 0, 10);
    const seconds = parseInt(match[3] || 0, 10);

    return hours * 3600 + minutes * 60 + seconds;
};

// Funció fetch millorada
const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({}); // Si falla el JSON, no trenquem tot el procés
                }
            });
        }).on('error', (e) => resolve({})); // Si falla la xarxa, continuem
    });
};

async function main() {
    try {
        // Codi NOU (El que funciona)
        const channelsRaw = fs.readFileSync(CHANNELS_FILE, 'utf8');
        // AFEGEIXO .channels AL FINAL PER ENTRAR DINS DE LA LLISTA
        const channels = JSON.parse(channelsRaw).channels;
        
        console.log(`Iniciant càrrega paral·lela per a ${channels.length} canals...`);
        const startTime = Date.now();

        // TRUC PROFESSIONAL: Creem totes les peticions a la vegada (Array de Promeses)
        const requests = channels.map(channel => {
            const uploadPlaylistId = channel.id.replace('UC', 'UU');
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=5&key=${API_KEY}`;
            
            // Retornem la promesa de la petició + dades del canal per no perdre l'origen
            return fetchJson(url).then(data => ({
                data: data,
                channelId: channel.id
            }));
        });

        // Esperem que TOTES acabin (això és molt ràpid)
        const results = await Promise.all(requests);

        let allVideos = [];

        // Processem els resultats
        results.forEach(result => {
            if (result.data && result.data.items) {
                const videos = result.data.items.map(item => ({
                    id: item.snippet.resourceId.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                    channelTitle: item.snippet.channelTitle,
                    publishedAt: item.snippet.publishedAt,
                    channelId: result.channelId
                }));
                allVideos = allVideos.concat(videos);
            }
        });

        const durationById = new Map();
        for (let i = 0; i < allVideos.length; i += 50) {
            const batch = allVideos.slice(i, i + 50);
            const ids = batch.map(video => video.id).join(',');
            const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${API_KEY}`;
            const data = await fetchJson(url);

            if (data.items) {
                data.items.forEach(item => {
                    const seconds = parseDurationSeconds(item.contentDetails?.duration);
                    durationById.set(item.id, seconds);
                });
            }
        }

        allVideos = allVideos.map(video => {
            const durationSeconds = durationById.get(video.id);
            return {
                ...video,
                isShort: durationSeconds !== null && durationSeconds <= 60
            };
        });

        // Ordenem per data
        allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        // Guardem només els 100 últims vídeos (per no fer el fitxer gegant)
        const finalData = JSON.stringify(allVideos.slice(0, 100), null, 2);
        fs.writeFileSync(OUTPUT_FILE, finalData);
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Fet! Processat en ${duration} segons.`);

    } catch (error) {
        console.error('Error fatal:', error);
        process.exit(1);
    }
}

main();
