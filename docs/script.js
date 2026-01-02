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
  return `https://www.youtube.com/embed/${id}`;
}

function getYouTubeThumbnail(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

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
      preview = `<iframe class="detail-preview" src="${embed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      preview = `<video class="detail-preview" controls><source src="${item.link}"></video>`;
    }
  } else if (item.type === 'gif') {
    preview = `<img src="${item.link}" alt="${item.title}" class="detail-preview">`;
  } else {
    preview = `<div class="file-icon-large">📄</div>`;
  }
  
  // download or open-on-youtube button
  const downloadHtml = isYouTubeUrl(item.link)
    ? `<a href="${item.link}" class="download-btn" target="_blank" rel="noopener noreferrer">Open on YouTube</a>`
    : `<a href="${item.link}" class="download-btn" download>Download</a>`;

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
}

// Back to grid view
function backToGrid() {
  document.getElementById('mediaContainer').classList.remove('hidden');
  document.getElementById('mediaDetail').classList.add('hidden');
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
