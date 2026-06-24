// ============================================================
// Inbox Focus — background.js (service worker)
// Handles authentication and Gmail API calls.
// ============================================================

const CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

// ---- Login: get a token from Google ----
function authenticate() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({
      interactive: true,
      scopes: [SCOPES]
    }, function (token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      chrome.storage.local.set({ authToken: token });
      resolve(token);
    });
  });
}

// ---- Step 1: get a list of message IDs ----
function fetchEmails(token) {
  return fetch(
    'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      if (!data.messages) return [];
      return fetchEmailDetails(token, data.messages);
    });
}

// ---- Step 2: get details for each message ----
function fetchEmailDetails(token, messages) {
  const requests = messages.map(message => {
    return fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(response => response.json())
      .then(email => {
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
  return Promise.all(requests);
}

// ---- Make dates human readable ----
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---- Listen for messages from content.js ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_EMAILS') {
    chrome.storage.local.get(['authToken'], function (result) {
      if (result.authToken) {
        fetchEmails(result.authToken)
          .then(data => sendResponse({ success: true, data: { messages: data } }))
          .catch(err => {
            // Token may be stale — clear it and try a fresh login
            chrome.storage.local.remove('authToken');
            authenticate()
              .then(token => fetchEmails(token))
              .then(data => sendResponse({ success: true, data: { messages: data } }))
              .catch(e => sendResponse({ success: false, error: String(e) }));
          });
      } else {
        authenticate()
          .then(token => fetchEmails(token))
          .then(data => sendResponse({ success: true, data: { messages: data } }))
          .catch(err => sendResponse({ success: false, error: String(err) }));
      }
    });
    return true; // keep the channel open for the async response
  }
});