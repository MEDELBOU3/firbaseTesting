    document.addEventListener('DOMContentLoaded', () => {

            // --- Firebase Config & Initialization ---
            // IMPORTANT: Replace with your actual Firebase configuration
            const firebaseConfigApp = {
               apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4", // ***** REPLACE *****
               authDomain: "sm4movies.firebaseapp.com",           // ***** REPLACE *****
               projectId: "sm4movies",                      // ***** REPLACE *****
               storageBucket: "sm4movies.appspot.com",       // ***** REPLACE *****
               messagingSenderId: "277353836953",           // ***** REPLACE *****
               appId: "1:277353836953:web:85e02783526c7cb58de308", // ***** REPLACE *****
            };

            let app, auth, db, timestamp, increment, currentUser = null, userDisplayName = 'Guest';

            try {
                // Initialize Firebase ONLY if it hasn't been initialized yet
                if (!firebase.apps.length) {
                   app = firebase.initializeApp(firebaseConfigApp);
                } else {
                   app = firebase.app(); // Get the default app if already initialized
                }
                auth = firebase.auth();
                db = firebase.firestore();
                timestamp = firebase.firestore.FieldValue.serverTimestamp; // Correct way to get timestamp
                increment = firebase.firestore.FieldValue.increment; // Correct way to get increment
                console.log("Firebase Initialized Successfully");
            } catch (e) {
                console.error("CRITICAL: Firebase Initialization Failed:", e);
                // Display a critical error message to the user
                document.body.innerHTML = `<div class="vh-100 d-flex align-items-center justify-content-center text-center p-4">
                                             <div class="alert alert-danger" role="alert">
                                               <h4 class="alert-heading">Initialization Error!</h4>
                                               <p>We couldn't connect to our services. This might be a temporary issue or a configuration problem.</p>
                                               <hr>
                                               <p class="mb-0">Please try refreshing the page later. If the problem persists, contact support. Error: ${e.message}</p>
                                             </div>
                                           </div>`;
                return; // Stop script execution if Firebase fails
            }

             // Check if Bootstrap JS is loaded
             if (typeof bootstrap === 'undefined') {
                 console.error("CRITICAL: Bootstrap JS not loaded. Modals and other components will not work.");
                 // Optionally display an error or disable features
                 alert("Error: Essential page components failed to load. Please refresh.");
                 return; // Stop if Bootstrap JS is missing
             }

             // --- Constants ---
             // IMPORTANT: Replace with your actual TMDb API Key
            const API_KEY = '431fb541e27bceeb9db2f4cab69b54e1'; // Replace!
            const BASE_URL = 'https://api.themoviedb.org/3';
            const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
            const POSTER_SIZE = 'w500';
            const BACKDROP_SIZE = 'w1280';
            const PROFILE_SIZE = 'w185';
            const LOGO_SIZE = 'w185';
            const PLACEHOLDER_PROFILE_ICON = 'fa-user-astronaut'; // Use this icon class
            const PLACEHOLDER_MOVIE_ICON = 'fa-film'; // Use this icon class
            const PLACEHOLDER_PROFILE_URL = ''; // No specific placeholder URL, use icon div
            const PLACEHOLDER_IMAGE_URL = ''; // No specific placeholder URL, use icon div


            // --- State ---
             let currentPage = 1;
             let totalPages = 0;
             let currentCategory = 'popular'; // Default category
             let currentSearchQuery = '';
             let isLoadingMovies = false; // Prevent multiple simultaneous loads
             let isLoadingDetails = false; // Prevent multiple detail loads

            // --- DOM Elements Cache ---
             const DOMElements = {
                 spinner: document.getElementById('spinner'),
                 backToTopBtn: document.getElementById('backToTop'),
                 heroSection: document.getElementById('heroSection'),
                 heroMovieTitle: document.getElementById('heroMovieTitle'),
                 heroMovieTagline: document.getElementById('heroMovieTagline'),
                 searchInput: document.getElementById('searchInput'),
                 searchButton: document.getElementById('searchButton'),
                 categoryNavLinks: document.querySelectorAll('.category-nav-link'), // Use this for main nav + dropdown
                 moviesSectionTitle: document.getElementById('moviesSectionTitle'),
                 moviesContainer: document.getElementById('moviesContainer'),
                 paginationUl: document.getElementById('pagination'),
                 featuredArticlesContainer: document.getElementById('featuredArticlesContainer'), // Added
                 reviewsContainer: document.getElementById('reviewsContainer'),          // Added
                 authArea: document.getElementById('authArea'),
                 userInfo: document.getElementById('userInfo'),
                 usernameDisplay: document.getElementById('usernameDisplay'),
                 logoutButton: document.getElementById('logoutButton'),
                 authButtonsContainer: document.getElementById('authButtons'), // Corrected ID
                 detailModalEl: document.getElementById('detailModal'),
                 detailModal: null, // Initialize later
                 detailModalContent: document.getElementById('detailModalContent'),
                 authModalEl: document.getElementById('authModal'), // The container modal
                 authModal: null, // Initialize later
                 loginForm: document.getElementById('loginForm'),
                 loginError: document.getElementById('loginError'),
                 signupForm: document.getElementById('signupForm'),
                 signupError: document.getElementById('signupError'),
                 qandaSection: document.getElementById('qandaSection'),
                 postQuestionCard: document.getElementById('postQuestionCard'),
                 postQuestionForm: document.getElementById('postQuestionForm'),
                 questionText: document.getElementById('questionText'),
                 questionPostStatus: document.getElementById('questionPostStatus'),
                 qandaLoginPrompt: document.getElementById('qandaLoginPrompt'),
                 questionsList: document.getElementById('questionsList'),
                 togglePostQuestionBtn: document.getElementById('togglePostQuestionBtn'),
                 newsletterFormDummy: document.getElementById('newsletterFormDummy'), // Added
                 newsletterMessageDummy: document.getElementById('newsletterMessageDummy') // Added
             };
             // Initialize Modals safely after DOM is ready and Bootstrap JS is confirmed loaded
             DOMElements.detailModal = new bootstrap.Modal(DOMElements.detailModalEl);
             DOMElements.authModal = new bootstrap.Modal(DOMElements.authModalEl);


            // --- Utilities ---
             const formatCurrency = (amount) => (amount && amount > 0) ? `$${amount.toLocaleString('en-US')}` : 'N/A';
             const formatRuntime = (minutes) => (minutes && minutes > 0) ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'N/A';
             const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
             const formatTimestamp = (fsTimestamp) => {
                 if (!fsTimestamp || typeof fsTimestamp.toDate !== 'function') return 'Invalid date';
                 try {
                     return new Date(fsTimestamp.toDate()).toLocaleString('en-US', {
                         day: 'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit', hour12: true
                     });
                 } catch (e) {
                     console.error("Error formatting timestamp:", fsTimestamp, e);
                     return 'Error displaying date';
                 }
             };
             const getImageUrl = (path, size) => path ? `${IMAGE_BASE_URL}${size}${path}` : null; // Return null if no path
             // Creates a placeholder div with an icon
             const createPlaceholderDiv = (containerClasses, iconClass = 'fa-image', text = '') => `<div class="${containerClasses} placeholder-img"><i class="fas ${iconClass}"></i>${text ? `<span class="ms-2 small">${text}</span>` : ''}</div>`;
             const debounce = (func, delay) => { let timeoutId; return (...args) => { clearTimeout(timeoutId); timeoutId = setTimeout(() => func.apply(this, args), delay); }; };
             const showSpinner = () => DOMElements.spinner?.classList.add('show');
             const hideSpinner = () => DOMElements.spinner?.classList.remove('show');
             const showElement = (el) => el?.classList.remove('d-none');
             const hideElement = (el) => el?.classList.add('d-none');
             // Displays feedback messages (errors/success) in form text elements
             const displayFeedback = (element, message, isError = true) => {
                 if (!element) return;
                 element.textContent = message;
                 element.className = `form-text mt-2 small text-center ${isError ? 'text-danger' : 'text-success'}`; // Use BS text color classes
                 if (message) { setTimeout(() => { if(element) element.textContent = ''; }, 5000); } // Auto-clear after 5s
             };
             // Fetches user data (display name) from Firestore
             const getUserData = async (userId) => {
                 if (!userId || !db) return { displayName: 'Anonymous' }; // Handle missing ID or DB
                 try {
                     const userDoc = await db.collection('users').doc(userId).get();
                     return userDoc.exists ? userDoc.data() : { displayName: 'User' }; // Default if doc doesn't exist
                 } catch (e) {
                     console.error("Error fetching user data for ID:", userId, e);
                     return { displayName: 'Error' }; // Indicate error fetching data
                 }
             };
             // Basic HTML escaping function to prevent XSS
             const escapeHTML = (str) => {
                if (str === null || typeof str === 'undefined') return '';
                return String(str).replace(/[&<>"']/g, (match) => {
                    switch (match) {
                        case '&': return '&amp;';
                        case '<': return '&lt;';
                        case '>': return '&gt;';
                        case '"': return '&quot;';
                        case "'": return '&#39;'; // Use HTML entity for single quote
                        default: return match;
                    }
                });
             };


            // --- Skeleton Renderer ---
            function renderSkeletons(container, count, type = 'movie') {
                if (!container) return;
                let skeletonHTML = '';
                container.innerHTML = ''; // Clear previous content

                if (type === 'movie') {
                    for (let i = 0; i < count; i++) {
                        skeletonHTML += `
                        <div class="col-6 col-sm-4 col-lg-3 mb-4 movie-card-wrapper">
                            <div class="movie-card" style="background-color: var(--cv-secondary-bg);">
                                <div class="movie-poster-container skeleton" style="height: 280px;"></div>
                                <div class="movie-info p-3">
                                    <div class="skeleton mb-2" style="height: 20px; width: 80%; border-radius: 5px;"></div>
                                    <div class="skeleton mb-3" style="height: 14px; width: 40%; border-radius: 5px;"></div>
                                    <div class="skeleton mb-3" style="height: 14px; width: 90%; border-radius: 5px;"></div>
                                     <div class="skeleton mb-3" style="height: 14px; width: 75%; border-radius: 5px;"></div>
                                    <div class="skeleton mt-auto" style="height: 38px; width: 100%; border-radius: var(--cv-border-radius-md);"></div>
                                </div>
                            </div>
                        </div>`;
                    }
                 } else if (type === 'question') {
                    for (let i = 0; i < count; i++) {
                         skeletonHTML += `
                        <div class="question-item mb-3" style="background-color: var(--cv-secondary-bg);">
                            <div class="skeleton mb-3" style="height: 24px; width: 75%; border-radius: 5px;"></div>
                            <div class="d-flex gap-3">
                                <div class="skeleton" style="height: 16px; width: 30%; border-radius: 5px;"></div>
                                <div class="skeleton" style="height: 16px; width: 40%; border-radius: 5px;"></div>
                            </div>
                        </div>`;
                    }
                } else if (type === 'comment') {
                     for (let i = 0; i < count; i++) {
                        skeletonHTML += `
                        <div class="comment-item py-3">
                             <div class="d-flex justify-content-between align-items-center mb-2">
                                 <div class="skeleton" style="height: 16px; width: 30%; border-radius: 5px;"></div>
                                 <div class="skeleton" style="height: 12px; width: 25%; border-radius: 5px;"></div>
                             </div>
                             <div class="skeleton mb-2" style="height: 14px; width: 90%; border-radius: 5px;"></div>
                            <div class="skeleton mb-3" style="height: 14px; width: 70%; border-radius: 5px;"></div>
                            <div class="skeleton" style="height: 16px; width: 20%; border-radius: 5px;"></div>
                        </div>`;
                     }
                 }
                 // Add more types (featured, review) if needed
                 container.innerHTML = skeletonHTML;
             }

            // --- Authentication & UI Updates ---
             auth.onAuthStateChanged(async (user) => {
                 // No spinner here initially, let content load first, then update auth state
                 currentUser = user;
                 if (user) {
                     try {
                        // Fetch user data only if logged in
                        const userData = await getUserData(user.uid);
                        userDisplayName = userData?.displayName || user.email?.split('@')[0] || 'User'; // Use display name, fallback to email part or 'User'
                        DOMElements.usernameDisplay.textContent = escapeHTML(userDisplayName); // Escape display name
                        hideElement(DOMElements.authButtonsContainer);
                        showElement(DOMElements.userInfo);
                        // Logout button is inside userInfo now, no need to show/hide separately if userInfo is handled
                        showElement(DOMElements.togglePostQuestionBtn); // Show Ask Question button
                        hideElement(DOMElements.qandaLoginPrompt);       // Hide login prompt for Q&A
                        DOMElements.postQuestionCard.classList.add('hidden'); // Start with form hidden
                        console.log(`Logged in as: ${userDisplayName} (UID: ${user.uid})`);
                     } catch (error) {
                         console.error("Error fetching user data during auth state change:", error);
                         // Handle error - maybe show default user name or an error message
                         userDisplayName = 'User (Error)';
                         DOMElements.usernameDisplay.textContent = userDisplayName;
                          hideElement(DOMElements.authButtonsContainer);
                         showElement(DOMElements.userInfo);
                     }
                 } else {
                     // Logged out state
                     userDisplayName = 'Guest';
                     currentUser = null;
                     showElement(DOMElements.authButtonsContainer);
                     hideElement(DOMElements.userInfo);
                     hideElement(DOMElements.togglePostQuestionBtn); // Hide Ask Question button
                     DOMElements.postQuestionCard.classList.add('hidden'); // Ensure form is hidden
                     showElement(DOMElements.qandaLoginPrompt);       // Show login prompt for Q&A
                     console.log('User logged out');
                 }
                 // Reload Q&A regardless of login state to show questions correctly
                 // (Permissions for posting/commenting are handled internally by checking currentUser)
                 loadQuestions();
             });

            // Handle User Signup
            async function handleSignup(e){
                e.preventDefault();
                showSpinner();
                const displayNameInput = DOMElements.signupForm.querySelector('#signupDisplayName');
                const emailInput = DOMElements.signupForm.querySelector('#signupEmail');
                const passwordInput = DOMElements.signupForm.querySelector('#signupPassword');
                const displayName = displayNameInput.value.trim();
                const email = emailInput.value.trim();
                const password = passwordInput.value;

                displayFeedback(DOMElements.signupError, ''); // Clear previous errors

                if (!displayName) {
                    displayFeedback(DOMElements.signupError, 'Display Name cannot be empty.');
                    hideSpinner();
                    return;
                }
                 if (password.length < 6) {
                     displayFeedback(DOMElements.signupError, 'Password must be at least 6 characters long.');
                     hideSpinner();
                     return;
                 }

                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    // Update profile and create user document in Firestore
                    await userCredential.user.updateProfile({ displayName: displayName });
                    // Create a document in 'users' collection to store display name (and potentially other info)
                    await db.collection('users').doc(userCredential.user.uid).set({
                        displayName: displayName,
                        email: email, // Store email for reference if needed
                        createdAt: timestamp() // Use the server timestamp function
                    }, { merge: true }); // Merge ensures we don't overwrite other fields if they exist

                    console.log('Signup successful:', userCredential.user.uid);
                    DOMElements.authModal.hide(); // Hide modal on success
                    // No need to manually update UI here, onAuthStateChanged will handle it
                 } catch(error) {
                    console.error("Signup Error:", error);
                    // Provide more user-friendly error messages
                    let message = 'Signup failed. Please try again.';
                    if (error.code === 'auth/email-already-in-use') {
                        message = 'This email address is already registered. Please login or use a different email.';
                    } else if (error.code === 'auth/weak-password') {
                        message = 'Password is too weak. Please use a stronger password (at least 6 characters).';
                    } else if (error.code === 'auth/invalid-email') {
                        message = 'Please enter a valid email address.';
                    }
                    displayFeedback(DOMElements.signupError, message);
                } finally {
                    hideSpinner();
                }
            }

            // Handle User Login
            async function handleLogin(e){
                e.preventDefault();
                showSpinner();
                const emailInput = DOMElements.loginForm.querySelector('#loginEmail');
                const passwordInput = DOMElements.loginForm.querySelector('#loginPassword');
                const email = emailInput.value.trim();
                const password = passwordInput.value;

                displayFeedback(DOMElements.loginError, ''); // Clear previous errors

                try {
                    await auth.signInWithEmailAndPassword(email, password);
                    console.log('Login successful');
                    DOMElements.authModal.hide(); // Hide modal on success
                    // No need to manually update UI here, onAuthStateChanged will handle it
                } catch(error) {
                    console.error("Login Error:", error);
                     let message = 'Login failed. Please check your email and password.';
                     if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        message = 'Invalid email or password. Please try again.';
                    } else if (error.code === 'auth/invalid-email') {
                         message = 'Please enter a valid email address.';
                    }
                     displayFeedback(DOMElements.loginError, message);
                } finally {
                    hideSpinner();
                }
            }

            // Handle User Logout
            async function handleLogout(){
                showSpinner();
                try {
                    await auth.signOut();
                    console.log('Logout successful');
                     // Reset state variables if necessary
                    currentPage = 1;
                    currentCategory = 'popular';
                    currentSearchQuery = '';
                    // UI update is handled by onAuthStateChanged
                } catch(error) {
                    console.error("Logout Error:", error);
                    alert('Logout failed. Please try again.'); // Simple alert for logout error
                } finally {
                    hideSpinner();
                }
            }


             // --- TMDB API Fetcher ---
             async function fetchFromTMDB(endpoint, params = {}) {
                 if (!API_KEY || API_KEY === 'YOUR_TMDB_API_KEY') {
                     console.error("TMDB API Key is missing or placeholder! Cannot fetch data.");
                     throw new Error("API key not configured."); // Throw error to be caught by callers
                 }
                 const url = new URL(`${BASE_URL}/${endpoint}`);
                 url.searchParams.append('api_key', API_KEY);
                 // Add language parameter for potentially localized results
                 url.searchParams.append('language', 'en-US');
                 // Append other parameters
                 Object.entries(params).forEach(([key, value]) => {
                     if (value !== null && value !== undefined && value !== '') { // Avoid empty params
                        url.searchParams.append(key, value);
                     }
                 });

                 console.log(`Fetching TMDB: ${url.toString()}`); // Log the URL being fetched

                 try {
                     const response = await fetch(url);
                     if (!response.ok) {
                         const errorData = await response.json().catch(() => ({})); // Try to get error details
                         console.error(`TMDB API Error ${response.status}: ${response.statusText}`, errorData);
                         throw new Error(`Failed to fetch from TMDB (${response.status}): ${errorData.status_message || response.statusText}`);
                     }
                     return await response.json();
                 } catch (error) {
                     console.error('Network or API error fetching from TMDB:', error);
                     // Re-throw the error so the calling function can handle UI updates
                     throw error;
                 }
             }

             // --- Content Loading & Rendering ---
             async function loadMovies(category = currentCategory, page = 1, query = currentSearchQuery) {
                if (isLoadingMovies) {
                    console.log("Already loading movies, request skipped.");
                    return;
                }
                isLoadingMovies = true;
                showSpinner(); // Show global spinner for main movie loads
                // Update section title immediately
                 let titlePrefix = 'Explore';
                 if (category === 'search' && query) {
                     titlePrefix = `Search Results for "${escapeHTML(query)}"`;
                 } else if (category !== 'search') {
                    // Capitalize and replace underscores for display
                    titlePrefix = `Explore ${category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
                 }
                if(DOMElements.moviesSectionTitle) DOMElements.moviesSectionTitle.textContent = titlePrefix;

                 renderSkeletons(DOMElements.moviesContainer, 12, 'movie'); // Show skeletons while fetching
                 DOMElements.paginationUl.innerHTML = ''; // Clear old pagination

                 try {
                    let data;
                    if (category === 'search' && query) {
                         data = await fetchFromTMDB('search/movie', { query: query, page: page, include_adult: false });
                     } else if (category !== 'search') {
                         data = await fetchFromTMDB(`movie/${category}`, { page: page, include_adult: false });
                     } else {
                         // Should not happen if logic is correct, but handle it
                         DOMElements.moviesContainer.innerHTML = `<div class="col-12 text-center py-5"><p class="text-secondary">Invalid request.</p></div>`;
                         throw new Error("Invalid category/query state");
                     }

                     if (data?.results) {
                         currentPage = page; // Update current page only on success
                         currentCategory = category; // Update category
                         currentSearchQuery = query; // Update search query
                        displayMovies(data.results);
                         totalPages = Math.min(data.total_pages || 0, 500); // TMDB limits to 500 pages
                        createPagination(currentPage, totalPages);
                         // Scroll to the top of the movie section smoothly after loading
                         // DOMElements.explore?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                         console.warn("No results found or invalid data structure:", data);
                         DOMElements.moviesContainer.innerHTML = `<div class="col-12 text-center py-5"><p class="text-secondary">No movies found matching your criteria.</p></div>`;
                         createPagination(1, 0); // No pages if no results
                     }

                 } catch (error) {
                     console.error(`Error loading movies (Category: ${category}, Page: ${page}, Query: ${query}):`, error);
                     DOMElements.moviesContainer.innerHTML = `<div class="col-12 text-center py-5"><div class="alert alert-warning">Could not load movies. ${error.message}</div></div>`;
                     createPagination(1, 0); // Reset pagination on error
                 } finally {
                    hideSpinner();
                    isLoadingMovies = false;
                 }
             }

             function displayMovies(movies) {
                 if(!DOMElements.moviesContainer) return;
                 DOMElements.moviesContainer.innerHTML = ''; // Clear skeletons or previous content

                 if (!movies || movies.length === 0) {
                     DOMElements.moviesContainer.innerHTML = `<div class="col-12 text-center py-5"><p class="text-secondary fst-italic">No movies found for this selection.</p></div>`;
                     return;
                 }

                 movies.forEach(movie => {
                     const posterUrl = getImageUrl(movie.poster_path, POSTER_SIZE);
                     const posterHTML = posterUrl
                        ? `<img src="${posterUrl}" alt="${escapeHTML(movie.title || 'Movie Poster')}" class="movie-poster" loading="lazy">`
                        : createPlaceholderDiv('movie-poster', PLACEHOLDER_MOVIE_ICON); // Use utility for placeholder

                     const ratingHTML = movie.vote_average && movie.vote_average > 0
                         ? `<div class="movie-rating"><i class="fas fa-star"></i><span>${movie.vote_average.toFixed(1)}</span></div>`
                         : ''; // Don't show rating if 0 or null

                     // Truncate overview for the card
                     const overviewSnippet = movie.overview
                        ? escapeHTML(movie.overview.substring(0, 70) + (movie.overview.length > 70 ? '...' : ''))
                        : 'No overview available.';

                     const movieElement = document.createElement('div');
                     movieElement.className = 'col-6 col-sm-4 col-lg-3 mb-4 movie-card-wrapper'; // Ensure correct grid classes
                     movieElement.innerHTML = `
                         <div class="movie-card" data-movie-id="${movie.id}" role="button" tabindex="0" aria-label="View details for ${escapeHTML(movie.title || 'this movie')}">
                             <div class="movie-poster-container">
                                 ${posterHTML}
                                 ${ratingHTML}
                             </div>
                             <div class="movie-info">
                                 <h3 class="movie-title">${escapeHTML(movie.title || 'Untitled Movie')}</h3>
                                 <p class="movie-date">${formatDate(movie.release_date)}</p>
                                 <p class="movie-overview">${overviewSnippet}</p>
                                 <button class="btn movie-card-button mt-auto" aria-hidden="true">View Details</button> <!-- Button is mainly visual cue -->
                             </div>
                         </div>`;

                     // Add click listener directly to the card
                     const cardElement = movieElement.querySelector('.movie-card');
                     if (cardElement) {
                         cardElement.addEventListener('click', () => showDetailModal('movie', movie.id));
                         // Add keypress listener for accessibility (Enter key)
                         cardElement.addEventListener('keypress', (e) => {
                             if (e.key === 'Enter' || e.key === ' ') {
                                 showDetailModal('movie', movie.id);
                             }
                         });
                     }
                     DOMElements.moviesContainer.appendChild(movieElement);
                 });
             }

            // Load a random popular movie for the Hero section background and title
            async function loadHeroMovie() {
                try {
                    const data = await fetchFromTMDB('movie/popular', { page: 1 });
                    if (data?.results?.length > 0) {
                        const randomMovie = data.results[Math.floor(Math.random() * Math.min(data.results.length, 10))]; // Pick from top 10
                        const backdropUrl = getImageUrl(randomMovie.backdrop_path || randomMovie.poster_path, BACKDROP_SIZE);

                        if (DOMElements.heroMovieTitle) DOMElements.heroMovieTitle.textContent = escapeHTML(randomMovie.title || 'Discover Amazing Movies');
                        if (DOMElements.heroMovieTagline) DOMElements.heroMovieTagline.textContent = escapeHTML(randomMovie.tagline || randomMovie.overview?.substring(0, 100) + '...' || 'Explore, discuss, and rate your favorite films.');

                        if (backdropUrl && DOMElements.heroSection) {
                            DOMElements.heroSection.style.backgroundImage = `url(${backdropUrl})`;
                        } else {
                            // Keep default background color if no backdrop
                             DOMElements.heroSection.style.backgroundImage = 'none';
                            DOMElements.heroSection.style.backgroundColor = 'var(--cv-secondary-bg)';
                        }
                    }
                } catch (error) {
                    console.error("Error loading hero movie:", error);
                    // Keep default text if fetch fails
                     if (DOMElements.heroMovieTitle) DOMElements.heroMovieTitle.textContent = 'Your Cinematic Universe';
                     if (DOMElements.heroMovieTagline) DOMElements.heroMovieTagline.textContent = 'Dive deep into films and connect with fellow movie lovers.';
                     if (DOMElements.heroSection) {
                        DOMElements.heroSection.style.backgroundImage = 'none';
                        DOMElements.heroSection.style.backgroundColor = 'var(--cv-secondary-bg)';
                     }
                }
            }

            // Placeholder function for loading Featured/Reviews - IMPLEMENT DYNAMICALLY LATER
            function loadFeaturedAndReviews() {
                console.log("Static featured articles and reviews shown. Implement dynamic loading from Firestore or another source if needed.");
                // Example: You might fetch 'featured_posts' or 'recent_reviews' collections from Firestore
                // renderSkeletons(DOMElements.featuredArticlesContainer, 3, 'article'); // Example skeleton type
                // renderSkeletons(DOMElements.reviewsContainer, 3, 'review'); // Example skeleton type
                // fetchFirestoreCollection('featured_posts').then(renderFeatured);
                // fetchFirestoreCollection('recent_reviews').then(renderReviews);
            }

            // --- Modal Rendering (Unified Controller) ---
            async function showDetailModal(type, id) {
                if (isLoadingDetails) {
                     console.log("Already loading details, request skipped.");
                     return;
                 }
                 isLoadingDetails = true;
                 // Show modal immediately with loading state
                 DOMElements.detailModalContent.innerHTML = `
                    <div class="text-center p-5 vh-50 d-flex align-items-center justify-content-center">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                            <span class="visually-hidden">Loading details...</span>
                        </div>
                    </div>`;
                 DOMElements.detailModal.show();

                 try {
                     if (type === 'movie') {
                         await renderMovieModalContent(id);
                     } else if (type === 'question') {
                         await renderQAModalContent(id);
                     } else {
                         throw new Error(`Invalid detail type requested: ${type}`);
                     }
                 } catch (error) {
                     console.error(`Error rendering ${type} detail modal for ID ${id}:`, error);
                     DOMElements.detailModalContent.innerHTML = `
                        <div class="container p-4 py-5">
                             <div class="alert alert-danger text-center">
                                 <h5 class="alert-heading">Error Loading Details</h5>
                                 <p>We couldn't load the details for this item. Please try again later.</p>
                                 <small>(${escapeHTML(error.message)})</small>
                             </div>
                         </div>`;
                 } finally {
                     isLoadingDetails = false;
                     // Ensure modal body is scrollable from the top after content load/error
                    const modalBody = DOMElements.detailModalEl.querySelector('.modal-body');
                    if (modalBody) modalBody.scrollTop = 0;
                 }
             }

            // Render Movie Details in Modal
            async function renderMovieModalContent(movieId) {
                const movieData = await fetchFromTMDB(`movie/${movieId}`, { append_to_response: 'credits,videos,images,release_dates' });

                if (!movieData) throw new Error('Movie data not found from API.');

                 const backdropUrl = getImageUrl(movieData.backdrop_path || movieData.poster_path, BACKDROP_SIZE);
                 const posterUrl = getImageUrl(movieData.poster_path, POSTER_SIZE);

                 // Find Director
                 const director = movieData.credits?.crew?.find(person => person.job === 'Director')?.name || 'N/A';

                // Get Top Billed Cast (e.g., top 10-12)
                const cast = movieData.credits?.cast?.slice(0, 12) || [];
                const castHTML = cast.length > 0 ? cast.map(person => {
                     const profileUrl = getImageUrl(person.profile_path, PROFILE_SIZE);
                     const profileHTML = profileUrl
                        ? `<img src="${profileUrl}" alt="${escapeHTML(person.name)}" class="cast-image" loading="lazy">`
                        : createPlaceholderDiv('cast-image', PLACEHOLDER_PROFILE_ICON); // Placeholder icon
                    return `
                         <div class="cast-card">
                             <div class="cast-image-container">${profileHTML}</div>
                             <div class="cast-info">
                                 <p class="cast-name" title="${escapeHTML(person.name)}">${escapeHTML(person.name || '?')}</p>
                                 <p class="cast-character" title="${escapeHTML(person.character)}">${escapeHTML(person.character || '')}</p>
                             </div>
                         </div>`;
                 }).join('') : '<p class="text-secondary small ms-1 fst-italic">No cast information available.</p>';

                 // Get Genres
                 const genresHTML = movieData.genres?.length > 0
                    ? movieData.genres.map(g => `<span class="genre-badge">${escapeHTML(g.name)}</span>`).join('')
                    : 'N/A';

                 // Find Official Trailer on YouTube
                 const trailer = movieData.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official);
                 const trailerHTML = trailer
                    ? `<div class="trailer-container mt-4">
                         <h5 class="modal-section-title">Trailer</h5>
                         <div class="ratio ratio-16x9">
                            <iframe class="trailer-iframe" src="https://www.youtube.com/embed/${trailer.key}" title="${escapeHTML(trailer.name || movieData.title + ' Trailer')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
                        </div>
                       </div>`
                    : ''; // No trailer section if not found

                // Get Production Companies with Logos (limit to a few)
                const companies = movieData.production_companies?.filter(c => c.logo_path).slice(0, 6) || [];
                const companiesHTML = companies.length > 0 ? companies.map(c => {
                     const logoUrl = getImageUrl(c.logo_path, LOGO_SIZE);
                     return logoUrl ? `<img src="${logoUrl}" alt="${escapeHTML(c.name)}" class="prod-company" title="${escapeHTML(c.name)}">` : '';
                 }).join('') : '<p class="text-secondary small ms-1 fst-italic">N/A</p>';

                // Find US Certification (Rating like PG-13, R)
                let certification = 'N/A';
                 const usRelease = movieData.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
                if (usRelease?.release_dates?.length > 0) {
                    // Find the first certification that isn't empty
                    certification = usRelease.release_dates.find(rd => rd.certification)?.certification || 'N/A';
                }


                 // Assemble the modal content HTML
                 DOMElements.detailModalContent.innerHTML = `
                     <div class="modal-backdrop-container">
                         ${backdropUrl ? `<img src="${backdropUrl}" alt="${escapeHTML(movieData.title || '')} backdrop" class="modal-movie-backdrop">` : createPlaceholderDiv('modal-movie-backdrop', PLACEHOLDER_MOVIE_ICON)}
                     </div>
                     <div class="container modal-body-content">
                         <div class="row mb-4">
                             <div class="col-md-4 text-center text-md-start mb-4 mb-md-0">
                                 ${posterUrl ? `<img src="${posterUrl}" alt="${escapeHTML(movieData.title || '')} poster" class="modal-movie-poster img-fluid">` : createPlaceholderDiv('modal-movie-poster w-100', PLACEHOLDER_MOVIE_ICON)}
                             </div>
                             <div class="col-md-8 d-flex flex-column justify-content-center">
                                 <h2 class="modal-movie-title">${escapeHTML(movieData.title || 'Untitled Movie')}</h2>
                                 ${movieData.tagline ? `<p class="modal-movie-tagline">${escapeHTML(movieData.tagline)}</p>` : ''}
                                 <div class="modal-movie-meta">
                                     ${movieData.vote_average ? `<div class="meta-item" title="Rating"><i class="fas fa-star meta-icon"></i><span>${movieData.vote_average.toFixed(1)}/10</span> <small class="text-tertiary">(${movieData.vote_count?.toLocaleString() || 0} votes)</small></div>` : ''}
                                     ${movieData.release_date ? `<div class="meta-item" title="Release Date"><i class="fas fa-calendar-alt meta-icon"></i><span>${formatDate(movieData.release_date)}</span></div>` : ''}
                                     ${movieData.runtime ? `<div class="meta-item" title="Runtime"><i class="fas fa-clock meta-icon"></i><span>${formatRuntime(movieData.runtime)}</span></div>` : ''}
                                     ${certification !== 'N/A' ? `<div class="meta-item" title="Certification"><i class="fas fa-certificate meta-icon"></i><span>${escapeHTML(certification)}</span></div>` : ''}
                                     ${movieData.status ? `<div class="meta-item" title="Status"><i class="fas fa-check-circle meta-icon"></i><span>${escapeHTML(movieData.status)}</span></div>` : ''}
                                 </div>
                                 <div class="my-4 genres-container">
                                     ${genresHTML}
                                 </div>
                             </div>
                         </div>

                         ${movieData.overview ? `<div class="mt-4"><h5 class="modal-section-title">Overview</h5><p class="text-secondary lh-lg">${escapeHTML(movieData.overview)}</p></div>` : ''}

                         <div class="row mt-4 g-3 justify-content-around text-center text-md-start">
                             <div class="col-md-4">
                                 <h6 class="fw-bold text-light mb-1">Director</h6>
                                 <p class="text-secondary mb-0">${escapeHTML(director)}</p>
                             </div>
                             ${movieData.budget > 0 ? `<div class="col-md-4"><h6 class="fw-bold text-light mb-1">Budget</h6><p class="text-secondary mb-0">${formatCurrency(movieData.budget)}</p></div>` : ''}
                            ${movieData.revenue > 0 ? `<div class="col-md-4"><h6 class="fw-bold text-light mb-1">Revenue</h6><p class="text-secondary mb-0">${formatCurrency(movieData.revenue)}</p></div>` : ''}
                         </div>

                         ${cast.length > 0 ? `<div class="cast-section mt-4"><h5 class="modal-section-title">Top Billed Cast</h5><div class="cast-scroll">${castHTML}</div></div>` : ''}

                         ${trailerHTML}

                         ${companies.length > 0 ? `<div class="mt-4"><h5 class="modal-section-title">Production Companies</h5><div class="prod-companies-list">${companiesHTML}</div></div>` : ''}

                         <div class="text-center mt-5">
                             <a href="https://www.themoviedb.org/movie/${movieData.id}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-light btn-sm">
                                 <i class="fas fa-external-link-alt me-2"></i> View Full Details on TMDb
                             </a>
                         </div>
                     </div>`;
             }

             // Render Q&A Details (Question + Comments) in Modal
            async function renderQAModalContent(questionId) {
                 try {
                     const questionDoc = await db.collection('questions').doc(questionId).get();
                     if (!questionDoc.exists) {
                         throw new Error("Question not found or has been deleted.");
                     }
                     const questionData = { id: questionDoc.id, ...questionDoc.data() };

                     // Fetch the author's display name
                     const authorData = await getUserData(questionData.userId);

                     // Initial HTML structure for the Q&A modal
                     DOMElements.detailModalContent.innerHTML = `
                         <div class="container p-4 py-5">
                             <h2 class="modal-movie-title mb-2">${escapeHTML(questionData.text)}</h2>
                             <p class="text-secondary mb-4 small">
                                 Asked by <strong class="text-info">${escapeHTML(authorData.displayName)}</strong>
                                 on ${formatTimestamp(questionData.timestamp)}
                             </p>
                             <hr class="border-secondary opacity-50">

                             <h5 class="modal-section-title mt-4 mb-3">Community Answers</h5>
                             <div id="commentsContainer" class="mb-4 comments-scrollable">
                                 <!-- Comments will be loaded here -->
                                ${renderSkeletons(null, 3, 'comment')} <!-- Render skeleton HTML directly -->
                             </div>

                             <div id="addCommentSection" class="mt-4">
                                 ${currentUser ? `
                                     <form id="addCommentForm">
                                         <h6 class="modal-section-title small-title fs-6 mb-2">Leave a Comment</h6>
                                         <input type="hidden" id="commentQuestionId" value="${escapeHTML(questionId)}">
                                         <div class="mb-2">
                                             <label for="commentText" class="visually-hidden">Your comment</label>
                                             <textarea class="form-control" id="commentText" rows="3" placeholder="Share your thoughts or answer..." required></textarea>
                                         </div>
                                         <button type="submit" class="btn btn-sm btn-primary"><i class="fas fa-paper-plane me-1"></i> Post Comment</button>
                                         <div id="commentPostStatus" class="form-text mt-2 small d-inline-block ms-2"></div>
                                     </form>
                                 ` : `
                                     <p class="text-center text-secondary small mt-4 fst-italic">
                                         Please <a href="#" class="link-info" data-bs-dismiss="modal" data-bs-toggle="modal" data-bs-target="#authModal" onclick="setActiveAuthTab('login')">log in</a> or <a href="#" class="link-info" data-bs-dismiss="modal" data-bs-toggle="modal" data-bs-target="#authModal" onclick="setActiveAuthTab('signup')">sign up</a> to add a comment.
                                     </p>
                                 `}
                             </div>
                         </div>`;

                     // Attach event listener if the form exists
                     const addCommentForm = document.getElementById('addCommentForm');
                     if (addCommentForm) {
                         addCommentForm.addEventListener('submit', handleAddComment);
                     }

                     // Load the actual comments
                     loadComments(questionId);

                 } catch (err) {
                     console.error("Error rendering Q&A modal content:", err);
                     // Display error within the modal content area
                     DOMElements.detailModalContent.innerHTML = `
                        <div class="container p-4 py-5">
                             <div class="alert alert-danger text-center">
                                 <h5 class="alert-heading">Error Loading Question</h5>
                                 <p>We couldn't load the details for this question. It might have been removed or there was a network issue.</p>
                                 <small>(${escapeHTML(err.message)})</small>
                             </div>
                         </div>`;
                 }
             }


            // --- Q&A Logic (Firestore Interactions) ---

            // Load Questions for the main page
            async function loadQuestions() {
                 if (!DOMElements.questionsList || !db) return; // Ensure element and DB exist
                 renderSkeletons(DOMElements.questionsList, 5, 'question'); // Show skeletons

                 try {
                     const snapshot = await db.collection('questions')
                                             .orderBy('timestamp', 'desc')
                                             .limit(20) // Load more questions initially
                                             .get();

                     if (snapshot.empty) {
                         DOMElements.questionsList.innerHTML = '<p class="text-center text-secondary mt-4 fst-italic">Be the first to ask a question!</p>';
                         return;
                     }

                     // Fetch author data in parallel for efficiency
                     const authorPromises = snapshot.docs.map(doc => getUserData(doc.data().userId));
                     const authorDataArray = await Promise.all(authorPromises);

                     let questionsHTML = '';
                     snapshot.docs.forEach((doc, index) => {
                         const question = { id: doc.id, ...doc.data() };
                         const author = authorDataArray[index] || { displayName: 'Anonymous' }; // Fallback

                         questionsHTML += `
                         <div class="question-item" data-question-id="${question.id}" role="button" tabindex="0" aria-label="View question: ${escapeHTML(question.text)}">
                             <p class="question-text mb-2">${escapeHTML(question.text)}</p>
                             <div class="question-meta">
                                 <span title="Author"><i class="fas fa-user"></i> <span class="author-name">${escapeHTML(author.displayName)}</span></span>
                                 <span title="Asked Date"><i class="fas fa-clock"></i> ${formatTimestamp(question.timestamp)}</span>
                                 <!-- Optionally add comment count later -->
                                 <!-- <span title="Answers"><i class="fas fa-comments"></i> ${question.commentCount || 0}</span> -->
                             </div>
                         </div>`;
                     });

                     DOMElements.questionsList.innerHTML = questionsHTML;

                     // Add event listeners to the newly created question items
                     DOMElements.questionsList.querySelectorAll('.question-item').forEach(item => {
                         item.addEventListener('click', () => showDetailModal('question', item.dataset.questionId));
                         item.addEventListener('keypress', (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                 showDetailModal('question', item.dataset.questionId);
                             }
                         });
                     });

                 } catch (err) {
                     console.error("Error loading questions:", err);
                     DOMElements.questionsList.innerHTML = '<p class="text-center text-danger mt-3">Could not load questions at this time. Please try again later.</p>';
                 }
             }

            // Handle Posting a New Question
            async function handlePostQuestion(e) {
                 e.preventDefault();
                 if (!currentUser) {
                     displayFeedback(DOMElements.questionPostStatus, "You must be logged in to ask a question.");
                     // Optionally show login modal
                     // DOMElements.authModal.show();
                     // setActiveAuthTab('login');
                     return;
                 }

                 const questionTextInput = DOMElements.questionText;
                 const text = questionTextInput.value.trim();

                 if (!text) {
                     displayFeedback(DOMElements.questionPostStatus, "Question cannot be empty.");
                     return;
                 }
                 if (text.length > 1000) { // Add a length limit
                      displayFeedback(DOMElements.questionPostStatus, "Question is too long (max 1000 characters).");
                     return;
                 }

                 showSpinner();
                 displayFeedback(DOMElements.questionPostStatus, ''); // Clear previous status

                 try {
                     await db.collection('questions').add({
                         userId: currentUser.uid,
                         text: text, // Store the raw text, escape it on display
                         timestamp: timestamp(), // Use server timestamp function
                         likeCount: 0, // Initialize like count (though maybe not needed for questions)
                         commentCount: 0 // Initialize comment count
                     });

                     questionTextInput.value = ''; // Clear the input field
                     displayFeedback(DOMElements.questionPostStatus, "Question posted successfully!", false); // Success message
                     DOMElements.postQuestionCard.classList.add('hidden'); // Hide the form again
                     loadQuestions(); // Refresh the questions list
                 } catch (err) {
                     console.error("Error posting question:", err);
                     displayFeedback(DOMElements.questionPostStatus, "Error posting question. Please try again.");
                 } finally {
                     hideSpinner();
                 }
             }

            // Load Comments for a specific Question within the Modal
            async function loadComments(questionId) {
                 const commentsContainer = document.getElementById('commentsContainer'); // Get container inside the modal
                 if (!commentsContainer || !db) return;

                 renderSkeletons(commentsContainer, 3, 'comment'); // Show comment skeletons

                 try {
                     const snapshot = await db.collection('comments')
                                             .where('questionId', '==', questionId)
                                             .orderBy('timestamp', 'asc') // Show oldest comments first
                                             .get();

                     if (snapshot.empty) {
                         commentsContainer.innerHTML = '<p class="text-center text-secondary small fst-italic mt-3">Be the first to share your thoughts!</p>';
                         return;
                     }

                     // Fetch author data and like status for all comments in parallel
                     const commentPromises = snapshot.docs.map(async (doc) => {
                         const comment = { id: doc.id, ...doc.data() };
                         const authorPromise = getUserData(comment.userId);
                         // Check if the current user liked this comment (only if logged in)
                         const likedPromise = currentUser ? checkIfLiked(comment.id, currentUser.uid) : Promise.resolve(false);
                         const [authorData, isLiked] = await Promise.all([authorPromise, likedPromise]);
                         return { ...comment, authorData, isLiked };
                     });

                     const commentsWithDetails = await Promise.all(commentPromises);

                     let commentsHTML = '';
                     commentsWithDetails.forEach(comment => {
                         const likeCount = comment.likeCount || 0;
                         const likedClass = comment.isLiked ? 'liked' : '';
                         const likeIconClass = comment.isLiked ? 'fas fa-heart' : 'far fa-heart'; // Solid or regular heart

                         commentsHTML += `
                         <div class="comment-item" id="comment-${comment.id}">
                             <div class="d-flex justify-content-between align-items-baseline">
                                 <strong class="comment-author">${escapeHTML(comment.authorData?.displayName || 'Anonymous')}</strong>
                                 <span class="comment-timestamp">${formatTimestamp(comment.timestamp)}</span>
                             </div>
                             <p class="comment-text mt-2">${escapeHTML(comment.text)}</p>
                             <div class="comment-actions">
                                 <button class="btn btn-link text-decoration-none p-0 like-button ${likedClass}" data-comment-id="${comment.id}" onclick="handleLikeToggle(this)" aria-pressed="${comment.isLiked}">
                                     <i class="${likeIconClass} me-1"></i>Like
                                 </button>
                                 <span class="like-count text-secondary ms-2" aria-live="polite">${likeCount}</span>
                             </div>
                         </div>`;
                     });

                     commentsContainer.innerHTML = commentsHTML;

                 } catch (err) {
                     console.error(`Error loading comments for question ${questionId}:`, err);
                     commentsContainer.innerHTML = '<p class="text-center text-danger small">Could not load comments at this time.</p>';
                 }
            }

            // Handle Adding a New Comment
            async function handleAddComment(e) {
                 e.preventDefault();
                 if (!currentUser) {
                     // Should ideally not happen as the form is hidden, but double-check
                     alert("You must be logged in to comment.");
                     return;
                 }

                 const commentTextInput = document.getElementById('commentText');
                 const questionIdInput = document.getElementById('commentQuestionId');
                 const commentStatus = document.getElementById('commentPostStatus');

                 if (!commentTextInput || !questionIdInput || !commentStatus) {
                     console.error("Comment form elements not found.");
                     return;
                 }

                 const text = commentTextInput.value.trim();
                 const questionId = questionIdInput.value;

                 displayFeedback(commentStatus, ''); // Clear previous status

                 if (!text) {
                     displayFeedback(commentStatus, "Comment cannot be empty.");
                     return;
                 }
                  if (text.length > 2000) { // Add a length limit
                      displayFeedback(commentStatus, "Comment is too long (max 2000 characters).");
                     return;
                 }
                 if (!questionId) {
                     displayFeedback(commentStatus, "Error: Question ID missing.");
                     return;
                 }

                 showSpinner(); // Use global spinner for potentially slower operations

                 try {
                     // Add the comment
                     const commentRef = await db.collection('comments').add({
                         questionId: questionId,
                         userId: currentUser.uid,
                         text: text, // Store raw text, escape on display
                         likeCount: 0,
                         timestamp: timestamp()
                     });

                    // Increment commentCount on the question using a transaction for atomicity
                    const questionRef = db.collection('questions').doc(questionId);
                    await db.runTransaction(async (transaction) => {
                        const questionDoc = await transaction.get(questionRef);
                        if (!questionDoc.exists) {
                             throw "Question does not exist."; // Or handle gracefully
                        }
                        const newCount = (questionDoc.data().commentCount || 0) + 1;
                        transaction.update(questionRef, { commentCount: newCount });
                     });


                     commentTextInput.value = ''; // Clear input
                     displayFeedback(commentStatus, "Comment posted!", false);
                     loadComments(questionId); // Reload comments in the modal

                 } catch (err) {
                     console.error("Error posting comment:", err);
                     displayFeedback(commentStatus, "Error posting comment. Please try again.");
                 } finally {
                     hideSpinner();
                 }
            }

            // Check if a user has liked a specific comment
            async function checkIfLiked(commentId, userId) {
                 if (!userId || !commentId || !db) return false;
                 try {
                     const likeDocRef = db.collection('likes').doc(`${userId}_${commentId}`);
                     const likeDoc = await likeDocRef.get();
                     return likeDoc.exists;
                 } catch (err) {
                     console.error(`Error checking like status for comment ${commentId}:`, err);
                     return false; // Assume not liked if error occurs
                 }
             }

            // Toggle Like/Unlike on a Comment (Made globally accessible via window)
            window.handleLikeToggle = async function(buttonElement) {
                 if (!currentUser) {
                     // Prompt login if not logged in
                     try {
                         DOMElements.authModal.show();
                         setActiveAuthTab('login');
                     } catch(e){ console.error("Failed to show auth modal", e); }
                     return;
                 }

                 const commentId = buttonElement.dataset.commentId;
                 if (!commentId) {
                     console.error("Like toggle failed: Missing comment ID.");
                     return;
                 }

                 // Disable button temporarily to prevent rapid clicks
                 buttonElement.disabled = true;
                 const likeIcon = buttonElement.querySelector('i');
                 const likeCountSpan = buttonElement.parentElement.querySelector('.like-count');

                 const commentRef = db.collection('comments').doc(commentId);
                 // Use a compound ID for the like document to ensure uniqueness per user/comment
                 const likeDocRef = db.collection('likes').doc(`${currentUser.uid}_${commentId}`);

                 try {
                    let likeChange = 0; // To update local count optimistically
                    const isCurrentlyLiked = buttonElement.classList.contains('liked');

                    // Use a transaction to ensure atomicity of checking like and updating counts
                    await db.runTransaction(async (transaction) => {
                        const likeDoc = await transaction.get(likeDocRef);
                        const commentDoc = await transaction.get(commentRef);

                        if (!commentDoc.exists) {
                            throw new Error("Comment no longer exists.");
                        }
                        const currentLikeCount = commentDoc.data().likeCount || 0;

                        if (!isCurrentlyLiked) { // User wants to like
                             if (!likeDoc.exists) { // Make sure they haven't already liked it concurrently
                                 transaction.set(likeDocRef, { userId: currentUser.uid, commentId: commentId, timestamp: timestamp() });
                                transaction.update(commentRef, { likeCount: increment(1) });
                                likeChange = 1;
                             } else {
                                 // Already liked in DB (UI was out of sync?), ensure count is correct if possible
                                 // Or just do nothing / log warning
                                 console.warn("Like button UI desynced? Like already exists in DB.");
                             }
                        } else { // User wants to unlike
                             if (likeDoc.exists) { // Make sure the like exists to be removed
                                 transaction.delete(likeDocRef);
                                 // Prevent count from going below zero
                                if (currentLikeCount > 0) {
                                     transaction.update(commentRef, { likeCount: increment(-1) });
                                 } else {
                                     // If count is already 0, ensure it stays 0 (Firestore increments might behave oddly)
                                     transaction.update(commentRef, { likeCount: 0 });
                                 }
                                likeChange = -1;
                            } else {
                                 console.warn("Like button UI desynced? Like does not exist in DB to remove.");
                                 // Optionally fix local UI if needed, but transaction prevents negative counts
                            }
                        }
                    });

                    // Update UI optimistically ONLY if the transaction likely succeeded (likeChange is set)
                     if (likeChange !== 0) {
                        buttonElement.classList.toggle('liked');
                        likeIcon.className = buttonElement.classList.contains('liked') ? 'fas fa-heart me-1' : 'far fa-heart me-1';
                         buttonElement.setAttribute('aria-pressed', buttonElement.classList.contains('liked'));
                        const currentCount = parseInt(likeCountSpan.textContent || '0');
                        // Ensure count doesn't go below 0 visually
                        likeCountSpan.textContent = Math.max(0, currentCount + likeChange);
                    } else if (!isCurrentlyLiked && likeChange === 0){
                         // Fix UI if user tried to like but DB said already liked
                         buttonElement.classList.add('liked');
                         likeIcon.className = 'fas fa-heart me-1';
                         buttonElement.setAttribute('aria-pressed', 'true');
                    } else if (isCurrentlyLiked && likeChange === 0) {
                         // Fix UI if user tried to unlike but DB said not liked
                         buttonElement.classList.remove('liked');
                         likeIcon.className = 'far fa-heart me-1';
                          buttonElement.setAttribute('aria-pressed', 'false');
                    }


                 } catch (err) {
                     console.error("Like toggle transaction failed:", err);
                     alert("Failed to update like status. Please try again.");
                     // Revert UI changes if necessary (or reload comments)
                 } finally {
                     // Re-enable button after operation completes or fails
                     buttonElement.disabled = false;
                 }
             }


             // --- Pagination ---
             function createPagination(currentPage, totalPages) {
                const container = DOMElements.paginationUl;
                if (!container) return;
                container.innerHTML = ''; // Clear previous pagination

                if (totalPages <= 1) return; // No pagination needed for 1 or 0 pages

                 const maxVisiblePages = 5; // Max number of page number links to show (excluding prev/next)
                 let startPage, endPage;

                 if (totalPages <= maxVisiblePages + 2) { // Show all pages if total is small
                     startPage = 1;
                     endPage = totalPages;
                 } else {
                     // Calculate start and end pages with ellipsis logic
                     const maxPagesBeforeCurrent = Math.floor(maxVisiblePages / 2);
                     const maxPagesAfterCurrent = Math.ceil(maxVisiblePages / 2) - 1;

                     if (currentPage <= maxPagesBeforeCurrent + 1) {
                         // Near the beginning
                         startPage = 1;
                         endPage = maxVisiblePages;
                     } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
                         // Near the end
                         startPage = totalPages - maxVisiblePages + 1;
                         endPage = totalPages;
                     } else {
                         // In the middle
                         startPage = currentPage - maxPagesBeforeCurrent;
                         endPage = currentPage + maxPagesAfterCurrent;
                     }
                 }

                 // Helper function to create a page item
                 const createPageItem = (page, label, isDisabled = false, isActive = false, isEllipsis = false) => {
                     const li = document.createElement('li');
                    li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;

                     const a = document.createElement('a');
                     a.className = 'page-link';
                     a.href = '#explore'; // Link to the explore section
                     a.innerHTML = label; // Use innerHTML for icons

                     if (isEllipsis || isDisabled) {
                         a.setAttribute('aria-disabled', 'true');
                         a.style.cursor = 'default'; // Indicate non-clickable
                     } else {
                         a.setAttribute('aria-label', typeof page === 'number' ? `Go to page ${page}` : label);
                         a.addEventListener('click', (e) => {
                             e.preventDefault();
                             if (currentPage !== page) {
                                 // Scroll to top of movie section before loading new page
                                const exploreSection = document.getElementById('explore');
                                if (exploreSection) {
                                     window.scrollTo({
                                         top: exploreSection.offsetTop - 80, // Adjust for navbar height
                                         behavior: 'smooth'
                                     });
                                }
                                // Add small delay for scroll before loading
                                setTimeout(() => {
                                     loadMovies(currentCategory, page, currentSearchQuery);
                                 }, 150); // Adjust delay as needed
                             }
                         });
                     }
                     li.appendChild(a);
                     return li;
                 };

                 // Previous Button
                 container.appendChild(createPageItem(currentPage - 1, '<i class="fas fa-chevron-left"></i>', currentPage === 1));

                 // First Page and Ellipsis (if needed)
                 if (startPage > 1) {
                     container.appendChild(createPageItem(1, '1'));
                     if (startPage > 2) {
                         container.appendChild(createPageItem(0, '...', true, false, true)); // Ellipsis item
                     }
                 }

                 // Page Number Links
                 for (let i = startPage; i <= endPage; i++) {
                     container.appendChild(createPageItem(i, i.toString(), false, i === currentPage));
                 }

                 // Ellipsis and Last Page (if needed)
                 if (endPage < totalPages) {
                     if (endPage < totalPages - 1) {
                         container.appendChild(createPageItem(0, '...', true, false, true)); // Ellipsis item
                     }
                     container.appendChild(createPageItem(totalPages, totalPages.toString()));
                 }

                 // Next Button
                 container.appendChild(createPageItem(currentPage + 1, '<i class="fas fa-chevron-right"></i>', currentPage === totalPages));
             }

             // --- Helper to activate auth modal tab ---
             window.setActiveAuthTab = function(tabId) { // Make global for onclick attributes
                 const tabTriggerEl = document.querySelector(`#nav-${tabId}-tab`);
                 const authModalInstance = bootstrap.Modal.getInstance(DOMElements.authModalEl); // Get modal instance

                 if (tabTriggerEl && bootstrap?.Tab && authModalInstance) {
                    // Ensure the modal is shown *before* trying to activate the tab if called from outside
                     if (!DOMElements.authModalEl.classList.contains('show')) {
                         authModalInstance.show();
                         // Showing is async, add a slight delay or use event listener for 'shown.bs.modal'
                         setTimeout(() => {
                             const tab = bootstrap.Tab.getOrCreateInstance(tabTriggerEl);
                             tab.show();
                         }, 150); // Adjust delay if needed
                    } else {
                        // If modal is already shown, just show the tab
                        const tab = bootstrap.Tab.getOrCreateInstance(tabTriggerEl);
                        tab.show();
                    }
                 } else {
                     console.warn(`Tab trigger for '${tabId}' not found, Bootstrap Tab component missing, or Auth Modal instance missing.`);
                 }
             }

            // --- Setup Event Listeners ---
            function setupEventListeners() {
                 console.log("Setting up event listeners...");

                 // Navbar Category Links & Dropdown Category Links
                 DOMElements.categoryNavLinks.forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const category = link.dataset.category;
                        if (category && category !== currentCategory) {
                            console.log(`Category selected: ${category}`);
                            // Update active state on nav links (optional, could be complex)
                            // Reset search and load
                            DOMElements.searchInput.value = '';
                            currentSearchQuery = '';
                             loadMovies(category, 1); // Load first page of new category
                             // Close dropdown if it's open (for mobile)
                             const navbarCollapse = document.getElementById('navbarNav');
                             if (navbarCollapse && navbarCollapse.classList.contains('show')) {
                                 bootstrap.Collapse.getInstance(navbarCollapse)?.hide();
                             }
                         } else if (category) {
                            console.log(`Category '${category}' already active or invalid.`);
                         }
                     });
                 });

                 // Search Functionality (Debounced input + Button click)
                 const debouncedSearch = debounce(() => {
                     const query = DOMElements.searchInput.value.trim();
                     if (query.length === 0 && currentCategory === 'search') {
                         // If search cleared, go back to default (popular)
                         console.log("Search cleared, loading popular movies.");
                          loadMovies('popular', 1);
                     } else if (query.length >= 3) { // Trigger search only if query is long enough
                         console.log(`Performing search for: ${query}`);
                          loadMovies('search', 1, query);
                    } else if (query.length > 0 && query.length < 3) {
                         console.log("Search query too short.");
                         // Optionally clear results or show message
                     }
                 }, 500); // 500ms delay after user stops typing

                 if (DOMElements.searchInput) DOMElements.searchInput.addEventListener('input', debouncedSearch);
                 if (DOMElements.searchButton) DOMElements.searchButton.addEventListener('click', () => {
                     // Trigger search immediately on button click
                     const query = DOMElements.searchInput.value.trim();
                     if (query.length === 0 && currentCategory === 'search') {
                          loadMovies('popular', 1);
                     } else if (query.length > 0) {
                          loadMovies('search', 1, query);
                     }
                 });
                 // Also allow Enter key in search input
                 if(DOMElements.searchInput) DOMElements.searchInput.addEventListener('keypress', (e) => {
                     if (e.key === 'Enter') {
                        e.preventDefault(); // Prevent form submission if it were inside a form
                        const query = DOMElements.searchInput.value.trim();
                        if (query.length === 0 && currentCategory === 'search') {
                             loadMovies('popular', 1);
                        } else if (query.length > 0) {
                             loadMovies('search', 1, query);
                        }
                     }
                 });


                // Authentication Forms
                if(DOMElements.loginForm) DOMElements.loginForm.addEventListener('submit', handleLogin);
                if(DOMElements.signupForm) DOMElements.signupForm.addEventListener('submit', handleSignup);
                if(DOMElements.logoutButton) DOMElements.logoutButton.addEventListener('click', handleLogout);

                // Q&A Form and Toggle Button
                if(DOMElements.postQuestionForm) DOMElements.postQuestionForm.addEventListener('submit', handlePostQuestion);
                if(DOMElements.togglePostQuestionBtn) DOMElements.togglePostQuestionBtn.addEventListener('click', () => {
                     // Toggle visibility and focus input if opening
                     const card = DOMElements.postQuestionCard;
                     card.classList.toggle('hidden');
                     if (!card.classList.contains('hidden')) {
                         DOMElements.questionText.focus();
                         // Scroll into view if needed
                         card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                     }
                });

                // Back to Top Button Visibility
                 const toggleBackToTop = debounce(() => {
                     DOMElements.backToTopBtn?.classList.toggle('show', window.scrollY > 400);
                 }, 150);
                window.addEventListener('scroll', toggleBackToTop);
                // Back to top click is handled by the <a> href="#"

                // Dummy Newsletter Form (Optional)
                 if (DOMElements.newsletterFormDummy && DOMElements.newsletterMessageDummy) {
                     DOMElements.newsletterFormDummy.addEventListener('submit', (e) => {
                         e.preventDefault();
                         const emailInput = DOMElements.newsletterFormDummy.querySelector('input[type="email"]');
                         if (emailInput && emailInput.value) {
                             displayFeedback(DOMElements.newsletterMessageDummy, `Thanks for subscribing, ${escapeHTML(emailInput.value)}! (Demo)`, false);
                             emailInput.value = '';
                         } else {
                             displayFeedback(DOMElements.newsletterMessageDummy, 'Please enter a valid email.', true);
                         }
                     });
                 }

                console.log("Event listeners setup complete.");
             }

            // --- Initial Load Actions ---
             console.log("Document loaded. Starting initial setup...");
            showSpinner(); // Show spinner during initial setup/load
            setupEventListeners();
             console.log("Loading initial page content...");

            // Use Promise.all to load critical initial content concurrently
            Promise.all([
                 loadHeroMovie(),          // Load dynamic hero background/text
                 loadMovies(),             // Load initial 'popular' movies (page 1)
                 // loadQuestions() is called by onAuthStateChanged after Firebase init/auth check
                 loadFeaturedAndReviews() // Load static/placeholder featured/reviews
             ])
             .then(() => {
                 console.log("Initial content loaded.");
             })
             .catch(error => {
                 console.error("Error during initial content loading:", error);
                 // Display a general error message if needed
             })
             .finally(() => {
                 hideSpinner(); // Hide spinner after initial loads are done or failed
                 // Auth state change will handle Q&A loading
             });

        }); // End DOMContentLoaded
