const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY || '';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchStatus = document.getElementById('searchStatus');
const resultsContainer = document.getElementById('results');

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

async function handleSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        showStatus('Please enter a song name', 'error');
        return;
    }

    showStatus('Searching...', 'loading');
    searchBtn.disabled = true;
    resultsContainer.innerHTML = '';

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/search-songs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Search failed');
        }

        const { results } = await response.json();

        if (!results || results.length === 0) {
            showStatus('No results found', 'error');
            return;
        }

        displayResults(results);
        showStatus(`Found ${results.length} results`, 'success');
    } catch (error) {
        console.error('Search error:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        searchBtn.disabled = false;
    }
}

function displayResults(results) {
    resultsContainer.innerHTML = '';

    results.forEach((result) => {
        const card = document.createElement('div');
        card.className = 'result-card';

        const durationStr = formatDuration(result.duration);
        const viewsStr = formatViews(result.views);
        const title = result.title.length > 60 ? result.title.substring(0, 60) + '...' : result.title;

        card.innerHTML = `
            <div class="result-thumbnail">
                <img src="${result.thumbnail}" alt="${result.title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22%3E%3Crect fill=%22%23ccc%22 width=%22100%22 height=%2256%22/%3E%3C/svg%3E'">
            </div>
            <div class="result-content">
                <h3 class="result-title" title="${result.title}">${escapeHtml(title)}</h3>
                <div class="result-metadata">
                    <span>⏱️ ${durationStr}</span>
                    <span>👁️ ${viewsStr}</span>
                </div>
                <div class="result-buttons">
                    <button class="download-btn download-btn-audio" data-video-id="${result.id}" data-title="${result.title}" onclick="downloadMedia('${result.id}', '${escapeAttr(result.title)}', 'audio')">
                        <span>🎵</span> MP3
                    </button>
                    <button class="download-btn download-btn-video" data-video-id="${result.id}" data-title="${result.title}" onclick="downloadMedia('${result.id}', '${escapeAttr(result.title)}', 'video')">
                        <span>🎬</span> Video
                    </button>
                </div>
            </div>
        `;

        resultsContainer.appendChild(card);
    });
}

async function downloadMedia(videoId, title, format) {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Downloading...';

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/download-media`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                videoId,
                format,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.${format === 'audio' ? 'mp3' : 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showStatus(`Downloaded ${title}`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showStatus(`Download failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatViews(views) {
    if (!views) return 'No views';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return String(views);
}

function showStatus(message, type) {
    searchStatus.textContent = message;
    searchStatus.className = `search-status ${type}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
