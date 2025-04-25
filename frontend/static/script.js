// Utility functions
function showTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    indicator.style.display = 'block';
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    indicator.style.display = 'none';
}

function scrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Handle input submission with Enter key
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processInput();
    }
});

// Add event listener for the send button
document.getElementById('send-btn').addEventListener('click', () => {
    processInput();
});

async function processInput() {
    const input = document.getElementById('user-input');
    const query = input.value.trim();

    if (!query) return;

    // Clear input and show typing indicator
    input.value = '';
    input.focus();
    showTypingIndicator();

    try {
        // Add user query to UI immediately
        addMessageToUI('user', query);
        scrollToBottom();

        // Send query to backend and get response
        const response = await fetch('/process_input', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        hideTypingIndicator();

        if (data.error) {
            addMessageToUI('assistant', `Error: ${data.error}`);
        } else {
            // Add assistant response to UI
            addMessageToUI('assistant', data.response);

            // Display relevant rows if available
            if (data.rows && data.rows.length > 0) {
                const rowsMessage = formatRowsForDisplay(data.rows);
                addMessageToUI('assistant', rowsMessage);
            }
        }

        scrollToBottom();
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        showError('Failed to process input. Please try again.');
    }
}

function addMessageToUI(sender, message) {
    const chatWindow = document.getElementById('chat-window');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        ${sender === 'assistant' ? `
            <div class="avatar">
                <img src="/static/assistant-avatar.jpg" alt="Assistant">
            </div>
        ` : ''}
        <div class="message-content">
            <div class="message-bubble">${message}</div>
            <div class="message-info">
                <span class="timestamp">${time}</span>
            </div>
        </div>
    `;

    chatWindow.appendChild(messageDiv);
}

function formatRowsForDisplay(rows) {
    return rows.map((row, index) => {
        return `Row ${index + 1}: ${JSON.stringify(row)}`;
    }).join('<br>');
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// Speech recognition functionality
const micBtn = document.getElementById("mic-btn");
if (micBtn) {
    micBtn.addEventListener("click", () => {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.lang = document.getElementById("speech-language")?.value || 'en-US';
            recognition.start();

            recognition.onresult = function(event) {
                const speechToText = event.results[0][0].transcript;
                document.getElementById("user-input").value = speechToText;
            };
        } else {
            showError("Speech recognition not supported in your browser");
        }
    });
}

// Settings Modal
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeModal = document.querySelector(".close-modal");
const darkModeToggle = document.getElementById("dark-mode-toggle");

// Load saved settings
const darkMode = localStorage.getItem("darkMode") === "true";
if (darkModeToggle) {
    darkModeToggle.checked = darkMode;
    if (darkMode) {
        document.body.classList.add("dark-mode");
    }
}

// Settings button click handler
if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
        settingsModal.style.display = "block";
    });
}

// Close modal when clicking the X
if (closeModal) {
    closeModal.addEventListener("click", () => {
        settingsModal.style.display = "none";
    });
}

// Close modal when clicking outside
window.addEventListener("click", (event) => {
    if (settingsModal && event.target === settingsModal) {
        settingsModal.style.display = "none";
    }
});

// Dark mode toggle handler
if (darkModeToggle) {
    darkModeToggle.addEventListener("change", () => {
        if (darkModeToggle.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("darkMode", "true");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("darkMode", "false");
        }
    });
}

// Language selection handler
const speechLanguageSelect = document.getElementById("speech-language");
if (speechLanguageSelect) {
    speechLanguageSelect.addEventListener("change", () => {
        localStorage.setItem("speechLanguage", speechLanguageSelect.value);
    });

    // Load saved language preference
    const savedLanguage = localStorage.getItem("speechLanguage");
    if (savedLanguage) {
        speechLanguageSelect.value = savedLanguage;
    }
}

// Clear conversation handler
const clearBtn = document.getElementById("clear-btn");
if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to clear this conversation?")) {
            try {
                const response = await fetch('/clear_chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) throw new Error('Network response was not ok');

                const data = await response.json();
                
                if (data.status === "success") {
                    // Clear the UI
                    const chatWindow = document.getElementById("chat-window");
                    chatWindow.innerHTML = '';
                    
                    // Add welcome message back with the user's name
                    const welcomeDiv = document.createElement('div');
                    welcomeDiv.className = 'welcome-message';
                    const userName = document.querySelector('.header-left h1')?.textContent || 'User';
                    welcomeDiv.innerHTML = `
                        <h2>Welcome! 👋</h2>
                        <p>How can I help you today?</p>
                    `;
                    chatWindow.appendChild(welcomeDiv);
                } else {
                    showError(data.error || "Failed to clear conversation");
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Failed to clear conversation. Please try again.');
            }
        }
    });
}

// New conversation handler
const newConversationBtn = document.getElementById("new-conversation-btn");
if (newConversationBtn) {
    newConversationBtn.addEventListener("click", async () => {
        try {
            const response = await fetch('/new_conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            
            if (data.status === "success") {
                // Redirect to the chatbot page with the new session
                window.location.href = data.redirect;
            } else {
                showError("Failed to start new conversation");
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Failed to start new conversation. Please try again.');
        }
    });
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    scrollToBottom();

    // If there's a welcome message but no chat history, show it
    const chatWindow = document.getElementById('chat-window');
    const messages = chatWindow.querySelectorAll('.message');
    const welcomeMessage = chatWindow.querySelector('.welcome-message');

    if (messages.length > 0 && welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
});

// Add these functions after the existing code

// Conversation sidebar functionality
const conversationsBtn = document.getElementById("conversations-btn");
const conversationsSidebar = document.getElementById("conversations-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar-btn");
const conversationsList = document.getElementById("conversations-list");
const sidebarNewConversationBtn = document.getElementById("sidebar-new-conversation-btn");

// Toggle sidebar visibility
if (conversationsBtn) {
    conversationsBtn.addEventListener("click", () => {
        conversationsSidebar.classList.add("active");
        createSidebarOverlay();
        loadConversations();
    });
}

// Close sidebar
if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", () => {
        conversationsSidebar.classList.remove("active");
        removeSidebarOverlay();
    });
}

// New conversation button in sidebar
if (sidebarNewConversationBtn) {
    sidebarNewConversationBtn.addEventListener("click", async () => {
        // Reuse the same functionality as the header new conversation button
        if (newConversationBtn) {
            conversationsSidebar.classList.remove("active");
            removeSidebarOverlay();
            // Trigger the same click handler
            newConversationBtn.click();
        }
    });
}

// Create overlay when sidebar is open
function createSidebarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    overlay.style.display = 'block';
    
    // Close sidebar when clicking outside
    overlay.addEventListener('click', () => {
        conversationsSidebar.classList.remove("active");
        removeSidebarOverlay();
    });
    
    document.body.appendChild(overlay);
}

// Remove overlay when sidebar is closed
function removeSidebarOverlay() {
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Load conversations from the server
async function loadConversations() {
    try {
        conversationsList.innerHTML = '<div class="loading-spinner">Loading conversations...</div>';
        
        const response = await fetch('/get_conversations', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        
        if (data.status === "success") {
            displayConversations(data.conversations);
        } else {
            conversationsList.innerHTML = '<div class="error">Failed to load conversations</div>';
        }
    } catch (error) {
        console.error('Error:', error);
        conversationsList.innerHTML = '<div class="error">Failed to load conversations</div>';
    }
}

// Display conversations in the sidebar
function displayConversations(conversations) {
    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="no-conversations">No conversations yet</div>';
        return;
    }
    
    conversationsList.innerHTML = '';
    
    conversations.forEach(conversation => {
        const conversationItem = document.createElement('div');
        conversationItem.className = `conversation-item ${conversation.is_current ? 'active' : ''}`;
        conversationItem.setAttribute('data-id', conversation.id);
        
        const date = new Date(conversation.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + 
                              date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        conversationItem.innerHTML = `
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-timestamp">${formattedDate}</div>
        `;
        
        conversationItem.addEventListener('click', () => switchConversation(conversation.id));
        
        conversationsList.appendChild(conversationItem);
    });
}

// Switch to another conversation
async function switchConversation(conversationId) {
    try {
        const response = await fetch(`/switch_conversation/${conversationId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        
        if (data.status === "success") {
            // Reload the page to display the switched conversation
            window.location.href = data.redirect;
        } else {
            showError("Failed to switch conversation");
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to switch conversation. Please try again.');
    }
}