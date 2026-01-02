let allMedia = [];
let currentView = 'grid'; // grid or detail

// Load media from JSON
async function loadMedia() {
  try {
    const response = await fetch('../media.json');
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
      preview = `<video class="media-preview" controls><source src="${item.link}"></video>`;
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
    preview = `<video class="detail-preview" controls><source src="${item.link}"></video>`;
  } else if (item.type === 'gif') {
    preview = `<img src="${item.link}" alt="${item.title}" class="detail-preview">`;
  } else {
    preview = `<div class="file-icon-large">📄</div>`;
  }
  
  detail.innerHTML = `
    <button class="back-btn" onclick="backToGrid()">← Back</button>
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
