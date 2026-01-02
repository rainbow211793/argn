let allMedia = [];
let currentView = 'grid'; // grid or detail

// Helpers for YouTube detection and embedding
function isYouTubeUrl(url) {
  return /(?:youtube\.com\/watch\?|youtu\.be\/|youtube\.com\/shorts\/)/i.test(url);
}

function getYouTubeID(url) {
  if (!url) return null;
  const patterns = [
    /[?&]v=([^&#]+)/, // youtube.com/watch?v=
    /youtu\.be\/([^?&#]+)/, // youtu.be/ID
    /youtube\.com\/shorts\/([^?&#]+)/ // youtube shorts
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function getYouTubeEmbedUrl(id) {
  // include modest branding and JS API enable for better control
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1`;
}

function getYouTubeThumbnail(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

// --- Faster download helpers ---
// Try a HEAD request to determine support for range requests and file size
async function probeUrl(url) {
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    if (!resp.ok) return { acceptRanges: false };
    const accept = resp.headers.get('accept-ranges');
    const length = parseInt(resp.headers.get('content-length') || '0', 10) || null;
    const type = resp.headers.get('content-type') || '';
    return { acceptRanges: !!accept && accept !== 'none', length, type };
  } catch (e) {
    return { acceptRanges: false };
  }
}

// Parallel range downloader. Falls back to single fetch if ranges unsupported.
async function chunkedDownload(url, filename, { onProgress = () => {}, signal = null, concurrency = 4 } = {}) {
  const probe = await probeUrl(url);
  if (!probe.length || !probe.acceptRanges) {
    // fallback to simple streaming fetch
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error('Download failed');
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(received, probe.length || 0);
    }
    const blob = new Blob(chunks, { type: resp.headers.get('content-type') || probe.type || 'application/octet-stream' });
    triggerDownload(blob, filename);
    return;
  }

  const total = probe.length;
  const partSize = Math.ceil(total / concurrency);
  const parts = [];
  let loaded = 0;

  // perform parallel range requests
  const fetchPart = async (start, end, index) => {
    const headers = { Range: `bytes=${start}-${end}` };
    const resp = await fetch(url, { headers, signal });
    if (!resp.ok && resp.status !== 206) throw new Error('Range request failed');
    const buffer = await resp.arrayBuffer();
    loaded += buffer.byteLength;
    onProgress(loaded, total);
    parts[index] = buffer;
  };

  const tasks = [];
  for (let i = 0; i < concurrency; i++) {
    const start = i * partSize;
    const end = Math.min((i + 1) * partSize - 1, total - 1);
    if (start > end) break;
    tasks.push(fetchPart(start, end, i));
  }

  await Promise.all(tasks);

  // combine parts
  const combined = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    const chunk = new Uint8Array(parts[i]);
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const blob = new Blob([combined], { type: probe.type || 'application/octet-stream' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/');
    const name = path[path.length - 1] || 'file';
    return decodeURIComponent(name);
  } catch (e) {
    return 'download';
  }
}
// --- end faster download helpers ---

// Load media from JSON
async function loadMedia() {
  try {
    const response = await fetch('./media.json');
    const data = await response.json();
    allMedia = data.media;
    displayMedia(allMedia);
  } catch (error) {
    console.error('Error loading media:', error);
  }
}

// Pause all audio/video elements. If `except` is provided, don't pause that element.
function pauseAllMedia(except = null) {
  document.querySelectorAll('video, audio').forEach(el => {
    if (el !== except) {
      try { el.pause(); } catch (e) {}
      try { el.currentTime = 0; } catch (e) {}
    }
  });
}

// Stop all YouTube iframes by clearing their `src` (useful for embedded YouTube players)
function stopAllIframes() {
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      if ((iframe.src || '').includes('youtube.com')) {
        iframe.src = '';
      }
    } catch (e) {}
  });
}

// Display media in grid
function displayMedia(mediaList) {
  const container = document.getElementById('mediaContainer');
  container.innerHTML = '';
  
  if (mediaList.length === 0) {
    container.innerHTML = '<p class="no-results">No media found</p>';
    return;
  }
  
  mediaList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';
    
    let preview = '';
    if (item.type === 'image') {
      preview = `<img src="${item.link}" alt="${item.title}" class="media-preview">`;
    } else if (item.type === 'video') {
      if (isYouTubeUrl(item.link)) {
        const id = getYouTubeID(item.link);
        const thumb = id ? getYouTubeThumbnail(id) : '';
        preview = `
          <div class="youtube-card">
            <img src="${thumb}" alt="${item.title}" class="media-preview">
            <div class="play-badge">▶</div>
          </div>
        `;
      } else {
        preview = `<video class="media-preview" controls><source src="${item.link}"></video>`;
      }
    } else if (item.type === 'gif') {
      preview = `<img src="${item.link}" alt="${item.title}" class="media-preview">`;
    } else {
      preview = `<div class="file-icon">📄</div>`;
    }
    
    card.innerHTML = `
      ${preview}
      <div class="card-info">
        <h3>${item.title}</h3>
        <p class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</p>
      </div>
    `;
    
    card.addEventListener('click', () => showMediaDetail(item));
    container.appendChild(card);

    // if the preview contains a native video element, add listeners to pause others when it plays
    const vid = card.querySelector('video');
    if (vid) {
      vid.addEventListener('play', () => pauseAllMedia(vid));
    }
  });
}

// Show detailed view of media
function showMediaDetail(item) {
  const detail = document.getElementById('mediaDetail');
  const container = document.getElementById('mediaContainer');
  
  let preview = '';
  if (item.type === 'image') {
    preview = `<img src="${item.link}" alt="${item.title}" class="detail-preview">`;
  } else if (item.type === 'video') {
    if (isYouTubeUrl(item.link)) {
      const id = getYouTubeID(item.link);
      const embed = id ? getYouTubeEmbedUrl(id) : item.link;
      // clear any other playing media before embedding a new YouTube iframe
      pauseAllMedia();
      stopAllIframes();
      preview = `<iframe class="detail-preview" src="${embed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      preview = `<video class="detail-preview" controls><source src="${item.link}"></video>`;
    }
  } else if (item.type === 'gif') {
    preview = `<img src="${item.link}" alt="${item.title}" class="detail-preview">`;
  } else {
    preview = `<div class="file-icon-large">📄</div>`;
  }
  
  // download or open-on-youtube button. For YouTube we offer both open and a third-party download link.
  let downloadHtml = '';
  if (isYouTubeUrl(item.link)) {
    const id = getYouTubeID(item.link);
    const downloadLink = id ? `https://ssyoutube.com/watch?v=${id}` : item.link;
    downloadHtml = `
      <a href="${item.link}" class="download-btn" target="_blank" rel="noopener noreferrer">Open on YouTube</a>
      <a href="${downloadLink}" class="download-btn" target="_blank" rel="noopener noreferrer">Download (third-party)</a>
    `;
  } else {
    const fname = filenameFromUrl(item.link);
    downloadHtml = `
      <button id="fastDownloadBtn" class="download-btn">Fast Download</button>
      <a href="${item.link}" class="download-btn" download>Download</a>
      <div id="downloadProgress" class="download-progress hidden">
        <progress id="downloadProgressBar" value="0" max="1"></progress>
        <span id="downloadProgressText"></span>
        <button id="cancelDownloadBtn" class="download-btn">Cancel</button>
      </div>
    `;
  }

  detail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="backToGrid()">← Back</button>
      ${downloadHtml}
    </div>
    <div class="detail-content">
      ${preview}
      <div class="detail-info">
        <h2>${item.title}</h2>
        <p class="description">${item.description}</p>
        <div class="tags-section">
          <strong>Tags:</strong>
          <p class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</p>
        </div>
        <div class="credits-section">
          <p><strong>Credits:</strong> ${item.credits}</p>
          <p><strong>Submitted by:</strong> ${item.submitted_by}</p>
        </div>
      </div>
    </div>
  `;
  
  container.classList.add('hidden');
  detail.classList.remove('hidden');

  // Wire up fast download UI (if present)
  const fastBtn = detail.querySelector('#fastDownloadBtn');
  if (fastBtn) {
    const progressWrap = detail.querySelector('#downloadProgress');
    const progressBar = detail.querySelector('#downloadProgressBar');
    const progressText = detail.querySelector('#downloadProgressText');
    const cancelBtn = detail.querySelector('#cancelDownloadBtn');
    let controller = null;

    const startDownload = async () => {
      controller = new AbortController();
      progressWrap.classList.remove('hidden');
      progressBar.value = 0;
      progressText.textContent = 'Starting...';
      try {
        await chunkedDownload(item.link, filenameFromUrl(item.link), {
          onProgress: (loaded, total) => {
            if (total) progressBar.value = loaded / total;
            progressText.textContent = total ? `${Math.round((loaded/total)*100)}%` : `${(loaded/1024).toFixed(0)} KB`;
          },
          signal: controller.signal
        });
        progressText.textContent = 'Completed';
      } catch (e) {
        if (e.name === 'AbortError') {
          progressText.textContent = 'Cancelled';
        } else {
          progressText.textContent = 'Error';
          console.error('Download error', e);
        }
      } finally {
        setTimeout(() => {
          progressWrap.classList.add('hidden');
          progressBar.value = 0;
        }, 2000);
      }
    };

    fastBtn.addEventListener('click', () => startDownload());
    cancelBtn.addEventListener('click', () => {
      if (controller) controller.abort();
    });
  }

  // If the detail contains a native video element, attach a 'play' handler to pause others
  const videoEl = detail.querySelector('video');
  if (videoEl) {
    videoEl.addEventListener('play', () => pauseAllMedia(videoEl));
  }
}

// Back to grid view
function backToGrid() {
  document.getElementById('mediaContainer').classList.remove('hidden');
  document.getElementById('mediaDetail').classList.add('hidden');
  // stop any playing media and clear iframe src to halt YouTube playback
  pauseAllMedia();
  stopAllIframes();
}

// Search functionality (case-insensitive, tag-based)
function searchMedia(query) {
  const searchTerm = query.toLowerCase().trim();
  
  if (!searchTerm) {
    displayMedia(allMedia);
    return;
  }
  
  const results = allMedia.filter(item => {
    return item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
           item.title.toLowerCase().includes(searchTerm) ||
           item.description.toLowerCase().includes(searchTerm);
  });
  
  displayMedia(results);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadMedia();
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchMedia(e.target.value);
  });
});
