let allMedia = [];
let allFolders = [];
let filteredMedia = [];
let currentView = 'grid';
let selectedCategory = '';
let selectedFolder = '';
let currentDetailMediaIndex = -1;

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

// Determine if a click event is a plain left-click (not a modifier / new-tab click)
function isPlainClick(event) {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
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
  } else if (item.type === 'html') {
    const url = Array.isArray(item.link) ? item.link[0] : item.link;
    if (isDetail) {
      // Show an embedded preview of the HTML file
      return `<iframe class="${baseClass}" src="${url}" sandbox="allow-same-origin allow-scripts" style="border: 1px solid #3a5a7a; border-radius: 8px;"></iframe>`;
    }
    return `<div class="${baseClass} html-preview"><div class="file-icon" style="font-size: 48px;">🌐</div></div>`;
  } else if (item.type === 'text') {
    // For text files, display truncated content
    return `<div class="${baseClass} text-preview" data-media-id="${item.id}">Loading text...</div>`;
  } else if (item.type === 'folder') {
    const folder = allFolders.find(f => f.id === item.id.replace('folder-', ''));
    const color = folder ? folder.color || '#3a5a7a' : '#3a5a7a';
    const height = isDetail ? '400px' : '200px';
    return `<div class="file-icon${isDetail ? '-large' : ''}" style="height: ${height}; background-color: ${color};">📂</div>`;
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
    
    // Add pseudo media for folders
    allFolders.forEach(folder => {
      allMedia.push({
        id: 'folder-' + folder.id,
        type: 'folder',
        slug: 'folder-' + folder.id,
        category: 'Folders',
        folders: [],
        link: '',
        title: folder.name,
        description: folder.description,
        tags: ['folder'],
        credits: '',
        submitted_by: ''
      });
    });
    
    // Randomize order but keep Gifstad flag first
    let flagItem = allMedia.find(m => m.id === '1');
    allMedia = allMedia.filter(m => m.id !== '1');
    allMedia.sort(() => Math.random() - 0.5);
    if (flagItem) allMedia.unshift(flagItem);
    
    filteredMedia = allMedia;
    
    // Determine current slug/folder from either query params or clean paths
    const urlParams = new URLSearchParams(window.location.search);
    let slug = urlParams.get('slug');
    let folderParam = urlParams.get('folder');

    const pathParts = window.location.pathname.replace(/\/+$/, '').split('/').filter(p => p);
    if (pathParts.length) {
      if (pathParts[0] === 'folder') {
        folderParam = folderParam || pathParts[1];
        if (pathParts.length === 3) {
          slug = slug || pathParts[2];
        }
      } else {
        slug = slug || pathParts[0];
      }
    }

    if (folderParam) {
      selectedFolder = folderParam;
    }

    // Ensure shared URLs (clean path or query) create a usable history state so Back stays within the app.
    (function() {
      const state = {};
      let cleanPath = '/';

      if (folderParam && slug) {
        cleanPath = `/folder/${folderParam}/${slug}`;
        state.folder = folderParam;
        state.slug = slug;
      } else if (folderParam) {
        cleanPath = `/folder/${folderParam}`;
        state.folder = folderParam;
      } else if (slug) {
        cleanPath = `/${slug}`;
        state.slug = slug;
      }

      // If the current URL doesn't already match the clean path, replace it.
      if (window.location.pathname !== cleanPath) {
        window.history.replaceState(state, '', cleanPath);
      } else {
        window.history.replaceState(state, '', window.location.pathname);
      }
    })();

    if (slug) {
      // Show specific media by slug
      const media = allMedia.find(m => m.slug === slug);
      if (media) {
        showMediaDetail(media, false);
        // Update meta tags for Discord/Google sharing
        document.title = media.title + ' - Argn';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = media.description || media.title;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = media.title;
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = media.description || media.title;
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.content = window.location.href;
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) twitterTitle.content = media.title;
        const twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) twitterDesc.content = media.description || media.title;
        
        if (media.type === 'image' || media.type === 'gif') {
          const ogImage = document.querySelector('meta[property="og:image"]');
          if (ogImage) ogImage.content = media.link;
          const ogType = document.querySelector('meta[property="og:type"]');
          if (ogType) ogType.content = 'article';
          const twitterCard = document.querySelector('meta[name="twitter:card"]');
          if (twitterCard) twitterCard.content = 'summary_large_image';
          const ogVideo = document.querySelector('meta[property="og:video"]');
          if (ogVideo) ogVideo.content = '';
        } else if (media.type === 'video') {
          if (isYouTubeUrl(media.link)) {
            const id = getYouTubeID(media.link);
            if (id) {
              const ogImage = document.querySelector('meta[property="og:image"]');
              if (ogImage) ogImage.content = getYouTubeThumbnail(id);
            }
            const ogType = document.querySelector('meta[property="og:type"]');
            if (ogType) ogType.content = 'video';
            const twitterCard = document.querySelector('meta[name="twitter:card"]');
            if (twitterCard) twitterCard.content = 'player';
            const ogVideo = document.querySelector('meta[property="og:video"]');
            if (ogVideo) ogVideo.content = media.link;
          } else {
            const ogVideo = document.querySelector('meta[property="og:video"]');
            if (ogVideo) ogVideo.content = media.link;
            const ogType = document.querySelector('meta[property="og:type"]');
            if (ogType) ogType.content = 'video';
            const twitterCard = document.querySelector('meta[name="twitter:card"]');
            if (twitterCard) twitterCard.content = 'player';
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) ogImage.content = '';
          }
        } else {
          // Reset to default
          const ogImage = document.querySelector('meta[property="og:image"]');
          if (ogImage) ogImage.content = 'https://argn.quest/preview.jpg';
          const ogType = document.querySelector('meta[property="og:type"]');
          if (ogType) ogType.content = 'website';
          const twitterCard = document.querySelector('meta[name="twitter:card"]');
          if (twitterCard) twitterCard.content = 'summary_large_image';
          const ogVideo = document.querySelector('meta[property="og:video"]');
          if (ogVideo) ogVideo.content = '';
        }
      } else {
        // Slug not found, show gallery
        populateCategoryFilter();
        displayMedia(filteredMedia);
      }
    } else {
      // Normal gallery view
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
  
  filteredMedia = allMedia.filter(item => {
    const matchCategory = !selectedCategory || item.category === selectedCategory;
    const matchFolder = !selectedFolder || (item.folders && item.folders.includes(selectedFolder));
    const matchSearch = !searchTerm || 
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
      item.title.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm);
    
    return matchCategory && matchFolder && matchSearch;
  });
  
  console.log('applyFilters:', { selectedFolder, selectedCategory, searchTerm, totalItems: allMedia.length, filteredCount: filteredMedia.length });
  
  displayMedia(filteredMedia);
}

// Filter by folder
function filterByFolder(folderId) {
  selectedFolder = folderId;
  
  // Update URL for clean routing
  if (folderId) {
    window.history.pushState({ folder: folderId }, '', `/folder/${folderId}`);
  } else {
    window.history.pushState({}, '', '/');
  }
  
  applyFilters();
}

// Clear folder filter and go back to gallery
function clearFolderFilter() {
  selectedFolder = '';
  window.history.pushState({}, '', '/');
  applyFilters();
}

// Simple Wordle minigame
const wordleWords = [
  // 3-letter words
  'SEB', 'LEM', 'BJO', 'SEI', 'LEI', 'BJI', 'SEO', 'LEO', 'BJO', 'SEU',
  'LEU', 'BJU', 'SEE', 'LEE', 'BJE', 'SEM', 'LEM', 'BJM', 'SEK', 'LEK',
  'BJK', 'SEL', 'LEL', 'BJL', 'SER', 'LER', 'BJR', 'BEX', 'LEX', 'BJX',
  'SEB', 'LEM', 'BJO', 'SEI', 'LEI', 'BJI', 'SEO', 'LEO', 'BJO', 'SEU',
  'LEU', 'BJU', 'SEE', 'LEE', 'BJE', 'SEM', 'LEM', 'BJM', 'SEK', 'LEK',
  'BJK', 'SEL', 'LEL', 'BJL', 'SER', 'LER', 'BJR', 'BEX', 'LEX', 'BJX',
  'SEB', 'LEM', 'BJO', 'SEI', 'LEI', 'BJI', 'SEO', 'LEO', 'BJO', 'SEU',
  'LEU', 'BJU', 'SEE', 'LEE', 'BJE', 'SEM', 'LEM', 'BJM', 'SEK', 'LEK',
  'BJK', 'SEL', 'LEL', 'BJL', 'SER', 'LER', 'BJR', 'BEX', 'LEX', 'BJX', "RLY"
  
  // 4-letter words
  ,'SEBI', 'LEME', 'BJOR', 'SEBL', 'LEMB', 'BJRN', 'SEBR', 'LEMR', 'BJRR', 'SEBX',
  'LEMX', 'BJRX', 'SEBO', 'LEMO', 'BJRO', 'SEBU', 'LEMU', 'BJRU', 'SEBE', 'LEME',
  'BJRE', 'SEBM', 'LEMM', 'BJRM', 'SEBK', 'LEMK', 'BJRK', 'SEBL', 'LEMB', 'BJRN',
  'SEBR', 'LEMR', 'BJRR', 'SEBX', 'LEMX', 'BJRX', 'SEBO', 'LEMO', 'BJRO', 'SEBU',
  'LEMU', 'BJRU', 'SEBE', 'LEME', 'BJRE', 'SEBM', 'LEMM', 'BJRM', 'SEBK', 'LEMK',
  'BJRK', 'SEBL', 'LEMB', 'BJRN', 'SEBR', 'LEMR', 'BJRR', 'SEBX', 'LEMX', 'BJRX',
  'SEBO', 'LEMO', 'BJRO', 'SEBU', 'LEMU', 'BJRU', 'SEBE', 'LEME', 'BJRE', 'SEBM',
  'LEMM', 'BJRM', 'SEBK', 'LEMK', 'BJRK', 'SEBL', 'LEMB', 'BJRN', 'SEBR', 'LEMR',
  'BJRR', 'SEBX', 'LEMX', 'BJRX', 'SEBO', 'LEMO', 'BJRO', 'SEBU', 'LEMU', 'BJRU'
  
  // 5-letter words
  ,'LEMEN', 'BJORN', 'SEBIL', 'LEMBJ', 'BJRNA', 'SEBIR', 'LEMIR', 'BJRIR', 'SEBIX', 'LEMIX',
  'BJRIX', 'SEBIO', 'LEMIO', 'BJRIO', 'SEBIU', 'LEMIU', 'BJRIU', 'SEBIE', 'LEMIE', 'BJRIE',
  'SEBIM', 'LEMIM', 'BJRIM', 'SEBIK', 'LEMIK', 'BJRIK', 'SEBIL', 'LEMBJ', 'BJRNA', 'SEBIR',
  'LEMIR', 'BJRIR', 'SEBIX', 'LEMIX', 'BJRIX', 'SEBIO', 'LEMIO', 'BJRIO', 'SEBIU', 'LEMIU',
  'BJRIU', 'SEBIE', 'LEMIE', 'BJRIE', 'SEBIM', 'LEMIM', 'BJRIM', 'SEBIK', 'LEMIK', 'BJRIK',
  'SEBIL', 'LEMBJ', 'BJRNA', 'SEBIR', 'LEMIR', 'BJRIR', 'SEBIX', 'LEMIX', 'BJRIX', 'SEBIO',
  'LEMIO', 'BJRIO', 'SEBIU', 'LEMIU', 'BJRIU', 'SEBIE', 'LEMIE', 'BJRIE', 'SEBIM', 'LEMIM',
  'BJRIM', 'SEBIK', 'LEMIK', 'BJRIK', 'SEBIL', 'LEMBJ', 'BJRNA', 'SEBIR', 'LEMIR', 'BJRIR',
  'SEBIX', 'LEMIX', 'BJRIX', 'SEBIO', 'LEMIO', 'BJRIO', 'SEBIU', 'LEMIU', 'BJRIU', 'SEBIE',
  'LEMIE', 'BJRIE', 'SEBIM', 'LEMIM', 'BJRIM', 'SEBIK', 'LEMIK', 'BJRIK', 'SEBIL', 'LEMBJ'
  
  // 6-letter words
  ,'SEBILE', 'BJORNL', 'SEBIKI', 'LEMRUL', 'BJORNI', 'SEBIRI', 'LEMBJO', 'SEBILE', 'BJORNE', 'LEMMIN',
  'SEBIBE', 'BJORNF', 'LEMWOL', 'SEBILI', 'BJORNE', 'LEMHAW', 'SEBITI', 'BJORNB', 'LEMLIO', 'SEBIHA',
  'BJORNW', 'LEMEAG', 'SEBITR', 'BJORNR', 'LEMMOU', 'SEBILA', 'BJORNF', 'LEMWAT', 'SEBIEA', 'BJORNA',
  'LEMFIR', 'SEBIWA', 'BJORNE', 'LEMAIR', 'SEBIFL', 'BJORNFL', 'LEMFLA', 'SEBIAR', 'BJORNAR', 'LEMARM',
  'SEBIMA', 'BJORNMA', 'LEMMAP', 'SEBILO', 'BJORNLO', 'LEMLORE', 'SEBIMY', 'BJORNM', 'LEMMYS', 'SEBILE',
  'BJORNL', 'LEMLEG', 'SEBIQU', 'BJORNQ', 'LEMQUE', 'SEBIRE', 'BJORNRE', 'LEMREA', 'SEBIWO', 'BJORNWO',
  'LEMWOR', 'SEBILA', 'BJORNL', 'LEMLAN', 'SEBIKI', 'BJORKN', 'LEMKIN', 'SEBITH', 'BJORNT', 'LEMTHR',
  'SEBILE', 'BJORNL', 'SEBIKI', 'LEMRUL', 'BJORNI', 'SEBIRI', 'LEMBJO', 'SEBILE', 'BJORNE', 'LEMMIN',
  'SEBIBE', 'BJORNF', 'LEMWOL', 'SEBILI', 'BJORNE', 'LEMHAW', 'SEBITI', 'BJORNB', 'LEMLIO', 'SEBIHA',
  'BJORNW', 'LEMEAG', 'SEBITR', 'BJORNR', 'LEMMOU', 'SEBILA', 'BJORNF', 'LEMWAT', 'SEBIEA', 'BJORNA'
];

let wordleWord = '';
let wordleGuesses = [];
let wordleMaxGuesses = 6;
let wordleWordLength = 4;

function initWordle() {
  // Randomly select word length and word
  const lengths = [3, 4, 5, 6];
  wordleWordLength = lengths[Math.floor(Math.random() * lengths.length)];
  
  // Filter words by length and pick random one
  const wordsOfLength = wordleWords.filter(word => word.length === wordleWordLength);
  wordleWord = wordsOfLength[Math.floor(Math.random() * wordsOfLength.length)];
  
  wordleGuesses = [];
  updateWordleGrid();
  
  // Update input maxlength
  document.getElementById('wordleInput').maxLength = wordleWordLength;
  document.getElementById('wordleInput').placeholder = `${wordleWordLength} letters`;
  
  document.getElementById('wordleInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkGuess();
  });
}

function checkGuess() {
  const input = document.getElementById('wordleInput');
  const guess = input.value.toUpperCase();
  
  if (guess.length !== wordleWordLength) return;
  
  wordleGuesses.push(guess);
  updateWordleGrid();
  
  if (guess === wordleWord) {
    document.getElementById('wordleMessage').innerHTML = '🎉 ACCESS GRANTED!';
    input.disabled = true;
  } else if (wordleGuesses.length >= wordleMaxGuesses) {
    document.getElementById('wordleMessage').innerHTML = `❌ Failed. Key was: ${wordleWord}`;
    input.disabled = true;
  }
  
  input.value = '';
}

function updateWordleGrid() {
  const grid = document.getElementById('wordleGrid');
  grid.innerHTML = '';
  
  for (let i = 0; i < wordleMaxGuesses; i++) {
    const row = document.createElement('div');
    row.className = 'wordle-row';
    
    const guess = wordleGuesses[i] || '';
    for (let j = 0; j < wordleWordLength; j++) {
      const cell = document.createElement('div');
      cell.className = 'wordle-cell';
      cell.textContent = guess[j] || '';
      
      if (guess) {
        if (guess[j] === wordleWord[j]) {
          cell.classList.add('correct');
        } else if (wordleWord.includes(guess[j])) {
          cell.classList.add('present');
        } else {
          cell.classList.add('absent');
        }
      }
      
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }
}

// Zombie Shooter Game
let gameCanvas, gameCtx;
let player = { x: 400, y: 300, size: 8 };
let zombies = [];
let bullets = [];
let score = 0;
let gameRunning = false;
let gameOver = false;
let isMobile = false;
let keys = {};

// Movement variables
let moveSpeed = 3;
let playerVelocity = { x: 0, y: 0 };
let mousePos = { x: 0, y: 0 };

// Check if device is mobile
function checkMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
}

function startZombieShooter() {
  isMobile = checkMobile();

  // Create game overlay
  const gameOverlay = document.createElement('div');
  gameOverlay.id = 'zombieGame';
  gameOverlay.innerHTML = `
    <div class="game-header">
      <h2>🧟 Zombie Shooter</h2>
      <button onclick="closeZombieGame()">×</button>
    </div>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div class="game-info">
      <span id="score">Score: 0</span>
      <span id="instructions">${isMobile ? 'Use D-pad to move, tap screen to shoot' : 'Arrow keys to move, mouse to aim, click to shoot'}</span>
    </div>
    ${isMobile ? `
      <div class="mobile-controls">
        <div class="dpad">
          <button id="upBtn">↑</button>
          <div class="dpad-middle">
            <button id="leftBtn">←</button>
            <button id="rightBtn">→</button>
          </div>
          <button id="downBtn">↓</button>
        </div>
        <button id="shootBtn">🔫 SHOOT</button>
      </div>
    ` : ''}
  `;

  document.body.appendChild(gameOverlay);

  // Setup canvas
  gameCanvas = document.getElementById('gameCanvas');
  gameCtx = gameCanvas.getContext('2d');

  // Adjust canvas size for mobile
  if (isMobile) {
    const maxWidth = Math.min(window.innerWidth - 40, 800);
    const maxHeight = Math.min(window.innerHeight - 200, 600);
    gameCanvas.width = maxWidth;
    gameCanvas.height = maxHeight;
    player.x = maxWidth / 2;
    player.y = maxHeight / 2;
  }

  // Initialize game
  zombies = [];
  bullets = [];
  score = 0;
  gameRunning = true;
  gameOver = false;

  // Add initial zombies
  for (let i = 0; i < 5; i++) {
    spawnZombie();
  }

  // Event listeners
  if (isMobile) {
    gameCanvas.addEventListener('touchstart', handleTouchShoot);
    setupDPad();
  } else {
    gameCanvas.addEventListener('mousemove', aimPlayer);
    gameCanvas.addEventListener('click', handleClick);
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  }

  // Start game loop
  gameLoop();
}

function closeZombieGame() {
  gameRunning = false;
  
  // Remove event listeners
  if (!isMobile) {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  }
  
  const gameOverlay = document.getElementById('zombieGame');
  if (gameOverlay) {
    gameOverlay.remove();
  }
}

function spawnZombie() {
  const side = Math.floor(Math.random() * 4);
  let x, y;

  switch (side) {
    case 0: // top
      x = Math.random() * gameCanvas.width;
      y = -20;
      break;
    case 1: // right
      x = gameCanvas.width + 20;
      y = Math.random() * gameCanvas.height;
      break;
    case 2: // bottom
      x = Math.random() * gameCanvas.width;
      y = gameCanvas.height + 20;
      break;
    case 3: // left
      x = -20;
      y = Math.random() * gameCanvas.height;
      break;
  }

  zombies.push({
    x: x,
    y: y,
    size: 12,
    speed: 0.5 + Math.random() * 0.5,
    health: 1
  });
}

function aimPlayer(e) {
  // Store mouse position for aiming bullets
  const rect = gameCanvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;
}

function handleTouchShoot(e) {
  e.preventDefault();
  if (!gameRunning || gameOver) return;
  
  if (gameOver) {
    // Restart game
    zombies = [];
    bullets = [];
    score = 0;
    gameOver = false;

    // Add initial zombies
    for (let i = 0; i < 5; i++) {
      spawnZombie();
    }

    gameLoop();
  } else {
    shootBullet();
  }
}

function handleClick(e) {
  e.preventDefault();
  if (!gameRunning) return;
  
  if (gameOver) {
    // Restart game
    zombies = [];
    bullets = [];
    score = 0;
    gameOver = false;

    // Add initial zombies
    for (let i = 0; i < 5; i++) {
      spawnZombie();
    }

    gameLoop();
  } else {
    shootBullet();
  }
}

function handleKeyDown(e) {
  keys[e.key] = true;
  e.preventDefault();
}

function handleKeyUp(e) {
  keys[e.key] = false;
  e.preventDefault();
}

function setupDPad() {
  const upBtn = document.getElementById('upBtn');
  const downBtn = document.getElementById('downBtn');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');

  // Touch events for D-pad
  upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowUp'] = true; });
  upBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowUp'] = false; });
  
  downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowDown'] = true; });
  downBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowDown'] = false; });
  
  leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; });
  leftBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowLeft'] = false; });
  
  rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; });
  rightBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowRight'] = false; });

  // Shoot button
  const shootBtn = document.getElementById('shootBtn');
  shootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    shootBullet();
  });
}

function shootBullet() {
  if (!gameRunning || gameOver) return;

  bullets.push({
    x: player.x,
    y: player.y,
    dx: 0,
    dy: 0,
    speed: 8,
    size: 3
  });

  // Calculate direction to mouse/touch position
  let targetX, targetY;

  if (isMobile) {
    // For mobile, shoot in the direction the player is facing (center of screen)
    targetX = gameCanvas.width / 2;
    targetY = gameCanvas.height / 2;
  } else {
    // For desktop, shoot towards stored mouse position
    targetX = mousePos.x;
    targetY = mousePos.y;
  }

  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  bullets[bullets.length - 1].dx = Math.cos(angle);
  bullets[bullets.length - 1].dy = Math.sin(angle);
}

function updateGame() {
  if (!gameRunning || gameOver) return;

  // Update player movement
  playerVelocity.x = 0;
  playerVelocity.y = 0;

  if (keys['ArrowUp'] || keys['w'] || keys['W']) playerVelocity.y = -moveSpeed;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) playerVelocity.y = moveSpeed;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) playerVelocity.x = -moveSpeed;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) playerVelocity.x = moveSpeed;

  // Apply movement
  player.x += playerVelocity.x;
  player.y += playerVelocity.y;

  // Keep player in bounds
  player.x = Math.max(player.size, Math.min(gameCanvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(gameCanvas.height - player.size, player.y));

  // Update bullets
  bullets = bullets.filter(bullet => {
    bullet.x += bullet.dx * bullet.speed;
    bullet.y += bullet.dy * bullet.speed;

    // Remove bullets that are off screen
    return bullet.x > -10 && bullet.x < gameCanvas.width + 10 &&
           bullet.y > -10 && bullet.y < gameCanvas.height + 10;
  });

  // Update zombies
  zombies.forEach(zombie => {
    // Move towards player
    const angle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
    zombie.x += Math.cos(angle) * zombie.speed;
    zombie.y += Math.sin(angle) * zombie.speed;
  });

  // Check bullet-zombie collisions
  bullets.forEach((bullet, bulletIndex) => {
    zombies.forEach((zombie, zombieIndex) => {
      const dx = bullet.x - zombie.x;
      const dy = bullet.y - zombie.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bullet.size + zombie.size) {
        // Hit!
        zombie.health--;
        bullets.splice(bulletIndex, 1);

        if (zombie.health <= 0) {
          zombies.splice(zombieIndex, 1);
          score += 10;

          // Spawn new zombie
          setTimeout(spawnZombie, Math.random() * 2000 + 1000);
        }
      }
    });
  });

  // Check player-zombie collisions
  zombies.forEach(zombie => {
    const dx = player.x - zombie.x;
    const dy = player.y - zombie.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < player.size + zombie.size) {
      gameOver = true;
    }
  });

  // Spawn more zombies over time
  if (Math.random() < 0.005) {
    spawnZombie();
  }
}

function drawGame() {
  // Clear canvas
  gameCtx.fillStyle = '#000';
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  // Draw player
  gameCtx.fillStyle = '#fff';
  gameCtx.beginPath();
  gameCtx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  gameCtx.fill();

  // Draw zombies
  gameCtx.fillStyle = '#f00';
  zombies.forEach(zombie => {
    gameCtx.beginPath();
    gameCtx.arc(zombie.x, zombie.y, zombie.size, 0, Math.PI * 2);
    gameCtx.fill();
  });

  // Draw bullets
  gameCtx.fillStyle = '#ff0';
  bullets.forEach(bullet => {
    gameCtx.beginPath();
    gameCtx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    gameCtx.fill();
  });

  // Draw game over screen
  if (gameOver) {
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    gameCtx.fillStyle = '#fff';
    gameCtx.font = '48px Arial';
    gameCtx.textAlign = 'center';
    gameCtx.fillText('GAME OVER', gameCanvas.width / 2, gameCanvas.height / 2 - 50);

    gameCtx.font = '24px Arial';
    gameCtx.fillText(`Final Score: ${score}`, gameCanvas.width / 2, gameCanvas.height / 2);
    gameCtx.fillText('Click to restart', gameCanvas.width / 2, gameCanvas.height / 2 + 50);
  }
}

function gameLoop() {
  if (!gameRunning) return;

  updateGame();
  drawGame();

  // Update score display
  document.getElementById('score').textContent = `Score: ${score}`;

  if (!gameOver) {
    requestAnimationFrame(gameLoop);
  }
}

// Display media in grid
function displayMedia(mediaList) {
  const container = document.getElementById('mediaContainer');
  container.innerHTML = '';
  
  // Update back button in top area based on folder selection
  const folderBackBtn = document.getElementById('folderBackBtn');
  if (selectedFolder) {
    folderBackBtn.innerHTML = `
      <button onclick="clearFolderFilter()" style="
        background: #2a5a7a;
        color: #e0e0e0;
        border: 1px solid #3a5a7a;
        padding: 10px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.3s;
      " onmouseover="this.style.background='#3a6a8a'" onmouseout="this.style.background='#2a5a7a'">← Back to Gallery</button>
    `;
  } else {
    folderBackBtn.innerHTML = '';
  }
  
  if (mediaList.length === 0) {
    if (selectedFolder) {
      container.innerHTML = `
        <div class="empty-folder" style="text-align: center; padding: 60px 20px; color: #cfd8ff;">
          <h3 style="margin-bottom: 16px;">📂 No media in this folder</h3>
          <p style="margin-bottom: 20px; color: #a0b4d8;">This folder doesn't have any items yet. Try another folder or go back to the gallery.</p>
          <button onclick="clearFolderFilter()" style="background: #2a5a7a; color: #e0e0e0; border: 1px solid #3a5a7a; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.3s;" onmouseover="this.style.background='#3a6a8a'" onmouseout="this.style.background='#2a5a7a'">← Back to Gallery</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="minigame">
        <h3>🔐 Access Denied</h3>
        <p>Enter decryption key:</p>
        <div class="wordle-grid" id="wordleGrid"></div>
        <div class="input-row">
          <input type="text" id="wordleInput" placeholder="4 letters">
          <button onclick="checkGuess()">Submit</button>
        </div>
        <div id="wordleMessage"></div>
      </div>
    `;
    initWordle();
    return;
  }
  
  mediaList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'media-card';
    
    const preview = getMediaPreview(item, false);
    
    if (item.type === 'folder') {
      card.innerHTML = `
        ${preview}
        <div class="card-info">
          <div class="card-category">${item.category || 'Uncategorized'}</div>
          <h3>${item.title}</h3>
          <p class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</p>
        </div>
        <button class="share-btn" onclick="shareFolder('${item.id.replace('folder-', '')}', '${item.title.replace(/'/g, "\\'")}')">📤 Share</button>
      `;
      card.addEventListener('click', (e) => {
        // Allow modifier clicks (new tab, open in background) and ignore clicks on buttons/inputs.
        if (!isPlainClick(e) || e.target.closest('button, input, textarea, select')) return;
        e.preventDefault();
        filterByFolder(item.id.replace('folder-', ''));
      });
    } else {
      const href = selectedFolder ? `/folder/${selectedFolder}/${item.slug}` : `/${item.slug}`;
      card.innerHTML = `
        <a href="${href}" style="text-decoration: none; color: inherit; display: block;">
          ${preview}
          <div class="card-info">
            <div class="card-category">${item.category || 'Uncategorized'}</div>
            <h3>${item.title}</h3>
            <p class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</p>
          </div>
        </a>
        <button class="share-btn" onclick="shareMedia('${item.slug}', '${item.title.replace(/'/g, "\\'")}')">📤 Share</button>
      `;
      card.addEventListener('click', (e) => {
        // Allow modifier clicks (new tab, open in background) and ignore clicks on buttons/inputs.
        if (!isPlainClick(e) || e.target.closest('button, input, textarea, select')) return;
        e.preventDefault();
        showMediaDetail(item);
      });
    }
    
    container.appendChild(card);

    // Ensure clicks on the Lyket widget don't trigger the card click
    const lyketInline = card.querySelector('.lyket-inline');
    if (lyketInline) {
      lyketInline.addEventListener('click', (e) => e.stopPropagation());
      lyketInline.addEventListener('touchstart', (e) => e.stopPropagation());
    }

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

  // Initialize/render any Lyket widgets added dynamically
  renderLyketWidgets();
}

// Show detailed view of media
function showMediaDetail(item, pushHistory = true) {
  const detail = document.getElementById('mediaDetail');
  const container = document.getElementById('mediaContainer');
  
  // Find the current media index in filteredMedia
  currentDetailMediaIndex = filteredMedia.findIndex(m => m.id === item.id);
  
  const preview = getMediaPreview(item, true);
  
  let downloadHtml = '';
  if (item.type === 'folder') {
    // No download for folders
  } else if (isYouTubeUrl(item.link)) {
    downloadHtml = `
      <a href="${item.link}" class="download-btn" target="_blank" rel="noopener noreferrer">Open on YouTube</a>
    `;
  } else if (item.type !== 'text') {
    const downloadUrl = Array.isArray(item.link) ? item.link[0] : item.link;
    downloadHtml = `<a href="${downloadUrl}" class="download-btn" target="_blank" rel="noopener noreferrer">Download</a>`;
  }
  
  const currentFolder = selectedFolder || (() => {
    const parts = window.location.pathname.split('/').filter(p => p);
    return parts[0] === 'folder' ? parts[1] : '';
  })();

  const shareUrl = item.type === 'folder'
    ? `https://argn.quest/folder/${item.id.replace('folder-', '')}`
    : currentFolder
      ? `https://argn.quest/folder/${currentFolder}/${item.slug}`
      : `https://argn.quest/${item.slug}`;

  const shareFunction = item.type === 'folder'
    ? `shareFolder('${item.id.replace('folder-', '')}', '${item.title.replace(/'/g, "\\'")}')`
    : `shareMedia('${item.slug}', '${item.title.replace(/'/g, "\\'")}', '${shareUrl.replace(/'/g, "\\'")}')`;
  
  // Generate navigation buttons
  const hasPrev = currentDetailMediaIndex > 0;
  const hasNext = currentDetailMediaIndex < filteredMedia.length - 1;
  
  let navigationHtml = '';
  if (filteredMedia.length > 1) {
    navigationHtml = `
      <div class="media-navigation">
        ${hasPrev ? `<button class="nav-btn prev-btn" onclick="navigateMedia(-1)">← Previous</button>` : '<div class="nav-btn disabled"></div>'}
        <span class="media-counter">${currentDetailMediaIndex + 1} / ${filteredMedia.length}</span>
        ${hasNext ? `<button class="nav-btn next-btn" onclick="navigateMedia(1)">Next →</button>` : '<div class="nav-btn disabled"></div>'}
      </div>
    `;
  }
  
  detail.innerHTML = `
      <div class="detail-header">
      <button class="back-btn" onclick="backToGrid()">← Back</button>
      <div class="detail-buttons">
        ${downloadHtml}
        <button class="share-btn" onclick="${shareFunction}">📤 Share</button>
      </div>
    </div>
    <div class="detail-content">
      ${preview}
      <div class="detail-info">
        <div class="detail-category-badge">${item.category || 'Uncategorized'}</div>
        <h2>${item.title}</h2>
        <div class="description">${marked.parse((item.description || '').replace(/\|\|/g, '\n\n'))}</div>
        <div class="tags-section">
          <strong>Tags:</strong>
          <p class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</p>
        </div>
        <div class="credits-section">
          <p><strong>Credits:</strong> ${item.credits || ''}</p>
          <p><strong>Submitted by:</strong> ${item.submitted_by || ''}</p>
        </div>
      </div>
    </div>
    ${navigationHtml}
  `;
  
  container.classList.add('hidden');
  detail.classList.remove('hidden');
  
  // Hide ads in detail view
  const adSidebar = document.getElementById('rightAdSidebar');
  if (adSidebar) adSidebar.classList.add('hidden');

  // Prevent header widget clicks from bubbling if detail has any click handlers
  const headerLyket = detail.querySelector('.lyket-detail');
  if (headerLyket) {
    headerLyket.addEventListener('click', (e) => e.stopPropagation());
    headerLyket.addEventListener('touchstart', (e) => e.stopPropagation());
  }

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
  
  // Update URL with clean slug URL (push a new history entry so Back works)
  if (typeof pushHistory === 'undefined' || pushHistory) {
    try {
      let cleanUrl;
      if (window.location.pathname.startsWith('/folder/')) {
        const parts = window.location.pathname.split('/').filter(p => p);
        cleanUrl = `/folder/${parts[1]}/${item.slug}`;
      } else {
        cleanUrl = `/${item.slug}`;
      }
      window.history.pushState({ slug: item.slug }, '', cleanUrl);
    } catch (e) {
      // Fallback
      let cleanUrl;
      if (window.location.pathname.startsWith('/folder/')) {
        const parts = window.location.pathname.split('/').filter(p => p);
        cleanUrl = `/folder/${parts[1]}/${item.slug}`;
      } else {
        cleanUrl = `/${item.slug}`;
      }
      window.history.replaceState(null, '', cleanUrl);
    }
  }
  
  // Add keyboard navigation
  document.addEventListener('keydown', handleDetailKeyboard);

  // Render any Lyket widgets in the detail view
  renderLyketWidgets();
}

// Navigate between media in detail view
function navigateMedia(direction) {
  const newIndex = currentDetailMediaIndex + direction;
  if (newIndex >= 0 && newIndex < filteredMedia.length) {
    showMediaDetail(filteredMedia[newIndex]);
  }
}

// Handle keyboard navigation in detail view
function handleDetailKeyboard(e) {
  if (document.getElementById('mediaDetail').classList.contains('hidden')) {
    document.removeEventListener('keydown', handleDetailKeyboard);
    return;
  }
  
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateMedia(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateMedia(1);
  }
}

// Back to grid view
function backToGrid() {
  const detail = document.getElementById('mediaDetail');
  const container = document.getElementById('mediaContainer');

  // If we're already in gallery mode, nothing to do
  if (detail.classList.contains('hidden')) return;

  // Determine where to go based on the current URL
  const pathname = window.location.pathname.replace(/\/+$/, '');
  if (pathname.startsWith('/folder/')) {
    const parts = pathname.split('/').filter(p => p);
    if (parts.length === 3) {
      // /folder/xyz/slug -> go back to folder view
      selectedFolder = parts[1];
      window.history.replaceState({ folder: selectedFolder }, '', `/folder/${selectedFolder}`);
    } else if (parts.length === 2) {
      // /folder/xyz -> go back to root gallery
      selectedFolder = '';
      window.history.replaceState({}, '', '/');
    } else {
      // Fallback to root
      selectedFolder = '';
      window.history.replaceState({}, '', '/');
    }
  } else if (pathname && pathname !== '/') {
    // /slug -> go back to root gallery
    selectedFolder = '';
    window.history.replaceState({}, '', '/');
  } else {
    // Root or query-param share -> go to root gallery
    selectedFolder = '';
    window.history.replaceState({}, '', '/');
  }

  container.classList.remove('hidden');
  detail.classList.add('hidden');
  applyFilters();
  pauseAllMedia();
  stopAllIframes();

  // Show ads in gallery view
  const adSidebar = document.getElementById('rightAdSidebar');
  if (adSidebar) adSidebar.classList.remove('hidden');
}

// Share media
function shareMedia(slug, title, shareUrl) {
  const url = shareUrl || `https://argn.quest/${slug}`;
  
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

function copyShareLink(url, button) {
  const btn = button || document.activeElement || (typeof event !== 'undefined' ? event.target : null);
  navigator.clipboard.writeText(url).then(() => {
    const original = btn ? btn.textContent : null;
    if (btn) {
      btn.textContent = '✅ Copied!';
      btn.style.background = '#1e8449';
    }
    
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

function shareFolder(folderId, title) {
  const shareUrl = `https://argn.quest/folder/${folderId}`;
  
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

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.remove();
}

// Handle browser back/forward navigation
function handlePopState(event) {
  let slug, folderParam;

  if (window.location.pathname !== '/') {
    if (window.location.pathname.startsWith('/folder/')) {
      const parts = window.location.pathname.split('/').filter(p => p);
      if (parts.length >= 2) {
        folderParam = parts[1];
        if (parts.length === 3) {
          slug = parts[2];
        }
      }
    } else {
      slug = window.location.pathname.slice(1);
    }
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    slug = urlParams.get('slug');
    folderParam = urlParams.get('folder');
  }

  if (slug) {
    const media = allMedia.find(m => m.slug === slug);
    if (media) {
      showMediaDetail(media, false);
      return;
    }
  }

  if (folderParam) {
    selectedFolder = folderParam;
    document.getElementById('mediaContainer').classList.remove('hidden');
    document.getElementById('mediaDetail').classList.add('hidden');
    applyFilters();
    return;
  }

  // Default: show root gallery
  selectedFolder = '';
  document.getElementById('mediaContainer').classList.remove('hidden');
  document.getElementById('mediaDetail').classList.add('hidden');
  applyFilters();
}

window.addEventListener('popstate', handlePopState);

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadMedia();
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    applyFilters();
  });
});



