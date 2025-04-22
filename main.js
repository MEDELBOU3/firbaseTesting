  // --- Firebase Configuration ---
        const firebaseConfigApp = {
            apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4", // *** REPLACE ***
            authDomain: "sm4movies.firebaseapp.com",           // *** REPLACE ***
            projectId: "sm4movies",                      // *** REPLACE ***
            storageBucket: "sm4movies.appspot.com",       // *** REPLACE ***
            messagingSenderId: "277353836953",           // *** REPLACE ***
            appId: "1:277353836953:web:85e02783526c7cb58de308" // *** REPLACE ***
        };
        // REMINDER: Set secure Firebase Realtime Database rules!

        // --- Firebase Initialization ---
        let firebaseApp;
        let firebaseAuth;
        let firebaseDatabase;
        let messagesRef;

        try {
            firebaseApp = firebase.initializeApp(firebaseConfigApp);
            firebaseAuth = firebase.auth();
            firebaseDatabase = firebase.database();
            messagesRef = firebaseDatabase.ref('messages');
            console.log("Firebase Initialized Successfully");
        } catch (e) {
            console.error("Firebase initialization failed:", e);
            alert("Fatal Error: Could not initialize Firebase. Check console and config.");
            document.body.innerHTML = '<div class="alert alert-danger m-5" role="alert">Firebase initialization failed. Please check the console for details and ensure your `firebaseConfigApp` is correct. Refresh the page after fixing.</div>';
        }

        // --- DOM Elements ---
        const appContainer = document.getElementById('app-container');
        const authSection = document.getElementById('auth-section');
        const chatSection = document.getElementById('chat-section');

        // Auth elements
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const loginCard = document.getElementById('login-card');
        const signupCard = document.getElementById('signup-card');
        const showSignupLink = document.getElementById('show-signup');
        const showLoginLink = document.getElementById('show-login');
        const loginEmailInput = document.getElementById('login-email');
        const loginPasswordInput = document.getElementById('login-password');
        const loginErrorDiv = document.getElementById('login-error');
        const signupNameInput = document.getElementById('signup-name');
        const signupEmailInput = document.getElementById('signup-email');
        const signupPasswordInput = document.getElementById('signup-password');
        const signupErrorDiv = document.getElementById('signup-error');

        // Chat elements
        const chatBox = document.getElementById('chat-box');
        const messageForm = document.getElementById('message-form');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const logoutButton = document.getElementById('logout-button');
        const userDisplayNameSpan = document.getElementById('user-display-name');
        const navbarAvatarDiv = document.getElementById('navbar-avatar');
        const chatErrorDiv = document.getElementById('chat-error');
        const themeSelector = document.getElementById('theme-selector');
        const navbarUserInfo = document.getElementById('navbar-user-info');

        // Profile Modal Elements
        const profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
        const modalAvatar = document.getElementById('modal-avatar');
        const modalDisplayName = document.getElementById('modal-display-name');
        const modalEmail = document.getElementById('modal-email');
        const modalUid = document.getElementById('modal-uid');


        // --- State Variables ---
        let currentUser = null;
        let messageListenerAttached = false;
        const messageCache = new Map(); // Simple cache to avoid re-rendering existing messages
        const knownUsers = new Map(); // Cache user display names/avatars by UID


        // --- Helper Functions ---

        function displayError(element, message) {
            element.textContent = message;
            element.classList.remove('hidden');
        }

        function clearError(element) {
            element.textContent = '';
            element.classList.add('hidden');
        }

        function toggleAuthForms(showSignup) {
            clearError(loginErrorDiv);
            clearError(signupErrorDiv);
            if (showSignup) {
                loginCard.classList.add('hidden');
                signupCard.classList.remove('hidden');
            } else {
                signupCard.classList.add('hidden');
                loginCard.classList.remove('hidden');
            }
            loginForm.reset();
            signupForm.reset();
        }

        function showAuthSection() {
            authSection.classList.remove('hidden');
            chatSection.classList.add('hidden');
            toggleAuthForms(false); // Default to login form
        }

        function showChatSection() {
            authSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
            chatSection.style.display = 'flex';
            scrollToBottom();
            messageInput.focus();
        }

        function formatTimestamp(timestamp) {
            if (!timestamp) return '';
            try {
                const date = new Date(timestamp);
                 // Check if date is valid
                if (isNaN(date.getTime())) {
                   return ''; // Return empty if timestamp is invalid
                }
                return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            } catch (e) {
                console.warn("Could not format timestamp:", timestamp, e);
                return '';
            }
        }

        // Generates simple avatar HTML (data URL or placeholder)
        function generateAvatarHTML(uid, displayName, sizeClass = '') {
            const name = displayName || 'Anon'; // Use Anon if no name
            let initials = '?';
            try {
                const nameParts = name.split(' ').filter(Boolean); // Split and remove empty parts
                if (nameParts.length >= 2) {
                    initials = nameParts[0][0] + nameParts[nameParts.length - 1][0];
                } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
                    initials = nameParts[0].substring(0, 2);
                } else if (nameParts.length === 1) {
                     initials = nameParts[0][0];
                }
            } catch (e) { /* Use default '?' if error */ }

            // Simple hash function to get a color index based on UID
            let hash = 0;
            if (uid) {
                 for (let i = 0; i < uid.length; i++) {
                     hash = uid.charCodeAt(i) + ((hash << 5) - hash);
                     hash = hash & hash; // Convert to 32bit integer
                 }
            }
            const colors = ['#0d6efd', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0'];
            const colorIndex = Math.abs(hash % colors.length);
            const bgColor = colors[colorIndex];

             // In a real app, check knownUsers cache or photoURL first
             const user = knownUsers.get(uid);
             if (user && user.photoURL) {
                  return `<img src="${user.photoURL}" alt="${initials}" class="avatar ${sizeClass}">`;
             }

            // Use initials
            return `<div class="avatar ${sizeClass}" style="background-color: ${bgColor};" title="${name}">${initials.toUpperCase()}</div>`;
        }

        function displayChatMessage(snapshot) {
            const messageId = snapshot.key;
            const messageData = snapshot.val();

            if (!messageData || !messageData.text || !messageData.uid || !messageData.timestamp) {
                console.warn("Received incomplete message data:", messageId, messageData);
                return;
            }

            // Avoid re-rendering if already displayed (using simple cache)
            if (messageCache.has(messageId)) {
                return;
            }

             // Cache known user data
            if (!knownUsers.has(messageData.uid)) {
                knownUsers.set(messageData.uid, {
                    displayName: messageData.displayName || 'Anonymous',
                    // photoURL: messageData.photoURL || null // Ideally, photoURL would come with message
                });
            }
            const senderInfo = knownUsers.get(messageData.uid);

            const messageWrapper = document.createElement('div');
            messageWrapper.classList.add('message-wrapper');
            messageWrapper.setAttribute('data-message-id', messageId);
            messageWrapper.setAttribute('data-sender-uid', messageData.uid);
            messageWrapper.setAttribute('data-sender-name', senderInfo.displayName);

            const isSent = currentUser && messageData.uid === currentUser.uid;
            messageWrapper.classList.add(isSent ? 'sent' : 'received');

            // 1. Avatar
            const avatarContainer = document.createElement('div');
            avatarContainer.classList.add('message-avatar');
            avatarContainer.innerHTML = generateAvatarHTML(messageData.uid, senderInfo.displayName);
             avatarContainer.querySelector('.avatar').addEventListener('click', () => showProfileModal(messageData.uid, senderInfo.displayName)); // Add click listener
            messageWrapper.appendChild(avatarContainer);

            // 2. Content (Bubble)
            const contentDiv = document.createElement('div');
            contentDiv.classList.add('message-content');

            const bubbleDiv = document.createElement('div');
            bubbleDiv.classList.add('message-bubble');

            // Sender Name
            const senderSpan = document.createElement('span');
            senderSpan.classList.add('message-sender');
            senderSpan.textContent = isSent ? 'You' : senderInfo.displayName;
             senderSpan.addEventListener('click', () => showProfileModal(messageData.uid, senderInfo.displayName)); // Add click listener
            bubbleDiv.appendChild(senderSpan);

            // Message Text
            const textP = document.createElement('p');
            textP.classList.add('message-text');
            // Basic sanitization (replace potential HTML tags - more robust sanitization needed for production)
            textP.textContent = messageData.text;
            bubbleDiv.appendChild(textP);

            // Timestamp
            const timeSpan = document.createElement('span');
            timeSpan.classList.add('message-timestamp');
            timeSpan.textContent = formatTimestamp(messageData.timestamp);
            bubbleDiv.appendChild(timeSpan);

            contentDiv.appendChild(bubbleDiv);
            messageWrapper.appendChild(contentDiv);


            // Remove "Loading/Initializing..." placeholder if present
            const loadingMsg = chatBox.querySelector('.loading-placeholder');
            if (loadingMsg) {
                loadingMsg.remove();
            }

            chatBox.appendChild(messageWrapper);
            messageCache.set(messageId); // Add to cache
            scrollToBottom();
        }

        function scrollToBottom() {
            setTimeout(() => {
                chatBox.scrollTop = chatBox.scrollHeight;
            }, 100); // Slight delay might help ensure layout is complete
        }

        function displayChatError(message) {
            chatErrorDiv.textContent = message;
            setTimeout(() => { chatErrorDiv.textContent = ''; }, 5000);
        }

        function setLoadingState(button, isLoading, loadingText = 'Processing...') {
             if (!button) return;
             const originalContent = button.dataset.originalContent || button.innerHTML;
             if (isLoading) {
                 button.disabled = true;
                 if (!button.dataset.originalContent) {
                      button.dataset.originalContent = originalContent;
                 }
                 button.innerHTML = `
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span class="visually-hidden">${loadingText}</span>
                 `;
             } else {
                 button.disabled = false;
                 // Check if original content was stored before restoring
                 if (button.dataset.originalContent) {
                     button.innerHTML = button.dataset.originalContent;
                     // Clear the stored content after restoring
                    // delete button.dataset.originalContent; // Can cause issues if called multiple times quickly
                 }
                 // Fallback if dataset wasn't set properly
                 else if (button.querySelector('.spinner-border')) {
                     // Attempt to restore based on common patterns (e.g., Send button)
                     if (button.id === 'send-button') button.innerHTML = '<i class="bi bi-send-fill"></i>';
                     else if (button.id === 'logout-button') button.innerHTML = '<i class="bi bi-box-arrow-right"></i><span class="d-none d-sm-inline ms-1">Logout</span>';
                     else button.textContent = 'Submit'; // Generic fallback
                 }
             }
         }

        function applyTheme(themeName) {
            document.body.classList.remove('theme-dark', 'theme-ocean', 'theme-forest', 'theme-sunset'); // Remove all theme classes
            if (themeName !== 'light') { // 'light' is the default (no class)
                 document.body.classList.add(`theme-${themeName}`);
            }
             // Update active state in dropdown
            themeSelector.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.toggle('active', item.dataset.theme === themeName);
            });
            localStorage.setItem('chatTheme', themeName); // Save preference
            console.log(`Theme applied: ${themeName}`);
        }

        function loadTheme() {
            const savedTheme = localStorage.getItem('chatTheme') || 'light'; // Default to light
            applyTheme(savedTheme);
        }

         // --- Profile Modal Logic ---
         function showProfileModal(uid, displayName) {
             if (!currentUser) return; // Should not happen if logged in

            const userToShow = knownUsers.get(uid) || { displayName: displayName || 'Unknown User' };
            const avatarHTML = generateAvatarHTML(uid, userToShow.displayName, 'avatar-lg');

            modalAvatar.innerHTML = avatarHTML;
            modalDisplayName.textContent = userToShow.displayName;
            modalUid.textContent = `UID: ${uid || 'N/A'}`;

            // Only show email for the currently logged-in user viewing their own profile
            if (currentUser.uid === uid) {
                 modalEmail.textContent = currentUser.email || 'Email not available';
                 modalEmail.classList.remove('hidden');
                  // Add listener to navbar user info too
                  navbarUserInfo.setAttribute('data-bs-toggle', 'modal');
                  navbarUserInfo.setAttribute('data-bs-target', '#profileModal');
            } else {
                 modalEmail.textContent = 'Email private'; // Don't show others' emails
                 modalEmail.classList.add('hidden');
                  // Disable modal toggle for navbar if viewing someone else
                  navbarUserInfo.removeAttribute('data-bs-toggle');
                  navbarUserInfo.removeAttribute('data-bs-target');
            }

             profileModal.show();
         }


        // --- Authentication Event Listeners ---

        showSignupLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearError(loginErrorDiv);
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            const button = loginForm.querySelector('button[type="submit"]');

             if (!loginForm.checkValidity()) {
                displayError(loginErrorDiv, 'Please fill in both email and password.');
                return;
            }

            setLoadingState(button, true, 'Logging in...');

            firebaseAuth.signInWithEmailAndPassword(email, password)
                .catch((error) => {
                    console.error("Login failed:", error);
                    displayError(loginErrorDiv, error.message);
                    setLoadingState(button, false);
                });
        });

        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearError(signupErrorDiv);
            const displayName = signupNameInput.value.trim();
            const email = signupEmailInput.value;
            const password = signupPasswordInput.value;
            const button = signupForm.querySelector('button[type="submit"]');

            if (!signupForm.checkValidity()) {
                displayError(signupErrorDiv, 'Please fill in all fields correctly (Password min. 6 chars).');
                return;
            }
             if (!displayName) {
                 displayError(signupErrorDiv, "Display Name cannot be empty.");
                 return;
             }

            setLoadingState(button, true, 'Signing up...');

            firebaseAuth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    console.log("Signup successful:", user.uid);
                    // Update profile immediately
                    return user.updateProfile({
                        displayName: displayName
                        // photoURL: null // Explicitly null initially, could set a default generated one here
                    }).then(() => {
                        console.log("Display name updated for new user.");
                        // Success - onAuthStateChanged handles UI
                        knownUsers.set(user.uid, { displayName: displayName }); // Update local cache
                    });
                })
                .catch((error) => {
                    console.error("Signup or profile update failed:", error);
                    displayError(signupErrorDiv, error.message);
                    setLoadingState(button, false);
                });
        });


        // --- Chat Event Listeners ---

        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = messageInput.value.trim();

            if (messageText && currentUser && messagesRef) {
                clearError(chatErrorDiv);
                setLoadingState(sendButton, true, 'Sending...');

                const newMessage = {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || currentUser.email, // Use display name or fallback
                    text: messageText,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                    // photoURL: currentUser.photoURL || null // Could include avatar URL if available
                };

                messagesRef.push(newMessage)
                    .then(() => {
                        messageInput.value = '';
                        messageInput.focus();
                    })
                    .catch((error) => {
                        console.error("Error sending message:", error);
                        displayChatError(`Failed to send: ${error.message}`);
                    })
                    .finally(() => {
                         setLoadingState(sendButton, false);
                    });
            } else if (!currentUser) {
                displayChatError("You must be logged in to send messages.");
            }
        });

        logoutButton.addEventListener('click', () => {
            setLoadingState(logoutButton, true, 'Logging out...');
            detachMessageListener(); // Detach listener *before* signout starts
            firebaseAuth.signOut().catch((error) => {
                console.error("Sign out error:", error);
                alert("Error signing out.");
            }).finally(() => {
                 setLoadingState(logoutButton, false); // Ensure reset even on error
            });
        });

        // Theme selection listener
        themeSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('dropdown-item')) {
                const theme = e.target.dataset.theme;
                applyTheme(theme);
            }
        });

        // Add click listener to the user info area in the navbar to show own profile
        navbarUserInfo.addEventListener('click', () => {
             if (currentUser && navbarUserInfo.getAttribute('data-bs-toggle') === 'modal') { // Check if modal toggle is active
                 showProfileModal(currentUser.uid, currentUser.displayName);
             }
         });


        // --- Realtime Message Listener Setup ---
        function setupMessageListener() {
            if (!messagesRef || messageListenerAttached) return;

            chatBox.innerHTML = '<p class="text-center loading-placeholder py-5">Loading messages...</p>';
            messageCache.clear(); // Clear cache when setting up listener

            // Listen for new messages
            messagesRef.orderByChild('timestamp').limitToLast(75).on('child_added', (snapshot) => {
                // Check again inside callback because state might change async
                if (!messageListenerAttached) return;
                displayChatMessage(snapshot);
            }, (error) => {
                console.error("Error fetching messages:", error);
                chatBox.innerHTML = `<p class="text-center error-text py-5">Error loading messages: ${error.message}</p>`;
                messageListenerAttached = false; // Detach on error
            });

            messageListenerAttached = true;
            console.log("Message listener attached.");
        }

        function detachMessageListener() {
            if (messagesRef && messageListenerAttached) {
                messagesRef.off('child_added'); // Detach specific listener type
                messageListenerAttached = false;
                messageCache.clear(); // Clear cache on detach
                knownUsers.clear(); // Clear user cache on logout
                console.log("Message listener detached.");
            }
        }


        // --- Authentication State Observer (The Core Logic) ---
        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged((user) => {
                // Reset button states on any auth change
                setLoadingState(loginForm.querySelector('button[type="submit"]'), false);
                setLoadingState(signupForm.querySelector('button[type="submit"]'), false);
                setLoadingState(logoutButton, false);

                if (user) {
                    // --- User is IN ---
                    currentUser = user;
                    console.log("Auth State: IN - ", user.uid, user.displayName);

                    // Update local cache for current user
                    knownUsers.set(user.uid, { displayName: user.displayName || user.email, photoURL: user.photoURL });

                    // Update UI
                    userDisplayNameSpan.textContent = user.displayName || user.email;
                    navbarAvatarDiv.innerHTML = generateAvatarHTML(user.uid, user.displayName);
                     // Make sure own profile is clickable from navbar
                     navbarUserInfo.setAttribute('data-bs-toggle', 'modal');
                     navbarUserInfo.setAttribute('data-bs-target', '#profileModal');
                     navbarUserInfo.classList.add('cursor-pointer');

                    showChatSection();
                    setupMessageListener();

                } else {
                    // --- User is OUT ---
                    currentUser = null;
                    console.log("Auth State: OUT");

                    // Update UI
                    userDisplayNameSpan.textContent = 'Not Logged In';
                    navbarAvatarDiv.innerHTML = '?'; // Placeholder avatar
                     navbarUserInfo.removeAttribute('data-bs-toggle');
                     navbarUserInfo.removeAttribute('data-bs-target');
                     navbarUserInfo.classList.remove('cursor-pointer');

                    showAuthSection();
                    detachMessageListener(); // Clean up listener
                    chatBox.innerHTML = '<p class="text-center loading-placeholder py-5">Please log in to start chatting.</p>';
                    messageInput.value = '';
                    clearError(chatErrorDiv);
                }
            });
        } else {
            console.error("FirebaseAuth object not available.");
            showAuthSection();
            displayError(loginErrorDiv, "Authentication service failed. Please refresh.");
        }

        // --- Initial Load ---
        loadTheme(); // Load saved theme preference on page load
