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
    
    // Check if we're viewing a slug
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');
    
    if (slug) {
      // Show specific media by slug
      const media = allMedia.find(m => m.slug === slug);
      if (media) {
        showMediaDetail(media);
      } else {
        // Slug not found, show gallery
        populateFolderFilter();
        populateCategoryFilter();
        displayMedia(filteredMedia);
      }
    } else {
      // Normal gallery view
      populateFolderFilter();
      populateCategoryFilter();
      displayMedia(filteredMedia);
    }
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
  
  const shareUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}${item.slug}`;
  
  detail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="backToGrid()">← Back</button>
      <div class="detail-buttons">
        ${downloadHtml}
        <button class="share-btn" onclick="shareMedia('${item.slug}', '${item.title.replace(/'/g, "\\'")}')">📤 Share</button>
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
  // If we're on a slug page, go back to gallery root
  if (new URLSearchParams(window.location.search).get('slug')) {
    window.history.back();
  } else {
    document.getElementById('mediaContainer').classList.remove('hidden');
    document.getElementById('mediaDetail').classList.add('hidden');
    pauseAllMedia();
    stopAllIframes();
  }
}

// Share media
function shareMedia(slug, title) {
  const shareUrl = `https://argn.quest/index.html?slug=${slug}`;
  
  // Show modal popup
  const modal = document.createElement('div');
  modal.id = 'shareModal';
  modal.onclick = (e) => {
    if (e.target === modal) closeShareModal();
  };
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  `;
  
  modal.innerHTML = `
    <div style="
      background: #0f1b35;
      padding: 30px;
      border-radius: 12px;
      max-width: 450px;
      width: 90%;
      text-align: center;
      box-shadow: 0 12px 48px rgba(0,0,0,0.8);
      border: 1px solid #3a5a7a;
    ">
      <h2 style="margin: 0 0 10px 0; color: #fff; font-size: 20px;">Share</h2>
      <p style="margin: 0 0 20px 0; color: #999; font-size: 13px;">${title}</p>
      
      <div style="
        display: flex;
        gap: 8px;
        background: #1a2a4a;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 20px;
        align-items: center;
        border: 1px solid #3a5a7a;
      ">
        <input type="text" value="${shareUrl}" readonly style="
          flex: 1;
          background: transparent;
          border: none;
          color: #5a8aaa;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          outline: none;
        ">
        <button onclick="copyShareLink('${shareUrl}')" style="
          background: #27ae60;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          white-space: nowrap;
          transition: background 0.3s;
        " onmouseover="this.style.background='#229954'" onmouseout="this.style.background='#27ae60'">📋 Copy</button>
      </div>
      
      <button onclick="closeShareModal()" style="
        background: #2a3a5a;
        color: #e0e0e0;
        border: 1px solid #3a5a7a;
        padding: 10px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.3s;
      " onmouseover="this.style.background='#3a4a6a'" onmouseout="this.style.background='#2a3a5a'">Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function copyShareLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    const btn = event.target;
    const original = btn.textContent;
    btn.textContent = '✅ Copied!';
    btn.style.background = '#1e8449';
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.textContent = '✅ Link copied to clipboard!';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #27ae60;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 600;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideUp 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
    
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '#27ae60';
    }, 2000);
  });
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.remove();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadMedia();
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    applyFilters();
  });
});

