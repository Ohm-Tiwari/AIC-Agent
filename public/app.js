const chatWindow = document.getElementById('chat-window');
const input = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let sessionId = null;

function addMessage(role) {
  const div = document.createElement('div');
  div.classList.add('message', role);
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

async function sendMessage(text) {
  const message = (text ?? input.value).trim();
  if (!message) return;

  input.value = '';
  sendBtn.disabled = true;

  document.getElementById('suggestions')?.remove();

  const userDiv = addMessage('user');
  userDiv.textContent = message;

  const thinkingDiv = addMessage('thinking');
  thinkingDiv.textContent = 'Searching the collection...';

  let agentDiv = null;
  let fullText = '';

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });

    if (!res.ok) {
      thinkingDiv.remove();
      addMessage('agent').textContent = 'Something went wrong. Please try again.';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let event;
        try { event = JSON.parse(line.slice(6)); } catch { continue; }

        if (event.type === 'session') {
          sessionId = event.sessionId;
        } else if (event.type === 'chunk') {
          if (!agentDiv) {
            thinkingDiv.remove();
            agentDiv = addMessage('agent');
          }
          fullText += event.text;
          agentDiv.innerHTML = marked.parse(fullText);
          chatWindow.scrollTop = chatWindow.scrollHeight;
        } else if (event.type === 'done') {
          if (!agentDiv) {
            thinkingDiv.remove();
            addMessage('agent').textContent = 'No response received. Please try again.';
          }
        } else if (event.type === 'error') {
          thinkingDiv.remove();
          addMessage('agent').textContent = 'Something went wrong. Please try again.';
        }
      }
    }
  } catch {
    thinkingDiv.remove();
    addMessage('agent').textContent = 'Something went wrong. Is the server running?';
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener('click', () => sendMessage());
input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

document.querySelectorAll('.suggestion').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
});
