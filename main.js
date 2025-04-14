  // --- Firebase Configuration ---
        const firebaseConfigApp = {
             apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4", // Keep yours, BUT SECURE IN REAL APP
             authDomain: "sm4movies.firebaseapp.com",
             projectId: "sm4movies",
            storageBucket: "sm4movies.appspot.com",
             messagingSenderId: "277353836953",
            appId: "1:277353836953:web:85e02783526c7cb58de308",
         };

        // --- Initialize Firebase ---
        try {
             firebase.initializeApp(firebaseConfigApp);
        } catch (e) {
             console.error("Firebase initialization error:", e);
             // Display a critical error to the user?
         }
         const auth = firebase.auth();
         const db = firebase.firestore();
         const timestamp = firebase.firestore.FieldValue.serverTimestamp(); // For timestamps
         const increment = firebase.firestore.FieldValue.increment; // For atomic counts

        // --- Constants ---
        const API_KEY = '431fb541e27bceeb9db2f4cab69b54e1';
        const BASE_URL = 'https://api.themoviedb.org/3';
        const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
        const POSTER_SIZE = 'w500';
        const BACKDROP_SIZE = 'w1280';
        const PROFILE_SIZE = 'w185';
        const LOGO_SIZE = 'w185';
        const PLACEHOLDER_PROFILE_URL = 'https://via.placeholder.com/185x278.png?text=No+Image';
         const PLACEHOLDER_MOVIE_URL = 'https://via.placeholder.com/500x750.png?text=No+Poster';


        // --- Global State ---
        let currentPage = 1;
        let totalPages = 0;
        let currentCategory = 'popular';
        let currentSearchQuery = '';
        let currentUser = null; // Holds the firebase auth user object
        let userDisplayName = 'Guest'; // Holds the display name for logged-in user

        // --- DOM Elements Cache (More efficient) ---
        const DOMElements = {
            moviesContainer: document.getElementById('moviesContainer'),
            paginationUl: document.getElementById('pagination'),
            spinner: document.getElementById('spinner'),
            categoryButtons: document.querySelectorAll('.category-pill'),
             categoryNavLinks: document.querySelectorAll('.category-nav-link'),
             searchInput: document.getElementById('searchInput'),
             searchButton: document.getElementById('searchButton'),
             backToTopBtn: document.getElementById('backToTop'),
             detailModalEl: document.getElementById('detailModal'),
            detailModal: new bootstrap.Modal(document.getElementById('detailModal')),
            detailModalContent: document.getElementById('detailModalContent'),
            heroSection: document.getElementById('heroSection'),
             heroMovieTitle: document.getElementById('heroMovieTitle'),
             heroMovieTagline: document.getElementById('heroMovieTagline'),
            moviesSectionTitle: document.getElementById('moviesSectionTitle'),
            featuredArticlesContainer: document.getElementById('featuredArticlesContainer'),
            reviewsContainer: document.getElementById('reviewsContainer'),
            authArea: document.getElementById('authArea'),
            userInfo: document.getElementById('userInfo'),
            usernameDisplay: document.getElementById('usernameDisplay'),
            logoutButton: document.getElementById('logoutButton'),
             loginButtonTrigger: document.getElementById('loginButtonTrigger'),
             signupButtonTrigger: document.getElementById('signupButtonTrigger'),
             loginForm: document.getElementById('loginForm'),
             loginEmail: document.getElementById('loginEmail'),
            loginPassword: document.getElementById('loginPassword'),
            loginError: document.getElementById('loginError'),
            signupForm: document.getElementById('signupForm'),
            signupDisplayName: document.getElementById('signupDisplayName'),
            signupEmail: document.getElementById('signupEmail'),
            signupPassword: document.getElementById('signupPassword'),
            signupError: document.getElementById('signupError'),
            qandaSection: document.getElementById('qandaSection'),
            postQuestionCard: document.getElementById('postQuestionCard'),
            postQuestionForm: document.getElementById('postQuestionForm'),
            questionText: document.getElementById('questionText'),
            questionPostStatus: document.getElementById('questionPostStatus'),
            qandaLoginPrompt: document.getElementById('qandaLoginPrompt'),
            questionsList: document.getElementById('questionsList'),
         };

        // --- Utility Functions ---
         // (Reusing formatCurrency, formatRuntime, formatDate from previous response)
         const formatCurrency = (amount) => amount ? `$${amount.toLocaleString('en-US')}` : 'N/A';
        const formatRuntime = (minutes) => minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'N/A';
        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
         const formatTimestamp = (firestoreTimestamp) => firestoreTimestamp ? new Date(firestoreTimestamp.toDate()).toLocaleString() : 'Just now';

        const getImageUrl = (path, size) => path ? `${IMAGE_BASE_URL}${size}${path}` : null;
         const getProfileImageUrl = (path) => path ? getImageUrl(path, PROFILE_SIZE) : PLACEHOLDER_PROFILE_URL;

        const createPlaceholderDiv = (className, iconClass = 'fa-image', style = '') => `<div class="${className} placeholder-img" style="${style}"><i class="fas ${iconClass}"></i></div>`;
        const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };
        const showSpinner = () => DOMElements.spinner.classList.add('show');
        const hideSpinner = () => DOMElements.spinner.classList.remove('show');
         const showElement = (el) => el.classList.remove('d-none');
         const hideElement = (el) => el.classList.add('d-none');

        // Simple function to display feedback messages
        const displayFeedback = (element, message, isError = true) => {
             element.textContent = message;
            element.className = `form-text mt-2 small ${isError ? 'text-danger' : 'text-success'}`;
             if (message) {
                 setTimeout(() => { element.textContent = ''; }, 5000); // Clear after 5s
             }
        };

         // Function to get user data from Firestore (basic)
        const getUserData = async (userId) => {
            if (!userId) return { displayName: 'Anonymous' }; // Handle anonymous
            try {
                 // Check cache or simple local storage first? For perf. For now, direct fetch.
                 const userDoc = await db.collection('users').doc(userId).get();
                 if (userDoc.exists) {
                     return userDoc.data(); // Should contain displayName
                 } else {
                     console.warn("User document not found for ID:", userId);
                     return { displayName: 'User (' + userId.substring(0, 4) + ')' }; // Fallback
                 }
            } catch (error) {
                 console.error("Error fetching user data:", error);
                 return { displayName: 'Error Fetching User' };
             }
        };


         // --- Authentication Logic ---
        auth.onAuthStateChanged(async (user) => {
            showSpinner(); // Show spinner during auth state change handling
            if (user) {
                 currentUser = user;
                 const userData = await getUserData(user.uid);
                 userDisplayName = userData?.displayName || user.email || 'Logged In User'; // Use stored name, fallback email
                 DOMElements.usernameDisplay.textContent = userDisplayName;
                hideElement(DOMElements.loginButtonTrigger.parentElement); // Hide login/signup btn container
                 showElement(DOMElements.userInfo);
                 showElement(DOMElements.logoutButton);
                 showElement(DOMElements.postQuestionCard);
                 hideElement(DOMElements.qandaLoginPrompt);
                 DOMElements.postQuestionCard.classList.remove('hidden');

                 console.log("User logged in:", currentUser.uid, userDisplayName);
             } else {
                 currentUser = null;
                 userDisplayName = 'Guest';
                showElement(DOMElements.loginButtonTrigger.parentElement); // Show login/signup btn container
                hideElement(DOMElements.userInfo);
                 hideElement(DOMElements.logoutButton);
                 hideElement(DOMElements.postQuestionCard);
                 showElement(DOMElements.qandaLoginPrompt);
                  DOMElements.postQuestionCard.classList.add('hidden');

                console.log("User logged out");
                 // Clear potentially sensitive Q&A modal content if user logs out while viewing?
                 if (DOMElements.detailModalEl.classList.contains('show')) {
                    // Maybe close it or clear Q&A specific parts
                    // DOMElements.detailModal.hide(); // Simplest approach
                 }
             }
            hideSpinner(); // Hide spinner after handling
         });

         async function handleSignup(e) {
            e.preventDefault();
             showSpinner();
             const displayName = DOMElements.signupDisplayName.value.trim();
            const email = DOMElements.signupEmail.value;
            const password = DOMElements.signupPassword.value;
            DOMElements.signupError.textContent = '';

            if (!displayName) {
                displayFeedback(DOMElements.signupError, 'Display Name cannot be empty.');
                hideSpinner();
                return;
             }

            try {
                 const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                 // IMPORTANT: Set display name in Firebase Auth profile
                 await userCredential.user.updateProfile({ displayName: displayName });
                 // Store user data in Firestore (optional but good practice)
                await db.collection('users').doc(userCredential.user.uid).set({
                    displayName: displayName,
                    email: email,
                     createdAt: timestamp,
                }, { merge: true }); // Use merge if you might add more fields later

                 console.log('Signup successful:', userCredential.user.uid);
                 bootstrap.Modal.getInstance(document.getElementById('signupModal')).hide(); // Hide signup modal
                // Auth state change listener will update UI
            } catch (error) {
                 console.error("Signup error:", error);
                 displayFeedback(DOMElements.signupError, error.message);
             } finally {
                hideSpinner();
             }
         }

        async function handleLogin(e) {
             e.preventDefault();
            showSpinner();
             const email = DOMElements.loginEmail.value;
             const password = DOMElements.loginPassword.value;
            DOMElements.loginError.textContent = '';

            try {
                await auth.signInWithEmailAndPassword(email, password);
                console.log('Login successful');
                 bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide(); // Hide login modal
                 // Auth state change listener updates UI
            } catch (error) {
                console.error("Login error:", error);
                displayFeedback(DOMElements.loginError, error.message);
            } finally {
                hideSpinner();
            }
        }

        async function handleLogout() {
            showSpinner();
            try {
                await auth.signOut();
                 console.log('Logout successful');
                // Optionally redirect to home page or refresh
                // location.reload(); // Simple refresh
            } catch (error) {
                console.error("Logout error:", error);
                alert('Error logging out. Please try again.'); // User feedback
            } finally {
                 hideSpinner();
            }
        }


        // --- TMDB API & Display Logic ---
        // (Reusing fetchFromTMDB, loadMovies, displayMovies, loadHeroMovie, loadFeaturedAndReviews, showMovieDetails logic from the previous step, but modifying showMovieDetails to be showDetailModal)
        // Modified showMovieDetails from previous answer -> showDetailModal to handle BOTH movies and Q&A

        async function showDetailModal(type, id) {
            showSpinner();
             DOMElements.detailModalContent.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-info" role="status"><span class="visually-hidden">Loading details...</span></div></div>`;
             DOMElements.detailModal.show();

             try {
                if (type === 'movie') {
                    await renderMovieModalContent(id);
                 } else if (type === 'question') {
                    await renderQAModalContent(id);
                } else {
                    throw new Error("Invalid detail type requested");
                 }
             } catch (error) {
                 console.error(`Error showing ${type} details for ID ${id}:`, error);
                DOMElements.detailModalContent.innerHTML = `<div class="alert alert-danger m-4">Could not load details. Please try again later.</div>`;
            } finally {
                 hideSpinner();
            }
         }


        async function renderMovieModalContent(movieId) {
             // Fetch movie data (Copied and adapted from previous `showMovieDetails`)
             const movieData = await fetchFromTMDB(`movie/${movieId}`, { append_to_response: 'credits,videos' });

             if (!movieData) throw new Error('Movie data not found');

             const backdropUrl = getImageUrl(movieData.backdrop_path, BACKDROP_SIZE);
             const posterUrl = getImageUrl(movieData.poster_path, POSTER_SIZE);
             const mainDirector = movieData.credits?.crew.find(p => p.job === 'Director')?.name || 'N/A';
             const cast = movieData.credits?.cast.slice(0, 12) || [];
             const genresHTML = movieData.genres?.map(g => `<span class="genre-badge">${g.name}</span>`).join('') || '';
             const trailer = movieData.videos?.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
             const companies = movieData.production_companies?.filter(c => c.logo_path).slice(0, 5) || [];

             const castHTML = cast.length > 0 ? cast.map(person => {
                 const profileImg = getProfileImageUrl(person.profile_path); // Uses placeholder function
                 return `
                     <div class="cast-card">
                        <img src="${profileImg}" alt="${person.name}" class="cast-image" loading="lazy">
                         <div class="cast-info">
                             <p class="cast-name">${person.name || 'Unknown'}</p>
                            <p class="cast-character">${person.character || ''}</p>
                        </div>
                    </div>`;
             }).join('') : '<p class="text-body-secondary small ms-1">Cast information not available.</p>';

             const companiesHTML = companies.length > 0 ? companies.map(c => {
                const logoUrl = getImageUrl(c.logo_path, LOGO_SIZE);
                 return `<img src="${logoUrl}" alt="${c.name}" class="prod-company" title="${c.name}">`;
             }).join('') : '<p class="text-body-secondary small ms-1">Production company information not available.</p>';

             // --- Set Modal HTML ---
            DOMElements.detailModalContent.innerHTML = `
                <div class="modal-backdrop-container">
                     ${backdropUrl ? `<img src="${backdropUrl}" alt="${movieData.title} backdrop" class="modal-movie-backdrop">` : createPlaceholderDiv('modal-movie-backdrop', 'fa-film')}
                 </div>
                 <div class="container modal-body-content">
                     <div class="row mb-4"> {/* Row for poster & title area */}
                         <div class="col-md-4 text-center text-md-start">
                            ${posterUrl ? `<img src="${posterUrl}" alt="${movieData.title}" class="modal-movie-poster">` : createPlaceholderDiv('modal-movie-poster', 'fa-film')}
                        </div>
                         <div class="col-md-8 d-flex flex-column justify-content-end"> {/* Align text better */}
                             <h2 class="modal-movie-title mt-md-5 pt-md-5">${movieData.title || 'Untitled'}</h2> {/* Push title down on md+ */}
                            <p class="modal-movie-tagline">${movieData.tagline || ''}</p>
                         </div>
                     </div>

                      <div class="modal-movie-meta"> {/* Metadata bar */}
                          <div class="meta-item" title="Rating"> <i class="fas fa-star meta-icon"></i> <span>${movieData.vote_average ? movieData.vote_average.toFixed(1) + '/10' : 'N/A'} (${movieData.vote_count ? movieData.vote_count.toLocaleString() + ' votes': '0 votes'})</span></div>
                         <div class="meta-item" title="Release Date"> <i class="fas fa-calendar-alt meta-icon"></i> <span>${formatDate(movieData.release_date)}</span></div>
                        <div class="meta-item" title="Runtime"> <i class="fas fa-clock meta-icon"></i> <span>${formatRuntime(movieData.runtime)}</span></div>
                         <div class="meta-item" title="Status"> <i class="fas fa-check-circle meta-icon"></i> <span>${movieData.status || 'N/A'}</span></div>
                     </div>

                     <div class="my-4">${genresHTML}</div>

                      <div class="mt-4">
                         <h5 class="modal-section-title">Overview</h5>
                         <p class="text-body-secondary lh-lg">${movieData.overview || 'No overview available.'}</p>
                      </div>

                     <div class="row mt-3 g-3"> {/* Simplified Details row */}
                         <div class="col-md-4"> <h6 class="fw-bold text-light">Director</h6> <p class="text-body-secondary mb-0">${mainDirector}</p></div>
                         <div class="col-md-4"> <h6 class="fw-bold text-light">Budget</h6> <p class="text-body-secondary mb-0">${formatCurrency(movieData.budget)}</p></div>
                        <div class="col-md-4"> <h6 class="fw-bold text-light">Revenue</h6> <p class="text-body-secondary mb-0">${formatCurrency(movieData.revenue)}</p></div>
                     </div>

                     <div class="cast-section">
                         <h5 class="modal-section-title">Cast</h5>
                         <div class="cast-scroll">${castHTML}</div>
                     </div>

                    ${trailer ? `
                        <div class="trailer-container">
                            <h5 class="modal-section-title">Trailer</h5>
                            <div class="ratio ratio-16x9"><iframe class="trailer-iframe rounded" src="https://www.youtube.com/embed/${trailer.key}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
                         </div>
                     ` : ''}

                      ${companies.length > 0 ? `
                         <div class="mt-4"> <h5 class="modal-section-title">Production Companies</h5> <div class="prod-companies-list">${companiesHTML}</div></div>
                     ` : ''}

                     <div class="text-center mt-5">
                        <a href="https://www.themoviedb.org/movie/${movieData.id}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-light"><i class="fas fa-external-link-alt me-2"></i> View Full Details on TMDB</a>
                    </div>
                 </div>
            `;
        }

         async function renderQAModalContent(questionId) {
             // Fetch question data
             let questionData = null;
             let authorData = null;
             try {
                const questionDoc = await db.collection('questions').doc(questionId).get();
                 if (questionDoc.exists) {
                     questionData = { id: questionDoc.id, ...questionDoc.data() };
                    authorData = await getUserData(questionData.userId);
                } else {
                    throw new Error("Question not found");
                }
             } catch (error) {
                 console.error("Error fetching question data:", error);
                 DOMElements.detailModalContent.innerHTML = `<div class="alert alert-danger m-4">Could not load question details.</div>`;
                 return; // Exit early on error
             }

             // Basic Q&A modal structure
             DOMElements.detailModalContent.innerHTML = `
                <div class="container p-4">
                     <h2 class="modal-movie-title mb-1">${questionData.text}</h2> {/* Reuse title style */}
                     <p class="text-body-secondary mb-4" style="font-size: 0.9rem;">
                         Asked by <strong class="text-info">${authorData.displayName}</strong> on ${formatTimestamp(questionData.timestamp)}
                     </p>
                     <hr style="border-color: var(--cv-dark-blue-700);">

                    <h5 class="modal-section-title">Comments</h5>
                     <div id="commentsContainer" class="mb-4">
                         <div class="text-center py-3"><div class="spinner-border spinner-border-sm text-info" role="status"><span class="visually-hidden">Loading comments...</span></div></div>
                     </div>

                      <div id="addCommentSection">
                          ${currentUser ? `
                             <form id="addCommentForm">
                                <h6 class="modal-section-title" style="font-size: 1.1rem; margin-top: 1rem;">Leave a Comment</h6>
                                 <input type="hidden" id="commentQuestionId" value="${questionId}">
                                 <div class="mb-2">
                                    <textarea class="form-control" id="commentText" rows="3" placeholder="Your comment..." required style="background-color: var(--cv-dark-blue-700); color: var(--cv-slate-200); border-color: var(--cv-dark-blue-700);"></textarea>
                                 </div>
                                 <button type="submit" class="btn btn-sm btn-primary"><i class="fas fa-paper-plane me-1"></i> Post Comment</button>
                                <div id="commentPostStatus" class="form-text mt-2 small"></div>
                             </form>
                          ` : `
                              <p class="text-center text-body-secondary small mt-4">Please <a href="#" data-bs-dismiss="modal" data-bs-toggle="modal" data-bs-target="#loginModal">log in</a> to post a comment.</p>
                         `}
                    </div>
                </div>
            `;

             // Attach comment form listener if present
            const addCommentForm = document.getElementById('addCommentForm');
            if (addCommentForm) {
                addCommentForm.addEventListener('submit', handleAddComment);
            }

            // Load comments
             loadComments(questionId);
        }


         // --- Q&A Functions ---
         async function loadQuestions() {
            const questionsListDiv = DOMElements.questionsList;
            questionsListDiv.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-info" role="status"></div></div>'; // Loading state

             try {
                const snapshot = await db.collection('questions').orderBy('timestamp', 'desc').limit(10).get(); // Get latest 10
                 if (snapshot.empty) {
                     questionsListDiv.innerHTML = '<p class="text-center text-body-secondary mt-3">No questions asked yet. Be the first!</p>';
                     return;
                 }

                 let questionsHTML = '';
                 // Fetch author data in parallel for efficiency
                 const authorPromises = snapshot.docs.map(doc => getUserData(doc.data().userId));
                 const authorDatas = await Promise.all(authorPromises);

                 snapshot.docs.forEach((doc, index) => {
                    const question = { id: doc.id, ...doc.data() };
                     const author = authorDatas[index]; // Get pre-fetched author data

                     questionsHTML += `
                        <div class="question-item" data-question-id="${question.id}">
                            <p class="question-text">${question.text}</p>
                            <div class="question-meta">
                                 <span title="Asked by"><i class="fas fa-user"></i> <span class="author-name">${author.displayName || 'Anonymous'}</span></span> |
                                 <span title="Asked on"><i class="fas fa-clock"></i> ${formatTimestamp(question.timestamp)}</span>
                                 <%-- Placeholder for comment count - requires denormalization or another query --%>
                                <%-- | <span title="Comments"><i class="fas fa-comments"></i> 0 Comments</span> --%>
                            </div>
                         </div>
                     `;
                 });

                 questionsListDiv.innerHTML = questionsHTML;

                 // Add event listeners to newly added question items
                 questionsListDiv.querySelectorAll('.question-item').forEach(item => {
                    item.addEventListener('click', () => {
                        showDetailModal('question', item.dataset.questionId);
                    });
                });

            } catch (error) {
                 console.error("Error loading questions:", error);
                 questionsListDiv.innerHTML = '<p class="text-center text-danger mt-3">Could not load questions.</p>';
            }
         }

        async function handlePostQuestion(e) {
            e.preventDefault();
             if (!currentUser) {
                displayFeedback(DOMElements.questionPostStatus, "You must be logged in to ask a question.");
                 return;
            }
            const questionText = DOMElements.questionText.value.trim();
            if (!questionText) {
                 displayFeedback(DOMElements.questionPostStatus, "Question cannot be empty.");
                 return;
            }

            showSpinner();
             DOMElements.questionPostStatus.textContent = '';

            try {
                await db.collection('questions').add({
                     userId: currentUser.uid,
                     text: questionText,
                     timestamp: timestamp,
                     // Add other fields like commentCount: 0 if you want denormalization
                 });
                 DOMElements.questionText.value = ''; // Clear textarea
                 displayFeedback(DOMElements.questionPostStatus, "Question posted successfully!", false);
                 loadQuestions(); // Refresh the list
             } catch (error) {
                 console.error("Error posting question:", error);
                displayFeedback(DOMElements.questionPostStatus, "Error posting question. Please try again.");
             } finally {
                 hideSpinner();
             }
         }

         async function loadComments(questionId) {
             const commentsContainer = document.getElementById('commentsContainer');
             if (!commentsContainer) return; // Element not found

            commentsContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-info" role="status"></div></div>'; // Loading

             try {
                 const snapshot = await db.collection('comments')
                    .where('questionId', '==', questionId)
                    .orderBy('timestamp', 'asc') // Show oldest first
                     .get();

                 if (snapshot.empty) {
                    commentsContainer.innerHTML = '<p class="text-center text-body-secondary small">No comments yet.</p>';
                     return;
                 }

                // Prepare to fetch user data and like status efficiently
                 const commentDataPromises = snapshot.docs.map(async (doc) => {
                    const comment = { id: doc.id, ...doc.data() };
                     const authorPromise = getUserData(comment.userId);
                    const likedPromise = currentUser ? checkIfLiked(comment.id, currentUser.uid) : Promise.resolve(false); // Check if liked by current user
                    const [authorData, isLiked] = await Promise.all([authorPromise, likedPromise]);
                    return { ...comment, authorData, isLiked }; // Combine data
                });

                const commentsWithDetails = await Promise.all(commentDataPromises);

                 let commentsHTML = '';
                 commentsWithDetails.forEach(comment => {
                    const likeCount = comment.likeCount || 0;
                     const likedClass = comment.isLiked ? 'liked' : '';
                     const likeIcon = comment.isLiked ? 'fas fa-heart' : 'far fa-heart';

                     commentsHTML += `
                        <div class="comment-item" id="comment-${comment.id}">
                            <div>
                                <strong class="comment-author">${comment.authorData?.displayName || 'Anonymous'}</strong>
                                <span class="comment-timestamp">${formatTimestamp(comment.timestamp)}</span>
                             </div>
                             <p class="comment-text">${comment.text}</p>
                             <div class="comment-actions">
                                 <span class="like-button ${likedClass}" data-comment-id="${comment.id}" onclick="handleLikeToggle(this)">
                                    <i class="${likeIcon}"></i> Like
                                 </span>
                                 <span class="like-count">${likeCount}</span>
                            </div>
                         </div>
                    `;
                 });
                 commentsContainer.innerHTML = commentsHTML;

            } catch (error) {
                console.error("Error loading comments:", error);
                 commentsContainer.innerHTML = '<p class="text-center text-danger small">Could not load comments.</p>';
             }
        }

        async function handleAddComment(e) {
             e.preventDefault();
            const commentTextEl = document.getElementById('commentText');
            const questionIdEl = document.getElementById('commentQuestionId');
             const commentPostStatusEl = document.getElementById('commentPostStatus');

             if (!currentUser || !commentTextEl || !questionIdEl || !commentPostStatusEl) {
                if(commentPostStatusEl) displayFeedback(commentPostStatusEl, "Error: Cannot post comment.");
                 return;
            }

            const commentText = commentTextEl.value.trim();
            const questionId = questionIdEl.value;
            if (!commentText || !questionId) {
                 displayFeedback(commentPostStatusEl, "Comment cannot be empty.");
                 return;
            }

            showSpinner(); // Maybe use a smaller spinner near the button?
            commentPostStatusEl.textContent = '';

            try {
                await db.collection('comments').add({
                     questionId: questionId,
                     userId: currentUser.uid,
                     text: commentText,
                    likeCount: 0, // Initialize like count
                    timestamp: timestamp,
                 });
                commentTextEl.value = ''; // Clear textarea
                displayFeedback(commentPostStatusEl, "Comment posted!", false);
                loadComments(questionId); // Refresh comments for this question
            } catch (error) {
                 console.error("Error posting comment:", error);
                displayFeedback(commentPostStatusEl, "Error posting comment. Please try again.");
            } finally {
                hideSpinner();
             }
        }


         // --- Like/Unlike Logic ---
         async function checkIfLiked(commentId, userId) {
             // Simple check if a document exists for this user/comment pair
             const likeDocRef = db.collection('likes').doc(`${userId}_${commentId}`);
            try {
                const doc = await likeDocRef.get();
                return doc.exists;
             } catch (error) {
                 console.error("Error checking if liked:", error);
                 return false; // Assume not liked on error
            }
         }

         async function handleLikeToggle(buttonElement) {
            if (!currentUser) {
                 // Prompt login - perhaps show the login modal
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
                return;
            }

             const commentId = buttonElement.dataset.commentId;
            if (!commentId) return;

             const likeIcon = buttonElement.querySelector('i');
            const likeCountSpan = buttonElement.parentElement.querySelector('.like-count');
             const commentRef = db.collection('comments').doc(commentId);
             const likeDocRef = db.collection('likes').doc(`${currentUser.uid}_${commentId}`);

             buttonElement.style.pointerEvents = 'none'; // Prevent double-clicking while processing

            try {
                 const isCurrentlyLiked = buttonElement.classList.contains('liked');
                let likeChange = 0;

                // Use a Firestore Transaction for atomic update of count and like doc
                await db.runTransaction(async (transaction) => {
                    const likeDoc = await transaction.get(likeDocRef);
                     const commentDoc = await transaction.get(commentRef); // Get current comment data

                     if (!commentDoc.exists) {
                        throw "Comment doesn't exist."; // Stop transaction
                     }

                    if (!isCurrentlyLiked) { // --- Like Action ---
                         if (!likeDoc.exists) {
                             transaction.set(likeDocRef, { userId: currentUser.uid, commentId: commentId, timestamp: timestamp });
                             transaction.update(commentRef, { likeCount: increment(1) });
                             likeChange = 1;
                             console.log("Liked comment:", commentId);
                         } else { console.log("Already liked (sync issue?), doing nothing"); }
                    } else { // --- Unlike Action ---
                         if (likeDoc.exists) {
                             transaction.delete(likeDocRef);
                             // Only decrement if count > 0 to prevent negative counts
                            if ((commentDoc.data().likeCount || 0) > 0) {
                                transaction.update(commentRef, { likeCount: increment(-1) });
                                likeChange = -1;
                            } else {
                                transaction.update(commentRef, { likeCount: 0 }); // Ensure it's 0 if somehow negative
                             }
                             console.log("Unliked comment:", commentId);
                         } else { console.log("Already unliked (sync issue?), doing nothing");}
                     }
                 });

                 // --- Update UI Optimistically (after successful transaction) ---
                if (likeChange !== 0) {
                    buttonElement.classList.toggle('liked');
                     likeIcon.className = buttonElement.classList.contains('liked') ? 'fas fa-heart' : 'far fa-heart';
                    const currentCount = parseInt(likeCountSpan.textContent || '0');
                     likeCountSpan.textContent = Math.max(0, currentCount + likeChange); // Ensure count doesn't go below 0
                }

            } catch (error) {
                 console.error("Error toggling like:", error);
                 // Maybe revert UI or show error message?
                 alert("Could not update like status. Please try again.");
            } finally {
                buttonElement.style.pointerEvents = 'auto'; // Re-enable button
             }
         }


        // --- Pagination ---
        // (Using the improved createPagination function from previous response)
        function createPagination(currentPage, totalPages) { DOMElements.paginationUl.innerHTML = ''; if (totalPages <= 1) return; const maxPagesToShow = 5; let startPage, endPage; if (totalPages <= maxPagesToShow + 2) { startPage = 1; endPage = totalPages; } else { const maxP = Math.floor(maxPagesToShow / 2); const maxA = Math.ceil(maxPagesToShow / 2) - 1; if (currentPage <= maxP + 1) { startPage = 1; endPage = maxPagesToShow; } else if (currentPage + maxA >= totalPages) { startPage = totalPages - maxPagesToShow + 1; endPage = totalPages; } else { startPage = currentPage - maxP; endPage = currentPage + maxA; } } const createP = (p,l,d=false,a=false) => { const i=document.createElement('li'); i.className=`page-item ${d?'disabled':''} ${a?'active':''}`; const n=document.createElement('a'); n.className='page-link'; n.href='#'; n.innerHTML=l; n.setAttribute('aria-label', typeof l==='number'?`Go to page ${l}`:l); if (!d&&!a){ n.addEventListener('click', (e)=>{ e.preventDefault(); window.scrollTo({top:DOMElements.heroSection.offsetHeight,behavior:'smooth'}); loadMovies(currentCategory, p, currentSearchQuery);}); } i.appendChild(n); return i; }; DOMElements.paginationUl.appendChild(createP(currentPage-1,'<i class="fas fa-chevron-left"></i>',currentPage===1)); if (startPage>1){ DOMElements.paginationUl.appendChild(createP(1,1)); if (startPage>2){ DOMElements.paginationUl.appendChild(createP(0,'...',true)); } } for(let i=startPage;i<=endPage;i++){ DOMElements.paginationUl.appendChild(createP(i,i,false,i===currentPage)); } if (endPage<totalPages){ if(endPage<totalPages-1){ DOMElements.paginationUl.appendChild(createP(0,'...',true)); } DOMElements.paginationUl.appendChild(createP(totalPages,totalPages)); } DOMElements.paginationUl.appendChild(createP(currentPage+1,'<i class="fas fa-chevron-right"></i>',currentPage===totalPages));}

        // --- Event Listeners Setup ---
         function setupEventListeners() {
            // TMDB Category Change
            const handleCategoryChange = (category) => {
                DOMElements.categoryButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.category === category));
                currentCategory = category;
                currentSearchQuery = '';
                DOMElements.searchInput.value = '';
                currentPage = 1;
                // Don't auto-scroll on category change, let user do it or handle separately if needed
                loadMovies();
            };
             DOMElements.categoryButtons.forEach(button => button.addEventListener('click', () => handleCategoryChange(button.dataset.category)));
             DOMElements.categoryNavLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); handleCategoryChange(link.dataset.category); }));

            // Search
            const performSearch = () => {
                const query = DOMElements.searchInput.value.trim();
                if (query && query !== currentSearchQuery) {
                     currentCategory = 'search'; currentSearchQuery = query; currentPage = 1;
                    DOMElements.categoryButtons.forEach(btn => btn.classList.remove('active'));
                     // Optionally scroll to results
                    loadMovies('search', currentPage, currentSearchQuery);
                 } else if (!query && currentSearchQuery) {
                    currentSearchQuery = ''; handleCategoryChange('popular'); // Revert
                 }
            };
            DOMElements.searchButton.addEventListener('click', performSearch);
             DOMElements.searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

             // Authentication Forms
            DOMElements.loginForm.addEventListener('submit', handleLogin);
            DOMElements.signupForm.addEventListener('submit', handleSignup);
             DOMElements.logoutButton.addEventListener('click', handleLogout);

            // Q&A Form
            DOMElements.postQuestionForm.addEventListener('submit', handlePostQuestion);


             // Back to Top
             window.addEventListener('scroll', debounce(() => { // Use debounce
                 DOMElements.backToTopBtn.classList.toggle('show', window.pageYOffset > 500);
             }, 150)); // Check scroll every 150ms
            DOMElements.backToTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0 }); });

             // Handle clicks on dynamically added elements via event delegation if needed later (e.g., like buttons inside modal)
             // Example: DOMElements.detailModalContent.addEventListener('click', (e) => { if (e.target.closest('.like-button')) { handleLikeToggle(e.target.closest('.like-button')); } });
             // But onclick attribute used for simplicity in generated comment HTML for now.

         }

        // --- Initialization ---
         document.addEventListener('DOMContentLoaded', () => {
            console.log("DOM Loaded, initializing...");
             setupEventListeners();
             loadHeroMovie();
             loadFeaturedAndReviews();
             loadQuestions(); // Load Q&A section
            loadMovies(); // Load initial movie category
        });
