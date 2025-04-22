    // --- App Configuration ---
        const APP_NAME = "Synergy Chat";
        const MESSAGE_LIMIT = 100; // How many messages to load initially
        const TYPING_TIMEOUT_MS = 3000; // How long until typing status resets
        const DEBOUNCE_TYPING_MS = 400; // Debounce interval for typing updates

        // --- Firebase Configuration ---
        const firebaseConfigApp = {
            apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4", // *** REPLACE ***
            authDomain: "sm4movies.firebaseapp.com",           // *** REPLACE ***
            projectId: "sm4movies",                      // *** REPLACE ***
            storageBucket: "sm4movies.appspot.com",       // *** REPLACE ***
            messagingSenderId: "277353836953",           // *** REPLACE ***
            appId: "1:277353836953:web:85e02783526c7cb58de308" // *** REPLACE ***
        };
        // REMINDER: Set secure Firebase Realtime Database rules as provided!

        // --- Firebase Initialization ---
        let firebaseApp, firebaseAuth, firebaseDatabase;
        let messagesRef, statusRef, typingRef, userStatusRef, userTypingRef;
        const presenceConnections = new Map(); // Track presence connections

        // --- DOM Elements ---
        const loadingOverlay = document.getElementById('loading-overlay');
        const appContainer = document.getElementById('app-container');
        const authSection = document.getElementById('auth-section');
        const chatSection = document.getElementById('chat-section');
        // Auth
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const loginCard = document.getElementById('login-card');
        const signupCard = document.getElementById('signup-card');
        const showSignupLink = document.getElementById('show-signup');
        const showLoginLink = document.getElementById('show-login');
        const loginErrorDiv = document.getElementById('login-error');
        const signupErrorDiv = document.getElementById('signup-error');
        // Chat Layout
        const userSidebar = document.getElementById('user-sidebar');
        const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
        const sidebarCloseButton = document.getElementById('sidebar-close-button');
        // Chat Navbar
        const chatNavbar = document.getElementById('chat-navbar');
        const userDisplayNameSpan = document.getElementById('user-display-name');
        const navbarAvatarDiv = document.getElementById('navbar-avatar');
        const navbarUserInfo = document.getElementById('navbar-user-info');
        const logoutButton = document.getElementById('logout-button');
        const themeSelector = document.getElementById('theme-selector');
        const onlineUserCountSpan = document.getElementById('online-user-count');
        // User List
        const userListUl = document.getElementById('user-list');
        // Chat Area
        const chatBox = document.getElementById('chat-box');
        const typingIndicatorDiv = document.getElementById('typing-indicator');
        // Input Area
        const messageForm = document.getElementById('message-form');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const chatErrorDiv = document.getElementById('chat-error');
        // Modal
        const profileModalEl = document.getElementById('profileModal');
        const profileModal = new bootstrap.Modal(profileModalEl);
        const modalAvatar = document.getElementById('modal-avatar');
        const modalDisplayName = document.getElementById('modal-display-name');
        const modalEmail = document.getElementById('modal-email');
        const modalUid = document.getElementById('modal-uid');
        const modalStatus = document.getElementById('modal-status');

        // --- State Variables ---
        let currentUser = null;
        let messageListenerAttached = false;
        let statusListenerAttached = false;
        let typingListenerAttached = false;
        let typingTimeout = null;
        const messageCache = new Map();
        const onlineUsers = new Map();
        const typingUsers = new Map();

        // --- Themes Definition ---
        const themes = [
            { name: 'light', label: 'Light Mode', icon: 'bi-sun-fill' },
            { name: 'dark', label: 'Dark Mode', icon: 'bi-moon-stars-fill' },
            // Add more themes here if desired
        ];

        //======================================================================
        // $ Utility Functions
        //======================================================================

        /**
         * Displays an error message in a designated element.
         * @param {HTMLElement} element - The element to display the error in.
         * @param {string} message - The error message.
         */
        function displayError(element, message) {
            if (!element) return;
            element.textContent = message;
            element.classList.remove('hidden');
        }

        /**
         * Clears an error message from a designated element.
         * @param {HTMLElement} element - The element to clear the error from.
         */
        function clearError(element) {
            if (!element) return;
            element.textContent = '';
            element.classList.add('hidden');
        }

        /**
         * Formats a timestamp into a locale-specific time string.
         * @param {number} timestamp - The Unix timestamp (milliseconds).
         * @returns {string} - Formatted time string (e.g., "10:30 AM") or empty string.
         */
        function formatTimestamp(timestamp) {
            if (!timestamp) return '';
            try {
                const date = new Date(timestamp);
                if (isNaN(date.getTime())) {
                    console.warn("Invalid timestamp received:", timestamp);
                    return '';
                }
                return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            } catch (e) {
                console.error("Error formatting timestamp:", timestamp, e);
                return '';
            }
        }

        /**
         * Generates HTML for a user avatar (initials-based with colored background).
         * @param {string|null} uid - User ID (used for color generation).
         * @param {string} displayName - User's display name.
         * @param {string} [sizeClass=''] - Additional CSS class for sizing (e.g., 'avatar-lg').
         * @returns {string} - HTML string for the avatar element.
         */
        function generateAvatarHTML(uid, displayName, sizeClass = '') {
             const name = displayName || '??';
             let initials = '?';
             try {
                 const nameParts = name.split(' ').filter(Boolean);
                 if (nameParts.length >= 2) {
                     initials = nameParts[0][0] + nameParts[nameParts.length - 1][0];
                 } else if (nameParts.length === 1 && nameParts[0].length > 0) {
                      // Ensure we don't try index 1 if length is 1
                      initials = nameParts[0].length >= 2 ? nameParts[0].substring(0, 2) : nameParts[0][0];
                 }
             } catch (e) { console.warn("Error generating initials for:", name, e); }

             // Simple hashing for color consistency
             let hash = 0;
             if (uid) {
                 for (let i = 0; i < uid.length; i++) {
                     hash = uid.charCodeAt(i) + ((hash << 5) - hash);
                     hash = hash & hash; // Convert to 32bit integer
                 }
             }
             // Consistent color palette
             const colors = ['#0d6efd', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0', '#6610f2', '#212529', '#ff6b6b', '#4ecdc4', '#feca57', '#48dbfb', '#9b59b6'];
             const colorIndex = Math.abs(hash % colors.length);
             const bgColor = colors[colorIndex];

             // Determine text color based on background brightness (simple contrast check)
             let textColor = '#ffffff'; // Default white text
             if (bgColor.startsWith('#')) {
                 const r = parseInt(bgColor.substring(1, 3), 16);
                 const g = parseInt(bgColor.substring(3, 5), 16);
                 const b = parseInt(bgColor.substring(5, 7), 16);
                 const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                 if (brightness > 150) { // Threshold may need adjustment
                     textColor = '#181c1a'; // Use dark text on light backgrounds
                 }
             }

             // Use htmlspecialchars equivalent for safety if name could contain html
             const safeName = name.replace(/</g, "<").replace(/>/g, ">");
             const safeInitials = initials.replace(/</g, "<").replace(/>/g, ">");

             return `<div class="avatar ${sizeClass}" style="background-color: ${bgColor}; color: ${textColor};" title="${safeName}">${safeInitials.toUpperCase()}</div>`;
         }


        /**
         * Toggles the loading state of a button (shows/hides text and spinner).
         * @param {HTMLButtonElement} button - The button element.
         * @param {boolean} isLoading - True to show loading state, false otherwise.
         */
        function setLoadingState(button, isLoading) {
            if (!button) return;
            const textSpan = button.querySelector('.btn-text');
            const spinnerSpan = button.querySelector('.spinner-border');

            if (isLoading) {
                button.disabled = true;
                button.classList.add('loading'); // Add class for potential specific styling
                if (textSpan) textSpan.style.display = 'none';
                if (spinnerSpan) spinnerSpan.style.display = 'inline-block';
            } else {
                button.disabled = false;
                button.classList.remove('loading');
                if (textSpan) textSpan.style.display = 'inline-block'; // Or 'inline', 'block' depending on original
                if (spinnerSpan) spinnerSpan.style.display = 'none';
            }
        }

        /**
         * Debounces a function call.
         * @param {Function} func - The function to debounce.
         * @param {number} wait - The debounce delay in milliseconds.
         * @returns {Function} - The debounced function.
         */
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args); // Use apply to maintain context
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // --- Show/Hide Loading Overlay ---
        function showLoadingOverlay() {
            loadingOverlay.classList.add('visible');
        }
        function hideLoadingOverlay() {
             // Delay hiding slightly to avoid flicker if operation is very fast
             setTimeout(() => {
                loadingOverlay.classList.remove('visible');
             }, 150);
        }

        //======================================================================
        // $ THEME MANAGEMENT
        //======================================================================

        /** Populates the theme selector dropdown menu. */
        function populateThemeSelector() {
            themeSelector.innerHTML = themes.map(theme => `
                <li>
                    <button class="dropdown-item d-flex align-items-center" data-theme="${theme.name}" type="button">
                        <i class="${theme.icon} me-2"></i>
                        <span>${theme.label}</span>
                    </button>
                </li>
            `).join('');
        }

        /** Applies the selected theme and saves preference. */
        function applyTheme(themeName) {
            // Remove all theme classes first
            document.body.className = themes.reduce((acc, t) => acc.replace(`theme-${t.name}`, ''), document.body.className).trim();

            if (themeName !== 'light') {
                document.body.classList.add(`theme-${themeName}`);
            }

            // Update the --primary-rgb variable for dynamic rgba() usage
             try {
                const primaryColorValue = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
                let rgb = { r: 13, g: 110, b: 253 }; // Default fallback (Bootstrap Blue)
                if (primaryColorValue.startsWith('#')) {
                     const hex = primaryColorValue;
                     if (hex.length === 4) { rgb = { r: parseInt(hex[1] + hex[1], 16), g: parseInt(hex[2] + hex[2], 16), b: parseInt(hex[3] + hex[3], 16) }; }
                     else if (hex.length === 7) { rgb = { r: parseInt(hex.substring(1, 3), 16), g: parseInt(hex.substring(3, 5), 16), b: parseInt(hex.substring(5, 7), 16) }; }
                 } else if (primaryColorValue.startsWith('rgb')) {
                     const match = primaryColorValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                     if (match) { rgb = { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) }; }
                 }
                document.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

                 // Also set secondary bg RGB for typing indicator
                 const secondaryBgValue = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim();
                 let secondaryRgb = { r: 255, g: 255, b: 255 }; // Default white
                 if (secondaryBgValue.startsWith('#')) { /* ... hex parsing ... */ }
                 else if (secondaryBgValue.startsWith('rgb')) { /* ... rgb parsing ... */ }
                 document.documentElement.style.setProperty('--bg-secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);


             } catch (e) {
                 console.error("Error processing theme colors for RGB:", e);
                 document.documentElement.style.setProperty('--primary-rgb', '13, 110, 253'); // Fallback
                 document.documentElement.style.setProperty('--bg-secondary-rgb', '255, 255, 255'); // Fallback
             }


            // Update active state in dropdown
            themeSelector.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.toggle('active', item.dataset.theme === themeName);
            });

            localStorage.setItem('chatTheme', themeName);
            console.log(`Theme applied: ${themeName}`);
        }

        /** Loads the saved theme preference or applies the default. */
        function loadTheme() {
            const savedTheme = localStorage.getItem('chatTheme') || 'light'; // Default to light
            applyTheme(savedTheme);
        }


        //======================================================================
        // $ UI DISPLAY FUNCTIONS
        //======================================================================

        /** Toggles between Login and Signup forms. */
        function toggleAuthForms(showSignup) {
            clearError(loginErrorDiv);
            clearError(signupErrorDiv);
            loginForm.reset(); // Reset form fields
            signupForm.reset();

            if (showSignup) {
                loginCard.classList.add('hidden');
                signupCard.classList.remove('hidden');
            } else {
                signupCard.classList.add('hidden');
                loginCard.classList.remove('hidden');
            }
        }

        /** Shows the Authentication section and hides the Chat section. */
        function showAuthSection() {
            authSection.classList.remove('hidden');
            chatSection.classList.add('hidden');
            toggleAuthForms(false); // Default to login form
            hideLoadingOverlay(); // Ensure loading overlay is hidden
        }

        /** Shows the Chat section and hides the Authentication section. */
        function showChatSection() {
            authSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
            chatSection.style.display = 'flex'; // Ensure flex display is applied
            scrollToBottom(); // Scroll down when chat loads
            messageInput.focus();
             hideLoadingOverlay(); // Ensure loading overlay is hidden
        }

        /** Scrolls the chat box to the bottom. */
        function scrollToBottom() {
             // Use requestAnimationFrame for smoother scrolling after DOM updates
             requestAnimationFrame(() => {
                 chatBox.scrollTop = chatBox.scrollHeight;
             });
        }

        /** Displays a chat message in the chat box. */
        function displayChatMessage(snapshot) {
            const messageId = snapshot.key;
            const messageData = snapshot.val();

            // Basic validation and check cache
            if (!messageData || !messageData.text || !messageData.uid || !messageData.timestamp || messageCache.has(messageId)) {
                if(messageCache.has(messageId)) console.log("Skipping cached message:", messageId);
                else console.warn("Received incomplete/invalid message data:", messageId, messageData);
                return;
            }

            const senderDisplayName = onlineUsers.get(messageData.uid)?.displayName || messageData.displayName || 'Anonymous';
            const isSent = currentUser && messageData.uid === currentUser.uid;

            // Create message wrapper
            const messageWrapper = document.createElement('div');
            messageWrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;
            messageWrapper.setAttribute('data-message-id', messageId);
            messageWrapper.setAttribute('data-sender-uid', messageData.uid);
            messageWrapper.setAttribute('data-sender-name', senderDisplayName); // Store name for profile modal

            // Create Avatar
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'message-avatar';
            avatarContainer.innerHTML = generateAvatarHTML(messageData.uid, senderDisplayName);
            const avatarElement = avatarContainer.querySelector('.avatar');
            if (avatarElement) {
                avatarElement.addEventListener('click', () => showProfileModal(messageData.uid));
            }
            messageWrapper.appendChild(avatarContainer);

            // Create Content Bubble container
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';

            // Create the bubble itself
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';

            // Create Sender Name element
            const senderSpan = document.createElement('span');
            senderSpan.className = 'message-sender';
            senderSpan.textContent = isSent ? 'You' : senderDisplayName;
            senderSpan.addEventListener('click', () => showProfileModal(messageData.uid));
            bubbleDiv.appendChild(senderSpan);

            // Create Message Text element
            const textP = document.createElement('p');
            textP.className = 'message-text';
            // Basic Sanitization: Use textContent to prevent HTML injection
            textP.textContent = messageData.text;
            bubbleDiv.appendChild(textP);

            // Create Timestamp element
            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-timestamp';
            timeSpan.textContent = formatTimestamp(messageData.timestamp);
            bubbleDiv.appendChild(timeSpan);

            // Assemble and Append
            contentDiv.appendChild(bubbleDiv);
            messageWrapper.appendChild(contentDiv);

            // Remove initial placeholder if present
            const loadingMsg = chatBox.querySelector('.loading-placeholder');
            if (loadingMsg) {
                loadingMsg.remove();
            }

            // Add to chatbox and cache
            chatBox.appendChild(messageWrapper);
            messageCache.set(messageId, true); // Mark as displayed

            // Scroll only if near the bottom already, or if it's our own message
            const isScrolledToBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 100; // 100px tolerance
            if (isScrolledToBottom || isSent) {
                 scrollToBottom();
            }
        }

        /** Updates the list of online users in the sidebar. */
        function displayUserList() {
            userListUl.innerHTML = ''; // Clear current list
            let onlineCount = 0;

            // Sort users: current user first, then alphabetically
            const sortedUsers = Array.from(onlineUsers.values()).sort((a, b) => {
                 if (a.uid === currentUser?.uid) return -1;
                 if (b.uid === currentUser?.uid) return 1;
                 return (a.displayName || '').localeCompare(b.displayName || '');
             });

            if (sortedUsers.length === 0) {
                userListUl.innerHTML = '<li class="loading-placeholder" style="padding: 1rem;">No users detected</li>';
                onlineUserCountSpan.textContent = 0;
                return;
            }

            sortedUsers.forEach(userData => {
                 if (userData.online) {
                     onlineCount++;
                 }
                 const li = document.createElement('li');
                 li.className = 'user-list-item';
                 li.setAttribute('data-uid', userData.uid);
                 li.setAttribute('data-online', userData.online ? 'true' : 'false');
                 li.title = `View profile of ${userData.displayName}`; // Tooltip

                 const isCurrentUserInList = userData.uid === currentUser?.uid;

                 li.innerHTML = `
                    ${generateAvatarHTML(userData.uid, userData.displayName)}
                    <span class="user-name">${userData.displayName}${isCurrentUserInList ? '<span class="you-indicator">(You)</span>' : ''}</span>
                    <span class="online-indicator"></span>
                 `;

                 li.addEventListener('click', () => showProfileModal(userData.uid));
                 userListUl.appendChild(li);
             });
            onlineUserCountSpan.textContent = onlineCount;
        }

        /** Updates the typing indicator display based on current typing users. */
        function displayTypingIndicator() {
            const typingNames = [];
            typingUsers.forEach((isTyping, uid) => {
                // Add name if typing and not the current user
                if (isTyping && uid !== currentUser?.uid) {
                    const userData = onlineUsers.get(uid); // Get name from online users cache
                    if (userData) {
                        typingNames.push(userData.displayName);
                    }
                }
            });

            if (typingNames.length === 0) {
                typingIndicatorDiv.textContent = '';
                typingIndicatorDiv.classList.remove('visible');
            } else {
                let text = '';
                if (typingNames.length === 1) {
                    text = `${typingNames[0]} is typing...`;
                } else if (typingNames.length === 2) {
                    text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
                } else {
                    // Show first two names and "and others"
                    text = `${typingNames.slice(0, 2).join(', ')} and others are typing...`;
                }
                typingIndicatorDiv.textContent = text;
                typingIndicatorDiv.classList.add('visible');
            }
        }


        //======================================================================
        // $ PROFILE MODAL
        //======================================================================

        /** Shows the profile modal populated with user data. */
        function showProfileModal(uid) {
            if (!uid) {
                console.warn("showProfileModal called without UID.");
                return;
            }

            const userData = onlineUsers.get(uid) || { displayName: 'Unknown User', online: false }; // Get data from cache
            const isCurrentUserProfile = currentUser && currentUser.uid === uid;

            // Populate Modal Elements
            modalAvatar.innerHTML = generateAvatarHTML(uid, userData.displayName, 'avatar-lg');
            modalDisplayName.textContent = userData.displayName;
            modalUid.textContent = `UID: ${uid}`;
            modalEmail.textContent = isCurrentUserProfile ? (currentUser.email || 'Email not set') : 'Email private';
            modalStatus.innerHTML = `
                <span class="badge rounded-pill ${userData.online ? 'text-bg-success' : 'text-bg-secondary'}">
                    <i class="bi bi-circle-fill me-1" style="font-size: 0.6em;"></i>
                    ${userData.online ? 'Online' : 'Offline'}
                </span>`;

            profileModal.show();
        }


        //======================================================================
        // $ FIREBASE PRESENCE & TYPING
        //======================================================================

        /** Sets up Firebase Realtime Database listeners for online presence. */
        function setupPresence() {
            if (!currentUser || !firebaseDatabase) {
                console.warn("Cannot setup presence: No user or DB connection.");
                return;
            }
            console.log("Setting up presence for user:", currentUser.uid);
            const uid = currentUser.uid;
            userStatusRef = firebaseDatabase.ref(`/status/${uid}`); // Specific user's status node

            const connectedRef = firebaseDatabase.ref('.info/connected');

            // Listener for connection status changes
            const connectionListener = connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    console.log("Firebase connected. Setting online status.");
                    const statusData = {
                        online: true,
                        lastChanged: firebase.database.ServerValue.TIMESTAMP,
                        displayName: currentUser.displayName || currentUser.email || 'Anonymous' // Store name
                    };
                    // Set online status
                    userStatusRef.set(statusData)
                        .catch(err => console.error("Failed to set online status:", err));

                    // IMPORTANT: Set onDisconnect handler AFTER confirming connection
                    userStatusRef.onDisconnect().set({
                        online: false,
                        lastChanged: firebase.database.ServerValue.TIMESTAMP,
                        displayName: currentUser.displayName || currentUser.email || 'Anonymous'
                    }).catch(err => console.error("Failed to set onDisconnect handler:", err));

                } else {
                    console.log("Firebase disconnected.");
                    // NOTE: No need to manually set offline here, onDisconnect handles it.
                }
            });
             presenceConnections.set('connection', connectionListener); // Store to remove later
        }

        /** Cleans up presence listeners and sets user offline. */
        function clearPresence() {
             // Get UID *before* potentially clearing currentUser
             const uid = currentUser?.uid;
             if (!uid || !firebaseDatabase) {
                 console.warn("Cannot clear presence: No user or DB connection.");
                 return;
             }
             console.log("Clearing presence for user:", uid);

             // 1. Remove the connection listener
             const connectionListener = presenceConnections.get('connection');
             if (connectionListener) {
                 firebaseDatabase.ref('.info/connected').off('value', connectionListener);
                 presenceConnections.delete('connection');
                 console.log(".info/connected listener removed.");
             }

             // 2. Attempt to set offline status immediately (best effort)
             const statusData = {
                 online: false,
                 lastChanged: firebase.database.ServerValue.TIMESTAMP,
                 displayName: currentUser?.displayName || currentUser?.email || 'Anonymous' // Use potentially stale data if needed
             };
             const refToClear = userStatusRef || firebaseDatabase.ref(`/status/${uid}`); // Use existing ref or get new one

             refToClear.set(statusData)
                .then(() => console.log("Offline status set on cleanup."))
                .catch(err => console.warn("Could not set offline on cleanup (might be expected if network lost):", err))
                .finally(() => {
                     // 3. Crucially, cancel any pending onDisconnect operations for this ref
                     refToClear.onDisconnect().cancel()
                         .then(() => console.log("onDisconnect handler cancelled."))
                         .catch(err => console.error("Failed to cancel onDisconnect handler:", err));

                     // 4. Clear the specific user status reference if it exists
                     if (userStatusRef) {
                         userStatusRef = null;
                     }
                 });
         }


        /** Debounced function to update the user's typing status in Firebase. */
        const updateTypingStatus = debounce((isTyping) => {
            if (!currentUser || !userTypingRef) {
                // console.log("Skipping typing update (no user or ref)");
                return;
            }
            // console.log(`Debounced: Updating typing status to: ${isTyping}`);
            userTypingRef.set(isTyping)
                .catch(error => console.error("Error setting typing status:", error));
        }, DEBOUNCE_TYPING_MS);


        //======================================================================
        // $ FIREBASE LISTENERS SETUP/TEARDOWN
        //======================================================================

        /** Attaches all necessary Firebase listeners. */
        function attachListeners() {
            if (!currentUser) {
                console.warn("Cannot attach listeners: No current user.");
                return;
            }
            console.log("Attaching Firebase listeners...");

            // --- Messages Listener ---
            if (!messageListenerAttached) {
                chatBox.innerHTML = '<p class="loading-placeholder py-5">Loading recent messages...</p>';
                messageCache.clear(); // Clear message cache on new attach
                messagesRef.orderByChild('timestamp').limitToLast(MESSAGE_LIMIT).on(
                    'child_added',
                    displayChatMessage, // Function to handle new message
                    (error) => { // Error callback
                        console.error("Message listener error:", error);
                        chatBox.innerHTML = `<p class="text-center error-text py-5">Error loading messages: ${error.message}</p>`;
                        messageListenerAttached = false; // Mark as detached on error
                    }
                );
                messageListenerAttached = true;
                console.log("Message listener attached.");
            }

            // --- Online Status Listener ---
            if (!statusListenerAttached) {
                statusRef.on('value',
                    (snapshot) => { // Success callback
                        onlineUsers.clear(); // Reset local cache
                        const statuses = snapshot.val() || {};
                        Object.keys(statuses).forEach(uid => {
                            onlineUsers.set(uid, { ...statuses[uid], uid: uid }); // Store user data
                        });
                        displayUserList(); // Update the UI list
                        displayTypingIndicator(); // Update typing indicator (names might have changed)
                        // Update profile modal if open
                        if (profileModalEl.classList.contains('show')) {
                           const displayedUid = modalUid.textContent.replace('UID: ', '');
                            if(displayedUid && onlineUsers.has(displayedUid)) {
                                const userData = onlineUsers.get(displayedUid);
                                modalStatus.innerHTML = `<span class="badge rounded-pill ${userData.online ? 'text-bg-success' : 'text-bg-secondary'}"><i class="bi bi-circle-fill me-1" style="font-size: 0.6em;"></i>${userData.online ? 'Online' : 'Offline'}</span>`;
                            }
                        }
                    },
                    (error) => { // Error callback
                        console.error("Status listener error:", error);
                        statusListenerAttached = false; // Mark as detached
                        userListUl.innerHTML = '<li class="error-text p-3">Error loading user status</li>';
                    }
                );
                statusListenerAttached = true;
                console.log("Status listener attached.");
            }

            // --- Typing Status Listener ---
            if (!typingListenerAttached) {
                userTypingRef = firebaseDatabase.ref(`/typing/${currentUser.uid}`); // Set ref for current user's typing node
                typingRef.on('value',
                    (snapshot) => { // Success callback
                        typingUsers.clear(); // Reset local cache
                        const typingData = snapshot.val() || {};
                        Object.keys(typingData).forEach(uid => {
                            typingUsers.set(uid, typingData[uid]); // Store boolean status
                        });
                        displayTypingIndicator(); // Update the UI indicator
                    },
                    (error) => { // Error callback
                        console.error("Typing listener error:", error);
                        typingListenerAttached = false; // Mark as detached
                    }
                );
                typingListenerAttached = true;
                console.log("Typing listener attached.");
            }

            // --- Setup Presence ---
            setupPresence();
        }

        /** Detaches all Firebase listeners and cleans up state. */
        function detachListeners() {
            console.log("Detaching Firebase listeners...");

            // Detach specific listeners using .off() without arguments if added with .on()
            if (messageListenerAttached) {
                messagesRef.off(); // Detaches all listeners on this path
                messageListenerAttached = false;
                console.log("Message listener detached.");
            }
            if (statusListenerAttached) {
                statusRef.off();
                statusListenerAttached = false;
                console.log("Status listener detached.");
            }
            if (typingListenerAttached) {
                typingRef.off();
                // Ensure own typing status is removed on detach/logout
                if (userTypingRef) {
                    userTypingRef.remove()
                        .catch(e => console.warn("Could not remove typing status on detach:", e));
                    userTypingRef = null; // Clear the reference
                }
                typingListenerAttached = false;
                console.log("Typing listener detached.");
            }

            // Clean up presence (sets offline, cancels onDisconnect)
            clearPresence();

            // Clear local state caches
            messageCache.clear();
            onlineUsers.clear();
            typingUsers.clear();

            // Reset UI elements related to listeners
            displayUserList();
            displayTypingIndicator();
             // Optionally clear chatbox or show logged out message
             // chatBox.innerHTML = '<p class="loading-placeholder py-5">Please log in to chat.</p>';
        }


        //======================================================================
        // $ AUTHENTICATION LOGIC & EVENT HANDLERS
        //======================================================================

        /** Handles Firebase Authentication state changes. */
        function handleAuthStateChanged(user) {
             // Always reset button loading states on auth change
             setLoadingState(loginForm.querySelector('button[type="submit"]'), false);
             setLoadingState(signupForm.querySelector('button[type="submit"]'), false);
             setLoadingState(logoutButton, false);

             if (user) {
                 // --- User is Logged IN ---
                 if (currentUser && currentUser.uid === user.uid) {
                     console.log("Auth State: Already logged in as", user.uid);
                      hideLoadingOverlay(); // Ensure overlay is hidden if check is fast
                     return; // No actual state change, avoid re-attaching listeners
                 }
                 console.log("Auth State: IN - ", user.uid, user.displayName);
                 currentUser = user; // Set current user

                 // Update UI elements for logged-in state
                 userDisplayNameSpan.textContent = user.displayName || user.email || 'User';
                 navbarAvatarDiv.innerHTML = generateAvatarHTML(user.uid, user.displayName);
                 navbarUserInfo.onclick = () => showProfileModal(user.uid); // Make navbar avatar clickable
                 navbarUserInfo.classList.add('cursor-pointer');
                 navbarUserInfo.title = "View your profile";

                 showChatSection(); // Show the main chat interface
                 attachListeners(); // Attach all necessary Firebase listeners

             } else {
                 // --- User is Logged OUT ---
                 if (!currentUser) {
                     console.log("Auth State: Already logged out.");
                      hideLoadingOverlay(); // Ensure overlay is hidden
                     return; // No actual state change
                 }
                 console.log("Auth State: OUT");
                 const wasLoggedInUser = currentUser; // Keep ref for potential cleanup if needed
                 currentUser = null; // Clear current user state

                 // Detach all listeners and clean up presence BEFORE showing auth section
                 detachListeners();

                 // Update UI elements for logged-out state
                 userDisplayNameSpan.textContent = 'Not Logged In';
                 navbarAvatarDiv.innerHTML = '?'; // Placeholder avatar
                 navbarUserInfo.onclick = null; // Remove click handler
                 navbarUserInfo.classList.remove('cursor-pointer');
                 navbarUserInfo.title = "";

                 showAuthSection(); // Show the login/signup interface
             }
         }

        // --- Initialize Firebase and Auth Listener ---
        function initializeFirebase() {
            try {
                firebaseApp = firebase.initializeApp(firebaseConfigApp);
                firebaseAuth = firebase.auth();
                firebaseDatabase = firebase.database();
                // Define top-level references
                messagesRef = firebaseDatabase.ref('messages');
                statusRef = firebaseDatabase.ref('status');
                typingRef = firebaseDatabase.ref('typing');
                console.log("Firebase Initialized Successfully");

                // Attach the core auth state listener
                 showLoadingOverlay(); // Show overlay until auth state is determined
                firebaseAuth.onAuthStateChanged(handleAuthStateChanged);

            } catch (e) {
                console.error("Firebase initialization failed:", e);
                document.body.innerHTML = `<div class="vh-100 d-flex justify-content-center align-items-center"><div class="alert alert-danger m-5" role="alert"><strong>Initialization Error!</strong> Could not connect to services. Please check console, Firebase config, and ensure Firebase services (Auth, Realtime DB) are enabled. Error: ${e.message}</div></div>`;
                 hideLoadingOverlay(); // Hide overlay on fatal error
            }
        }


        // --- Event Listener Bindings ---

        /** Sets up all static event listeners for the application. */
        function bindEventListeners() {
            // Auth Form Toggles
            showSignupLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
            showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });

            // Auth Form Submissions
            loginForm.addEventListener('submit', handleLoginSubmit);
            signupForm.addEventListener('submit', handleSignupSubmit);

            // Logout Button
            logoutButton.addEventListener('click', handleLogout);

            // Message Sending Form
            messageForm.addEventListener('submit', handleMessageSend);

            // Typing Indicator Logic
            messageInput.addEventListener('input', handleTypingInput);

            // Theme Selection Dropdown
            themeSelector.addEventListener('click', handleThemeSelection);

            // Sidebar Toggle (Mobile)
            sidebarToggleButton?.addEventListener('click', toggleSidebar);
            sidebarCloseButton?.addEventListener('click', closeSidebar);
            // Click outside sidebar to close (optional)
            document.addEventListener('click', handleOutsideSidebarClick);
        }

        // --- Event Handler Functions ---

        /** Handles the login form submission. */
        function handleLoginSubmit(event) {
            event.preventDefault();
            clearError(loginErrorDiv);
            const emailInput = loginForm.elements['login-email'];
            const passwordInput = loginForm.elements['login-password'];
            const button = event.submitter || loginForm.querySelector('button[type="submit"]');

            if (!emailInput.value || !passwordInput.value) {
                displayError(loginErrorDiv, 'Please enter both email and password.');
                return;
            }

            setLoadingState(button, true);
             showLoadingOverlay(); // Show overlay during login attempt

            firebaseAuth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
                .catch((error) => {
                    console.error("Login failed:", error);
                    displayError(loginErrorDiv, `Login failed: ${error.message}`);
                    setLoadingState(button, false);
                    hideLoadingOverlay(); // Hide on error
                });
             // Note: Success is handled by onAuthStateChanged, which will also hide overlay
        }

        /** Handles the signup form submission. */
        function handleSignupSubmit(event) {
            event.preventDefault();
            clearError(signupErrorDiv);
            const nameInput = signupForm.elements['signup-name'];
            const emailInput = signupForm.elements['signup-email'];
            const passwordInput = signupForm.elements['signup-password'];
            const button = event.submitter || signupForm.querySelector('button[type="submit"]');

            if (!nameInput.value.trim() || !emailInput.value || passwordInput.value.length < 6) {
                 displayError(signupErrorDiv, 'Please fill all fields correctly (Password min 6 characters).');
                 return;
             }

             setLoadingState(button, true);
             showLoadingOverlay(); // Show overlay during signup

             firebaseAuth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
                 .then((userCredential) => {
                     console.log("Signup successful, updating profile...");
                     // Update the user's profile immediately after creation
                     return userCredential.user.updateProfile({
                         displayName: nameInput.value.trim()
                         // photoURL: null // Can set a default avatar URL here if desired
                     });
                 })
                 .then(() => {
                     console.log("Display name updated for new user.");
                     // Success is handled by onAuthStateChanged, which hides overlay
                 })
                 .catch((error) => {
                     console.error("Signup or profile update failed:", error);
                     displayError(signupErrorDiv, `Signup failed: ${error.message}`);
                     setLoadingState(button, false);
                      hideLoadingOverlay(); // Hide on error
                 });
        }

        /** Handles the logout button click. */
        function handleLogout() {
            setLoadingState(logoutButton, true);
            showLoadingOverlay(); // Show overlay during logout
            // Detach listeners happens within onAuthStateChanged AFTER signout completes
            firebaseAuth.signOut()
                .catch(err => {
                     console.error("Sign out error:", err);
                     alert("Error signing out. Please try again."); // Simple alert for signout error
                     setLoadingState(logoutButton, false); // Reset button if signout fails
                     hideLoadingOverlay(); // Hide overlay on error
                 });
            // Note: UI changes/listener detach handled by onAuthStateChanged
        }

        /** Handles the message sending form submission. */
        function handleMessageSend(event) {
             event.preventDefault();
             const messageText = messageInput.value.trim();

             // Validate state and input
             if (!messageText || !currentUser || !messagesRef) {
                 if (!currentUser) displayError(chatErrorDiv, "You're not logged in.");
                 return;
             }

             clearError(chatErrorDiv);
             setLoadingState(sendButton, true); // Show loading on send button

             const newMessage = {
                 uid: currentUser.uid,
                 displayName: currentUser.displayName || currentUser.email || 'Anonymous', // Ensure name is present
                 text: messageText, // Already trimmed
                 timestamp: firebase.database.ServerValue.TIMESTAMP // Use server time
             };

             // Clear local typing status immediately when sending a message
             clearTimeout(typingTimeout);
             if (userTypingRef) {
                 userTypingRef.set(false).catch(e => console.warn("Couldn't clear typing status on send:", e));
             }

             // Push message to Firebase
             messagesRef.push(newMessage)
                 .then(() => {
                     // Success! Clear the input field.
                     messageInput.value = '';
                 })
                 .catch(error => {
                     // Failure! Display error to user.
                     console.error("Error sending message:", error);
                     displayChatError(`Failed to send message: ${error.message}`);
                 })
                 .finally(() => {
                     // Always reset button state and focus input
                     messageInput.focus();
                     setLoadingState(sendButton, false);
                 });
         }

        /** Handles input events on the message input field for typing indicators. */
        function handleTypingInput() {
            if (!currentUser || !userTypingRef) return; // Only if logged in and ref is set

            // Indicate typing = true (debounced)
            updateTypingStatus(true);

            // Reset the timeout to turn typing indicator off after inactivity
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                 // After timeout, set typing to false
                 if (userTypingRef) {
                     userTypingRef.set(false)
                        .catch(error => console.warn("Error setting typing status (timeout):", error));
                 }
            }, TYPING_TIMEOUT_MS);
        }

        /** Handles theme selection from the dropdown. */
        function handleThemeSelection(event) {
             if (event.target.classList.contains('dropdown-item')) {
                 const theme = event.target.dataset.theme;
                 if (theme) {
                     applyTheme(theme);
                 }
             }
         }

        /** Toggles the mobile sidebar visibility. */
        function toggleSidebar() {
             userSidebar?.classList.toggle('active');
        }
        /** Closes the mobile sidebar. */
        function closeSidebar() {
             userSidebar?.classList.remove('active');
        }
        /** Closes the sidebar if a click occurs outside of it on mobile. */
        function handleOutsideSidebarClick(event) {
             if (window.innerWidth < 768 && // Only on mobile view
                 userSidebar?.classList.contains('active') &&
                 !userSidebar.contains(event.target) &&
                 !sidebarToggleButton?.contains(event.target))
             {
                 closeSidebar();
             }
         }


        //======================================================================
        // $ INITIALIZATION
        //======================================================================

        // --- Run Initialization ---
        document.addEventListener('DOMContentLoaded', () => {
            populateThemeSelector();
            loadTheme(); // Load theme preference early
            bindEventListeners(); // Setup button clicks, form submits etc.
            initializeFirebase(); // Initialize Firebase and Auth listener
        });
