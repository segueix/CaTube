const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeRelatedScore,
    rankAndDiversifyRelated
} = require('../js/recommendation.js');

function video(overrides = {}) {
    return {
        id: overrides.id || 'v1',
        channelId: overrides.channelId || 'c1',
        title: overrides.title || 'Video prova tema tecnologia',
        normalizedTitleTokens: overrides.normalizedTitleTokens || ['video', 'prova', 'tema', 'tecnologia'],
        tags: overrides.tags || ['tecnologia', 'review'],
        categories: overrides.categories || ['tech'],
        ...overrides
    };
}

test('high tag similarity ranks above category-only match', () => {
    const current = video({ id: 'current', channelId: 'root', tags: ['ai', 'tech', 'open-source'], categories: ['tech'] });
    const strongTags = video({ id: 'tags-win', channelId: 'c2', tags: ['ai', 'tech', 'open-source'], categories: ['news'] });
    const onlyCategory = video({ id: 'cat-only', channelId: 'c3', tags: ['sports'], categories: ['tech'] });

    const s1 = computeRelatedScore(strongTags, current, { follows: [], likedByChannel: {} });
    const s2 = computeRelatedScore(onlyCategory, current, { follows: [], likedByChannel: {} });

    assert.ok(s1.total > s2.total);
});

test('diversification avoids 3 consecutive videos from the same channel', () => {
    const current = video({ id: 'current', channelId: 'root' });
    const candidates = [
        video({ id: 'a1', channelId: 'same', tags: ['ai', 'tech'] }),
        video({ id: 'a2', channelId: 'same', tags: ['ai', 'tech'] }),
        video({ id: 'a3', channelId: 'same', tags: ['ai', 'tech'] }),
        video({ id: 'b1', channelId: 'other', tags: ['ai', 'tech'] })
    ];

    const ranked = rankAndDiversifyRelated(candidates, {
        currentVideo: current,
        userSignals: { follows: [], likedByChannel: {} },
        maxConsecutiveSameChannel: 2
    });

    const channels = ranked.map(item => item.video.channelId);
    const hasThreeConsecutive = channels.some((_, idx) => idx >= 2 && channels[idx] === channels[idx - 1] && channels[idx - 1] === channels[idx - 2]);
    assert.equal(hasThreeConsecutive, false);
});

test('missing tags falls back to category without breaking', () => {
    const current = video({ id: 'current', tags: [], normalizedTitleTokens: ['politica', 'catalunya'], categories: ['actualitat'] });
    const candidate = video({ id: 'cand', tags: undefined, normalizedTitleTokens: [], categories: ['actualitat'] });

    const scored = computeRelatedScore(candidate, current, { follows: [], likedByChannel: {} });
    assert.ok(Number.isFinite(scored.total));
    assert.equal(scored.breakdown.sameCategory, true);
});
