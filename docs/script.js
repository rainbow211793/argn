let allMedia = [];
let allFolders = [];
let filteredMedia = [];
let currentView = 'grid';
let selectedCategory = '';
let selectedFolder = '';

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
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1`;
}

function getYouTubeThumbnail(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

// Pause all audio/video elements
function pauseAllMedia(except = null) {
  document.querySelectorAll('video, audio').forEach(el => {
    if (el !== except) {
      try { el.pause(); } catch (e) {}
      try { el.currentTime = 0; } catch (e) {}
    }
  });
}

// Stop all YouTube iframes
function stopAllIframes() {
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      if ((iframe.src || '').includes('youtube.com')) {
        iframe.src = '';
      }
    } catch (e) {}
  });
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show temporary feedback
    const shareBtn = event.target;
    const originalText = shareBtn.textContent;
    shareBtn.textContent = 'Copied!';
    setTimeout(() => {
      shareBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}
function getMediaPreview(item, isDetail = false) {
  const baseClass = isDetail ? 'detail-preview' : 'media-preview';
  
  if (item.type === 'image') {
    return `<img src="${item.link}" alt="${item.title}" class="${baseClass}">`;
  } else if (item.type === 'video') {
    if (isYouTubeUrl(item.link)) {
      const id = getYouTubeID(item.link);
      if (isDetail) {
        const embed = id ? getYouTubeEmbedUrl(id) : item.link;
        pauseAllMedia();
        stopAllIframes();
        return `<iframe class="${baseClass}" src="${embed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else {
        const thumb = id ? getYouTubeThumbnail(id) : '';
        return `
          <div class="youtube-card">
            <img src="${thumb}" alt="${item.title}" class="${baseClass}">
            <div class="play-badge">▶</div>
          </div>
        `;
      }
    } else {
      return `<video class="${baseClass}" controls><source src="${item.link}"></video>`;
    }
  } else if (item.type === 'gif') {
    return `<img src="${item.link}" alt="${item.title}" class="${baseClass}">`;
  } else if (item.type === 'audio') {
    return `<audio class="${baseClass}" controls><source src="${item.link}"></audio>`;
  } else if (item.type === 'text') {
    // For text files, display truncated content
    return `<div class="${baseClass} text-preview" data-media-id="${item.id}">Loading text...</div>`;
  } else {
    const icon = item.type === 'text' ? '📄' : item.type === 'audio' ? '🎵' : '📄';
    const height = isDetail ? '400px' : '200px';
    return `<div class="file-icon${isDetail ? '-large' : ''}" style="height: ${height}">${icon}</div>`;
  }
}

// Load text file content
async function loadTextFileContent(mediaId, element) {
  const item = allMedia.find(m => m.id === mediaId);
  if (!item || item.type !== 'text') return;
  
  try {
    const response = await fetch(item.link);
    let content = await response.text();
    
    // Check if we need to truncate (more than 500 characters)
    const truncated = content.length > 500;
    const displayContent = truncated ? content.substring(0, 500) + '...' : content;
    
    element.innerHTML = `<pre class="text-content">${escapeHtml(displayContent)}</pre>`;
    if (truncated) {
      element.innerHTML += `<a href="${item.link}" target="_blank" class="read-more-btn">Read Full Text</a>`;
    }
  } catch (error) {
    element.innerHTML = `<p class="error">Error loading text file</p>`;
    console.error('Error loading text file:', error);
  }
}

// Escape HTML characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Load media from JSON
async function loadMedia() {
  try {
    const response = await fetch('./media.json');
    const data = await response.json();
    allMedia = data.media;
    allFolders = data.folders || [];
    filteredMedia = allMedia;
    
    // Populate folder filter
    populateFolderFilter();
    
    // Populate category filter
    populateCategoryFilter();
    
    displayMedia(filteredMedia);
  } catch (error) {
    console.error('Error loading media:', error);
  }
}

// Populate category dropdown
function populateCategoryFilter() {
  const categories = [...new Set(allMedia.map(m => m.category).filter(Boolean))].sort();
  const select = document.getElementById('categorySelect');
  
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
  
  select.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    applyFilters();
  });
}

// Populate folder filter
function populateFolderFilter() {
  const folderScroll = document.getElementById('folderScroll');
  
  allFolders.forEach(folder => {
    const folderCard = document.createElement('div');
    folderCard.className = 'folder-card';
    folderCard.onclick = () => filterByFolder(folder.id);
    folderCard.title = folder.description;
    folderCard.innerHTML = `
      <div class="folder-icon" style="background-color: ${folder.color || '#3a5a7a'};">📂</div>
      <div class="folder-name">${folder.name}</div>
    `;
    folderScroll.appendChild(folderCard);
  });
}

// Apply both search and category filters
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
  
  // Filter folders
  filterFolders(searchTerm);
  
  filteredMedia = allMedia.filter(item => {
    const matchCategory = !selectedCategory || item.category === selectedCategory;
    const matchFolder = !selectedFolder || (item.folders && item.folders.includes(selectedFolder));
    const matchSearch = !searchTerm || 
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      item.title.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm);
    
    return matchCategory && matchFolder && matchSearch;
  });
  
  displayMedia(filteredMedia);
}

// Filter folders by search term
function filterFolders(searchTerm) {
  document.querySelectorAll('.folder-card').forEach((card, index) => {
    if (index === 0) {
      // Always show "All" button
      card.style.display = 'flex';
      return;
    }
    
    const folderName = card.querySelector('.folder-name').textContent.toLowerCase();
    if (!searchTerm || folderName.includes(searchTerm)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// Filter by folder
function filterByFolder(folderId) {
  selectedFolder = folderId;
  
  // Update active folder card
  document.querySelectorAll('.folder-card').forEach(card => {
    card.classList.remove('active');
  });
  
  if (!folderId) {
    document.querySelector('.all-folders-card').classList.add('active');
  } else {
    const folders = document.querySelectorAll('.folder-card:not(.all-folders-card)');
    folders.forEach((card, index) => {
      if (allFolders[index] && allFolders[index].id === folderId) {
        card.classList.add('active');
      }
    });
  }
  
  applyFilters();
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
    
    const preview = getMediaPreview(item, false);
    
    card.innerHTML = `
      ${preview}
      <div class="card-info">
        <div class="card-category">${item.category || 'Uncategorized'}</div>
        <h3>${item.title}</h3>
        <p class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</p>
      </div>
    `;
    
    card.addEventListener('click', () => showMediaDetail(item));
    container.appendChild(card);

    // Handle text file loading in cards
    if (item.type === 'text') {
      const textElement = card.querySelector('.text-preview');
      if (textElement) {
        loadTextFileContent(item.id, textElement);
      }
    }

    // Pause others when native video plays
    const vid = card.querySelector('video');
    if (vid) {
      vid.addEventListener('play', () => pauseAllMedia(vid));
    }
    
    // Pause others when audio plays
    const audio = card.querySelector('audio');
    if (audio) {
      audio.addEventListener('play', () => pauseAllMedia(audio));
    }
  });
}

// Show detailed view of media
function showMediaDetail(item) {
  const detail = document.getElementById('mediaDetail');
  const container = document.getElementById('mediaContainer');
  
  const preview = getMediaPreview(item, true);
  
  let downloadHtml = '';
  if (isYouTubeUrl(item.link)) {
    downloadHtml = `
      <a href="${item.link}" class="download-btn" target="_blank" rel="noopener noreferrer">Open on YouTube</a>
    `;
  } else if (item.type !== 'text') {
    downloadHtml = `<a href="${item.link}" class="download-btn" target="_blank" rel="noopener noreferrer">Download</a>`;
  }
  
  detail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="backToGrid()">← Back</button>
      <div class="detail-buttons">
        ${downloadHtml}
      </div>
    </div>
    <div class="detail-content">
      ${preview}
      <div class="detail-info">
        <div class="detail-category-badge">${item.category || 'Uncategorized'}</div>
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

  // Handle text file loading in detail view
  if (item.type === 'text') {
    const textElement = detail.querySelector('.text-preview');
    if (textElement) {
      loadTextFileContent(item.id, textElement);
    }
  }

  // Pause others when native video plays
  const videoEl = detail.querySelector('video');
  if (videoEl) {
    videoEl.addEventListener('play', () => pauseAllMedia(videoEl));
  }
  
  // Pause others when audio plays
  const audioEl = detail.querySelector('audio');
  if (audioEl) {
    audioEl.addEventListener('play', () => pauseAllMedia(audioEl));
  }
}

// Back to grid view
function backToGrid() {
  document.getElementById('mediaContainer').classList.remove('hidden');
  document.getElementById('mediaDetail').classList.add('hidden');
  pauseAllMedia();
  stopAllIframes();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadMedia();
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    applyFilters();
  });
});

