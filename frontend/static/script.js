// Add these functions at the beginning of script.js
function showTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    indicator.classList.add('visible');
}

function hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    indicator.classList.remove('visible');
}

function scrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Handle input submission
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input and show typing indicator
    input.value = '';
    input.focus();
    showTypingIndicator();
    
    try {
        // Add message to UI immediately
        addMessageToUI('user', message);
        scrollToBottom();
        
        // Send to backend and get response
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        hideTypingIndicator();
        
        // Add assistant response to UI
        addMessageToUI('assistant', data.response);
        scrollToBottom();
        
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        // Show error message to user
        showError('Failed to send message. Please try again.');
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

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

const micBtn = document.getElementById("mic-btn");
const inputField = document.getElementById("input-field");

micBtn.addEventListener("click", () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';  // You can set this dynamically based on the selected language
    recognition.start();

    recognition.onresult = function(event) {
        const speechToText = event.results[0][0].transcript;
        inputField.value = speechToText;  // Put the speech result into the input field
    };
});

const loadingSpinner = document.getElementById("loading-spinner");

document.getElementById("submit-btn").addEventListener("click", function() {
    loadingSpinner.style.display = "block"; // Show spinner
    const userMessage = document.getElementById("input-field").value;
    if (userMessage.trim() === "") return;

    // Display user's message
    const chatWindow = document.getElementById("chat-window");
    const userMessageDiv = document.createElement("div");
    userMessageDiv.classList.add("message", "user");
    userMessageDiv.innerHTML = `
        <div class="message-bubble">${userMessage}</div>
        <div class="message-info">
            <div class="timestamp">Just now</div>
        </div>
    `;
    chatWindow.appendChild(userMessageDiv);

    // Clear input field
    document.getElementById("input-field").value = "";

    // Simulate assistant response
    setTimeout(() => {
        const assistantMessageDiv = document.createElement("div");
        assistantMessageDiv.classList.add("message", "assistant");
        assistantMessageDiv.innerHTML = `
            <div class="avatar">
                <img src="/static/assistant-avatar.jpg" alt="Assistant Avatar">
            </div>
            <div class="message-bubble">I'm sorry, I can't answer that right now.</div>
            <div class="message-info">
                <div class="timestamp">Now</div>
            </div>
        `;
        chatWindow.appendChild(assistantMessageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;  // Scroll to the latest message
        loadingSpinner.style.display = "none"; // Hide spinner after response
    }, 1000);  // Simulating a delay before the assistant replies
});

// Update script.js to show/hide the typing indicator
const typingIndicator = document.getElementById("typing-indicator");

setTimeout(() => {
    typingIndicator.style.display = "block"; // Show typing indicator
    setTimeout(() => {
        typingIndicator.style.display = "none"; // Hide after response
    }, 1000);
}, 500);

// Settings Modal
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeModal = document.querySelector(".close-modal");
const darkModeToggle = document.getElementById("dark-mode-toggle");

// Load saved settings
const darkMode = localStorage.getItem("darkMode") === "true";
darkModeToggle.checked = darkMode;
if (darkMode) {
    document.body.classList.add("dark-mode");
}

// Settings button click handler
settingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "block";
});

// Close modal when clicking the X
closeModal.addEventListener("click", () => {
    settingsModal.style.display = "none";
});

// Close modal when clicking outside
window.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
        settingsModal.style.display = "none";
    }
});

// Dark mode toggle handler
darkModeToggle.addEventListener("change", () => {
    if (darkModeToggle.checked) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("darkMode", "true");
    } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("darkMode", "false");
    }
});

// Language selection handler
const speechLanguageSelect = document.getElementById("speech-language");
speechLanguageSelect.addEventListener("change", () => {
    localStorage.setItem("speechLanguage", speechLanguageSelect.value);
});

// Load saved language preference
const savedLanguage = localStorage.getItem("speechLanguage");
if (savedLanguage) {
    speechLanguageSelect.value = savedLanguage;
}

// Add event listener for the send button
document.getElementById("send-btn").addEventListener("click", () => {
    sendMessage();
});
