// Your Gmail OAuth Client ID
const CLIENT_ID = 'iapnopmnpfflldjoheiphodijdpjodli.apps.googleusercontent.com';

// Scopes tell Google what your extension is allowed to access
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// This function handles logging the user in
function authenticate() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ 
      interactive: true,
      scopes: [SCOPES]
    }, function(token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      // Save the token to storage so we can use it later
      chrome.storage.local.set({ authToken: token });
      resolve(token);
    });
  });
}

// This function fetches emails from Gmail API
// Step 1: Get list of message IDs
function fetchEmails(token) {
  return fetch(
    'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread', {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(response => response.json())
  .then(data => {
    if (!data.messages) return [];
    // Step 2: Fetch details for each message
    return fetchEmailDetails(token, data.messages);
  });
}

// Step 2: Get actual content for each email
function fetchEmailDetails(token, messages) {
  const requests = messages.map(message => {
    return fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    .then(response => response.json())
    .then(email => {
      // Pull out the headers we need
      const headers = email.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      return {
        id: email.id,
        from: from,
        subject: subject,
        date: formatDate(date),
        unread: email.labelIds?.includes('UNREAD')
      };
    });
  });

  // Run all requests at the same time instead of one by one
  return Promise.all(requests);
}

// Make dates readable
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return date.toLocaleTimeString([], { 
    hour: '2-digit', minute: '2-digit' 
  });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_EMAILS') {
    // First check if we already have a token saved
    chrome.storage.local.get(['authToken'], function(result) {
      if (result.authToken) {
        // We have a token, fetch emails
        fetchEmails(result.authToken)
          .then(data => sendResponse({ success: true, data: data }))
          .catch(err => sendResponse({ success: false, error: err }));
      } else {
        // No token, authenticate first
        authenticate()
          .then(token => fetchEmails(token))
          .then(data => sendResponse({ success: true, data: data }))
          .catch(err => sendResponse({ success: false, error: err }));
      }
    });
    // This tells Chrome to wait for our async response
    return true;
  }
});