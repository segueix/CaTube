Aplicació per descobrir Youtubers
Canvis millor integració  
Millora logo
Modificació canals
Nous canals
Més canals
Encara més canals
Idem

## Feed metadata de recomanació
El procés `scripts/update_feed.js` afegeix metadades pensades per recomanacions locals (sense `search.list relatedToVideoId`): cada vídeo manté `tags` i ara pot incloure `normalizedTitleTokens` (fins a 12 tokens normalitzats i sense stopwords), mentre que cada canal conserva `topTags` a `channels[channelId].topTags`. El client és compatible amb feeds antics: si falten `normalizedTitleTokens`, els calcula al vol abans de puntuar relacionats.
