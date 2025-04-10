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
            // You would typically make an API call to clear the conversation on the server
            // For now, just clear the UI
            const chatWindow = document.getElementById("chat-window");
            // Keep only the welcome message
            const welcomeMessage = document.querySelector(".welcome-message");
            chatWindow.innerHTML = '';
            if (welcomeMessage) {
                chatWindow.appendChild(welcomeMessage);
            }
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