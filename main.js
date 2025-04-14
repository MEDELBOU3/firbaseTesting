    document.addEventListener('DOMContentLoaded', () => {

            // --- Firebase Config & Initialization ---
            const firebaseConfigApp = { apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4", authDomain: "sm4movies.firebaseapp.com", projectId: "sm4movies", storageBucket: "sm4movies.appspot.com", messagingSenderId: "277353836953", appId: "1:277353836953:web:85e02783526c7cb58de308" };
            let auth, db, timestamp, increment;
             try { if (!firebase.apps.length) { firebase.initializeApp(firebaseConfigApp); } auth = firebase.auth(); db = firebase.firestore(); timestamp = firebase.firestore.FieldValue.serverTimestamp; increment = firebase.firestore.FieldValue.increment; console.log("Firebase Ready"); } catch (e) { console.error("CRITICAL: Firebase Init Failed:", e); document.body.innerHTML = `<div class="vh-100 d-flex align-items-center justify-content-center"><div class="alert alert-danger">Firebase Init Error. Site cannot function. ${e.message}</div></div>`; return; }
             if (typeof bootstrap === 'undefined') { console.error("CRITICAL: Bootstrap JS not loaded."); return; } // Stop if BS fails

             // --- Constants ---
            const API_KEY = '431fb541e27bceeb9db2f4cab69b54e1'; const BASE_URL = 'https://api.themoviedb.org/3'; const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
             const POSTER_SIZE = 'w500'; const BACKDROP_SIZE = 'w1280'; const PROFILE_SIZE = 'w185'; const LOGO_SIZE = 'w185';
            const PLACEHOLDER_PROFILE_ICON = 'fa-user-astronaut'; const PLACEHOLDER_MOVIE_ICON = 'fa-film';

            // --- State ---
             let currentPage = 1; let totalPages = 0; let currentCategory = 'popular'; let currentSearchQuery = ''; let currentUser = null; let userDisplayName = 'Guest';

            // --- DOM Elements Cache ---
             const DOMElements = { /* Cache all relevant DOM elements using their IDs */
                 spinner: document.getElementById('spinner'), backToTopBtn: document.getElementById('backToTop'), heroSection: document.getElementById('heroSection'),
                 heroMovieTitle: document.getElementById('heroMovieTitle'), heroMovieTagline: document.getElementById('heroMovieTagline'), searchInput: document.getElementById('searchInput'), searchButton: document.getElementById('searchButton'),
                 categoryButtons: document.querySelectorAll('.category-pill'), categoryNavLinks: document.querySelectorAll('.category-nav-link'),
                featuredArticlesContainer: document.getElementById('featuredArticlesContainer'), moviesSectionTitle: document.getElementById('moviesSectionTitle'),
                 moviesContainer: document.getElementById('moviesContainer'), paginationUl: document.getElementById('pagination'), reviewsContainer: document.getElementById('reviewsContainer'),
                authArea: document.getElementById('authArea'), userInfo: document.getElementById('userInfo'), usernameDisplay: document.getElementById('usernameDisplay'),
                 logoutButton: document.getElementById('logoutButton'), authButtonsContainer: document.querySelector('.auth-buttons'), // The container for login/signup buttons
                 detailModalEl: document.getElementById('detailModal'), detailModal: bootstrap.Modal.getInstance(document.getElementById('detailModal')) ?? new bootstrap.Modal(document.getElementById('detailModal')), detailModalContent: document.getElementById('detailModalContent'),
                 authModalEl: document.getElementById('authModal'), // The container modal
                loginForm: document.getElementById('loginForm'), loginError: document.getElementById('loginError'),
                signupForm: document.getElementById('signupForm'), signupError: document.getElementById('signupError'),
                 qandaSection: document.getElementById('qandaSection'), postQuestionCard: document.getElementById('postQuestionCard'), postQuestionForm: document.getElementById('postQuestionForm'),
                 questionText: document.getElementById('questionText'), questionPostStatus: document.getElementById('questionPostStatus'), qandaLoginPrompt: document.getElementById('qandaLoginPrompt'), questionsList: document.getElementById('questionsList'),
                 togglePostQuestionBtn: document.getElementById('togglePostQuestionBtn')
             };

            // --- Utilities ---
             const formatCurrency = (amount) => amount ? `$${amount.toLocaleString('en-US')}` : 'N/A';
             const formatRuntime = (minutes) => minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'N/A';
             const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
             const formatTimestamp = (fsTimestamp) => fsTimestamp?.toDate ? new Date(fsTimestamp.toDate()).toLocaleDateString('en-US', { day: 'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'}) : 'Timestamp invalid';
             const getImageUrl = (path, size) => path ? `${IMAGE_BASE_URL}${size}${path}` : null;
             const createPlaceholderDiv = (className, iconClass = 'fa-image', style = '') => `<div class="${className} placeholder-img" style="${style}"><i class="fas ${iconClass}"></i></div>`;
             const debounce = (func, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };
            const showSpinner = () => DOMElements.spinner?.classList.add('show');
            const hideSpinner = () => DOMElements.spinner?.classList.remove('show');
            const showElement = (el) => el?.classList.remove('d-none');
            const hideElement = (el) => el?.classList.add('d-none');
             const displayFeedback = (element, message, isError = true) => { if (!element) return; element.textContent = message; element.className = `form-text mt-2 small text-center ${isError ? 'text-danger' : 'text-success'}`; if (message) { setTimeout(() => { if(element) element.textContent = ''; }, 4000); } }; // Centered feedback
             const getUserData = async (userId) => { if (!userId || !db) return { displayName: 'Anonymous' }; try { const d=await db.collection('users').doc(userId).get(); return d.exists ? d.data() : { displayName: 'User'}; } catch (e) { console.error("GetUser Error:", e); return { displayName:'Err' }; } };
            const escapeHTML = (str) => str.replace(/[&<>"']/g, (match) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '' }[match])); // Basic HTML escaping

            // --- Skeleton Renderer ---
             function renderSkeletons(container, count, type = 'movie') { /* same as before */
                let skeletonHTML = ''; if (!container) return;
                 if (type === 'movie') {
                    for (let i = 0; i < count; i++) skeletonHTML += `<div class="col-6 col-md-4 col-lg-3 mb-4 movie-card-wrapper"><div class="movie-card"><div class="movie-poster-container skeleton"></div><div class="movie-info"><div class="skeleton mb-2" style="height: 20px; width: 70%; border-radius: 5px;"></div><div class="skeleton mb-3" style="height: 14px; width: 40%; border-radius: 5px;"></div><div class="skeleton mt-auto" style="height: 34px; width: 100%; border-radius: var(--cv-border-radius-md);"></div></div></div></div>`;
                 } else if (type === 'question') {
                    for (let i = 0; i < count; i++) skeletonHTML += `<div class="question-item" style="background-color: var(--cv-secondary-bg);"><div class="skeleton mb-2" style="height: 24px; width: 80%;"></div><div class="skeleton" style="height: 14px; width: 50%;"></div></div>`;
                } // Add more types (featured, review) if needed
                container.innerHTML = skeletonHTML;
             }

            // --- Authentication & UI Updates ---
             auth.onAuthStateChanged(async (user) => {
                 showSpinner();
                 currentUser = user;
                 if (user) {
                     const userData = await getUserData(user.uid);
                     userDisplayName = userData?.displayName || user.email || 'User';
                    DOMElements.usernameDisplay.textContent = userDisplayName;
                    hideElement(DOMElements.authButtonsContainer);
                    showElement(DOMElements.userInfo);
                    showElement(DOMElements.logoutButton);
                     showElement(DOMElements.togglePostQuestionBtn); // Show Ask button
                    hideElement(DOMElements.qandaLoginPrompt);
                    DOMElements.postQuestionCard.classList.add('hidden'); // Start hidden, user must click button
                     console.log(`Logged in: ${userDisplayName} (${user.uid})`);
                 } else {
                     userDisplayName = 'Guest';
                    showElement(DOMElements.authButtonsContainer);
                    hideElement(DOMElements.userInfo);
                    hideElement(DOMElements.logoutButton);
                     hideElement(DOMElements.togglePostQuestionBtn); // Hide Ask button
                    DOMElements.postQuestionCard.classList.add('hidden'); // Ensure form hidden
                    showElement(DOMElements.qandaLoginPrompt);
                     console.log('Logged out');
                }
                 loadQuestions(); // Reload Q&A for correct permissions/display
                hideSpinner();
             });

             // (Add handleSignup, handleLogin, handleLogout - same logic as before)
             async function handleSignup(e){ e.preventDefault(); showSpinner(); const dN=DOMElements.signupForm.querySelector('#signupDisplayName').value.trim(); const em=DOMElements.signupForm.querySelector('#signupEmail').value; const pw=DOMElements.signupForm.querySelector('#signupPassword').value; DOMElements.signupError.textContent = ''; if(!dN){ displayFeedback(DOMElements.signupError,'Display Name required.'); hideSpinner(); return; } try{ const uC=await auth.createUserWithEmailAndPassword(em,pw); await uC.user.updateProfile({displayName:dN}); await db.collection('users').doc(uC.user.uid).set({displayName:dN, email:em, createdAt:timestamp},{merge:true}); bootstrap.Modal.getInstance(DOMElements.authModalEl)?.hide(); } catch(err){ displayFeedback(DOMElements.signupError,err.message); } finally{ hideSpinner(); }}
            async function handleLogin(e){ e.preventDefault(); showSpinner(); const em=DOMElements.loginForm.querySelector('#loginEmail').value; const pw=DOMElements.loginForm.querySelector('#loginPassword').value; DOMElements.loginError.textContent=''; try{ await auth.signInWithEmailAndPassword(em,pw); bootstrap.Modal.getInstance(DOMElements.authModalEl)?.hide(); } catch(err){ displayFeedback(DOMElements.loginError,err.message); } finally{ hideSpinner(); }}
            async function handleLogout(){ showSpinner(); try{ await auth.signOut(); } catch(err){ console.error("Logout Err:",err); alert('Logout Failed.'); } finally{ hideSpinner(); } }


             // --- TMDB API ---
             async function fetchFromTMDB(endpoint, params={}){/* same as before */}

             // --- Content Loading & Rendering ---
             async function loadMovies(category = currentCategory, page = currentPage, query = currentSearchQuery) { /* Logic ok, use skeletons */
                if (!DOMElements.moviesContainer) return; renderSkeletons(DOMElements.moviesContainer, 12, 'movie'); let data; let titlePrefix='Explore'; if(category==='search'&&query){ titlePrefix=`Search: "${escapeHTML(query)}"`; data=await fetchFromTMDB('search/movie',{query:query,page:page});} else if(category!=='search'){ titlePrefix=`Explore ${category.replace(/_/g,' ')}`; data=await fetchFromTMDB(`movie/${category}`,{page:page});} else { DOMElements.moviesContainer.innerHTML = ''; return; } if(DOMElements.moviesSectionTitle) DOMElements.moviesSectionTitle.textContent=titlePrefix; if(data?.results){ displayMovies(data.results); totalPages=Math.min(data.total_pages,500); createPagination(page,totalPages); } else { DOMElements.moviesContainer.innerHTML = `<div class="col-12 text-center py-5"><p class="text-secondary">Could not load movies.</p></div>`; createPagination(1,0); }}

             function displayMovies(movies) { /* Refined Card HTML */
                 if(!DOMElements.moviesContainer)return; DOMElements.moviesContainer.innerHTML = ''; if (!movies || movies.length === 0) { DOMElements.moviesContainer.innerHTML = `<div class="col-12 text-center py-5"><p class="text-secondary">No movies found.</p></div>`; return; }
                 movies.forEach(movie => {
                    const posterUrl = getImageUrl(movie.poster_path, POSTER_SIZE);
                    const movieElement = document.createElement('div'); movieElement.className = 'col-6 col-sm-4 col-lg-3 mb-4 movie-card-wrapper';
                    const posterHTML = posterUrl ? `<img src="${posterUrl}" alt="${escapeHTML(movie.title)}" class="movie-poster" loading="lazy">` : createPlaceholderDiv('movie-poster', PLACEHOLDER_MOVIE_ICON);
                     movieElement.innerHTML = `
                        <div class="movie-card" data-movie-id="${movie.id}">
                             <div class="movie-poster-container">
                                ${posterHTML}
                                 ${movie.vote_average ? `<div class="movie-rating"><i class="fas fa-star"></i><span>${movie.vote_average.toFixed(1)}</span></div>` : ''}
                            </div>
                             <div class="movie-info">
                                <h3 class="movie-title">${escapeHTML(movie.title || 'Untitled')}</h3>
                                 <p class="movie-date">${formatDate(movie.release_date)}</p>
                             
                                <p class="movie-overview">${escapeHTML(movie.overview?.substring(0,60) + (movie.overview?.length > 60 ? '...' : '') || '')}</p>
                                 <button class="btn movie-card-button mt-auto">Details</button> 
                             </div>
                         </div>`;
                    movieElement.querySelector('.movie-card').addEventListener('click', () => showDetailModal('movie', movie.id));
                     DOMElements.moviesContainer.appendChild(movieElement);
                });
            }

             async function loadHeroMovie(){ /* unchanged */ }
            async function loadFeaturedAndReviews(){ /* unchanged but using placeholders now */
                 // Can be simplified - maybe just fetch one popular movie for featured, one top rated for review example
                 if (DOMElements.featuredArticlesContainer) DOMElements.featuredArticlesContainer.innerHTML = '<!-- Dynamic Featured Placeholder/Content Here -->';
                 if (DOMElements.reviewsContainer) DOMElements.reviewsContainer.innerHTML = '<!-- Dynamic Review Placeholder/Content Here -->';
                 console.log("Static featured/reviews shown, implement dynamic loading if needed.");
             }

             // --- Modal Rendering (Unified) ---
             async function showDetailModal(type, id) { /* unchanged controller logic */
                showSpinner(); DOMElements.detailModalContent.innerHTML=`<div class="text-center p-5 vh-50 d-flex align-items-center justify-content-center"><div class="spinner-border text-primary"></div></div>`; DOMElements.detailModal.show(); try { if (type === 'movie') await renderMovieModalContent(id); else if (type === 'question') await renderQAModalContent(id); else throw new Error("Invalid type"); } catch (err) { console.error(err); DOMElements.detailModalContent.innerHTML=`<div class="alert alert-danger m-4">Details Error.</div>`; } finally { hideSpinner(); } }
             async function renderMovieModalContent(movieId) { /* unchanged content generation */
                const movieData = await fetchFromTMDB(`movie/${movieId}`, { append_to_response: 'credits,videos,images' }); if (!movieData) throw new Error('Movie data not found'); const backdropUrl = getImageUrl(movieData.backdrop_path || movieData.poster_path, BACKDROP_SIZE); const posterUrl = getImageUrl(movieData.poster_path, POSTER_SIZE); const director=movieData.credits?.crew.find(p=>p.job==='Director')?.name||'N/A'; const cast=movieData.credits?.cast.slice(0,12)||[];const genresHTML=movieData.genres?.map(g => `<span class="genre-badge">${escapeHTML(g.name)}</span>`).join('')||'';const trailer=movieData.videos?.results.find(v=>v.site==='YouTube'&&v.type==='Trailer'); const companies=movieData.production_companies?.filter(c=>c.logo_path).slice(0,5)||[]; const castHTML = cast.length>0?cast.map(p=>{const img=getImageUrl(p.profile_path,PROFILE_SIZE); return `<div class="cast-card"><img src="${img||PLACEHOLDER_PROFILE_URL}" alt="${escapeHTML(p.name)}" class="cast-image" loading="lazy"><div class="cast-info"><p class="cast-name">${escapeHTML(p.name||'?')}</p><p class="cast-character">${escapeHTML(p.character||'')}</p></div></div>`; }).join(''):'<p class="text-secondary small ms-1">N/A</p>'; const companiesHTML = companies.length>0?companies.map(c=>{const logo=getImageUrl(c.logo_path,LOGO_SIZE); return logo ? `<img src="${logo}" alt="${escapeHTML(c.name)}" class="prod-company" title="${escapeHTML(c.name)}">`:''}).join(''):'<p class="text-secondary small ms-1">N/A</p>';
                 DOMElements.detailModalContent.innerHTML = `
                <div class="modal-backdrop-container">${backdropUrl ? `<img src="${backdropUrl}" alt="" class="modal-movie-backdrop">`:createPlaceholderDiv('modal-movie-backdrop',PLACEHOLDER_MOVIE_ICON)}</div>
                <div class="container modal-body-content">
                    <div class="row mb-4"><div class="col-lg-4 text-center">${posterUrl ? `<img src="${posterUrl}" alt="" class="modal-movie-poster">`:createPlaceholderDiv('modal-movie-poster', PLACEHOLDER_MOVIE_ICON)}</div><div class="col-lg-8 d-flex flex-column justify-content-center mt-4 mt-lg-0"><h2 class="modal-movie-title">${escapeHTML(movieData.title||'Untitled')}</h2><p class="modal-movie-tagline">${escapeHTML(movieData.tagline||'')}</p><div class="modal-movie-meta"> <div class="meta-item" title="Rating"><i class="fas fa-star meta-icon"></i><span>${movieData.vote_average?movieData.vote_average.toFixed(1)+'/10':'N/A'} (${movieData.vote_count?movieData.vote_count.toLocaleString()+' votes':'0 votes'})</span></div> <div class="meta-item" title="Date"><i class="fas fa-calendar-alt meta-icon"></i><span>${formatDate(movieData.release_date)}</span></div> <div class="meta-item" title="Runtime"><i class="fas fa-clock meta-icon"></i><span>${formatRuntime(movieData.runtime)}</span></div> <div class="meta-item" title="Status"><i class="fas fa-check-circle meta-icon"></i><span>${movieData.status||'N/A'}</span></div></div><div class="my-4">${genresHTML}</div></div></div>
                     <div class="mt-4"><h5 class="modal-section-title">Overview</h5><p class="text-secondary lh-lg">${escapeHTML(movieData.overview||'N/A')}</p></div>
                     <div class="row mt-4 g-3"><div class="col-md-4"><h6 class="fw-bold text-light">Director</h6><p class="text-secondary mb-0">${escapeHTML(director)}</p></div><div class="col-md-4"><h6 class="fw-bold text-light">Budget</h6><p class="text-secondary mb-0">${formatCurrency(movieData.budget)}</p></div><div class="col-md-4"><h6 class="fw-bold text-light">Revenue</h6><p class="text-secondary mb-0">${formatCurrency(movieData.revenue)}</p></div></div>
                     <div class="cast-section"><h5 class="modal-section-title">Top Billed Cast</h5><div class="cast-scroll">${castHTML}</div></div>
                    ${trailer ? `<div class="trailer-container"><h5 class="modal-section-title">Trailer</h5><div class="ratio ratio-16x9"><iframe class="trailer-iframe rounded" src="https://www.youtube.com/embed/${trailer.key}" title="Trailer" frameborder="0" allowfullscreen></iframe></div></div>` : ''}
                    ${companies.length>0?`<div class="mt-4"><h5 class="modal-section-title">Production</h5><div class="prod-companies-list">${companiesHTML}</div></div>`:''}
                    <div class="text-center mt-5"><a href="https://www.themoviedb.org/movie/${movieData.id}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-light"><i class="fas fa-external-link-alt me-2"></i> View on TMDB</a></div>
                 </div>`;
            }
            async function renderQAModalContent(questionId) { /* Uses escapeHTML now */
                try { const qDoc = await db.collection('questions').doc(questionId).get(); if (!qDoc.exists) throw new Error("Q Not Found"); const qData={id: qDoc.id, ...qDoc.data()}; const aData=await getUserData(qData.userId);
                    DOMElements.detailModalContent.innerHTML=`<div class="container p-4 py-5"><h2 class="modal-movie-title mb-2">${escapeHTML(qData.text)}</h2><p class="text-secondary mb-4 small">Asked by <strong class="text-info">${escapeHTML(aData.displayName)}</strong> on ${formatTimestamp(qData.timestamp)}</p><hr class="border-secondary"><h5 class="modal-section-title">Comments</h5><div id="commentsContainer" class="mb-4 comments-scrollable" style="max-height: 40vh; overflow-y: auto;"></div><div id="addCommentSection">${currentUser?'<form id="addCommentForm"><h6 class="modal-section-title small-title fs-6 mb-2">Leave a Comment</h6><input type="hidden" id="commentQuestionId" value="${questionId}"><div class="mb-2"><textarea class="form-control" id="commentText" rows="3" placeholder="Your comment..." required></textarea></div><button type="submit" class="btn btn-sm btn-primary"><i class="fas fa-paper-plane me-1"></i> Post</button><div id="commentPostStatus" class="form-text mt-2 small"></div></form>':'<p class="text-center text-secondary small mt-4">Please <a href="#" class="link-info" data-bs-dismiss="modal" data-bs-toggle="modal" data-bs-target="#authModal" onclick="setActiveAuthTab(\'login\')">log in</a> to comment.</p>'}</div></div>`;
                     const addCommentForm=document.getElementById('addCommentForm'); if(addCommentForm){ addCommentForm.addEventListener('submit',handleAddComment); } loadComments(questionId);
                 } catch(err){ DOMElements.detailModalContent.innerHTML = `<div class="alert alert-danger m-4">Error loading question.</div>`;}
            }


            // --- Q&A Logic ---
            async function loadQuestions() { /* Uses escapeHTML */
                 if(!DOMElements.questionsList) return; renderSkeletons(DOMElements.questionsList, 3, 'question'); try{const snp=await db.collection('questions').orderBy('timestamp','desc').limit(15).get(); if(snp.empty){DOMElements.questionsList.innerHTML='<p class="text-center text-secondary mt-3">No questions asked yet.</p>'; return;}let ht=''; const aPs=snp.docs.map(d=>getUserData(d.data().userId));const aDs=await Promise.all(aPs); snp.docs.forEach((d,i)=>{const q={id:d.id,...d.data()};const a=aDs[i];ht+=`<div class="question-item" data-question-id="${q.id}"><p class="question-text">${escapeHTML(q.text)}</p><div class="question-meta"><span title="User"><i class="fas fa-user"></i> <span class="author-name">${escapeHTML(a.displayName||'Anon')}</span></span><span title="Date"><i class="fas fa-clock"></i> ${formatTimestamp(q.timestamp)}</span></div></div>`;}); DOMElements.questionsList.innerHTML=ht; DOMElements.questionsList.querySelectorAll('.question-item').forEach(itm=>{itm.addEventListener('click',()=>showDetailModal('question',itm.dataset.questionId));});} catch(err){ console.error(err);DOMElements.questionsList.innerHTML='<p class="text-center text-danger mt-3">Could not load questions.</p>';}}
            async function handlePostQuestion(e) { /* unchanged */ e.preventDefault();if(!currentUser){displayFeedback(DOMElements.questionPostStatus,"Login required.");return;} const txt=DOMElements.questionText.value.trim();if(!txt){displayFeedback(DOMElements.questionPostStatus,"Question empty.");return;} showSpinner();DOMElements.questionPostStatus.textContent='';try{await db.collection('questions').add({userId:currentUser.uid,text:txt,timestamp:timestamp,likeCount:0});DOMElements.questionText.value='';displayFeedback(DOMElements.questionPostStatus,"Posted!",false);DOMElements.postQuestionCard.classList.add('hidden');loadQuestions();}catch(err){displayFeedback(DOMElements.questionPostStatus,"Error posting.");}finally{hideSpinner();}}
             async function loadComments(questionId) { /* Uses escapeHTML */
                 const commentsContainer = document.getElementById('commentsContainer'); if (!commentsContainer) return; commentsContainer.innerHTML='<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-info"></div></div>'; try{ const snp = await db.collection('comments').where('questionId', '==', questionId).orderBy('timestamp', 'asc').get(); if (snp.empty) { commentsContainer.innerHTML = '<p class="text-center text-secondary small fst-italic mt-3">Be the first to comment.</p>'; return; } const cPs = snp.docs.map(async d => { const c={id:d.id,...d.data()};const aP=getUserData(c.userId); const lP=currentUser?checkIfLiked(c.id,currentUser.uid):Promise.resolve(false); const[aD,iL]=await Promise.all([aP,lP]); return {...c, aD, iL}; }); const cmts=await Promise.all(cPs); let cH = ''; cmts.forEach(c => { const lC = c.likeCount||0; const lCl = c.isLiked?'liked':''; const lI=c.isLiked?'fas fa-heart':'far fa-heart'; cH+=`<div class="comment-item" id="comment-${c.id}"><div><strong class="comment-author">${escapeHTML(c.aD?.displayName||'Anon')}</strong><span class="comment-timestamp">${formatTimestamp(c.timestamp)}</span></div><p class="comment-text">${escapeHTML(c.text)}</p><div class="comment-actions"><button class="btn btn-link text-decoration-none p-0 like-button ${lCl}" data-comment-id="${c.id}" onclick="handleLikeToggle(this)"><i class="${lI} me-1"></i>Like</button><span class="like-count text-secondary ms-2">${lC}</span></div></div>`;}); commentsContainer.innerHTML = cH; } catch (err) { console.error(err); commentsContainer.innerHTML = '<p class="text-center text-danger small">Load comments error.</p>'; } }
            async function handleAddComment(e) { /* unchanged */ e.preventDefault(); const cEl=document.getElementById('commentText'); const qEl=document.getElementById('commentQuestionId'); const sEl=document.getElementById('commentPostStatus'); if(!currentUser||!cEl||!qEl||!sEl){if(sEl)displayFeedback(sEl,"Error posting comment."); return;}const txt=cEl.value.trim();const qId=qEl.value; if(!txt||!qId){displayFeedback(sEl,"Comment empty."); return;} showSpinner();sEl.textContent='';try{await db.collection('comments').add({questionId:qId,userId:currentUser.uid,text:txt,likeCount:0,timestamp:timestamp}); cEl.value='';displayFeedback(sEl,"Comment posted!",false);loadComments(qId);}catch(err){displayFeedback(sEl,"Error posting comment.");}finally{hideSpinner();}}
            async function checkIfLiked(commentId, userId){ /* unchanged */ try{return (await db.collection('likes').doc(`${userId}_${commentId}`).get()).exists;}catch(err){return false;} }
            window.handleLikeToggle = async function(buttonElement) { /* Unchanged logic, uses window */
                 if (!currentUser) { try{bootstrap.Modal.getOrCreateInstance(DOMElements.authModalEl).show();setActiveAuthTab('login');} catch(e){} return; }
                 const commentId = buttonElement.dataset.commentId; if (!commentId) return;
                 const likeIcon = buttonElement.querySelector('i'); const likeCountSpan = buttonElement.parentElement.querySelector('.like-count');
                 const commentRef = db.collection('comments').doc(commentId); const likeDocRef = db.collection('likes').doc(`${currentUser.uid}_${commentId}`);
                 buttonElement.style.pointerEvents = 'none';
                 try { const isLiked = buttonElement.classList.contains('liked'); let likeChange = 0;
                     await db.runTransaction(async (t) => {
                        const likeDoc = await t.get(likeDocRef); const commDoc = await t.get(commentRef); if (!commDoc.exists) throw "Comm Gone";
                         if (!isLiked && !likeDoc.exists) { t.set(likeDocRef, { u:currentUser.uid, c:commentId, t:timestamp }); t.update(commentRef, { likeCount: increment(1) }); likeChange=1;}
                        else if (isLiked && likeDoc.exists) { t.delete(likeDocRef); if((commDoc.data().likeCount||0)>0) t.update(commentRef,{likeCount:increment(-1)}); else t.update(commentRef,{likeCount:0}); likeChange=-1;}
                     });
                    if (likeChange!==0) { buttonElement.classList.toggle('liked'); likeIcon.className = buttonElement.classList.contains('liked') ? 'fas fa-heart' : 'far fa-heart'; const currentCount = parseInt(likeCountSpan.textContent||'0'); likeCountSpan.textContent = Math.max(0, currentCount+likeChange); }
                } catch (err) { console.error("Like error:", err); alert("Like update failed."); }
                 finally { buttonElement.style.pointerEvents = 'auto'; }
             }


             // --- Pagination ---
             function createPagination(currentPage, totalPages) { /* Unchanged logic, using cached DOMElements.paginationUl */
                 const container=DOMElements.paginationUl; container.innerHTML='';if(totalPages<=1)return;const maxP=5;let sP,eP;if(totalPages<=maxP+2){sP=1;eP=totalPages;}else{const b=Math.floor(maxP/2);const a=Math.ceil(maxP/2)-1;if(currentPage<=b+1){sP=1;eP=maxP;}else if(currentPage+a>=totalPages){sP=totalPages-maxP+1;eP=totalPages;}else{sP=currentPage-b;eP=currentPage+a;}}const createP=(p,l,d=false,act=false)=>{const i=document.createElement('li');i.className=`page-item ${d?'disabled':''} ${act?'active':''}`;const n=document.createElement('a');n.className='page-link';n.href='#';n.innerHTML=l;n.setAttribute('aria-label',typeof l==='number'?`Go to page ${l}`:l);if(!d&&!act){n.addEventListener('click',(e)=>{e.preventDefault();window.scrollTo({top: DOMElements.explore?.offsetTop - 80 || 0,behavior:'smooth'});loadMovies(currentCategory,p,currentSearchQuery);});}i.appendChild(n);return i;};container.appendChild(createP(currentPage-1,'<i class="fas fa-chevron-left"></i>',currentPage===1));if(sP>1){container.appendChild(createP(1,1));if(sP>2){container.appendChild(createP(0,'...',true));}}for(let i=sP;i<=eP;i++){container.appendChild(createP(i,i,false,i===currentPage));}if(eP<totalPages){if(eP<totalPages-1){container.appendChild(createP(0,'...',true));}container.appendChild(createP(totalPages,totalPages));}container.appendChild(createP(currentPage+1,'<i class="fas fa-chevron-right"></i>',currentPage===totalPages));
            }

             // --- Helper to activate auth modal tab ---
             window.setActiveAuthTab = function(tabId) { // Make global for onclick
                 const tabTriggerEl = document.querySelector(`#nav-${tabId}-tab`);
                 if (tabTriggerEl && bootstrap?.Tab) {
                     const tab = bootstrap.Tab.getInstance(tabTriggerEl) ?? new bootstrap.Tab(tabTriggerEl);
                    tab.show();
                } else {
                     console.warn(`Tab trigger for ${tabId} not found or Bootstrap Tab component missing.`);
                 }
             }


            // --- Setup Event Listeners ---
            function setupEventListeners() { /* Unchanged listener setup logic */
                 // Categories
                const handleCategoryChange = (cat) => { DOMElements.categoryButtons.forEach(b=>b.classList.toggle('active',b.dataset.category===cat)); currentCategory=cat; currentSearchQuery=''; DOMElements.searchInput.value=''; currentPage=1; loadMovies(); };
                DOMElements.categoryButtons.forEach(b => b?.addEventListener('click', () => handleCategoryChange(b.dataset.category)));
                 DOMElements.categoryNavLinks.forEach(l => l?.addEventListener('click', (e) => { e.preventDefault(); handleCategoryChange(l.dataset.category); }));
                // Search
                 const performSearch = () => { const q = DOMElements.searchInput.value.trim(); if (q && q!== currentSearchQuery){ currentCategory='search'; currentSearchQuery=q; currentPage=1; DOMElements.categoryButtons.forEach(b=>b.classList.remove('active')); loadMovies('search', currentPage, q); } else if (!q && currentSearchQuery){ currentSearchQuery=''; handleCategoryChange('popular'); }};
                 if(DOMElements.searchButton) DOMElements.searchButton.addEventListener('click', performSearch);
                if(DOMElements.searchInput) DOMElements.searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
                // Auth
                if(DOMElements.loginForm) DOMElements.loginForm.addEventListener('submit', handleLogin);
                if(DOMElements.signupForm) DOMElements.signupForm.addEventListener('submit', handleSignup);
                if(DOMElements.logoutButton) DOMElements.logoutButton.addEventListener('click', handleLogout);
                // Q&A
                 if(DOMElements.postQuestionForm) DOMElements.postQuestionForm.addEventListener('submit', handlePostQuestion);
                if(DOMElements.togglePostQuestionBtn) DOMElements.togglePostQuestionBtn.addEventListener('click', () => {
                    DOMElements.postQuestionCard?.classList.toggle('hidden');
                });
                // Back to Top
                window.addEventListener('scroll', debounce(() => { DOMElements.backToTopBtn?.classList.toggle('show', window.pageYOffset > 500); }, 150));
                DOMElements.backToTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0 }));
                // Dummy Newsletter
                 if(DOMElements.newsletterFormDummy) { /* Dummy listener unchanged */ }
             }

            // --- Initial Load Actions ---
             console.log("Setting up...");
            setupEventListeners();
             console.log("Loading initial content...");
            loadHeroMovie();
            loadFeaturedAndReviews(); // Maybe show static first, then load dynamic
             loadQuestions();
             loadMovies(); // Load initial 'popular' movies

        }); // End DOMContentLoaded
