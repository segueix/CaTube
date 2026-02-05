const fs = require('fs');
const https = require('https');
const path = require('path');

// 1. CONFIGURACIÓ
// Utilitzem la mateixa URL del Google Sheets que ja tens al projecte
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlB5oWUFyPtQu6U21l2sWRlnWPndhsVA-YvcB_3c9Eby80XKVgmnPdWNpwzcxSqMutkqV6RyJLjsMe/pub?gid=0&single=true&output=csv';

const PATH_CHANNELS_JSON = path.join(__dirname, '../js/channels-ca.json');
const PATH_FEED_JSON = path.join(__dirname, '../data/feed.json');

// 2. FUNCIONS AUXILIARS (Copiades de la teva lògica actual per ser consistents)

// Funció per descarregar el CSV
const fetchData = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchData(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
};

// Funció per llegir el CSV tal com ho fa el teu actualitzador
function parseCSV(csvText) {
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    let separator = ',';
    const firstLine = lines[0];
    if (firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length)) {
        separator = ';';
    }

    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    const idIdx = headers.indexOf('id');
    const nameIdx = headers.indexOf('name');
    const catIdx = headers.indexOf('category'); // Busca la columna 'category'

    if (idIdx === -1) return [];

    return lines.slice(1).map(line => {
        const values = line.split(separator);
        const rawCats = values[catIdx] ? values[catIdx].trim() : '';
        // Convertim a array (ex: "Digitals, Política" -> ["Digitals", "Política"])
        const categories = rawCats.split(/[;,]/).map(c => c.trim()).filter(Boolean);
        
        return {
            id: values[idIdx]?.trim(),
            name: values[nameIdx]?.trim(),
            categories: categories,
            // Guardem també la primera categoria com a principal per si de cas
            mainCategory: categories[0] || 'Altres'
        };
    }).filter(c => c.id);
}

// 3. FUNCIÓ PRINCIPAL
async function main() {
    try {
        console.log('📡 Descarregant dades del Google Sheets...');
        const csvData = await fetchData(SHEET_CSV_URL);
        const channels = parseCSV(csvData);
        console.log(`✅ S'han trobat ${channels.length} canals actius al Full de Càlcul.`);

        // --- PAS A: Actualitzar js/channels-ca.json ---
        console.log('📝 Regenerant js/channels-ca.json...');
        const channelsJsonOutput = {
            updatedAt: new Date().toISOString(),
            channels: channels.map(c => ({
                id: c.id,
                name: c.name,
                // Guardem tant array com string per compatibilitat amb el teu codi antic/nou
                categories: c.categories,
                category: c.mainCategory 
            }))
        };
        
        fs.writeFileSync(PATH_CHANNELS_JSON, JSON.stringify(channelsJsonOutput, null, 2));
        console.log('✅ js/channels-ca.json actualitzat i netejat de canals antics.');

        // --- PAS B: Actualitzar categories a data/feed.json ---
        if (fs.existsSync(PATH_FEED_JSON)) {
            console.log('🔄 Actualitzant metadades dels vídeos a feed.json...');
            const feedData = JSON.parse(fs.readFileSync(PATH_FEED_JSON, 'utf8'));
            
            // Creem un diccionari ràpid: ID_CANAL -> NOVES_CATEGORIES
            const channelCategoryMap = {};
            channels.forEach(c => {
                channelCategoryMap[c.id] = c.categories;
            });

            let videosUpdated = 0;
            let channelsUpdated = 0;

            // 1. Actualitzem la llista de canals del feed (metadades)
            if (feedData.channels) {
                Object.keys(feedData.channels).forEach(channelId => {
                    if (channelCategoryMap[channelId]) {
                        // Si el canal existeix al Excel, posem les categories noves
                        feedData.channels[channelId].categories = channelCategoryMap[channelId];
                        channelsUpdated++;
                    }
                    // NOTA: No esborrem canals del feed per no trencar l'històric, 
                    // però els actualitzem si són al CSV.
                });
            }

            // 2. Actualitzem cada vídeo individual
            if (Array.isArray(feedData.videos)) {
                feedData.videos.forEach(video => {
                    // Mirem si tenim dades noves per aquest canal (buscant per sourceChannelId o channelId)
                    const channelId = video.sourceChannelId || video.channelId;
                    const newCats = channelCategoryMap[channelId];

                    if (newCats) {
                        // Comprovem si cal canviar alguna cosa
                        const currentCatsStr = JSON.stringify(video.categories);
                        const newCatsStr = JSON.stringify(newCats);

                        if (currentCatsStr !== newCatsStr) {
                            video.categories = newCats;
                            videosUpdated++;
                        }
                    }
                });
            }

            fs.writeFileSync(PATH_FEED_JSON, JSON.stringify(feedData, null, 2));
            console.log(`✅ feed.json actualitzat:`);
            console.log(`   - ${channelsUpdated} canals sincronitzats.`);
            console.log(`   - ${videosUpdated} vídeos corregits amb la nova etiqueta.`);
        } else {
            console.warn('⚠️ No s\'ha trobat data/feed.json. Només s\'ha generat channels-ca.json.');
        }

    } catch (error) {
        console.error('❌ Error fatal:', error);
    }
}

main();
