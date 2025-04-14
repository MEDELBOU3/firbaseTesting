 // Initialize Firebase with your config
const firebaseConfig = {
    apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4", // Should be secured in a real app
    authDomain: "sm4movies.firebaseapp.com",
    projectId: "sm4movies",
    storageBucket: "sm4movies.appspot.com",
    messagingSenderId: "277353836953",
    appId: "1:277353836953:web:85e02783526c7cb58de308",
};

// TMDB API configuration
const tmdbApiKey = "431fb541e27bceeb9db2f4cab69b54e1";
const tmdbBaseUrl = "https://api.themoviedb.org/3";
const imageBaseUrl = "https://image.tmdb.org/t/p/";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const moviesContainer = document.getElementById('moviesContainer');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const categoryPills = document.querySelectorAll('.category-pill');
const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
const contentDivs = document.querySelectorAll('#mainContent > div');
const backToTopBtn = document.getElementById('backToTop');
const spinnerOverlay = document.getElementById('spinner');
const authButtons = document.getElementById('authButtons');
const userProfileDropdown = document.getElementById('userProfileDropdown');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutButton = document.getElementById('logoutButton');

// App state
let currentPage = 1;
let currentCategory = 'popular';
let totalPages = 0;

// Event listeners

// Category pills
categoryPills.forEach(pill => {
    pill.addEventListener('click', function() {
        // Remove active class from all pills
        categoryPills.forEach(p => p.classList.remove('active'));
        // Add active class to clicked pill
        this.classList.add('active');
        // Update current category
        currentCategory = this.getAttribute('data-category');
        // Reset to page 1
        currentPage = 1;
        // Fetch movies with new category
        fetchMovies(currentCategory, currentPage);
    });
});

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove active class from all nav links
        navLinks.forEach(l => l.classList.remove('active'));
        // Add active class to clicked link
        this.classList.add('active');
        
        // Hide all content divs
        contentDivs.forEach(div => div.classList.add('d-none'));
        
        // Show the corresponding content
        const contentId = this.id.replace('Nav', 'Content');
        document.getElementById(contentId).classList.remove('d-none');
        
        // If trending or top rated is clicked, fetch those movies
        if (contentId === 'trendingContent') {
            fetchTrendingMovies(1);
        } else if (contentId === 'topRatedContent') {
            fetchTopRatedMovies(1);
        }
    });
});

// Search functionality
searchButton.addEventListener('click', function() {
    const query = searchInput.value.trim();
    if (query) {
        searchMovies(query);
    }
});

searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchMovies(query);
        }
    }
});

// Back to top button
window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('show');
    } else {
        backToTopBtn.classList.remove('show');
    }
});

backToTopBtn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Authentication
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showSpinner();
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            const user = userCredential.user;
            hideSpinner();
            // Close modal
            const authModal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
            authModal.hide();
            
            // Show success message
            alert('Successfully signed in!');
        })
        .catch((error) => {
            hideSpinner();
            alert('Error: ' + error.message);
        });
});

signupForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }
    
    showSpinner();
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed up
            const user = userCredential.user;
            
            // Update profile with name
            user.updateProfile({
                displayName: name
            }).then(() => {
                // Save additional user info to Firestore
                return db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }).then(() => {
                hideSpinner();
                // Close modal
                const authModal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
                authModal.hide();
                
                // Show success message
                alert('Account created successfully!');
            });
        })
        .catch((error) => {
            hideSpinner();
            alert('Error: ' + error.message);
        });
});

logoutButton.addEventListener('click', function(e) {
    e.preventDefault();
    
    auth.signOut().then(() => {
        // Sign-out successful
        alert('You have been signed out');
    }).catch((error) => {
        // An error happened
        alert('Error signing out: ' + error.message);
    });
});

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        authButtons.classList.add('d-none');
        userProfileDropdown.classList.remove('d-none');
        
        // Update user info in dropdown
        document.getElementById('dropdownUserName').textContent = user.displayName || 'User';
        document.getElementById('dropdownUserEmail').textContent = user.email;
        
        // Set avatar
        const avatarContainer = document.getElementById('userAvatar');
        if (user.photoURL) {
            avatarContainer.innerHTML = `<img src="${user.photoURL}" alt="User avatar" class="avatar-img">`;
        } else {
            // Set initial letter as avatar
            const initial = (user.displayName || user.email[0]).charAt(0).toUpperCase();
            avatarContainer.textContent = initial;
        }
    } else {
        // User is signed out
        authButtons.classList.remove('d-none');
        userProfileDropdown.classList.add('d-none');
    }
});

// API functions

// Fetch movies by category
function fetchMovies(category, page = 1) {
    showSpinner();
    
    fetch(`${tmdbBaseUrl}/movie/${category}?api_key=${tmdbApiKey}&language=en-US&page=${page}`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, moviesContainer);
            totalPages = data.total_pages > 500 ? 500 : data.total_pages; // TMDB limits to 500 pages
            createPagination(page, totalPages, pagination, (newPage) => {
                currentPage = newPage;
                fetchMovies(category, newPage);
            });
            hideSpinner();
        })
        .catch(error => {
            console.error('Error fetching movies:', error);
            hideSpinner();
            moviesContainer.innerHTML = `<div class="col-12 text-center"><p>Error loading movies. Please try again later.</p></div>`;
        });
}

// Fetch trending movies
function fetchTrendingMovies(page = 1) {
    showSpinner();
    
    const trendingContainer = document.getElementById('trendingMoviesContainer');
    const trendingPagination = document.getElementById('trendingPagination');
    
    fetch(`${tmdbBaseUrl}/trending/movie/week?api_key=${tmdbApiKey}&page=${page}`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, trendingContainer);
            totalPages = data.total_pages > 500 ? 500 : data.total_pages;
            createPagination(page, totalPages, trendingPagination, (newPage) => {
                fetchTrendingMovies(newPage);
            });
            hideSpinner();
        })
        .catch(error => {
            console.error('Error fetching trending movies:', error);
            hideSpinner();
            trendingContainer.innerHTML = `<div class="col-12 text-center"><p>Error loading trending movies. Please try again later.</p></div>`;
        });
}

// Fetch top rated movies
function fetchTopRatedMovies(page = 1) {
    showSpinner();
    
    const topRatedContainer = document.getElementById('topRatedMoviesContainer');
    const topRatedPagination = document.getElementById('topRatedPagination');
    
    fetch(`${tmdbBaseUrl}/movie/top_rated?api_key=${tmdbApiKey}&language=en-US&page=${page}`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, topRatedContainer);
            totalPages = data.total_pages > 500 ? 500 : data.total_pages;
            createPagination(page, totalPages, topRatedPagination, (newPage) => {
                fetchTopRatedMovies(newPage);
            });
            hideSpinner();
        })
        .catch(error => {
            console.error('Error fetching top rated movies:', error);
            hideSpinner();
            topRatedContainer.innerHTML = `<div class="col-12 text-center"><p>Error loading top rated movies. Please try again later.</p></div>`;
        });
}

// Search movies
function searchMovies(query) {
    showSpinner();
    
    fetch(`${tmdbBaseUrl}/search/movie?api_key=${tmdbApiKey}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`)
        .then(response => response.json())
        .then(data => {
            displayMovies(data.results, moviesContainer);
            totalPages = data.total_pages > 500 ? 500 : data.total_pages;
            createPagination(1, totalPages, pagination, (newPage) => {
                searchMovies(query, newPage);
            });
            hideSpinner();
        })
        .catch(error => {
            console.error('Error searching movies:', error);
            hideSpinner();
            moviesContainer.innerHTML = `<div class="col-12 text-center"><p>Error searching movies. Please try again later.</p></div>`;
        });
}

// Get movie details
function getMovieDetails(movieId) {
    showSpinner();
    
    Promise.all([
        fetch(`${tmdbBaseUrl}/movie/${movieId}?api_key=${tmdbApiKey}&language=en-US`).then(res => res.json()),
        fetch(`${tmdbBaseUrl}/movie/${movieId}/credits?api_key=${tmdbApiKey}`).then(res => res.json())
    ])
        .then(([movieData, creditsData]) => {
            displayMovieModal(movieData, creditsData);
            hideSpinner();
            // Show modal
            const movieModal = new bootstrap.Modal(document.getElementById('movieModal'));
            movieModal.show();
        })
        .catch(error => {
            console.error('Error fetching movie details:', error);
            hideSpinner();
            alert('Error loading movie details. Please try again later.');
        });
}

// Helper functions

// Display movies in grid
function displayMovies(movies, container) {
    if (movies.length === 0) {
        container.innerHTML = `<div class="col-12 text-center"><p>No movies found. Try a different search.</p></div>`;
        return;
    }
    
    let html = '';
    
    movies.forEach(movie => {
        const posterUrl = movie.poster_path ? 
            `${imageBaseUrl}w342${movie.poster_path}` : 
            '/api/placeholder/220/330';
        
        html += `
            <div class="col-6 col-md-4 col-lg-3 mb-4">
                <div class="movie-card" data-movie-id="${movie.id}">
                    <div class="position-relative">
                        <img src="${posterUrl}" class="movie-poster" alt="${movie.title}">
                        <div class="movie-rating">${movie.vote_average.toFixed(1)}</div>
                    </div>
                    <div class="movie-info">
                        <h5 class="movie-title">${movie.title}</h5>
                        <p class="movie-date">${formatDate(movie.release_date)}</p>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add click event to movie cards
    const movieCards = container.querySelectorAll('.movie-card');
    movieCards.forEach(card => {
        card.addEventListener('click', function() {
            const movieId = this.getAttribute('data-movie-id');
            getMovieDetails(movieId);
        });
    });
}

// Display movie details in modal
function displayMovieModal(movie, credits) {
    const backdropUrl = movie.backdrop_path ? 
        `${imageBaseUrl}w1280${movie.backdrop_path}` : 
        '/api/placeholder/800/250';
    
    const posterUrl = movie.poster_path ? 
        `${imageBaseUrl}w342${movie.poster_path}` : 
        '/api/placeholder/150/225';
    
    document.querySelector('.modal-movie-backdrop').src = backdropUrl;
    document.querySelector('.modal-movie-poster').src = posterUrl;
    document.querySelector('.modal-movie-title').textContent = movie.title;
    document.querySelector('.modal-movie-tagline').textContent = movie.tagline || '';
    document.getElementById('movieRating').textContent = `${movie.vote_average.toFixed(1)}/10`;
    document.getElementById('movieReleaseDate').textContent = formatDate(movie.release_date);
    document.getElementById('movieRuntime').textContent = `${movie.runtime} min`;
    document.getElementById('movieOverview').textContent = movie.overview;
    
    // Display genres
    const genresContainer = document.getElementById('movieGenres');
    genresContainer.innerHTML = '';
    movie.genres.forEach(genre => {
        const genreBadge = document.createElement('span');
        genreBadge.className = 'genre-badge';
        genreBadge.textContent = genre.name;
        genresContainer.appendChild(genreBadge);
    });
    
    // Display cast
    const castContainer = document.getElementById('movieCast');
    castContainer.innerHTML = '';
    
    const cast = credits.cast.slice(0, 10); // Show top 10 cast members
    cast.forEach(person => {
        const profileUrl = person.profile_path ? 
            `${imageBaseUrl}w185${person.profile_path}` : 
            '/api/placeholder/120/180';
        
        const castCard = document.createElement('div');
        castCard.className = 'cast-card';
        castCard.innerHTML = `
            <img src="${profileUrl}" class="cast-image" alt="${person.name}">
            <div class="cast-info">
                <p class="cast-name">${person.name}</p>
                <p class="cast-character">${person.character}</p>
            </div>
        `;
        castContainer.appendChild(castCard);
    });
    
    // Save movie to user's history in Firestore if logged in
    const user = auth.currentUser;
    if (user) {
        db.collection('users').doc(user.uid).collection('history').doc(movie.id.toString()).set({
            movieId: movie.id,
            title: movie.title,
            posterPath: movie.poster_path,
            rating: movie.vote_average,
            viewedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .catch(error => {
            console.error('Error saving to history:', error);
        });
    }
}

// Create pagination controls
function createPagination(currentPage, totalPages, container, callback) {
    let html = '';
    
    // Previous button
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Pages
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust startPage if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page
    if (startPage > 1) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
        `;
        
        if (startPage > 2) {
            html += `
                <li class="page-item disabled">
                    <a class="page-link" href="#">...</a>
                </li>
            `;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `
                <li class="page-item disabled">
                    <a class="page-link" href="#">...</a>
                </li>
            `;
        }
        
        html += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    // Next button
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    container.innerHTML = html;
    
    // Add click events to pagination links
    const pageLinks = container.querySelectorAll('.page-link');
    pageLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const page = parseInt(this.getAttribute('data-page'));
            if (!isNaN(page) && page > 0 && page <= totalPages) {
                callback(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Show spinner
function showSpinner() {
    spinnerOverlay.classList.add('show');
}

// Hide spinner
function hideSpinner() {
    spinnerOverlay.classList.remove('show');
}

// Function to show signup tab in auth modal
function showSignupTab() {
    const signupTab = document.getElementById('signup-tab');
    const tab = new bootstrap.Tab(signupTab);
    tab.show();
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Fetch initial movies
    fetchMovies(currentCategory, currentPage);
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});
