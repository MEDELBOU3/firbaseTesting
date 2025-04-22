 /* ==========================================================================
       Graphite Chat Application - COMPLETE & ADVANCED REWRITE
       Using Firebase v9 SDK (via HTML Script Tags), Bootstrap 5
       Features: Auth, Realtime Chat, Presence, Typing, Media, Profile, Theming
       ========================================================================== */
    
    (function () {
        "use strict";
    
        //======================================================================
        // Firebase Configuration
        //======================================================================
        // For Firebase JS SDK v7.20.0 and later, measurementId is optional
        const firebaseConfig = {
           apiKey: "AIzaSyDp2V0ULE-32AcIJ92a_e3mhMe6f6yZ_H4",
           authDomain: "sm4movies.firebaseapp.com",
           projectId: "sm4movies",
           storageBucket: "sm4movies.firebasestorage.app",
           messagingSenderId: "277353836953",
           appId: "1:277353836953:web:85e02783526c7cb58de308",
           measurementId: "G-690RSNJ2Q2",
           databaseURL: "https://sm4movies-default-rtdb.firebaseio.com"
       };

       try {
        // Check if firebase global exists *before* initializing
        if (typeof firebase === 'undefined') {
            throw new Error("FAILURE: Global 'firebase' object is undefined BEFORE initializeApp call.");
        }
        if (typeof firebase.initializeApp !== 'function') {
             throw new Error("FAILURE: 'firebase.initializeApp' is not a function BEFORE initializeApp call.");
        }

        console.log("Attempting firebase.initializeApp...");
        const firebaseApp = firebase.initializeApp(firebaseConfig);
        console.log("✅ SUCCESS: firebase.initializeApp completed!", firebaseApp.name);

        // Try accessing other services directly IF initializeApp succeeded
        if (firebase.auth && typeof firebase.auth.getAuth === 'function') {
            const auth = firebase.auth.getAuth(firebaseApp);
            console.log("✅ SUCCESS: Got Auth service instance.");
        } else {
             console.error("❌ PROBLEM: firebase.auth or firebase.auth.getAuth not found AFTER initializeApp.");
        }

         if (firebase.database && typeof firebase.database.getDatabase === 'function') {
            const db = firebase.database.getDatabase(firebaseApp);
            console.log("✅ SUCCESS: Got Database service instance.");
        } else {
             console.error("❌ PROBLEM: firebase.database or firebase.database.getDatabase not found AFTER initializeApp.");
        }

    } catch (error) {
        console.error("❌❌❌ CATASTROPHIC ERROR during simplified test:", error);
         document.body.innerHTML = `<div style='padding: 20px; color: red; font-size: 1.2em;'><h2>Simplified Init Failed!</h2><p>Check console. Error: ${error.message}</p></div>`;
    }

    console.log("--- Simplified Test Finished ---");
    
        //======================================================================
        // App Configuration Constants
        //======================================================================
        const CONFIG = {
            MESSAGE_LIMIT: 50, // How many messages to initially load (can implement pagination later)
            TYPING_TIMEOUT_MS: 3000, // How long 'typing...' stays after last input
            DEBOUNCE_TYPING_MS: 400, // Delay before sending typing update
            DEBOUNCE_SEARCH_MS: 300, // Delay for search input
            EMOJI_LIST: ['😀', '😂', '😊', '😍', '🤔', '👍', '👎', '❤️', '🔥', '🎉', '🚀', '✅', '👀', '👋', '🙏', '✨', '💯', '😇', '😎', '😭', '🤯', '🤣', '🙄', '😥', '😴', '🥳', '🥺', '👉', '👈', '👀', '🎶', '💡', ' M M M M K K H H H H H B B F C Z C V ' , /* ... add more as needed ... */ ],
            THEMES: [
                { name: 'light', label: 'Graphite Light', icon: 'bi-brightness-high-fill' },
                { name: 'dark', label: 'Graphite Dark', icon: 'bi-moon-stars-fill' },
                { name: 'sapphire', label: 'Sapphire Sea', icon: 'bi-water' }
            ],
            MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB Max file size
            ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
            ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp3'], // Be mindful of browser support
            OFFLINE_THRESHOLD_MS: 60 * 1000 // Mark user offline if inactive for 1 minute
        };
    
        //======================================================================
        // State Management
        //======================================================================
        let state = {
            currentUser: null, // Holds Firebase Auth user object + profile data from DB
            currentChatId: null, // e.g., "uid1_uid2"
            currentRecipientId: null, // The UID of the person being chatted with
            currentRecipientData: null, // Full profile data of the recipient
            isUserOnline: false, // Tracks current user's explicit online state
            listeners: { // To store listener detachment functions
                auth: null,
                messages: null,
                status: null, // For all users' status
                contacts: null, // For user list updates
                chats: null, // For chat metadata (last msg, unread)
                presence: null, // For current user's own connection mgmt
                typing: null // For recipient's typing status
            },
            typingTimeout: null, // Timer for clearing local user's typing status
            mediaFiles: [], // Array of File objects staged for upload
            searchQuery: '', // Current search term for contacts
            caches: {
                contacts: new Map(), // Map<uid, userData>
                chatMetadata: new Map(), // Map<chatId, chatMetaData>
                messages: new Map(), // Map<chatId, Map<messageId, messageData>> - Store messages per chat
                onlineUsers: new Map(), // Map<uid, { online: boolean, lastActive: number }>
                typingUsers: new Map() // Map<chatId, Map<uid, boolean>> - Who is typing in which chat
            }
        };
    
        //======================================================================
        // Firebase Service References (Initialized in initializeFirebase)
        //======================================================================
        let firebaseApp, firebaseAuth, firebaseDb, firebaseStorage;
        // V9 Service Functions (accessed via initialized instances)
        let getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
            updateProfile, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail;
        let getDatabase, ref, set, push, update, remove, onValue, onChildAdded, off,
            serverTimestamp, increment, query, limitToLast, equalTo, orderByChild, startAt, endAt, get; // Added query functions
        let getStorage, storageRef, uploadBytesResumable, getDownloadURL;
    
        //======================================================================
        // DOM Elements Reference
        //======================================================================
        const UI = {
            // Query all elements needed and store references
            elements: {
                loadingOverlay: document.getElementById('loading-overlay'),
                appContainer: document.getElementById('app-container'),
                authSection: document.getElementById('auth-section'),
                chatSection: document.getElementById('chat-section'),
    
                // Auth Elements
                loginForm: document.getElementById('loginForm'),
                registerForm: document.getElementById('registerForm'),
                loginEmailInput: document.getElementById('loginEmail'),
                loginPasswordInput: document.getElementById('loginPassword'),
                registerNameInput: document.getElementById('registerName'),
                registerEmailInput: document.getElementById('registerEmail'),
                registerPasswordInput: document.getElementById('registerPassword'),
                confirmPasswordInput: document.getElementById('confirmPassword'),
                loginError: document.getElementById('login-error'),
                signupError: document.getElementById('signup-error'),
                googleLoginBtn: document.getElementById('googleLoginBtn'),
                facebookLoginBtn: document.getElementById('facebookLoginBtn'), // Note: FB Login requires more setup
                forgotPasswordLink: document.getElementById('forgotPasswordLink'),
                loginTabBtn: document.getElementById('login-tab-button'),
                registerTabBtn: document.getElementById('register-tab-button'),
    
                // Modals (Instances)
                forgotPasswordModal: new bootstrap.Modal(document.getElementById('forgotPasswordModal')),
                profileModal: new bootstrap.Modal(document.getElementById('profileModal')),
                mediaGalleryModal: new bootstrap.Modal(document.getElementById('mediaGalleryModal')),
                mediaPreviewModal: new bootstrap.Modal(document.getElementById('mediaPreviewModal')),
    
                // Forgot Password Modal Elements
                forgotPasswordForm: document.getElementById('forgotPasswordForm'),
                resetEmailInput: document.getElementById('resetEmail'),
                sendResetLinkBtn: document.getElementById('sendResetLinkBtn'),
    
                // Profile Modal Elements
                updateProfileForm: document.getElementById('updateProfileForm'),
                updateNameInput: document.getElementById('updateName'),
                updateBioInput: document.getElementById('updateBio'),
                updateProfilePictureInput: document.getElementById('updateProfilePictureInput'),
                editProfilePic: document.getElementById('editProfilePic'),
                saveProfileBtn: document.getElementById('saveProfileBtn'),
    
                // Sidebar Elements
                userSidebar: document.getElementById('user-sidebar'),
                sidebarToggleButton: document.getElementById('sidebar-toggle-button'),
                userProfilePicSidebar: document.getElementById('userProfilePicSidebar'),
                userNameSidebar: document.getElementById('userNameSidebar'),
                userStatusIndicatorSidebar: document.getElementById('userStatusIndicatorSidebar'),
                userStatusTextSidebar: document.getElementById('userStatusTextSidebar'),
                searchContactsInput: document.getElementById('searchContactsInput'),
                contactListContainer: document.getElementById('contactListContainer'),
                profileDropdownBtn: document.getElementById('profileDropdownBtn'),
                logoutBtn: document.getElementById('logoutBtn'),
    
                // Main Chat Area Elements
                chatMain: document.getElementById('chat-main'),
                chatNavbar: document.getElementById('chat-navbar'),
                activeChatHeaderInfo: document.getElementById('activeChatHeaderInfo'),
                activeChatAvatar: document.getElementById('activeChatAvatar'),
                activeChatName: document.getElementById('activeChatName'),
                activeChatStatusIndicator: document.getElementById('activeChatStatusIndicator'),
                activeChatStatusText: document.getElementById('activeChatStatusText'),
                emptyChatHeaderInfo: document.getElementById('emptyChatHeaderInfo'),
                activeChatOptionsMenu: document.getElementById('activeChatOptionsMenu'),
                themeSelector: document.getElementById('theme-selector'),
                chatMenuDropdown: document.getElementById('chatMenuDropdown'),
                clearChatBtn: document.getElementById('clearChatBtn'),
                blockUserBtn: document.getElementById('blockUserBtn'),
    
                // Chat Box Elements
                chatBoxWrapper: document.getElementById('chat-box-wrapper'),
                chatBox: document.getElementById('chat-box'),
                emptyChatState: document.getElementById('emptyChatState'),
                typingIndicator: document.getElementById('typing-indicator'),
                skeletonChat: document.querySelector('.skeleton-chat'),
                contactListSkeleton: document.querySelector('.skeleton-list'),
    
                // Message Input Elements
                messageFormContainer: document.getElementById('message-form-container'),
                messageForm: document.getElementById('message-form'),
                messageInput: document.getElementById('messageInput'),
                sendButton: document.getElementById('send-button'),
                emojiBtn: document.getElementById('emojiBtn'),
                emojiPicker: document.getElementById('emojiPicker'),
                attachmentMenuButton: document.getElementById('attachmentMenuButton'),
                attachImageVideoBtn: document.getElementById('attachImageVideoBtn'),
                attachAudioBtn: document.getElementById('attachAudioBtn'),
                imageVideoInput: document.getElementById('imageVideoInput'),
                audioInput: document.getElementById('audioInput'),
                mediaPreviewContainer: document.getElementById('mediaPreviewContainer'),
                chatError: document.getElementById('chat-error'),
    
                // Media Gallery Modal Elements
                imageGalleryContainer: document.getElementById('imageGalleryContainer'),
                videoGalleryContainer: document.getElementById('videoGalleryContainer'),
                audioGalleryContainer: document.getElementById('audioGalleryContainer'),
                noImagesMessage: document.getElementById('noImagesMessage'),
                noVideosMessage: document.getElementById('noVideosMessage'),
                noAudiosMessage: document.getElementById('noAudiosMessage'),
                mediaGalleryTabs: document.getElementById('mediaGalleryTabs'),
    
    
                // Media Preview Modal Elements
                mediaPreviewContent: document.getElementById('mediaPreviewContent'),
    
                // Toast Container
                toastContainer: document.querySelector('.toast-container')
            },
    
            // UI Helper Methods
            showLoadingOverlay(instant = false) {
                const overlay = this.elements.loadingOverlay;
                if (!overlay) return;
                overlay.style.transition = instant ? 'none' : 'opacity 0.3s ease, visibility 0.3s ease';
                overlay.style.opacity = '1';
                overlay.style.visibility = 'visible';
            },
    
            hideLoadingOverlay(delay = 200) {
                const overlay = this.elements.loadingOverlay;
                if (!overlay) return;
                setTimeout(() => {
                    overlay.style.transition = 'opacity 0.3s ease, visibility 0.3s ease';
                    overlay.style.opacity = '0';
                    overlay.style.visibility = 'hidden';
                }, delay);
            },
    
            showAuthSection() {
                this.elements.authSection.classList.remove('hidden');
                this.elements.authSection.style.display = 'flex';
                this.elements.chatSection.classList.add('hidden');
                this.elements.chatSection.style.display = 'none';
                this.hideLoadingOverlay(0); // Hide quickly when showing auth
            },
    
            showChatSection() {
                this.elements.authSection.classList.add('hidden');
                this.elements.authSection.style.display = 'none';
                this.elements.chatSection.classList.remove('hidden');
                this.elements.chatSection.style.display = 'flex';
                this.hideLoadingOverlay(); // Normal delay
                // Auto-focus message input on larger screens when chat appears
                if (window.innerWidth > 767.98 && state.currentChatId) {
                     this.elements.messageInput?.focus();
                }
            },
    
            toggleSidebar(forceOpen = null) {
                const isActive = this.elements.userSidebar.classList.contains('active');
                if (forceOpen === true && !isActive) {
                     this.elements.userSidebar.classList.add('active');
                } else if (forceOpen === false && isActive) {
                     this.elements.userSidebar.classList.remove('active');
                } else if (forceOpen === null) {
                     this.elements.userSidebar.classList.toggle('active');
                }
                 // Add overlay for clicking off sidebar on mobile? (Optional enhancement)
            },
    
            // Enhanced method to manage loading states for buttons
            setButtonLoading(button, isLoading) {
                 if (!button) return;
                 button.disabled = isLoading;
                 const spinner = button.querySelector('.spinner-border');
                 const text = button.querySelector('.btn-text');
    
                 if (isLoading) {
                     button.classList.add('loading');
                     if (spinner) spinner.style.display = 'inline-block';
                     if (text) text.style.display = 'none'; // Hide text when loading
                 } else {
                     button.classList.remove('loading');
                     if (spinner) spinner.style.display = 'none';
                     if (text) text.style.display = 'inline'; // Show text when not loading
                 }
            }
        };
    
        //======================================================================
        // Utility Functions
        //======================================================================
    
        // Clears error message display for a form element
        function clearError(element) {
            if (element && !element.classList.contains('hidden')) {
                element.textContent = '';
                element.classList.add('hidden');
            }
        }
    
        // Displays an error message either in a dedicated element or as a toast
        function displayError(element, message, isToast = false) {
            console.error("Error:", message); // Log error for debugging
            if (!isToast && element) {
                element.textContent = message;
                element.classList.remove('hidden');
            } else {
                showToast(message, "danger");
            }
        }
    
        // Shows a Bootstrap toast notification
        function showToast(message, type = 'info', delay = 5000) {
            if (!UI.elements.toastContainer) return;
            const toastId = `toast-${Date.now()}`;
            const toastTypeClasses = {
                info: 'text-bg-info',
                success: 'text-bg-success',
                warning: 'text-bg-warning',
                danger: 'text-bg-danger'
            };
            const toastClass = toastTypeClasses[type] || toastTypeClasses.info;
            const iconClass = {
                info: 'bi-info-circle-fill',
                success: 'bi-check-circle-fill',
                warning: 'bi-exclamation-triangle-fill',
                danger: 'bi-x-octagon-fill'
            }[type] || 'bi-info-circle-fill';
    
            const toastHTML = `
                <div id="${toastId}" class="toast align-items-center ${toastClass} border-0" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${delay}">
                  <div class="d-flex">
                    <div class="toast-body">
                      <i class="bi ${iconClass} me-2"></i> ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                  </div>
                </div>`;
    
            UI.elements.toastContainer.insertAdjacentHTML('beforeend', toastHTML);
            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                const bsToast = new bootstrap.Toast(toastElement);
                toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
                bsToast.show();
            }
        }
    
        // Formats timestamp into a readable time string (e.g., "10:30 AM")
        function formatTimestamp(timestamp) {
            if (!timestamp || typeof timestamp !== 'number') return '';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        }
    
         // Formats timestamp into a relative time string (e.g., "5m ago", "yesterday", "Mar 15")
        function formatRelativeTime(timestamp) {
            if (!timestamp || typeof timestamp !== 'number') return '';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
    
            const now = new Date();
            const seconds = Math.round((now - date) / 1000);
            const minutes = Math.round(seconds / 60);
            const hours = Math.round(minutes / 60);
            const days = Math.round(hours / 24);
    
            if (seconds < 5) return 'just now';
            if (minutes < 1) return `${seconds}s ago`;
            if (hours < 1) return `${minutes}m ago`;
            if (days < 1) {
                // Check if it was yesterday
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                if (date.getDate() === yesterday.getDate() &&
                    date.getMonth() === yesterday.getMonth() &&
                    date.getFullYear() === yesterday.getFullYear()) {
                    return 'Yesterday';
                }
                // Check if it's today
                if (date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear()) {
                     return formatTimestamp(timestamp); // Show time if today
                }
                 // Otherwise, show hours if less than 24 hours ago but crossed midnight
                if (hours < 24) {
                    return `${hours}h ago`;
                }
    
            }
             // If more than a day ago, show date
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    
        // Generates placeholder avatar HTML with initials and a background color based on UID
        function generateAvatarHTML(uid, displayName, sizeClass = '', includeStatus = false, isOnline = false) {
            const initials = (displayName || '??').trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            // Consistent color generation based on UID
            const colors = ['#4c6ef5', '#20c997', '#fab005', '#fa5252', '#7950f2', '#f783ac', '#ff922b', '#228be6'];
            let hash = 0;
            if (uid) {
                for (let i = 0; i < uid.length; i++) {
                    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
                    hash = hash & hash; // Convert to 32bit integer
                }
            }
            const bgColor = colors[Math.abs(hash % colors.length)];
            const statusIndicatorHTML = includeStatus
                ? `<span class="status-indicator ${isOnline ? 'bg-success' : 'bg-secondary'}"></span>`
                : '';
    
            return `<div class="avatar ${sizeClass}" style="background-color: ${bgColor}; color: #fff;" title="${displayName || 'User'}">
                        ${initials}
                        ${statusIndicatorHTML}
                    </div>`;
        }
    
        // Higher-order function for debouncing
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    
        // Creates a consistent chat ID from two user IDs
        function getChatId(uid1, uid2) {
            if (!uid1 || !uid2) {
                 console.warn("Attempted to get chat ID with invalid UIDs:", uid1, uid2);
                 return null;
             }
            return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
        }
    
        // Auto-resizes the message textarea based on content
        function resizeTextarea() {
            const textarea = UI.elements.messageInput;
            textarea.style.height = 'auto'; // Reset height
            // Set height based on scroll height, capped at ~5 lines (adjust 120px as needed)
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    
        // Validates a file based on size and allowed MIME types
        function validateFile(file, allowedTypes) {
             if (!file) return false;
             const isValidSize = file.size <= CONFIG.MAX_FILE_SIZE;
             const isValidType = allowedTypes.includes(file.type);
             if (!isValidSize) {
                 console.warn(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
                 showToast(`File "${file.name}" is too large (max ${CONFIG.MAX_FILE_SIZE / 1024 / 1024} MB).`, "warning");
             }
             if (!isValidType) {
                  console.warn(`Invalid file type: ${file.name} (${file.type})`);
                 showToast(`File type for "${file.name}" is not allowed.`, "warning");
             }
            return isValidSize && isValidType;
        }
    
        // Simple function to escape HTML to prevent XSS from user-generated text
        function escapeHTML(str) {
            if (!str) return '';
            return str.replace(/[&<>"']/g, function (match) {
                const escapeMap = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;' //  &#39; is safer than &apos; for older browsers
                };
                return escapeMap[match];
            });
        }
    
        // Function to scroll the chatbox to the bottom
        function scrollChatToBottom(behavior = 'smooth') {
             if (UI.elements.chatBox) {
                 // A small delay often helps ensure rendering is complete before scrolling
                 setTimeout(() => {
                    UI.elements.chatBox.scrollTo({ top: UI.elements.chatBox.scrollHeight, behavior });
                 }, 50);
             }
        }
    
        //======================================================================
        // Firebase Service Initialization
        //======================================================================
        function initializeFirebase() {
            try {
                // Check if Firebase is loaded (from script tags)
                if (typeof firebase === 'undefined' || !firebase.initializeApp) {
                     throw new Error("Firebase SDK not loaded or invalid version. Ensure Firebase v9+ scripts are included in HTML.");
                }
    
                // Initialize Firebase App
                firebaseApp = firebase.initializeApp(firebaseConfig);
    
                // Get Firebase Service Functions (v9 modular style)
                // Authentication
                getAuth = firebase.auth.getAuth;
                onAuthStateChanged = firebase.auth.onAuthStateChanged;
                signInWithEmailAndPassword = firebase.auth.signInWithEmailAndPassword;
                createUserWithEmailAndPassword = firebase.auth.createUserWithEmailAndPassword;
                updateProfile = firebase.auth.updateProfile;
                signOut = firebase.auth.signOut;
                GoogleAuthProvider = firebase.auth.GoogleAuthProvider;
                signInWithPopup = firebase.auth.signInWithPopup;
                sendPasswordResetEmail = firebase.auth.sendPasswordResetEmail;
    
                // Realtime Database
                getDatabase = firebase.database.getDatabase;
                ref = firebase.database.ref;
                set = firebase.database.set;
                push = firebase.database.push;
                update = firebase.database.update;
                remove = firebase.database.remove;
                onValue = firebase.database.onValue;
                onChildAdded = firebase.database.onChildAdded;
                off = firebase.database.off;
                serverTimestamp = firebase.database.serverTimestamp;
                increment = firebase.database.increment;
                query = firebase.database.query;
                limitToLast = firebase.database.limitToLast;
                orderByChild = firebase.database.orderByChild; // For querying messages by timestamp etc.
                startAt = firebase.database.startAt;
                endAt = firebase.database.endAt;
                get = firebase.database.get; // For fetching data once
    
                // Cloud Storage
                getStorage = firebase.storage.getStorage;
                storageRef = firebase.storage.ref;
                uploadBytesResumable = firebase.storage.uploadBytesResumable;
                getDownloadURL = firebase.storage.getDownloadURL;
    
                // Get Service Instances
                firebaseAuth = getAuth(firebaseApp);
                firebaseDb = getDatabase(firebaseApp);
                firebaseStorage = getStorage(firebaseApp);
    
                console.log("Firebase Initialized Successfully:", firebaseApp.name);
    
                // Attach the crucial auth state listener immediately
                state.listeners.auth = onAuthStateChanged(firebaseAuth, handleAuthStateChanged);
    
            } catch (error) {
                console.error("Firebase Initialization Failed:", error);
                UI.showLoadingOverlay(true); // Show overlay permanently on init failure
                displayError(null, `Critical Error: Could not initialize Firebase services. Please check configuration and network. ${error.message}`, true);
                // Prevent further execution if Firebase fails to load
                throw new Error("Firebase failed to initialize.");
            }
        }
    
    
        //======================================================================
        // Firebase Service Wrappers (Simplified for direct use now)
        // Moved direct calls into handlers for clarity with v9 syntax access
        //======================================================================
    
    
        //======================================================================
        // Presence Management (Online/Offline Status)
        //======================================================================
        function setupPresenceManagement() {
            if (!state.currentUser || state.listeners.presence) return;
    
            const uid = state.currentUser.uid;
            const userStatusDbRef = ref(firebaseDb, `/status/${uid}`);
            const infoConnectedRef = ref(firebaseDb, '.info/connected');
    
            state.listeners.presence = onValue(infoConnectedRef, (snapshot) => {
                if (snapshot.val() === false) {
                    // Use 'set' on disconnect for immediate update if connection is lost gracefully
                    // However, relying solely on 'onDisconnect' might be better for abrupt closures
                    // For simplicity here, we just mark as offline if RTDB detects disconnection.
                     set(userStatusDbRef, {
                          online: false,
                          lastActive: serverTimestamp()
                      });
                    state.isUserOnline = false;
                    return;
                }
    
                // Use onDisconnect to set status when client disconnects uncleanly
                firebase.database().onDisconnect(userStatusDbRef).set({
                    online: false,
                    lastActive: serverTimestamp()
                }).then(() => {
                    // Set current status to online once connection is established AND onDisconnect is set up
                    set(userStatusDbRef, {
                        online: true,
                        lastActive: serverTimestamp()
                     });
                     state.isUserOnline = true;
                     updateSidebarStatus(true);
                }).catch(error => {
                    console.error("Could not set onDisconnect status:", error);
                });
            });
        }
    
         function teardownPresenceManagement() {
              if (!state.currentUser) return;
              const uid = state.currentUser.uid;
              const userStatusDbRef = ref(firebaseDb, `/status/${uid}`);
             // Explicitly set offline when logging out cleanly
             set(userStatusDbRef, {
                  online: false,
                  lastActive: serverTimestamp()
             }).catch(error => console.warn("Could not set status to offline on logout:", error));
             // Cancel the onDisconnect operation
              firebase.database().onDisconnect(userStatusDbRef).cancel().catch(error => console.warn("Could not cancel onDisconnect:", error));
              state.isUserOnline = false;
    
              // Detach the '.info/connected' listener
             if (state.listeners.presence) {
                  // Firebase RTDB listeners need the original ref and event type to detach
                 // The onValue returns an unsubscribe function directly.
                 state.listeners.presence(); // Call the unsubscribe function returned by onValue
                 state.listeners.presence = null;
                 console.log("Presence listener detached.");
             }
        }
    
         function updateSidebarStatus(isOnline) {
            if (UI.elements.userStatusIndicatorSidebar) {
                 UI.elements.userStatusIndicatorSidebar.className = `bi bi-circle-fill me-1 text-${isOnline ? 'success' : 'secondary'} small`;
            }
             if (UI.elements.userStatusTextSidebar) {
                UI.elements.userStatusTextSidebar.textContent = isOnline ? 'Online' : 'Offline';
             }
         }
    
        //======================================================================
        // Listener Management
        //======================================================================
    
         // Detaches a specific listener if it exists
        function detachListener(type) {
             if (state.listeners[type]) {
                 try {
                    state.listeners[type](); // Call the unsubscribe function
                    console.log(`Listener detached: ${type}`);
                } catch (error) {
                     console.warn(`Error detaching listener ${type}:`, error);
                 }
                 state.listeners[type] = null;
             }
         }
    
         // Attaches listeners needed when the user is logged in and viewing the chat interface
         function attachChatListeners() {
             if (!state.currentUser) return;
            console.log("Attaching core chat listeners...");
             attachContactsAndChatsListener(); // Combined listener for users and chat metadata
            attachStatusListener(); // Listener for everyone's online status
            setupPresenceManagement(); // Handle own online status
    
            // If a chat is already selected (e.g., returning to tab)
             if (state.currentChatId) {
                 attachMessageListener(state.currentChatId);
                attachTypingListener(state.currentChatId);
             }
         }
    
         // Detaches all listeners, typically on logout or critical error
        function detachAllListeners() {
             console.log("Detaching all listeners...");
            if (state.currentUser) {
                 teardownPresenceManagement(); // Must be called before detaching others if user is logged in
             }
            Object.keys(state.listeners).forEach(detachListener);
    
             // Clear local caches associated with listeners
            // state.caches.messages.clear(); // Don't clear messages cache on logout, maybe clear on demand?
            state.caches.onlineUsers.clear();
            state.caches.contacts.clear();
            state.caches.chatMetadata.clear();
             state.caches.typingUsers.clear();
             // Optionally clear media cache too if it's per-session: state.caches.media.clear();
             displayUserList(); // Update UI to reflect cleared state
         }
    
    
        // Combined listener for Users and Chat Metadata for efficiency
         function attachContactsAndChatsListener() {
             if (state.listeners.contacts || state.listeners.chats || !state.currentUser) return;
             console.log("Attaching contacts and chats listener...");
             const usersRef = ref(firebaseDb, 'users');
            const chatsRef = ref(firebaseDb, 'chats');
    
            // Listener for changes in the 'users' node
             state.listeners.contacts = onValue(usersRef, (snapshot) => {
                console.log("Contacts data received/updated.");
                 state.caches.contacts.clear();
                 const users = snapshot.val() || {};
                 Object.entries(users).forEach(([uid, data]) => {
                     if (uid !== state.currentUser?.uid) { // Exclude self
                         state.caches.contacts.set(uid, { uid, ...data });
                     }
                 });
                 // If recipient data is outdated, update it
                 if (state.currentRecipientId && state.caches.contacts.has(state.currentRecipientId)) {
                      state.currentRecipientData = state.caches.contacts.get(state.currentRecipientId);
                      displayActiveChatHeader(); // Refresh header if recipient details changed
                  }
                displayUserList(); // Re-render the user list
             }, (error) => {
                 console.error("Contacts Listener Error:", error);
                 showToast("Error fetching user list.", "danger");
            });
    
             // Listener for changes in the 'chats' node (metadata only)
            // We filter client-side which chats belong to the current user
             state.listeners.chats = onValue(chatsRef, (snapshot) => {
                console.log("Chat metadata received/updated.");
                state.caches.chatMetadata.clear(); // Recalculate metadata
                const chats = snapshot.val() || {};
                const myUid = state.currentUser?.uid;
                if (!myUid) return;
    
                 Object.entries(chats).forEach(([chatId, data]) => {
                     // Check if the current user is a participant in this chat
                    if (data.participants && data.participants.includes(myUid)) {
                         // Calculate unread count specifically for the current user
                         const unreadCount = data.unreadCount?.[myUid] || 0;
                         // Store metadata including the correctly calculated unread count
                        state.caches.chatMetadata.set(chatId, { ...data, calculatedUnreadCount: unreadCount });
                    }
                 });
                 displayUserList(); // Re-render user list as metadata might affect sorting/badges
            }, (error) => {
                console.error("Chat Metadata Listener Error:", error);
                showToast("Error fetching chat details.", "danger");
             });
         }
    
         // Listener for online/offline status of all users
        function attachStatusListener() {
            if (state.listeners.status || !state.currentUser) return;
             console.log("Attaching global status listener...");
            const statusRef = ref(firebaseDb, 'status');
    
            state.listeners.status = onValue(statusRef, (snapshot) => {
                console.log("Global status data received/updated.");
                 state.caches.onlineUsers.clear(); // Reset cache
                const statuses = snapshot.val() || {};
                Object.entries(statuses).forEach(([uid, data]) => {
                    // Store the latest status info for each user
                     if (uid !== state.currentUser?.uid) { // Don't need to track self here separately
                         state.caches.onlineUsers.set(uid, { online: data?.online || false, lastActive: data?.lastActive || 0 });
                    }
                });
                displayUserList(); // Re-render user list to show updated statuses
                displayActiveChatHeader(); // Update status in the active chat header
            }, (error) => {
                console.error("Global Status Listener Error:", error);
                 showToast("Error fetching user statuses.", "warning"); // Non-critical
            });
        }
    
        // Attaches listener for messages in a specific chat
        function attachMessageListener(chatId) {
            if (!chatId || !state.currentUser) return;
            detachListener('messages'); // Remove previous message listener first
             console.log(`Attaching message listener for chat: ${chatId}`);
    
             // Ensure a message cache exists for this chat
            if (!state.caches.messages.has(chatId)) {
                state.caches.messages.set(chatId, new Map());
            }
             const chatMessagesCache = state.caches.messages.get(chatId);
             chatMessagesCache.clear(); // Clear previous messages for this chat
            UI.elements.chatBox.innerHTML = ''; // Clear chatbox UI
            UI.elements.skeletonChat.style.display = 'block'; // Show skeleton loader
    
            // Reference messages for the specific chat, limit to last N messages
            const messagesRef = ref(firebaseDb, `chats/${chatId}/messages`);
             // Query for the last N messages
             const messagesQuery = query(messagesRef, limitToLast(CONFIG.MESSAGE_LIMIT));
    
    
             let initialMessagesLoaded = false;
             state.listeners.messages = onChildAdded(messagesQuery, (snapshot) => {
                 if (!snapshot.exists()) return;
                const messageId = snapshot.key;
                const messageData = snapshot.val();
    
                 // Check if message already processed (could happen with cache race conditions)
                 if (chatMessagesCache.has(messageId)) return;
    
                 // Store message in cache
                 chatMessagesCache.set(messageId, { id: messageId, data: messageData });
                displayChatMessage({ id: messageId, data: messageData }); // Display the new message
    
                if (!initialMessagesLoaded) {
                     // Only scroll automatically for new incoming messages after initial load
                     // or if the user is already near the bottom.
                     const isScrolledToBottom = UI.elements.chatBox.scrollHeight - UI.elements.chatBox.scrollTop - UI.elements.chatBox.clientHeight < 100;
                     if(messageData.senderId === state.currentUser.uid || isScrolledToBottom) {
                         scrollChatToBottom('smooth');
                     }
                }
            }, (error) => {
                console.error(`Message Listener Error (Chat ${chatId}):`, error);
                 showToast("Error loading messages.", "danger");
                UI.elements.chatBox.innerHTML = '<div class="p-4 text-center text-danger">Could not load messages.</div>';
                 UI.elements.skeletonChat.style.display = 'none';
             });
    
    
             // Handle initial load completion
            // We can use 'get' to determine when the initial batch is loaded
             get(messagesQuery).then(() => {
                 console.log(`Initial messages loaded for chat: ${chatId}`);
                 initialMessagesLoaded = true;
                UI.elements.skeletonChat.style.display = 'none'; // Hide skeleton
                if (chatMessagesCache.size === 0) {
                    UI.elements.emptyChatState.classList.remove('hidden'); // Show empty state if no messages after load
                 } else {
                     UI.elements.emptyChatState.classList.add('hidden');
                    scrollChatToBottom('auto'); // Jump to bottom instantly on initial load
                }
             }).catch(error => {
                console.error("Error getting initial messages:", error);
                 UI.elements.skeletonChat.style.display = 'none'; // Hide skeleton even on error
                 showToast("Error fetching initial messages.", "danger");
            });
        }
    
         // Attaches listener for typing status of the recipient in a specific chat
        function attachTypingListener(chatId) {
             if (!chatId || !state.currentUser || !state.currentRecipientId) return;
            detachListener('typing'); // Remove previous typing listener
            console.log(`Attaching typing listener for chat ${chatId}, recipient ${state.currentRecipientId}`);
    
            const recipientTypingRef = ref(firebaseDb, `chats/${chatId}/typing/${state.currentRecipientId}`);
    
            // Initialize cache for this chat if it doesn't exist
             if (!state.caches.typingUsers.has(chatId)) {
                 state.caches.typingUsers.set(chatId, new Map());
             }
    
             state.listeners.typing = onValue(recipientTypingRef, (snapshot) => {
                const typingData = snapshot.val();
                const isTyping = typingData?.isTyping ?? false;
                 // Store typing status for the recipient in the specific chat cache
                 const chatTypingCache = state.caches.typingUsers.get(chatId);
                 chatTypingCache.set(state.currentRecipientId, isTyping);
                displayTypingIndicator(); // Update UI based on cached status
            }, (error) => {
                console.error(`Typing Listener Error (Chat ${chatId}, Recipient ${state.currentRecipientId}):`, error);
                // Non-critical, maybe just log it
            });
        }
    
         // Updates the typing indicator UI
         function displayTypingIndicator() {
             let typingText = '';
            if (state.currentChatId && state.currentRecipientId) {
                 const chatTypingCache = state.caches.typingUsers.get(state.currentChatId);
                 const isRecipientTyping = chatTypingCache?.get(state.currentRecipientId) || false;
                if (isRecipientTyping) {
                     typingText = `${escapeHTML(state.currentRecipientData?.name) || 'User'} is typing...`;
                }
            }
            UI.elements.typingIndicator.textContent = typingText;
             // Toggle visibility based on whether anyone is typing
            UI.elements.typingIndicator.style.display = typingText ? 'block' : 'none';
        }
    
    
        //======================================================================
        // Authentication Handlers & Flow
        //======================================================================
    
         // Central handler for Firebase Auth state changes
         async function handleAuthStateChanged(user) {
             UI.showLoadingOverlay(true); // Show loader during transition
             detachAllListeners(); // Clear existing listeners before proceeding
             resetAppState(); // Reset state variables
    
             if (user) {
                 console.log("User authenticated:", user.uid);
                 state.currentUser = { ...user }; // Store basic auth user data
    
                 try {
                     // Fetch or create user profile in Realtime Database
                     const userRef = ref(firebaseDb, `users/${user.uid}`);
                    const snapshot = await get(userRef);
    
                    if (snapshot.exists()) {
                        state.currentUser = { ...user, ...snapshot.val() }; // Merge auth data with DB data
                        console.log("User profile found in DB:", state.currentUser.name);
                     } else {
                         console.log("User profile not found, creating new one...");
                         const profileData = {
                             uid: user.uid,
                            name: user.displayName || `User_${user.uid.slice(0, 5)}`,
                             email: user.email,
                            photoURL: user.photoURL || null, // Use photoURL from provider if available
                             bio: '',
                            createdAt: serverTimestamp(),
                             blockedUsers: {} // Initialize blocked users list
                        };
                        await set(userRef, profileData);
                         // If user had displayName/photoURL from provider, update Auth profile too for consistency
                         if (!user.displayName && profileData.name) await updateProfile(user, { displayName: profileData.name });
                         if (!user.photoURL && profileData.photoURL) await updateProfile(user, { photoURL: profileData.photoURL });
    
                        state.currentUser = { ...user, ...profileData, createdAt: Date.now() }; // Use current time temporarily
                        console.log("New user profile created.");
                    }
    
                     displayCurrentUserInfoSidebar(); // Update sidebar with user info
                     attachChatListeners(); // Attach listeners needed for chat view
                     UI.showChatSection(); // Switch to the chat view
    
                 } catch (error) {
                     console.error("Error fetching/creating user profile:", error);
                     showToast("Error loading your profile. Please try again later.", "danger");
                     // Logout the user if profile loading fails critically
                     await FirebaseService.auth.signOut().catch(e => console.error("Signout failed after profile error:", e));
                     UI.showAuthSection(); // Go back to auth section
                 }
    
             } else {
                 console.log("User logged out.");
                 // No user logged in, ensure clean state and show auth screen
                resetAppState();
                UI.showAuthSection();
            }
         }
    
        // Reset application state when logging out or switching users
         function resetAppState() {
              state.currentUser = null;
              state.currentChatId = null;
              state.currentRecipientId = null;
              state.currentRecipientData = null;
              state.mediaFiles = [];
              state.searchQuery = '';
              // Don't detach listeners here, handleAuthStateChanged does it.
              // Clear UI elements that hold user/chat specific data
             if(UI.elements.userNameSidebar) UI.elements.userNameSidebar.textContent = 'Loading...';
             if(UI.elements.userProfilePicSidebar) UI.elements.userProfilePicSidebar.innerHTML = generateAvatarHTML(null, null);
             if(UI.elements.chatBox) UI.elements.chatBox.innerHTML = '';
             if(UI.elements.contactListContainer) UI.elements.contactListContainer.innerHTML = ''; // Clear contacts
              displayActiveChatHeader(); // Reset chat header
              displayMediaPreview(); // Clear media preview
              UI.elements.emptyChatState?.classList.remove('hidden');
             UI.elements.chatBox.innerHTML = ''; // Clear chat box
             updateSidebarStatus(false); // Ensure sidebar status is offline
         }
    
        // Handles the login form submission
        async function handleLoginSubmit(event) {
            event.preventDefault();
            clearError(UI.elements.loginError);
            const email = UI.elements.loginEmailInput.value.trim();
            const password = UI.elements.loginPasswordInput.value;
    
            if (!email || !password) {
                displayError(UI.elements.loginError, "Please enter both email and password.");
                return;
            }
    
             const submitButton = event.submitter;
            UI.setButtonLoading(submitButton, true);
            UI.showLoadingOverlay();
    
            try {
                console.log("Attempting login...");
                await signInWithEmailAndPassword(firebaseAuth, email, password);
                console.log("Login successful (authStateChanged will handle UI).");
                 // onAuthStateChanged will handle the rest
            } catch (error) {
                console.error("Login Failed:", error);
                 const errorCode = error.code;
                 let message = `Login failed: ${error.message}`;
                 // Provide more user-friendly messages for common errors
                 if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
                     message = "Incorrect email or password. Please try again.";
                } else if (errorCode === 'auth/invalid-email') {
                     message = "Please enter a valid email address.";
                } else if (errorCode === 'auth/network-request-failed') {
                     message = "Network error. Please check your connection.";
                 }
                displayError(UI.elements.loginError, message);
                UI.hideLoadingOverlay(0);
                UI.setButtonLoading(submitButton, false);
            }
             // No need to hide overlay/spinner on success, handleAuthStateChanged does that
        }
    
        // Handles the registration form submission
        async function handleSignupSubmit(event) {
            event.preventDefault();
            clearError(UI.elements.signupError);
            const name = UI.elements.registerNameInput.value.trim();
            const email = UI.elements.registerEmailInput.value.trim();
            const password = UI.elements.registerPasswordInput.value;
            const confirmPassword = UI.elements.confirmPasswordInput.value;
    
            if (!name || !email || !password) {
                displayError(UI.elements.signupError, "Please fill in all fields.");
                return;
            }
            if (password.length < 6) {
                displayError(UI.elements.signupError, "Password must be at least 6 characters long.");
                return;
            }
            if (password !== confirmPassword) {
                displayError(UI.elements.signupError, "Passwords do not match.");
                return;
            }
    
            const submitButton = event.submitter;
             UI.setButtonLoading(submitButton, true);
            UI.showLoadingOverlay();
    
            try {
                console.log("Attempting signup...");
                const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
                console.log("Signup successful, creating profile...");
    
                 // Update profile immediately after creation (name)
                // PhotoURL and initial DB record are handled in handleAuthStateChanged
                await updateProfile(userCredential.user, { displayName: name });
                console.log("Firebase Auth profile updated with display name.");
    
                 // Let handleAuthStateChanged create the DB record now that Auth profile is set
                // onAuthStateChanged will be triggered, and handle profile creation/UI update
                showToast(`Welcome, ${name}! Account created successfully.`, 'success');
    
    
             } catch (error) {
                console.error("Signup Failed:", error);
                 const errorCode = error.code;
                 let message = `Signup failed: ${error.message}`;
                 if (errorCode === 'auth/email-already-in-use') {
                     message = "This email address is already registered.";
                } else if (errorCode === 'auth/invalid-email') {
                     message = "Please enter a valid email address.";
                } else if (errorCode === 'auth/weak-password') {
                     message = "Password is too weak. Please choose a stronger password.";
                } else if (errorCode === 'auth/network-request-failed') {
                     message = "Network error. Please check your connection.";
                 }
                displayError(UI.elements.signupError, message);
                UI.hideLoadingOverlay(0);
                UI.setButtonLoading(submitButton, false);
             }
             // No need to hide overlay/spinner on success, handleAuthStateChanged does that
        }
    
         // Handles Google Sign-In button click
         async function handleGoogleLogin() {
             UI.setButtonLoading(UI.elements.googleLoginBtn, true);
            clearError(UI.elements.loginError); // Clear any previous errors
            UI.showLoadingOverlay();
            const provider = new GoogleAuthProvider();
    
             try {
                console.log("Attempting Google Sign-In...");
                 await signInWithPopup(firebaseAuth, provider);
                console.log("Google Sign-In successful (authStateChanged will handle UI).");
                 // onAuthStateChanged handles the rest
            } catch (error) {
                console.error("Google Sign-In Failed:", error);
                 const errorCode = error.code;
                 let message = `Google Sign-In failed: ${error.message}`;
                 if (errorCode === 'auth/popup-closed-by-user') {
                     message = "Sign-in popup closed before completion.";
                } else if (errorCode === 'auth/cancelled-popup-request') {
                     message = "Multiple sign-in popups opened. Please try again.";
                 } else if (errorCode === 'auth/network-request-failed') {
                     message = "Network error during Google Sign-In.";
                 }
                // Display error on the login pane
                 displayError(UI.elements.loginError, message);
                 // Ensure UI state is reset
                UI.setButtonLoading(UI.elements.googleLoginBtn, false);
                 UI.hideLoadingOverlay(0);
                // Ensure login tab is active if sign-in failed
                if (UI.elements.loginTabBtn && !UI.elements.loginTabBtn.classList.contains('active')) {
                    bootstrap.Tab.getOrCreateInstance(UI.elements.loginTabBtn).show();
                }
             }
            // No need to hide overlay/spinner on success
         }
    
        // Handles the forgot password form submission
        async function handleForgotPasswordSubmit(event) {
            event?.preventDefault(); // Allow calling without event if needed
            const resetEmail = UI.elements.resetEmailInput.value.trim();
    
            if (!resetEmail) {
                showToast("Please enter your email address.", "warning");
                return;
            }
    
             UI.setButtonLoading(UI.elements.sendResetLinkBtn, true);
            try {
                 await sendPasswordResetEmail(firebaseAuth, resetEmail);
                 showToast("Password reset email sent! Check your inbox (and spam folder).", "success");
                UI.elements.forgotPasswordModal.hide();
                 UI.elements.forgotPasswordForm.reset();
            } catch (error) {
                 console.error("Forgot Password Failed:", error);
                 const errorCode = error.code;
                 let message = `Error sending reset email: ${error.message}`;
                 if (errorCode === 'auth/user-not-found') {
                     message = "No account found with this email address.";
                 } else if (errorCode === 'auth/invalid-email') {
                     message = "Please enter a valid email address.";
                } else if (errorCode === 'auth/network-request-failed') {
                     message = "Network error. Please try again.";
                 }
                showToast(message, "danger");
            } finally {
                 UI.setButtonLoading(UI.elements.sendResetLinkBtn, false);
            }
        }
    
         // Handles the logout button click
         async function handleLogout() {
             if (!state.currentUser) return;
             console.log("Logging out user:", state.currentUser.uid);
             UI.setButtonLoading(UI.elements.logoutBtn, true);
    
            try {
                // Presence management already handles setting offline status via onDisconnect cancellation + explicit set
                 await signOut(firebaseAuth);
                 console.log("Sign out successful.");
                 // handleAuthStateChanged will manage UI clearing and listener detachment
                 showToast("You have been logged out.", "info");
             } catch (error) {
                 console.error("Logout Failed:", error);
                showToast(`Logout failed: ${error.message}`, "danger");
                 UI.setButtonLoading(UI.elements.logoutBtn, false); // Re-enable button on failure
             }
            // Don't reset button state on success, auth state change handles UI transition
         }
    
        //======================================================================
        // User Profile Management
        //======================================================================
    
         // Populates the profile modal with current user data
         function populateProfileModal() {
            if (!state.currentUser) return;
            UI.elements.updateNameInput.value = state.currentUser.name || state.currentUser.displayName || ''; // Prefer name from DB
            UI.elements.updateBioInput.value = state.currentUser.bio || '';
    
             // Display current profile picture or placeholder
             const photoURL = state.currentUser.photoURL;
             if (photoURL) {
                 UI.elements.editProfilePic.innerHTML = `<img src="${photoURL}" class="img-fluid rounded-circle" style="width: 120px; height: 120px; object-fit: cover;" alt="Profile Picture">`;
             } else {
                 // Use the standard avatar generator if no photoURL
                 UI.elements.editProfilePic.innerHTML = generateAvatarHTML(
                    state.currentUser.uid,
                    state.currentUser.name || state.currentUser.displayName,
                    'd-flex align-items-center justify-content-center fs-1' // Make placeholder bigger
                );
                 UI.elements.editProfilePic.querySelector('.avatar')?.classList.add('w-100', 'h-100', 'rounded-circle');
            }
        }
    
        // Handles saving changes from the profile modal
        async function handleProfileUpdate(event) {
            event.preventDefault();
            if (!state.currentUser) return;
    
            const newName = UI.elements.updateNameInput.value.trim();
            const newBio = UI.elements.updateBioInput.value.trim();
            const photoFile = UI.elements.updateProfilePictureInput.files[0];
    
            if (!newName) {
                showToast("Name cannot be empty.", "warning");
                return;
            }
    
             UI.setButtonLoading(UI.elements.saveProfileBtn, true);
    
             try {
                let newPhotoURL = state.currentUser.photoURL; // Start with existing URL
    
                 // 1. Upload new photo if selected and valid
                 if (photoFile) {
                     if (validateFile(photoFile, CONFIG.ALLOWED_IMAGE_TYPES)) {
                        console.log("Uploading new profile picture...");
                        const filePath = `profile_pics/${state.currentUser.uid}/${Date.now()}_${photoFile.name}`;
                        const fileStorageRef = storageRef(firebaseStorage, filePath);
                        const uploadTask = uploadBytesResumable(fileStorageRef, photoFile);
    
                        // Add upload progress listener (optional)
                        uploadTask.on('state_changed',
                            (snapshot) => {
                                 const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                console.log('Upload is ' + progress + '% done');
                                // You could potentially show progress in the modal here
                             },
                            (error) => {
                                 console.error("Upload failed:", error);
                                 throw new Error(`Failed to upload profile picture: ${error.code}`); // Throw to be caught below
                            }
                         );
    
                        // Wait for upload to complete
                         await uploadTask;
                        newPhotoURL = await getDownloadURL(uploadTask.snapshot.ref);
                         console.log("New profile picture uploaded:", newPhotoURL);
                    } else {
                         // Validation failed (toast already shown by validateFile)
                         UI.setButtonLoading(UI.elements.saveProfileBtn, false);
                         return; // Stop profile update if file is invalid
                    }
                }
    
                 // 2. Update Firebase Auth Profile (Name and potentially Photo URL)
                 const authUpdates = {};
                 if (newName !== state.currentUser.displayName) authUpdates.displayName = newName;
                 if (newPhotoURL !== state.currentUser.photoURL) authUpdates.photoURL = newPhotoURL;
    
                 if (Object.keys(authUpdates).length > 0) {
                     console.log("Updating Firebase Auth profile...", authUpdates);
                     await updateProfile(firebaseAuth.currentUser, authUpdates);
                     console.log("Firebase Auth profile updated.");
                }
    
                 // 3. Update Realtime Database Profile (Name, Bio, Photo URL)
                 const dbUpdates = {};
                 if (newName !== state.currentUser.name) dbUpdates.name = newName; // Assuming 'name' exists in DB model
                 if (newBio !== state.currentUser.bio) dbUpdates.bio = newBio;
                 if (newPhotoURL !== state.currentUser.photoURL) dbUpdates.photoURL = newPhotoURL;
    
    
                 if (Object.keys(dbUpdates).length > 0) {
                     console.log("Updating Realtime Database profile...", dbUpdates);
                    const userDbRef = ref(firebaseDb, `users/${state.currentUser.uid}`);
                    await update(userDbRef, dbUpdates);
                    console.log("Realtime Database profile updated.");
                }
    
                // 4. Update Local State
                 const updatedUserData = { ...state.currentUser, ...dbUpdates }; // Update from DB
                if (authUpdates.displayName) updatedUserData.displayName = authUpdates.displayName; // Update from Auth
                 if (authUpdates.photoURL) updatedUserData.photoURL = authUpdates.photoURL; // Update from Auth
                 state.currentUser = updatedUserData;
    
    
                 // 5. Update UI
                 displayCurrentUserInfoSidebar(); // Refresh sidebar
                // The profile modal picture preview doesn't need explicit update, as the modal will be closed.
                 // Re-populating on next open will show the changes.
                UI.elements.profileModal.hide();
                 showToast("Profile updated successfully!", "success");
    
             } catch (error) {
                 console.error("Profile Update Failed:", error);
                 showToast(`Profile update failed: ${error.message}`, "danger");
             } finally {
                 UI.setButtonLoading(UI.elements.saveProfileBtn, false);
                 // Clear the file input value in case the user opens the modal again
                 UI.elements.updateProfilePictureInput.value = '';
            }
        }
    
        //======================================================================
        // Chat & Contact List Management
        //======================================================================
    
        // Handles clicking on a user in the contact list
        function handleContactClick(recipientUid) {
            if (!state.currentUser || recipientUid === state.currentRecipientId) {
                 if(window.innerWidth <= 767.98) { // Close sidebar on mobile if clicking active chat again
                    UI.toggleSidebar(false);
                 }
                return; // Do nothing if already selected or no user
            }
    
            console.log(`Switching chat to recipient: ${recipientUid}`);
            const recipientData = state.caches.contacts.get(recipientUid);
            if (!recipientData) {
                console.error("Recipient data not found in cache for UID:", recipientUid);
                showToast("Could not load chat details. User data missing.", "danger");
                return;
            }
    
            // --- State Updates ---
            const newChatId = getChatId(state.currentUser.uid, recipientUid);
            if (!newChatId) {
                console.error("Failed to generate valid chat ID.");
                return;
            }
            state.currentChatId = newChatId;
            state.currentRecipientId = recipientUid;
            state.currentRecipientData = recipientData;
    
            // --- UI Updates ---
            displayUserList(); // Re-render list to highlight the new active chat
            displayActiveChatHeader(); // Update the main chat header
            UI.elements.emptyChatState.classList.add('hidden'); // Hide empty state
            UI.elements.chatBox.innerHTML = ''; // Clear previous chat messages
            UI.elements.messageInput.value = ''; // Clear message input
             resizeTextarea(); // Reset textarea height
            UI.elements.mediaPreviewContainer.innerHTML = ''; // Clear media previews
             state.mediaFiles = []; // Clear staged media files
    
             // Close sidebar on mobile after selecting a chat
            if(window.innerWidth <= 767.98) {
                 UI.toggleSidebar(false);
            }
    
    
            // --- Listener Updates ---
            detachListener('messages'); // Remove listener for old chat
            detachListener('typing'); // Remove listener for old chat's typing
    
            attachMessageListener(state.currentChatId); // Attach listener for new chat messages
            attachTypingListener(state.currentChatId); // Attach listener for new chat's typing
    
            // --- Mark Messages as Read ---
            // Use update instead of set to avoid overwriting other unread counts
             const unreadRef = ref(firebaseDb, `chats/${state.currentChatId}/unreadCount/${state.currentUser.uid}`);
            set(unreadRef, 0).catch(error => console.warn("Failed to mark messages as read:", error));
    
    
             // --- Focus Input ---
             UI.elements.messageInput.focus();
            // Optionally: displayMediaGallery(); // Maybe load gallery only when modal opened
         }
    
    
        // Renders the list of contacts/chats in the sidebar
        function displayUserList() {
            if (!UI.elements.contactListContainer || !state.currentUser) return;
    
            const container = UI.elements.contactListContainer;
            container.innerHTML = ''; // Clear existing list
            UI.elements.contactListSkeleton.style.display = 'none'; // Hide skeleton initially
    
            const myUid = state.currentUser.uid;
            const filteredContacts = Array.from(state.caches.contacts.values()).filter(contact => {
                // Basic filtering based on search query
                const nameMatch = !state.searchQuery || (contact.name || '').toLowerCase().includes(state.searchQuery.toLowerCase());
                // Add logic here to filter out blocked users if implemented
                // const isBlocked = state.currentUser.blockedUsers?.[contact.uid];
                // return nameMatch && !isBlocked;
                return nameMatch;
            });
    
            if (filteredContacts.length === 0 && state.searchQuery) {
                 container.innerHTML = `<div class="p-3 text-center text-muted small">No users found matching "${escapeHTML(state.searchQuery)}".</div>`;
                 return;
            } else if (state.caches.contacts.size === 0 && !state.searchQuery) {
                 // Show skeleton only if contacts haven't loaded at all yet
                if (!state.listeners.contacts) { // Check if listener is attached as a proxy for loading
                     UI.elements.contactListSkeleton.style.display = 'flex'; // Use display type of items
                 } else {
                     container.innerHTML = '<div class="p-3 text-center text-muted small">No other users found.</div>';
                 }
                 return;
            }
    
             // Sort contacts: prioritize chats with recent messages, then alphabetically
             const sortedContacts = filteredContacts.sort((a, b) => {
                const chatIdA = getChatId(myUid, a.uid);
                const chatIdB = getChatId(myUid, b.uid);
                const metaA = state.caches.chatMetadata.get(chatIdA);
                const metaB = state.caches.chatMetadata.get(chatIdB);
                const timeA = metaA?.lastMessage?.createdAt || 0;
                const timeB = metaB?.lastMessage?.createdAt || 0;
    
                if (timeB !== timeA) return timeB - timeA; // Newest messages first
                return (a.name || '').localeCompare(b.name || ''); // Then alphabetically
            });
    
            // Render sorted contacts
            sortedContacts.forEach(contact => {
                 const chatId = getChatId(myUid, contact.uid);
                 const chatMeta = state.caches.chatMetadata.get(chatId);
                 const lastMsg = chatMeta?.lastMessage || null;
                 // Read calculated unread count for *this* user
                 const unreadCount = chatMeta?.calculatedUnreadCount || 0;
                 const isOnline = state.caches.onlineUsers.get(contact.uid)?.online ?? false;
    
                 const isActive = chatId === state.currentChatId;
    
                 const li = document.createElement('div');
                 li.className = `user-list-item list-group-item list-group-item-action ${isActive ? 'active' : ''}`;
                li.dataset.uid = contact.uid;
                li.setAttribute('role', 'button'); // Make it clear it's clickable
    
                let lastMessageText = 'Start chatting...';
                if (lastMsg) {
                    if (lastMsg.text) {
                         lastMessageText = escapeHTML(lastMsg.text);
                     } else if (lastMsg.mediaType) {
                         // Prepend sender info for media messages in preview
                        const prefix = lastMsg.senderId === myUid ? "You sent a" : "";
                         lastMessageText = `${prefix} ${lastMsg.mediaType}`.trim();
                    }
                }
    
                // Limit text length
                const maxLen = 30;
                if (lastMessageText.length > maxLen) {
                    lastMessageText = lastMessageText.substring(0, maxLen) + '...';
                }
    
    
                 li.innerHTML = `
                    <div class="d-flex align-items-center w-100">
                        <div class="position-relative flex-shrink-0">
                             ${contact.photoURL
                                ? `<img src="${contact.photoURL}" class="avatar rounded-circle me-2" style="width: 40px; height: 40px; object-fit: cover;" alt="${escapeHTML(contact.name)}">`
                                 : generateAvatarHTML(contact.uid, contact.name, 'me-2')}
                            <span class="online-indicator position-absolute bottom-0 end-0 p-1 border border-light rounded-circle ${isOnline ? 'bg-success' : 'bg-secondary'}"></span>
                        </div>
                        <div class="flex-grow-1 ms-2 overflow-hidden">
                            <div class="contact-name fw-medium text-truncate">${escapeHTML(contact.name) || 'Unnamed User'}</div>
                            <div class="last-message small text-truncate">${lastMessageText}</div>
                        </div>
                        <div class="message-meta text-end ms-2 flex-shrink-0">
                            <div class="message-time small mb-1">${lastMsg?.createdAt ? formatRelativeTime(lastMsg.createdAt) : ''}</div>
                            ${unreadCount > 0 ? `<span class="unread-badge badge bg-primary rounded-pill float-end">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
                        </div>
                    </div>
                `;
    
                li.addEventListener('click', () => handleContactClick(contact.uid));
                 container.appendChild(li);
            });
        }
    
        // Displays the active chat information in the header
        function displayActiveChatHeader() {
            if (!UI.elements.activeChatHeaderInfo || !UI.elements.emptyChatHeaderInfo) return;
    
            if (state.currentRecipientData && state.currentChatId) {
                // Show active chat info
                 UI.elements.activeChatHeaderInfo.classList.remove('hidden');
                UI.elements.activeChatOptionsMenu.classList.remove('hidden');
                UI.elements.emptyChatHeaderInfo.classList.add('hidden');
    
                 const recipient = state.currentRecipientData;
                 const isOnline = state.caches.onlineUsers.get(recipient.uid)?.online ?? false;
    
                 UI.elements.activeChatName.textContent = escapeHTML(recipient.name) || 'Unnamed User';
                 UI.elements.activeChatAvatar.innerHTML = recipient.photoURL
                     ? `<img src="${recipient.photoURL}" class="img-fluid rounded-circle" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHTML(recipient.name)}">`
                     : generateAvatarHTML(recipient.uid, recipient.name);
    
                UI.elements.activeChatStatusIndicator.className = `bi bi-circle-fill me-1 text-${isOnline ? 'success' : 'secondary'} small`;
                UI.elements.activeChatStatusText.textContent = isOnline ? 'Online' : 'Offline';
    
                // Potentially update Block User button text/state here if implemented
                // UI.elements.blockUserBtn.textContent = state.currentUser.blockedUsers?.[recipient.uid] ? 'Unblock User' : 'Block User';
    
            } else {
                 // Show placeholder if no chat selected
                UI.elements.activeChatHeaderInfo.classList.add('hidden');
                UI.elements.activeChatOptionsMenu.classList.add('hidden');
                UI.elements.emptyChatHeaderInfo.classList.remove('hidden');
             }
         }
    
    
        //======================================================================
        // Message Handling
        //======================================================================
    
        // Displays a single chat message in the chat box
         function displayChatMessage({ id, data }) {
             if (!id || !data || !state.currentUser || !state.currentChatId || !UI.elements.chatBox) return;
    
             // Make sure this message belongs to the currently active chat cache
             const chatMessagesCache = state.caches.messages.get(state.currentChatId);
             if (!chatMessagesCache || !chatMessagesCache.has(id)) {
                 // Message might be from a previous chat or cache inconsistency
                 console.warn(`Attempted to display message ${id} not in active chat cache.`);
                // Optionally add it if missing: chatMessagesCache?.set(id, { id, data });
                 // return; // Or return to prevent display errors
             }
    
             const isSent = data.senderId === state.currentUser.uid;
             const senderData = isSent ? state.currentUser : state.caches.contacts.get(data.senderId);
             const senderName = isSent ? 'You' : (senderData?.name || senderData?.displayName || 'User');
    
             const messageWrapper = document.createElement('div');
             messageWrapper.className = `message-wrapper d-flex mb-3 ${isSent ? 'sent justify-content-end' : 'received justify-content-start'}`;
             messageWrapper.dataset.messageId = id;
    
            // Use placeholder if sender data isn't available yet
             const avatarHtml = senderData
                ? (senderData.photoURL ?
                      `<img src="${senderData.photoURL}" class="avatar rounded-circle" style="width: 36px; height: 36px; object-fit: cover;" alt="${escapeHTML(senderName)}">` :
                      generateAvatarHTML(data.senderId, senderName))
                : generateAvatarHTML(data.senderId, 'User'); // Placeholder if user data missing
    
            const messageContentHtml = `
                 <div class="message-content ${isSent ? 'ms-auto me-2 text-end' : 'ms-2 text-start'}">
                     <div class="message-bubble shadow-sm d-inline-block position-relative">
                        ${!isSent ? `<span class="message-sender d-block mb-1 small fw-medium">${escapeHTML(senderName)}</span>` : ''}
                        ${data.mediaURL && data.mediaType ? `<div class="media-message mb-1">${generateMediaHTML(data.mediaURL, data.mediaType, id)}</div>` : ''}
                        ${data.text ? `<p class="message-text mb-0">${escapeHTML(data.text)}</p>` : ''}
                        <span class="message-timestamp position-absolute bottom-0 end-0 p-1 small text-muted">${formatTimestamp(data.createdAt)}</span>
                     </div>
                 </div>
             `;
             // Correct order for Sent vs Received
             if (isSent) {
                messageWrapper.innerHTML = messageContentHtml + `<div class="message-avatar flex-shrink-0">${avatarHtml}</div>`;
             } else {
                messageWrapper.innerHTML = `<div class="message-avatar flex-shrink-0">${avatarHtml}</div>` + messageContentHtml;
            }
    
    
             // Replace existing element if it exists (e.g., replacing a temp message)
             const existingElement = UI.elements.chatBox.querySelector(`[data-message-id="${id}"]`);
             if (existingElement) {
                UI.elements.chatBox.replaceChild(messageWrapper, existingElement);
             } else {
                 // Append the new message
                 UI.elements.chatBox.appendChild(messageWrapper);
             }
    
    
             // Add event listener for media preview on images/videos inside message bubbles
            const mediaItem = messageWrapper.querySelector('.media-message > [data-url]');
            if (mediaItem) {
                 mediaItem.addEventListener('click', () => {
                    const url = mediaItem.dataset.url;
                    const type = mediaItem.dataset.type;
                     showMediaPreviewModal(url, type);
                 });
            }
         }
    
        // Generates HTML for media content within a message bubble
        function generateMediaHTML(url, type, messageId = '') {
            switch (type) {
                case 'image':
                    return `<img src="${url}" class="img-fluid rounded" style="max-height: 300px; max-width: 100%; cursor: pointer;" alt="Shared Image" data-url="${url}" data-type="image" data-message-id="${messageId}">`;
                case 'video':
                    // Add controls but maybe initially load without autoplay
                     return `<video src="${url}" controls class="img-fluid rounded" style="max-height: 300px; max-width: 100%; cursor: pointer;" data-url="${url}" data-type="video" data-message-id="${messageId}"></video>`;
                 case 'audio':
                     // Use the Bootstrap based styling maybe, or just standard controls
                     return `<div class="audio-player p-2 border rounded"><audio src="${url}" controls class="w-100"></audio></div>`;
                default:
                     // Generic link for unsupported types (e.g., documents if added later)
                     return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm"><i class="bi bi-file-earmark-arrow-down me-1"></i>Download File</a>`;
            }
        }
    
        // Handles sending a message (text and/or media)
        async function handleMessageSend(event) {
            event.preventDefault();
            if (!state.currentUser || !state.currentChatId || !state.currentRecipientId) {
                 showToast("Cannot send message. No active chat selected.", "warning");
                return;
            }
    
            const text = UI.elements.messageInput.value.trim();
            const filesToUpload = [...state.mediaFiles]; // Copy files to process
    
            if (!text && filesToUpload.length === 0) {
                return; // Nothing to send
            }
    
             UI.setButtonLoading(UI.elements.sendButton, true);
            UI.elements.messageInput.disabled = true; // Disable input while sending
    
            // Clear input fields and preview immediately
            UI.elements.messageInput.value = '';
             resizeTextarea();
            UI.elements.mediaPreviewContainer.innerHTML = '';
             state.mediaFiles = [];
    
             try {
                 // 1. Upload Files (if any)
                 const uploadResults = [];
                 if (filesToUpload.length > 0) {
                    console.log(`Uploading ${filesToUpload.length} file(s)...`);
                    const uploadPromises = filesToUpload.map(async (file) => {
                        const filePath = `chat_media/${state.currentChatId}/${state.currentUser.uid}/${Date.now()}_${file.name}`;
                        const fileStorageRef = storageRef(firebaseStorage, filePath);
                         console.log(`Uploading ${file.name} to ${filePath}`);
                         const uploadTask = uploadBytesResumable(fileStorageRef, file);
    
                        // Await completion
                         await uploadTask;
                         const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        return {
                            mediaURL: downloadURL,
                            mediaType: file.type.split('/')[0] || 'file', // 'image', 'video', 'audio', 'file'
                             mediaName: file.name // Store original filename (optional)
                        };
                    });
                    uploadResults.push(...await Promise.all(uploadPromises));
                    console.log("All files uploaded successfully.");
                 }
    
                // 2. Prepare Message Data(s)
                 const messagesToSend = [];
                 const timestamp = serverTimestamp(); // Use server timestamp for consistency
    
                 // If there's text OR no files, send a text message (potentially empty if only files were sent)
                 if (text || filesToUpload.length === 0) {
                    messagesToSend.push({
                         senderId: state.currentUser.uid,
                         senderDisplayName: state.currentUser.name || state.currentUser.displayName, // Use DB name first
                         recipientId: state.currentRecipientId, // Good to store recipient for queries/rules
                        text: text,
                        mediaURL: null, // No media for this specific message object
                        mediaType: null,
                        createdAt: timestamp,
                        readStatus: { [state.currentUser.uid]: true, [state.currentRecipientId]: false } // Initial read status
                     });
                }
    
                 // Create separate message objects for each uploaded file
                 uploadResults.forEach(result => {
                     messagesToSend.push({
                         senderId: state.currentUser.uid,
                         senderDisplayName: state.currentUser.name || state.currentUser.displayName,
                         recipientId: state.currentRecipientId,
                         text: '', // Empty text for media-only messages
                        mediaURL: result.mediaURL,
                        mediaType: result.mediaType,
                         mediaName: result.mediaName, // Optional: filename
                        createdAt: timestamp,
                        readStatus: { [state.currentUser.uid]: true, [state.currentRecipientId]: false }
                     });
                 });
    
                 // 3. Push messages to Realtime Database and Update Chat Metadata
                 const chatRef = ref(firebaseDb, `chats/${state.currentChatId}`);
                const messagesRef = ref(firebaseDb, `chats/${state.currentChatId}/messages`);
    
                 const updates = {};
                 // Push each message and capture the key (though not strictly needed here)
                const messagePromises = messagesToSend.map(msg => push(messagesRef, msg));
                await Promise.all(messagePromises);
                console.log(`${messagesToSend.length} message(s) pushed to DB.`);
    
    
                // Update chat metadata: last message and participants/unread count
                const lastMessageData = messagesToSend[messagesToSend.length - 1];
                 updates[`/lastMessage`] = {
                    text: lastMessageData.text || `[${lastMessageData.mediaType}]`,
                     senderId: lastMessageData.senderId,
                     createdAt: timestamp // Use the same server timestamp
                 };
                 updates[`/participants`] = [state.currentUser.uid, state.currentRecipientId]; // Ensure participants are set
                // Atomically increment unread count for the recipient
                 updates[`/unreadCount/${state.currentRecipientId}`] = increment(messagesToSend.length);
                // Ensure unread count for sender is 0 (or doesn't exist)
                 updates[`/unreadCount/${state.currentUser.uid}`] = 0;
    
    
                 await update(ref(firebaseDb), { [`/chats/${state.currentChatId}`]: updates }); // Perform batched update on the chat node
    
                console.log("Chat metadata updated.");
                scrollChatToBottom('smooth'); // Scroll down after sending
    
    
            } catch (error) {
                console.error("Message Send Failed:", error);
                showToast(`Failed to send message: ${error.message}`, "danger");
                 // Consider re-populating the input fields if sending failed? Or just show error.
             } finally {
                UI.setButtonLoading(UI.elements.sendButton, false);
                 UI.elements.messageInput.disabled = false; // Re-enable input
                // Ensure focus returns to input if appropriate
                 if (window.innerWidth > 767.98) UI.elements.messageInput.focus();
            }
        }
    
    
        // Sends typing status update to Firebase (debounced)
        const debouncedSendTypingStatus = debounce((isTyping) => {
             if (!state.currentChatId || !state.currentUser) return;
            const typingRef = ref(firebaseDb, `chats/${state.currentChatId}/typing/${state.currentUser.uid}`);
            set(typingRef, { isTyping: isTyping })
                 .catch(error => console.warn("Could not set typing status:", error));
    
            // Clear the timeout if user continues typing
             clearTimeout(state.typingTimeout);
             if (isTyping) {
                 // Set a timeout to automatically clear typing status if user stops
                 state.typingTimeout = setTimeout(() => {
                    set(typingRef, { isTyping: false })
                         .catch(error => console.warn("Could not clear typing status:", error));
                 }, CONFIG.TYPING_TIMEOUT_MS);
            }
        }, CONFIG.DEBOUNCE_TYPING_MS);
    
    
        //======================================================================
        // Media Handling (Attachments, Previews, Gallery)
        //======================================================================
    
        // Handles file input changes for media attachments
         function handleMediaInput(event, allowedTypes) {
            if (!event.target.files) return;
            const files = Array.from(event.target.files);
             const validFiles = files.filter(file => validateFile(file, allowedTypes));
    
            if (validFiles.length > 0) {
                 // Add only valid files to the state
                 state.mediaFiles.push(...validFiles);
                displayMediaPreview(); // Update the preview UI
             }
             // Reset the file input value to allow selecting the same file again
            event.target.value = '';
        }
    
    
        // Renders the preview of staged media files below the message input
        function displayMediaPreview() {
            if (!UI.elements.mediaPreviewContainer) return;
             UI.elements.mediaPreviewContainer.innerHTML = ''; // Clear previous previews
    
             state.mediaFiles.forEach((file, index) => {
                 const url = URL.createObjectURL(file); // Create temporary URL for preview
                 const isImage = file.type.startsWith('image/');
                 const isVideo = file.type.startsWith('video/');
                 const isAudio = file.type.startsWith('audio/');
    
                 const item = document.createElement('div');
                 item.className = "media-preview-item position-relative d-inline-flex align-items-center justify-content-center rounded bg-light";
                item.style.width = "70px";
                item.style.height = "70px";
                item.style.overflow = "hidden";
                 item.dataset.index = index.toString();
    
                let previewHTML = '';
                 if (isImage) {
                     previewHTML = `<img src="${url}" class="img-fluid" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHTML(file.name)} Preview">`;
                } else if (isVideo) {
                     previewHTML = `<video src="${url}" class="img-fluid" style="width: 100%; height: 100%; object-fit: cover;" title="${escapeHTML(file.name)}"></video>`;
                 } else if (isAudio) {
                     previewHTML = `<i class="bi bi-music-note-beamed fs-3 text-secondary" title="${escapeHTML(file.name)}"></i>`;
                } else { // Generic file fallback
                    previewHTML = `<i class="bi bi-file-earmark fs-3 text-secondary" title="${escapeHTML(file.name)}"></i>`;
                }
    
                 item.innerHTML = `
                    ${previewHTML}
                    <button type="button" class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center"
                            style="width: 20px; height: 20px; transform: translate(25%, -25%); line-height: 1;"
                            aria-label="Remove ${escapeHTML(file.name)}" data-remove-index="${index}">
                        <i class="bi bi-x small"></i>
                    </button>
                `;
    
                 // Add event listener to remove button
                 item.querySelector('button[data-remove-index]').addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering other events
                    const indexToRemove = parseInt(e.currentTarget.dataset.removeIndex);
                    state.mediaFiles.splice(indexToRemove, 1); // Remove from state
                     URL.revokeObjectURL(url); // Clean up blob URL
                    displayMediaPreview(); // Re-render previews
                 });
    
                UI.elements.mediaPreviewContainer.appendChild(item);
    
                 // IMPORTANT: Revoke object URLs when they are no longer needed to free up memory
                // Add cleanup logic, e.g., when the message is sent or files are cleared manually.
                 // A more robust approach might track URLs and revoke them explicitly.
                 // For simplicity here, rely on browser GC or revoke on remove click.
             });
         }
    
    
        // Fetches and displays media shared in the current chat within the media gallery modal
         async function displayMediaGallery() {
             if (!state.currentChatId || !state.currentUser) return;
             console.log("Loading media gallery for chat:", state.currentChatId);
    
            // Reset gallery content and show loading states (optional)
            const containers = [
                 UI.elements.imageGalleryContainer,
                 UI.elements.videoGalleryContainer,
                UI.elements.audioGalleryContainer
             ];
            const noMessages = [
                UI.elements.noImagesMessage,
                UI.elements.noVideosMessage,
                 UI.elements.noAudiosMessage
             ];
             containers.forEach(c => { if (c) c.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></div>'; });
             noMessages.forEach(m => m?.classList.add('d-none'));
    
            const messagesRef = ref(firebaseDb, `chats/${state.currentChatId}/messages`);
             // Query for messages that have a mediaURL property
             const mediaMessagesQuery = query(messagesRef, orderByChild('mediaURL'), startAt('https://')); // Basic query, might need adjustment
    
             try {
                 const snapshot = await get(mediaMessagesQuery);
                 const images = [], videos = [], audios = [];
    
                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                         const msgData = childSnapshot.val();
                         if (msgData.mediaURL && msgData.mediaType) {
                            const mediaItem = {
                                 id: childSnapshot.key,
                                 url: msgData.mediaURL,
                                 timestamp: msgData.createdAt,
                                name: msgData.mediaName || msgData.mediaType // Optional name
                            };
                            if (msgData.mediaType === 'image') images.push(mediaItem);
                            else if (msgData.mediaType === 'video') videos.push(mediaItem);
                            else if (msgData.mediaType === 'audio') audios.push(mediaItem);
                        }
                    });
                 }
    
                // Sort by timestamp (newest first)
                images.sort((a, b) => b.timestamp - a.timestamp);
                videos.sort((a, b) => b.timestamp - a.timestamp);
                audios.sort((a, b) => b.timestamp - a.timestamp);
    
                // Render Images
                if (UI.elements.imageGalleryContainer) {
                     UI.elements.imageGalleryContainer.innerHTML = images.length > 0 ? images.map(img => `
                        <div class="col">
                             <img src="${img.url}" class="img-fluid rounded media-gallery-item"
                                 style="cursor: pointer; object-fit: cover; aspect-ratio: 1 / 1;"
                                 loading="lazy" alt="${escapeHTML(img.name) || 'Shared Image'}"
                                 data-url="${img.url}" data-type="image">
                        </div>
                    `).join('') : '';
                    UI.elements.noImagesMessage?.classList.toggle('d-none', images.length > 0);
                 }
    
                 // Render Videos
                 if (UI.elements.videoGalleryContainer) {
                     UI.elements.videoGalleryContainer.innerHTML = videos.length > 0 ? videos.map(vid => `
                        <div class="col">
                            <div class="position-relative video-gallery-thumb rounded overflow-hidden">
                                <video src="${vid.url}" class="img-fluid media-gallery-item"
                                       style="cursor: pointer; display: block; width: 100%; object-fit: cover; aspect-ratio: 16 / 9;"
                                       preload="metadata" alt="${escapeHTML(vid.name) || 'Shared Video'} Preview"
                                       data-url="${vid.url}" data-type="video">
                                 </video>
                                <i class="bi bi-play-circle-fill position-absolute top-50 start-50 translate-middle fs-1 text-white" style="opacity: 0.8;"></i>
                            </div>
                        </div>
                     `).join('') : '';
                    UI.elements.noVideosMessage?.classList.toggle('d-none', videos.length > 0);
                 }
    
                // Render Audios
                if (UI.elements.audioGalleryContainer) {
                     UI.elements.audioGalleryContainer.innerHTML = audios.length > 0 ? audios.map(audio => `
                        <div class="list-group-item d-flex align-items-center gap-3">
                            <i class="bi bi-music-note-beamed fs-4 text-secondary"></i>
                            <div class="flex-grow-1 overflow-hidden">
                                 <div class="small text-truncate" title="${escapeHTML(audio.name) || 'Audio File'}">${escapeHTML(audio.name) || 'Audio File'}</div>
                                <audio src="${audio.url}" controls class="w-100" style="max-height: 40px;"></audio>
                                <div class="text-muted small mt-1">${formatRelativeTime(audio.timestamp)}</div>
                             </div>
                        </div>
                     `).join('') : '';
                    UI.elements.noAudiosMessage?.classList.toggle('d-none', audios.length > 0);
                 }
    
    
                 // Add common click listener for image/video previews in gallery
                UI.elements.mediaGalleryModal._element.querySelectorAll('.media-gallery-item[data-url]').forEach(item => {
                     item.removeEventListener('click', handleGalleryItemClick); // Remove previous listener if any
                     item.addEventListener('click', handleGalleryItemClick);
                 });
    
    
            } catch (error) {
                console.error("Error fetching media gallery:", error);
                 showToast("Failed to load shared media.", "danger");
                // Reset gallery to error state
                containers.forEach(c => { if (c) c.innerHTML = '<div class="col-12 text-center p-5 text-danger">Could not load media.</div>'; });
                 noMessages.forEach(m => m?.classList.remove('d-none'));
             }
        }
    
    
        // Click handler for media items within the gallery modal
         function handleGalleryItemClick(event) {
             const item = event.currentTarget;
            const url = item.dataset.url;
            const type = item.dataset.type;
            if (url && type) {
                showMediaPreviewModal(url, type);
            }
         }
    
         // Shows the large media preview modal
         function showMediaPreviewModal(url, type) {
             if (!url || !type) return;
             let contentHTML = '';
             if (type === 'image') {
                 contentHTML = `<img src="${url}" class="img-fluid" style="max-height: 85vh; object-fit: contain;" alt="Media Preview">`;
             } else if (type === 'video') {
                 contentHTML = `<video src="${url}" controls autoplay class="img-fluid" style="max-height: 85vh; max-width: 100%; object-fit: contain;"></video>`;
            } else {
                console.warn("Unsupported media type for preview modal:", type);
                 return; // Don't show modal for unsupported types
            }
            UI.elements.mediaPreviewContent.innerHTML = contentHTML;
             UI.elements.mediaPreviewModal.show();
         }
    
        //======================================================================
        // Chat Actions (Clear, Block)
        //======================================================================
    
         // Handles clearing all messages in the current chat
         async function handleClearChat() {
             if (!state.currentChatId || !state.currentUser) return;
    
            if (!confirm("Are you sure you want to permanently clear all messages in this chat? This cannot be undone.")) {
                return;
            }
             console.log(`Clearing chat: ${state.currentChatId}`);
    
             try {
                 const messagesRef = ref(firebaseDb, `chats/${state.currentChatId}/messages`);
                await remove(messagesRef);
    
                // Also clear last message metadata
                 const lastMessageRef = ref(firebaseDb, `chats/${state.currentChatId}/lastMessage`);
                await remove(lastMessageRef);
    
                // Optionally clear typing indicators for this chat if any exist
                const typingRef = ref(firebaseDb, `chats/${state.currentChatId}/typing`);
                 await remove(typingRef);
    
                // Clear local message cache for this chat
                 state.caches.messages.delete(state.currentChatId);
                 // Clear media cache if maintained separately per chat
                 state.caches.media.delete(state.currentChatId);
    
                 // Update UI
                 UI.elements.chatBox.innerHTML = '';
                 UI.elements.emptyChatState.classList.remove('hidden');
                 // Optionally update last message display in contact list immediately
                 displayUserList();
                showToast("Chat cleared successfully.", "success");
    
             } catch (error) {
                 console.error("Failed to clear chat:", error);
                showToast(`Failed to clear chat: ${error.message}`, "danger");
             }
         }
    
         // Handles blocking a user (STUB - requires implementation in DB/rules)
         async function handleBlockUser() {
            if (!state.currentRecipientId || !state.currentUser) return;
            const recipientName = escapeHTML(state.currentRecipientData?.name) || 'this user';
             // const isCurrentlyBlocked = state.currentUser.blockedUsers?.[state.currentRecipientId]; // Check local state first
    
            if (!confirm(`Are you sure you want to block ${recipientName}? You will no longer see their messages, and they won't see yours.`)) {
                 return;
             }
            console.log(`Attempting to block user: ${state.currentRecipientId}`);
    
             // --- !!! BACKEND IMPLEMENTATION REQUIRED !!! ---
             // 1. Update the current user's data in Firebase to add the recipientId to a 'blockedUsers' map/list.
             // Example: update(ref(firebaseDb, `users/${state.currentUser.uid}/blockedUsers`), { [state.currentRecipientId]: true });
             // 2. Implement Firebase Security Rules:
             //    - Prevent writing messages to chats where a participant is blocked by the sender.
             //    - Prevent reading messages from users who have blocked the reader (or vice-versa).
             //    - Prevent blocked users from appearing in contact lists/searches.
             // ---------------------------------------------
    
             try {
                // --- Example DB Update (REMOVE/REPLACE with actual implementation) ---
                 const blockedUsersRef = ref(firebaseDb, `users/${state.currentUser.uid}/blockedUsers/${state.currentRecipientId}`);
                 await set(blockedUsersRef, true); // Set block status to true
                 console.log(`User ${state.currentRecipientId} blocked in DB (client-side representation).`);
                 // --- End of Example DB Update ---
    
                // Update local state cache
                 if (!state.currentUser.blockedUsers) state.currentUser.blockedUsers = {};
                state.currentUser.blockedUsers[state.currentRecipientId] = true;
    
    
                showToast(`${recipientName} has been blocked.`, "success");
    
                // Optionally, close the current chat and update UI
                 const blockedUserId = state.currentRecipientId; // Store before resetting state
                 state.currentChatId = null;
                 state.currentRecipientId = null;
                 state.currentRecipientData = null;
                detachListener('messages');
                detachListener('typing');
                UI.elements.chatBox.innerHTML = '';
                 UI.elements.emptyChatState.classList.remove('hidden');
                 displayActiveChatHeader(); // Clear header
                 displayUserList(); // Re-render list (blocked user should ideally be filtered out)
    
                 // Maybe navigate away or hide the chat input section?
    
    
            } catch (error) {
                console.error("Failed to block user:", error);
                 showToast(`Failed to block user: ${error.message}`, "danger");
            }
        }
    
    
        //======================================================================
        // Theme Management
        //======================================================================
         function populateThemeSelector() {
             if (!UI.elements.themeSelector) return;
             UI.elements.themeSelector.innerHTML = CONFIG.THEMES.map(theme => `
                 <li><button class="dropdown-item d-flex align-items-center" data-theme="${theme.name}">
                    <i class="${theme.icon} me-2"></i>${theme.label}
                    </button></li>
             `).join('');
             // Add checkmark to current theme if possible (needs reliable way to get current theme)
         }
    
        function applyTheme(themeName) {
             if (!CONFIG.THEMES.some(t => t.name === themeName)) {
                themeName = 'light'; // Default to light if invalid
             }
            console.log("Applying theme:", themeName);
            // Remove existing theme classes
            document.body.classList.remove(...CONFIG.THEMES.map(t => `theme-${t.name}`));
            // Add the new theme class if it's not the default (light)
            if (themeName !== 'light') {
                 document.body.classList.add(`theme-${themeName}`);
            }
            localStorage.setItem('chatTheme', themeName);
            // Add checkmark to the selected theme in the dropdown (optional visual cue)
            UI.elements.themeSelector.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.theme === themeName) {
                     item.classList.add('active'); // Bootstrap 'active' class for visual selection
                 }
             });
         }
    
        function loadTheme() {
            const savedTheme = localStorage.getItem('chatTheme') || 'light';
            applyTheme(savedTheme);
        }
    
        //======================================================================
        // Emoji Picker Logic
        //======================================================================
        function populateEmojiPicker() {
            if (!UI.elements.emojiPicker) return;
             // Wrap buttons for better spacing/layout if needed
            const emojiHTML = CONFIG.EMOJI_LIST.map(emoji => `
                <button type="button" class="emoji btn btn-sm btn-link p-1" data-emoji="${emoji}" title="Insert ${emoji}">${emoji}</button>
            `).join('');
             UI.elements.emojiPicker.innerHTML = `<div class="d-flex flex-wrap p-2 justify-content-center">${emojiHTML}</div>`; // Added wrapper
    
            // Use event delegation on the picker container for efficiency
             UI.elements.emojiPicker.addEventListener('click', (event) => {
                 if (event.target.classList.contains('emoji')) {
                     const emoji = event.target.dataset.emoji;
                    // Insert emoji at current cursor position
                     const textarea = UI.elements.messageInput;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + emoji + textarea.value.substring(end);
                     // Move cursor after inserted emoji
                     textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    
                     // Close picker, focus input, resize
                    UI.elements.emojiPicker.classList.add('d-none');
                    textarea.focus();
                     resizeTextarea();
                 }
             });
        }
    
    
        //======================================================================
        // Event Binding
        //======================================================================
        function bindEventListeners() {
            console.log("Binding event listeners...");
    
            // --- Authentication Forms ---
            UI.elements.loginForm?.addEventListener('submit', handleLoginSubmit);
            UI.elements.registerForm?.addEventListener('submit', handleSignupSubmit);
            UI.elements.googleLoginBtn?.addEventListener('click', handleGoogleLogin);
            UI.elements.forgotPasswordLink?.addEventListener('click', (e) => {
                e.preventDefault();
                UI.elements.forgotPasswordModal.show();
             });
             UI.elements.forgotPasswordForm?.addEventListener('submit', handleForgotPasswordSubmit);
             // Optional: Add listener for Facebook button if implemented
             // UI.elements.facebookLoginBtn?.addEventListener('click', handleFacebookLogin);
    
    
            // --- Message Form & Input ---
            UI.elements.messageForm?.addEventListener('submit', handleMessageSend);
            // Auto-resize textarea on input
            UI.elements.messageInput?.addEventListener('input', resizeTextarea);
            // Trigger typing indicator on input (debounced)
            UI.elements.messageInput?.addEventListener('input', () => {
                debouncedSendTypingStatus(true);
            });
             // Optional: Handle pressing Enter to send (Shift+Enter for newline)
            UI.elements.messageInput?.addEventListener('keydown', (e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault(); // Prevent default newline behavior
                     handleMessageSend(new Event('submit', { cancelable: true, bubbles: true })); // Trigger form submission
                 }
            });
    
            // --- Sidebar ---
            UI.elements.sidebarToggleButton?.addEventListener('click', () => UI.toggleSidebar());
             UI.elements.searchContactsInput?.addEventListener('input', debounce((e) => {
                state.searchQuery = e.target.value.trim();
                displayUserList();
            }, CONFIG.DEBOUNCE_SEARCH_MS));
             UI.elements.logoutBtn?.addEventListener('click', handleLogout);
    
    
            // --- Modals ---
            // Populate profile modal when shown
             UI.elements.profileModal._element?.addEventListener('show.bs.modal', populateProfileModal);
             // Handle profile save button click
             UI.elements.saveProfileBtn?.addEventListener('click', handleProfileUpdate);
             // Profile picture change triggers file input click
             UI.elements.editProfilePic?.closest('.position-relative')?.querySelector('label')?.addEventListener('click', (e) => {
                 // Check if the click is specifically on the label itself
                if (e.target.tagName === 'LABEL' || e.target.closest('label')) {
                     UI.elements.updateProfilePictureInput.click();
                }
             });
            UI.elements.updateProfilePictureInput?.addEventListener('change', populateProfileModal); // Re-render preview on change? Maybe handle in handleProfileUpdate better.
    
            // Populate media gallery when shown
             UI.elements.mediaGalleryModal._element?.addEventListener('show.bs.modal', displayMediaGallery);
    
             // Close Media Preview modal when hidden
             UI.elements.mediaPreviewModal._element?.addEventListener('hidden.bs.modal', () => {
                 // Stop video/audio playback if playing
                 const mediaElement = UI.elements.mediaPreviewContent.querySelector('video, audio');
                 if (mediaElement) {
                    mediaElement.pause();
                    mediaElement.src = ''; // Remove source to free resources
                }
                 UI.elements.mediaPreviewContent.innerHTML = ''; // Clear content
             });
    
    
            // --- Attachments & Emoji Picker ---
            UI.elements.attachImageVideoBtn?.addEventListener('click', () => UI.elements.imageVideoInput?.click());
            UI.elements.attachAudioBtn?.addEventListener('click', () => UI.elements.audioInput?.click());
    
            // Handle file input for different types
             UI.elements.imageVideoInput?.addEventListener('change', (e) => handleMediaInput(e, [...CONFIG.ALLOWED_IMAGE_TYPES, ...CONFIG.ALLOWED_VIDEO_TYPES]));
            UI.elements.audioInput?.addEventListener('change', (e) => handleMediaInput(e, CONFIG.ALLOWED_AUDIO_TYPES));
    
             // Toggle emoji picker
             UI.elements.emojiBtn?.addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent body click listener from closing it immediately
                 UI.elements.emojiPicker.classList.toggle('d-none');
                 if (!UI.elements.emojiPicker.classList.contains('d-none')) {
                    // Maybe focus first emoji or a search input if added later?
                 }
            });
    
             // Close emoji picker if clicked outside
             document.addEventListener('click', (e) => {
                if (!UI.elements.emojiPicker?.classList.contains('d-none') &&
                     !UI.elements.emojiPicker.contains(e.target) &&
                     !UI.elements.emojiBtn.contains(e.target)) {
                     UI.elements.emojiPicker.classList.add('d-none');
                 }
            });
    
    
            // --- Theme Selector ---
             UI.elements.themeSelector?.addEventListener('click', e => {
                const themeButton = e.target.closest('.dropdown-item[data-theme]');
                 if (themeButton) {
                     const theme = themeButton.dataset.theme;
                     applyTheme(theme);
                }
             });
    
            // --- Chat Actions Dropdown ---
            UI.elements.clearChatBtn?.addEventListener('click', (e) => {
                 e.preventDefault();
                 handleClearChat();
            });
            UI.elements.blockUserBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                 handleBlockUser();
            });
    
    
            // --- Responsive Sidebar Closing ---
             // Close sidebar if clicking on the main chat area on mobile
             UI.elements.chatMain?.addEventListener('click', () => {
                if (window.innerWidth <= 767.98 && UI.elements.userSidebar?.classList.contains('active')) {
                     UI.toggleSidebar(false);
                 }
             });
    
    
            console.log("Event listeners bound.");
        }
    
        //======================================================================
        // Initialization Function
        //======================================================================
         function initializeApp() {
             console.log("Initializing Graphite Chat App...");
             UI.showLoadingOverlay(true); // Show loading overlay at the very start
    
            try {
                // Setup UI elements that don't depend on Firebase data
                populateThemeSelector();
                populateEmojiPicker();
                 loadTheme();
                 bindEventListeners(); // Bind handlers to UI elements
    
                // Initialize Firebase (this attaches the critical auth listener)
                initializeFirebase();
    
                console.log("App initialization sequence started.");
                // Further setup happens within handleAuthStateChanged based on login status
    
            } catch (error) {
                console.error("Catastrophic Initialization Error:", error);
                 // UI should already show loading overlay permanently from initializeFirebase error
                // Optionally display a permanent error message on the page itself
                 document.body.innerHTML = `<div class="vh-100 d-flex justify-content-center align-items-center text-danger">
                                               <h2>Application failed to initialize. Please refresh or contact support.</h2>
                                            </div>`;
            }
         }
    
    
        //======================================================================
        // Start the Application when the DOM is ready
        //======================================================================
        document.addEventListener('DOMContentLoaded', initializeApp);
    
    })(); // End of IIFE
