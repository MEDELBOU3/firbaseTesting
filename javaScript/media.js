/* ============================================================================
   EDUCATION MEDIA VIEW - COMPLETE JAVASCRIPT LOGIC
   Advanced TMDB Integration with Enhanced Features
   Version 2.0 - Corrected & Improved
   ============================================================================ */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const TMDB_CONFIG = {
    API_KEY: '6053381e440f17b9ca0ce345499db322', // IMPORTANT: This key might be public and could be deactivated. Generate your own if issues persist.
    BASE_URL: 'https://api.themoviedb.org/3',
    IMAGE_URL: 'https://image.tmdb.org/t/p/',
    LANGUAGE: 'en-US', // CORRECTED: Standard ISO 639-1 and 3166-1 code.
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Enhanced Genre Mapping with Educational Focus
const SUBJECT_GENRES = {
    history: { ids: [36, 10752, 99], name: 'Histoire', icon: '📜', description: 'Films historiques et documentaires' },
    science: { ids: [878, 99], name: 'Sciences', icon: '🔬', description: 'Science-fiction et documentaires scientifiques' },
    lang: { ids: [10769, 18], name: 'Langues', icon: '🌍', description: 'Contenus pour l\'apprentissage des langues' },
    tech: { ids: [878, 9648], name: 'Technologie', icon: '💻', description: 'Innovation et technologie' },
    art: { ids: [10402, 18], name: 'Arts', icon: '🎨', description: 'Arts visuels et créativité' },
    nature: { ids: [99, 10751], name: 'Nature', icon: '🌿', description: 'Environnement et nature' }
};

const GENRE_MAP = {
    28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie',
    80: 'Crime', 99: 'Documentaire', 18: 'Drame', 10751: 'Famille',
    14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique',
    9648: 'Mystère', 10749: 'Romance', 878: 'Science-Fiction',
    10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western'
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let eduMediaState = {
    currentPage: 1,
    totalPages: 1,
    currentFilter: '',
    currentSort: 'popularity',
    currentSearch: '',
    currentView: 'grid',
    allMedia: [],
    filteredMedia: [],
    cache: new Map(),
    watchlist: [],
    favorites: []
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function initEduMedia() {
    console.log('🎬 Initializing Education Media v2.0...');

    if (!TMDB_CONFIG.API_KEY) {
        console.error('❌ CRITICAL: TMDB API Key is missing!');
        showErrorState(new Error('TMDB API Key is not configured. Please add it to media.js.'));
        return;
    }

    loadUserPreferences();
    setupEventListeners();
    renderEduMedia();
    updateStatsMedia();
    updateLastUpdatedTime();

    console.log('✅ Education Media initialized successfully.');
}

function loadUserPreferences() {
    try {
        const saved = localStorage.getItem('eduMediaPreferences');
        if (saved) {
            const prefs = JSON.parse(saved);
            eduMediaState.currentView = prefs.view || 'grid';
            eduMediaState.currentSort = prefs.sort || 'popularity';
            eduMediaState.watchlist = prefs.watchlist || [];
            eduMediaState.favorites = prefs.favorites || [];
        }
    } catch (error) {
        console.warn('Could not load user preferences:', error);
    }
}

function saveUserPreferences() {
    try {
        const prefs = {
            view: eduMediaState.currentView,
            sort: eduMediaState.currentSort,
            watchlist: eduMediaState.watchlist,
            favorites: eduMediaState.favorites
        };
        localStorage.setItem('eduMediaPreferences', JSON.stringify(prefs));
    } catch (error) {
        console.warn('Could not save user preferences:', error);
    }
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
    document.getElementById('eduMediaFilter')?.addEventListener('change', handleFilterChange);
    document.getElementById('eduMediaSort')?.addEventListener('change', handleSortChange);
    
    const searchEl = document.getElementById('eduMediaSearch');
    if (searchEl) {
        let searchTimeout;
        searchEl.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            document.getElementById('clearSearch').style.display = e.target.value ? 'block' : 'none';
            searchTimeout = setTimeout(() => {
                eduMediaState.currentSearch = e.target.value;
                eduMediaState.currentPage = 1;
                renderEduMedia();
            }, 500);
        });
    }

    document.getElementById('clearSearch')?.addEventListener('click', () => {
        const searchInput = document.getElementById('eduMediaSearch');
        if (searchInput) {
            searchInput.value = '';
            eduMediaState.currentSearch = '';
            document.getElementById('clearSearch').style.display = 'none';
            renderEduMedia();
        }
    });

    document.querySelectorAll('.view-toggle-buttons button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-toggle-buttons button').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            eduMediaState.currentView = e.currentTarget.dataset.view;
            saveUserPreferences();
            renderCurrentView();
        });
    });

    document.getElementById('eduMediaRefresh')?.addEventListener('click', refreshMedia);
    document.getElementById('eduMediaShuffle')?.addEventListener('click', shuffleMedia);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    document.getElementById('loadMoreMedia')?.addEventListener('click', loadMoreMedia);

    setupModalEventListeners();
}

function setupModalEventListeners() {
    document.getElementById('addToFavorites')?.addEventListener('click', handleAddToFavorites);
    document.getElementById('shareMedia')?.addEventListener('click', handleShareMedia);

    document.querySelectorAll('[data-ai-action]').forEach(btn => {
        btn.addEventListener('click', (e) => handleAIAction(e.currentTarget.dataset.aiAction));
    });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleFilterChange(e) {
    eduMediaState.currentFilter = e.target.value;
    eduMediaState.currentPage = 1;
    renderEduMedia();
}

function handleSortChange(e) {
    eduMediaState.currentSort = e.target.value;
    eduMediaState.currentPage = 1;
    saveUserPreferences();
    applyFiltersAndSort();
    renderCurrentView();
    updateMediaCount();
}

function handleAddToFavorites() {
    const modal = document.getElementById('eduMediaModal');
    if (!modal) return;
    
    const mediaId = modal.dataset.currentMediaId;
    if (!mediaId) return;

    const mediaTitle = document.getElementById('eduMediaTitle')?.textContent || 'This media';
    const btn = document.getElementById('addToFavorites');
    const index = eduMediaState.favorites.indexOf(mediaId);

    if (index === -1) {
        eduMediaState.favorites.push(mediaId);
        if (btn) btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
        showNotification(`"${mediaTitle}" added to favorites`, 'success');
    } else {
        eduMediaState.favorites.splice(index, 1);
        if (btn) btn.innerHTML = '<i class="bi bi-heart"></i>';
        showNotification(`"${mediaTitle}" removed from favorites`, 'info');
    }

    saveUserPreferences();
}

function handleShareMedia() {
    const title = document.getElementById('eduMediaTitle')?.textContent;
    const modal = document.getElementById('eduMediaModal');
    const mediaId = modal?.dataset.currentMediaId;

    if (!mediaId) return;

    const shareUrl = `https://www.themoviedb.org/movie/${mediaId}`;
    const shareText = `Check out this educational content I found: ${title}`;

    if (navigator.share) {
        navigator.share({
            title: `Discover: ${title}`,
            text: shareText,
            url: shareUrl
        }).catch(err => console.log('Share was cancelled or failed:', err));
    } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('Link copied to clipboard', 'success');
        });
    }
}

function handleAIAction(action) {
    const title = document.getElementById('eduMediaTitle')?.textContent;
    const overview = document.getElementById('eduMediaDesc')?.textContent;
    // Placeholder implementation
    showNotification(`AI Action "${action}" triggered. This feature needs to be implemented.`, 'info');
}

// ============================================================================
// CORE DATA FETCHING & RENDERING
// ============================================================================

async function renderEduMedia() {
    const loader = document.getElementById('eduMediaLoader');
    const contentViews = ['eduMediaGrid', 'eduMediaList', 'eduMediaCards', 'eduMediaEmpty', 'loadMoreContainer'];
    
    loader?.classList.remove('d-none');
    contentViews.forEach(id => document.getElementById(id)?.classList.add('d-none'));

    try {
        const media = await fetchTMDBMedia();
        eduMediaState.allMedia = media;
        applyFiltersAndSort();

        if (eduMediaState.filteredMedia.length === 0) {
            showEmptyState();
        } else {
            renderCurrentView();
            updateStatsMedia();
            updateMediaCount();
            updateLastUpdatedTime();

            if (eduMediaState.currentPage < eduMediaState.totalPages) {
                document.getElementById('loadMoreContainer')?.classList.remove('d-none');
            }
        }
    } catch (error) {
        console.error('❌ TMDB Fetch Error:', error);
        showErrorState(error);
    } finally {
        loader?.classList.add('d-none');
    }
}

async function fetchTMDBMedia() {
    const { currentFilter, currentSearch, currentPage, currentSort } = eduMediaState;
    const cacheKey = `${currentFilter}-${currentSearch}-${currentPage}-${currentSort}`;
    const cached = eduMediaState.cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < TMDB_CONFIG.CACHE_DURATION)) {
        console.log('📦 Using cached data for key:', cacheKey);
        eduMediaState.totalPages = cached.totalPages;
        return cached.data;
    }

    let endpoint, params;

    if (currentSearch) {
        endpoint = 'search/movie';
        params = { query: currentSearch };
    } else if (currentFilter && SUBJECT_GENRES[currentFilter]) {
        endpoint = 'discover/movie';
        params = {
            with_genres: SUBJECT_GENRES[currentFilter].ids.join(','),
            'vote_count.gte': 100
        };
    } else {
        endpoint = 'movie/popular';
        params = {};
    }

    const queryParams = new URLSearchParams({
        api_key: TMDB_CONFIG.API_KEY,
        language: TMDB_CONFIG.LANGUAGE,
        page: currentPage,
        sort_by: getSortParam(currentSort),
        ...params
    });

    const url = `${TMDB_CONFIG.BASE_URL}/${endpoint}?${queryParams}`;
    console.log('📡 Fetching from TMDB:', url);

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TMDB API Error (${response.status}): ${errorData.status_message || response.statusText}`);
    }

    const data = await response.json();
    eduMediaState.totalPages = data.total_pages;

    const processedResults = data.results.map(item => ({
        id: item.id,
        title: item.title,
        overview: item.overview || 'Description not available',
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date,
        vote_average: item.vote_average || 0,
        vote_count: item.vote_count || 0,
        genre_ids: item.genre_ids || [],
        popularity: item.popularity || 0,
        media_type: 'movie'
    }));

    eduMediaState.cache.set(cacheKey, { data: processedResults, totalPages: data.total_pages, timestamp: Date.now() });
    return processedResults;
}

function getSortParam(sort) {
    const sortMap = {
        popularity: 'popularity.desc',
        release_date: 'release_date.desc',
        vote_average: 'vote_average.desc',
        title: 'original_title.asc' // Use 'original_title' for better sorting
    };
    return sortMap[sort] || 'popularity.desc';
}

// ============================================================================
// FILTER & SORT LOGIC
// ============================================================================

function applyFiltersAndSort() {
    let media = [...eduMediaState.allMedia];
    
    // Client-side filtering is only really needed if the API doesn't do it, but we can keep it for multi-page results.
    // The main sorting should be handled by the API `sort_by` parameter for accurate pagination.
    // However, if we combine pages, client-side sorting becomes necessary again.
    
    media.sort((a, b) => {
        switch (eduMediaState.currentSort) {
            case 'release_date': return new Date(b.release_date || 0) - new Date(a.release_date || 0);
            case 'vote_average': return (b.vote_average || 0) - (a.vote_average || 0);
            case 'title': return (a.title || '').localeCompare(b.title || '');
            default: return (b.popularity || 0) - (a.popularity || 0);
        }
    });

    eduMediaState.filteredMedia = media;
}

// ============================================================================
// VIEW RENDERING
// ============================================================================

function renderCurrentView() {
    const views = {
        grid: renderGridView,
        list: renderListView,
        cards: renderCardsView
    };

    document.getElementById('eduMediaGrid')?.classList.add('d-none');
    document.getElementById('eduMediaList')?.classList.add('d-none');
    document.getElementById('eduMediaCards')?.classList.add('d-none');

    const renderFunction = views[eduMediaState.currentView] || views.grid;
    renderFunction();
}

function renderGridView() {
    const grid = document.getElementById('eduMediaGrid');
    if (!grid) return;
    grid.innerHTML = eduMediaState.filteredMedia.map(createGridCardHTML).join('');
    attachCardEventListeners();
    grid.classList.remove('d-none');
}

function renderListView() {
    const list = document.getElementById('eduMediaList');
    if (!list) return;
    list.innerHTML = eduMediaState.filteredMedia.map(createListCardHTML).join('');
    list.classList.remove('d-none');
}

function renderCardsView() {
    const cards = document.getElementById('eduMediaCards');
    if (!cards) return;
    cards.innerHTML = eduMediaState.filteredMedia.map(createLargeCardHTML).join('');
    cards.classList.remove('d-none');
}

// ============================================================================
// HTML TEMPLATE HELPERS
// ============================================================================

function createGridCardHTML(media) {
    return `
    <div class="col-xl-3 col-lg-4 col-md-6">
        <div class="edu-media-card" data-id="${media.id}" data-type="${media.media_type}">
            <div class="card-image-wrapper">
                <img src="${getImageUrl(media.poster_path, 'w500')}" alt="${escapeHtml(media.title)}" class="edu-media-poster" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Image+Not+Available'">
                <div class="card-overlay">
                    <div class="overlay-content">
                        <div class="rating-badge"><i class="bi bi-star-fill"></i> ${media.vote_average.toFixed(1)}</div>
                        <button class="btn btn-primary btn-sm quick-view-btn" onclick="event.stopPropagation(); EduMediaAPI.openQuickView(${media.id}, '${media.media_type}')"><i class="bi bi-eye"></i></button>
                    </div>
                </div>
            </div>
            <div class="edu-media-info">
                <h5 class="edu-media-title-card">${escapeHtml(media.title)}</h5>
                <div class="edu-media-meta"><span class="year">${getYear(media.release_date)}</span></div>
            </div>
        </div>
    </div>`;
}

function createListCardHTML(media) {
    return `
    <div class="edu-media-list-item" data-id="${media.id}" data-type="${media.media_type}">
        <div class="list-item-image"><img src="${getImageUrl(media.poster_path, 'w200')}" alt="${escapeHtml(media.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300/333/fff?text=No+Image'"></div>
        <div class="list-item-content">
            <div class="list-item-header">
                <h5>${escapeHtml(media.title)}</h5>
                <div class="list-item-meta">
                    <span class="year">${getYear(media.release_date)}</span>
                    <span class="rating"><i class="bi bi-star-fill"></i> ${media.vote_average.toFixed(1)}</span>
                    <span class="badge">${getSubjectFromGenres(media.genre_ids)}</span>
                </div>
            </div>
            <p class="list-item-desc">${truncateText(media.overview, 200)}</p>
            <div class="list-item-actions">
                <button class="btn btn-primary btn-sm" onclick="EduMediaAPI.openModal(${media.id}, '${media.media_type}', '${escapeHtml(media.title).replace(/'/g, "\\'")}')"><i class="bi bi-info-circle"></i> More Info</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="EduMediaAPI.addToWatchlist(${media.id})"><i class="bi bi-bookmark"></i> Watchlist</button>
            </div>
        </div>
    </div>`;
}

function createLargeCardHTML(media) {
    return `
    <div class="col-md-6 col-lg-4">
        <div class="edu-media-card-large" data-id="${media.id}" data-type="${media.media_type}" onclick="EduMediaAPI.openModal(${media.id}, '${media.media_type}', '${escapeHtml(media.title).replace(/'/g, "\\'")}')">
            <div class="card-large-image" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url('${getImageUrl(media.backdrop_path, 'w780')}')">
                <div class="card-large-overlay">
                    <div class="card-large-content">
                        <h5>${escapeHtml(media.title)}</h5>
                        <p>${truncateText(media.overview, 150)}</p>
                        <div class="card-large-meta">
                            <span><i class="bi bi-calendar"></i> ${getYear(media.release_date)}</span>
                            <span><i class="bi bi-star-fill"></i> ${media.vote_average.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function attachCardEventListeners() {
    document.querySelectorAll('.edu-media-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.quick-view-btn')) return;
            const id = card.dataset.id;
            const type = card.dataset.type;
            const title = card.querySelector('.edu-media-title-card')?.textContent || 'Unknown';
            EduMediaAPI.openModal(id, type, title);
        });
    });
}

// ============================================================================
// MODAL FUNCTIONALITY
// ============================================================================

async function openEduMediaModal(id, type) {
    const modalEl = document.getElementById('eduMediaModal');
    if (!modalEl) return;

    modalEl.dataset.currentMediaId = id;
    modalEl.dataset.currentMediaType = type;
    const modal = new bootstrap.Modal(modalEl);

    try {
        showModalLoading(true);
        const [details, videos, similar] = await Promise.all([
            fetchMediaDetails(id, type),
            fetchMediaVideos(id, type),
            fetchSimilarMedia(id, type)
        ]);

        populateModalData(details, videos, similar);
        updateFavoritesButton(id);
        modal.show();
    } catch (error) {
        console.error('❌ Error opening modal:', error);
        showModalError(error);
        modal.hide();
    } finally {
        showModalLoading(false);
    }
}

async function fetchMediaDetails(id, type) {
    const url = `${TMDB_CONFIG.BASE_URL}/${type}/${id}?api_key=${TMDB_CONFIG.API_KEY}&language=${TMDB_CONFIG.LANGUAGE}&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch media details: ${response.status}`);
    return await response.json();
}

async function fetchMediaVideos(id, type) {
    const url = `${TMDB_CONFIG.BASE_URL}/${type}/${id}/videos?api_key=${TMDB_CONFIG.API_KEY}&language=fr,en-US`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.results?.length) return null;

    // Smart trailer selection logic
    const trailers = data.results.filter(v => v.type === 'Trailer' && v.site === 'YouTube');
    const officialTrailers = trailers.filter(v => v.official);
    
    return officialTrailers.find(v => v.iso_639_1 === 'fr') || // Official French
           trailers.find(v => v.iso_639_1 === 'fr') ||         // Any French
           officialTrailers.find(v => v.iso_639_1 === 'en') || // Official English
           trailers[0];                                        // First available
}

async function fetchSimilarMedia(id, type) {
    const url = `${TMDB_CONFIG.BASE_URL}/${type}/${id}/similar?api_key=${TMDB_CONFIG.API_KEY}&language=${TMDB_CONFIG.LANGUAGE}&page=1`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.results.slice(0, 4);
}

function populateModalData(details, trailer, similar) {
    document.getElementById('eduMediaTitle').textContent = details.title || details.name || 'Unknown Title';
    document.getElementById('eduMediaYear').textContent = new Date(details.release_date || details.first_air_date).getFullYear() || 'N/A';
    document.getElementById('eduMediaRating').textContent = `${(details.vote_average || 0).toFixed(1)}/10`;
    document.getElementById('eduMediaDesc').textContent = details.overview || 'Description not available.';

    const durationEl = document.getElementById('eduMediaDuration');
    if (details.runtime) {
        durationEl.textContent = `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}min`;
    } else {
        durationEl.textContent = '';
    }

    const playerEl = document.getElementById('eduMediaPlayer');
    playerEl.innerHTML = trailer ? 
        `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` :
        `<div class="player-placeholder"><i class="bi bi-film"></i><p>Trailer not available</p></div>`;

    document.getElementById('eduMediaGenres').textContent = details.genres?.map(g => g.name).join(', ') || 'N/A';
    document.getElementById('eduMediaLanguage').textContent = details.original_language?.toUpperCase() || 'N/A';
    document.getElementById('eduMediaVotes').textContent = `${formatNumber(details.vote_count || 0)} votes`;

    const similarEl = document.getElementById('similarMedia');
    similarEl.innerHTML = (similar && similar.length > 0) ? similar.map(media => `
        <div class="similar-item" onclick="EduMediaAPI.openModal(${media.id}, 'movie', '${escapeHtml(media.title || media.name).replace(/'/g, "\\'")}')">
            <img src="${getImageUrl(media.poster_path, 'w154')}" alt="${escapeHtml(media.title || media.name)}" onerror="this.src='https://via.placeholder.com/154x231/333/fff?text=No+Image'">
            <span>${escapeHtml(media.title || media.name)}</span>
        </div>`).join('') : '<p class="text-muted">No similar content found.</p>';
}

function showModalLoading(isLoading) {
    const playerEl = document.getElementById('eduMediaPlayer');
    if (isLoading) {
        playerEl.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100"><div class="spinner-border text-primary"></div></div>`;
    }
}

function showModalError(error) {
    showNotification(`Error opening details: ${error.message}`, 'danger');
}

function updateFavoritesButton(mediaId) {
    const btn = document.getElementById('addToFavorites');
    if (btn) {
        const isFavorite = eduMediaState.favorites.includes(String(mediaId));
        btn.innerHTML = isFavorite ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
    }
}

// ============================================================================
// QUICK VIEW & ACTIONS
// ============================================================================

function openQuickView(id) {
    const media = eduMediaState.allMedia.find(m => m.id == id);
    if (!media) return;

    document.getElementById('quickViewTitle').textContent = media.title;
    document.getElementById('quickViewOverview').textContent = truncateText(media.overview, 200);
    document.getElementById('quickViewPoster').src = getImageUrl(media.poster_path, 'w300');

    const quickModal = new bootstrap.Modal(document.getElementById('quickViewModal'));
    quickModal.show();
}

function addToWatchlist(mediaId) {
    const idStr = String(mediaId);
    const index = eduMediaState.watchlist.indexOf(idStr);
    if (index === -1) {
        eduMediaState.watchlist.push(idStr);
        showNotification('Added to watchlist', 'success');
    } else {
        eduMediaState.watchlist.splice(index, 1);
        showNotification('Removed from watchlist', 'info');
    }
    saveUserPreferences();
}

async function refreshMedia() {
    const btn = document.getElementById('eduMediaRefresh');
    if (btn) {
        btn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
        btn.disabled = true;
    }

    eduMediaState.cache.clear();
    eduMediaState.currentPage = 1;
    await renderEduMedia();

    if (btn) {
        btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        btn.disabled = false;
    }
    showNotification('Media refreshed', 'success');
}

function shuffleMedia() {
    eduMediaState.filteredMedia = [...eduMediaState.filteredMedia].sort(() => Math.random() - 0.5);
    renderCurrentView();
    showNotification('Media shuffled!', 'success');
}

function resetFilters() {
    eduMediaState.currentFilter = '';
    eduMediaState.currentSearch = '';
    eduMediaState.currentSort = 'popularity';
    eduMediaState.currentPage = 1;

    document.getElementById('eduMediaFilter').value = '';
    document.getElementById('eduMediaSearch').value = '';
    document.getElementById('eduMediaSort').value = 'popularity';
    document.getElementById('clearSearch').style.display = 'none';

    renderEduMedia();
    showNotification('Filters have been reset', 'info');
}

async function loadMoreMedia() {
    const btn = document.getElementById('loadMoreMedia');
    if (!btn || eduMediaState.currentPage >= eduMediaState.totalPages) return;
    
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Loading...';
    btn.disabled = true;

    try {
        eduMediaState.currentPage++;
        const newMedia = await fetchTMDBMedia();
        eduMediaState.allMedia = [...eduMediaState.allMedia, ...newMedia];
        applyFiltersAndSort();
        // Instead of re-rendering, we should append to the current view for a smoother experience.
        // This is a more complex implementation, so for now we'll stick to re-rendering.
        renderCurrentView(); 
        updateStatsMedia();
        updateMediaCount();
        showNotification(`${newMedia.length} new items loaded`, 'success');
    } catch (error) {
        console.error('Error loading more media:', error);
        showNotification('Failed to load more media', 'danger');
        eduMediaState.currentPage--; // Revert page on error
    } finally {
        btn.innerHTML = '<i class="bi bi-plus-circle"></i> Load More Media';
        btn.disabled = false;
        if (eduMediaState.currentPage >= eduMediaState.totalPages) {
            document.getElementById('loadMoreContainer').classList.add('d-none');
        }
    }
}

// ============================================================================
// UI & STATE DISPLAY
// ============================================================================

function updateStatsMedia() {
    document.getElementById('totalMediaCount').textContent = formatNumber(eduMediaState.allMedia.length);
    const activeFilter = eduMediaState.currentFilter ? SUBJECT_GENRES[eduMediaState.currentFilter].name : 'None';
    document.getElementById('activeFilterCount').textContent = activeFilter;
}

function updateMediaCount() {
    const count = eduMediaState.filteredMedia.length;
    document.getElementById('mediaCountText').textContent = `${formatNumber(count)} item${count !== 1 ? 's' : ''} found`;
}

function updateLastUpdatedTime() {
    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' });
}

function showEmptyState() {
    document.getElementById('eduMediaEmpty')?.classList.remove('d-none');
}

function showErrorState(error) {
    const grid = document.getElementById('eduMediaGrid');
    if (!grid) return;
    grid.innerHTML = `
    <div class="col-12">
        <div class="alert alert-danger d-flex align-items-center" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-3 fs-2"></i>
            <div>
                <h5 class="alert-heading">Loading Error</h5>
                <p class="mb-0">${escapeHtml(error.message)}</p>
                <button class="btn btn-sm btn-outline-danger mt-2" onclick="EduMediaAPI.refresh()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
            </div>
        </div>
    </div>`;
    grid.classList.remove('d-none');
}

function showNotification(message, type = 'info') {
    // Assuming a global `showToast` function exists from the main app script
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getImageUrl(path, size = 'w500') {
    return path ? `${TMDB_CONFIG.IMAGE_URL}${size}${path}` : 'https://via.placeholder.com/500x750/1a1a1a/666?text=Image+Not+Available';
}

function truncateText(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function getYear(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).getFullYear() || 'N/A';
}

function getSubjectFromGenres(genreIds) {
    if (!genreIds?.length) return 'General';
    for (const [, data] of Object.entries(SUBJECT_GENRES)) {
        if (genreIds.some(id => data.ids.includes(id))) {
            return `${data.icon} ${data.name}`;
        }
    }
    return 'General';
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatNumber(num) {
    return num.toLocaleString();
}

// ============================================================================
// EXPORT PUBLIC API
// ============================================================================

const EduMediaAPI = {
    init: initEduMedia,
    openModal: openEduMediaModal,
    openQuickView: openQuickView,
    addToWatchlist: addToWatchlist,
    refresh: refreshMedia,
    shuffle: shuffleMedia,
    reset: resetFilters,
    loadMore: loadMoreMedia,
    // Add other advanced functions here if they need to be public
};

window.EduMediaAPI = EduMediaAPI;

console.log('✅ Education Media module fully loaded and ready.');
