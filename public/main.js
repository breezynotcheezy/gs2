const fileEl = document.getElementById('file');
const segModeEl = document.getElementById('segMode');
const modelEl = document.getElementById('model');
const timeoutEl = document.getElementById('timeout');
const verboseEl = document.getElementById('verbose');
const runBtn = document.getElementById('run');
const textEl = document.getElementById('text');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

runBtn.addEventListener('click', async () => {
  try {
    setStatus('Reading file/text...');
    let text = textEl.value.trim();
    if (fileEl.files && fileEl.files[0]) {
      const buf = await fileEl.files[0].arrayBuffer();
      text = new TextDecoder().decode(buf);
    }
    if (!text) {
      alert('Please choose a file or paste text.');
      return;
    }
    setStatus('Submitting to server...');
    runBtn.disabled = true;

    const body = {
      text,
      segMode: segModeEl.value,
      model: modelEl.value,
      timeoutMs: Number(timeoutEl.value || '45000'),
      verbose: verboseEl.checked,
    };
    const resp = await fetch('/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok || data?.ok === false) {
      setStatus('Error');
      outputEl.textContent = JSON.stringify(data, null, 2);
      return;
    }
    setStatus('Done');
    outputEl.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    setStatus('Error');
    outputEl.textContent = String(e?.message || e);
  } finally {
    runBtn.disabled = false;
  }
});
