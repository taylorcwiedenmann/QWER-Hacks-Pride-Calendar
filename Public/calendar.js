const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

// Send message when button clicked
chatSend.addEventListener('click', handleSendMessage);

// Send message when Enter key pressed
chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
    }
});

async function handleSendMessage() {
    const message = chatInput.value.trim();
    
    // Don't send if empty
    if (!message) {
        return;
    }

    // Display user message
    addMessageToChat('You', message, 'user');
    
    // Clear input
    chatInput.value = '';
    
    // Disable input while processing
    chatInput.disabled = true;
    chatSend.disabled = true;
    
    // Show loading indicator
    addMessageToChat('Assistant', 'Thinking...', 'assistant loading');
    
    try {
        // Call AI API
        const response = await fetch('/api/assistant/recommend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();

        // Remove loading message
        removeLastMessage();

        if (!data.ok) {
            addMessageToChat('Assistant', `Error: ${data.error}`, 'assistant error');
            return;
        }

        // Handle different response types
        if (data.type === 'chat') {
            // Casual conversation response
            addMessageToChat('Assistant', data.message, 'assistant');
        } else if (data.type === 'declined') {
            // Polite decline for out-of-scope requests
            addMessageToChat('Assistant', data.message, 'assistant');
        } else if (data.type === 'recommendations') {
            // Event recommendations
            displayRecommendations(data.recommendations);
        } else {
            // Fallback for backward compatibility
            displayRecommendations(data.recommendations);
        }

    } catch (error) {
        console.error('AI error:', error);
        removeLastMessage();
        addMessageToChat('Assistant', 'Sorry, something went wrong. Please try again.', 'assistant error');
    } finally {
        // Re-enable input
        chatInput.disabled = false;
        chatSend.disabled = false;
        chatInput.focus();
    }
}

function addMessageToChat(sender, text, className = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${className}`;
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatLog.appendChild(messageDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function removeLastMessage() {
    const messages = chatLog.querySelectorAll('.chat-message');
    if (messages.length > 0) {
        messages[messages.length - 1].remove();
    }
}

function displayRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        addMessageToChat('Assistant', "I couldn't find any events matching your request.", 'assistant');
        return;
    }

    let html = '<strong>Assistant:</strong> Here are my recommendations:<br><br>';
    
    recommendations.forEach((rec, index) => {
        html += `
            <div style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                <strong>${index + 1}. ${rec.name}</strong><br>
                📅 ${rec.date} at ${rec.start_time}<br>
                ${rec.location ? `📍 ${rec.location}<br>` : ''}
                💡 ${rec.reason}
            </div>
        `;
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';
    messageDiv.innerHTML = html;
    chatLog.appendChild(messageDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
}