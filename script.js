// DOM Elements
const statusText = document.getElementById('statusText');
const statusSpinner = document.getElementById('statusSpinner');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const groupsContainer = document.getElementById('groupsContainer');
const postContent = document.getElementById('postContent');
const imageUpload = document.getElementById('imageUpload');
const imageUploadContainer = document.getElementById('imageUploadContainer');
const imagePreview = document.getElementById('imagePreview');
const selectAllButton = document.getElementById('selectAllButton');
const deselectAllButton = document.getElementById('deselectAllButton');
const previewPostButton = document.getElementById('previewPostButton');
const postToGroupsButton = document.getElementById('postToGroupsButton');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const postResults = document.getElementById('postResults');
const resultsMessage = document.getElementById('resultsMessage');
const selectedCount = document.getElementById('selectedCount');
const selectionInfo = document.getElementById('selectionInfo');
const groupsetName = document.getElementById('groupsetName');
const saveGroupsetButton = document.getElementById('saveGroupsetButton');
const groupsetList = document.getElementById('groupsetList');
const processingCount = document.getElementById('processingCount');
const successCount = document.getElementById('successCount');
const failedCount = document.getElementById('failedCount');

// New Enhanced Elements
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const pullToRefresh = document.getElementById('pullToRefresh');
const pullIndicator = document.getElementById('pullIndicator');
const postingControls = document.getElementById('postingControls');
const stopPostingButton = document.getElementById('stopPostingButton');
const skipCurrentButton = document.getElementById('skipCurrentButton');

// Global state
let allGroups = [];
let selectedGroups = new Set();
let currentImageFile = null;
let savedGroupsets = JSON.parse(localStorage.getItem('fb_groupsets')) || [];
let currentRequestId = null;
let eventSource = null;
let postResultsData = {};
let groupIdToNameMap = {};
let currentTheme = localStorage.getItem('theme') || 'light';
let modalResolve = null;
let pullStartY = 0;
let isPulling = false;
let isPosting = false;
let shouldStopPosting = false;
let shouldSkipCurrent = false;

// Enhanced Utility Functions
function showToast(message, type = 'info', duration = 3000) {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function showModal(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        modalResolve = resolve;
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalConfirm.textContent = confirmText;
        modalCancel.textContent = cancelText;
        confirmModal.classList.add('show');
    });
}

function hideModal() {
    confirmModal.classList.remove('show');
    if (modalResolve) {
        modalResolve(false);
        modalResolve = null;
    }
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
}

function handleImageDrop(files) {
    if (files && files[0] && files[0].type.startsWith('image/')) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            currentImageFile = file;
            showToast('Image uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    } else {
        showToast('Please upload a valid image file', 'error');
    }
}

// Initialize Enhanced Features
document.addEventListener('DOMContentLoaded', function() {
    console.log('Facebook Auto-Post Tool Loaded - Enhanced Version');
    
    // Initialize theme
    setTheme(currentTheme);
    
    // Setup enhanced features
    setupThemeToggle();
    setupDragAndDrop();
    setupModalSystem();
    setupPullToRefresh();
    setupKeyboardShortcuts();
    setupPostingControls();
    
    // Load existing functionality
    loadSavedGroupsets();
    fetchGroupsAuto();
});

// Theme Toggle Setup
function setupThemeToggle() {
    themeToggle.addEventListener('click', () => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        showToast(`Switched to ${newTheme} mode`, 'info');
    });
}

// Drag and Drop Setup
function setupDragAndDrop() {
    imageUploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadContainer.classList.add('drag-over');
    });

    imageUploadContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        imageUploadContainer.classList.remove('drag-over');
    });

    imageUploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadContainer.classList.remove('drag-over');
        handleImageDrop(e.dataTransfer.files);
    });

    imageUploadContainer.addEventListener('click', () => {
        imageUpload.click();
    });
}

// Modal System Setup
function setupModalSystem() {
    modalClose.addEventListener('click', hideModal);
    modalCancel.addEventListener('click', hideModal);
    
    modalConfirm.addEventListener('click', () => {
        confirmModal.classList.remove('show');
        if (modalResolve) {
            modalResolve(true);
            modalResolve = null;
        }
    });

    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            hideModal();
        }
    });
}

// Pull to Refresh Setup
function setupPullToRefresh() {
    if (!('ontouchstart' in window)) return; // Skip on desktop
    
    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            pullStartY = e.touches[0].clientY;
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && !isPulling) {
            const currentY = e.touches[0].clientY;
            const pullDistance = currentY - pullStartY;

            if (pullDistance > 60) {
                isPulling = true;
                pullToRefresh.classList.add('pulling');
                pullIndicator.innerHTML = '<span class="spinner"></span><span>Release to refresh...</span>';
            }
        }
    });

    document.addEventListener('touchend', () => {
        if (isPulling) {
            isPulling = false;
            pullToRefresh.classList.remove('pulling');
            pullIndicator.innerHTML = '<span class="spinner"></span><span>Pull to refresh...</span>';
            
            // Trigger refresh
            showToast('Refreshing groups...', 'info');
            fetchGroupsAuto();
        }
    });
}

// Keyboard Shortcuts Setup
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter or Cmd+Enter for quick posting
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !postToGroupsButton.disabled) {
            e.preventDefault();
            postToGroupsButton.click();
        }
        
        // Ctrl+A or Cmd+A for select all (when focused on groups)
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement === groupsContainer) {
            e.preventDefault();
            selectAllButton.click();
        }
        
        // Escape to close modal
        if (e.key === 'Escape' && confirmModal.classList.contains('show')) {
            hideModal();
        }
    });
}

// Posting Controls Setup
function setupPostingControls() {
    stopPostingButton.addEventListener('click', () => {
        if (currentRequestId) {
            fetch(`/stop_posting/${currentRequestId}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'stop_requested') {
                    showToast('Stopping all posting...', 'warning');
                    stopPostingButton.disabled = true;
                    skipCurrentButton.disabled = true;
                }
            })
            .catch(error => {
                console.error('Error stopping posting:', error);
                showToast('Error stopping posting', 'error');
            });
        }
    });

    skipCurrentButton.addEventListener('click', () => {
        if (currentRequestId) {
            fetch(`/skip_current/${currentRequestId}`, {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'skip_requested') {
                    showToast('Skipping current group...', 'info');
                    skipCurrentButton.disabled = true;
                    setTimeout(() => {
                        if (isPosting) {
                            skipCurrentButton.disabled = false;
                        }
                    }, 2000);
                }
            })
            .catch(error => {
                console.error('Error skipping current group:', error);
                showToast('Error skipping current group', 'error');
            });
        }
    });
}

// Clean up EventSource when page is unloaded
window.addEventListener('beforeunload', function() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
});

// Fetch groups from proxy
function fetchGroupsAuto() {
    showStatus('🔄 Loading your groups...', true);
    fetch('/fetch_groups', {
        method: 'POST',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(textData => {
        try {
            allGroups = parseGroupsFromText(textData);
            if (allGroups.length > 0) {
                showStatus(`✅ Loaded ${allGroups.length} groups`, false);
                displayGroups(allGroups);
                enableControls(true);
                // Create mapping from group ID to group name
                allGroups.forEach(group => {
                    groupIdToNameMap[group.id] = group.name;
                });
            } else {
                showStatus('❌ No groups found', false);
                groupsContainer.innerHTML = '<div class="empty-state">No groups found in the response</div>';
                console.log("Raw response for debugging:", textData);
            }
        } catch (error) {
            showStatus('❌ Error parsing groups', false);
            console.error("Parsing error:", error);
            groupsContainer.innerHTML = '<div class="empty-state">Error parsing groups. Check console.</div>';
        }
    })
    .catch(error => {
        showStatus('❌ Failed to load groups', false);
        console.error("Fetch error:", error);
        groupsContainer.innerHTML = '<div class="empty-state">Error: Could not connect to proxy server. Make sure it\'s running on port 5000.</div>';
    });
}

function showStatus(message, showSpinner) {
    statusText.textContent = message;
    statusSpinner.style.display = showSpinner ? 'block' : 'none';
}

function parseGroupsFromText(content) {
    console.log("Parsing Facebook response...");
    // Try multiple patterns to find groups
    const patterns = [
        /"node"\s*:\s*\{[^}]*?"id"\s*:\s*"(\d+)"[^}]*?"name"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*?"url"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*?"(?:profile_picture|picture)"[^}]*?"uri"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*\}[^}]*\}/g,
        /"id"\s*:\s*"(\d+)"[^}]*?"name"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*?"url"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*?"(?:profile_picture|picture|uri)"\s*:\s*"((?:[^"\\]|\\.)*)"/g
    ];
    const groups = [];
    const seen = new Set();
    for (const pattern of patterns) {
        const matches = [...content.matchAll(pattern)];
        for (const match of matches) {
            const [, id, rawName, rawUrl, rawPicture] = match;
            if (id && !seen.has(id)) {
                seen.add(id);
                const name = decodeUnicode(rawName);
                const url = fixUrl(decodeUnicode(rawUrl));
                const picture = rawPicture ? fixUrl(decodeUnicode(rawPicture)) : '';
                groups.push({ id, name, url, picture });
            }
        }
        if (groups.length > 0) break;
    }
    return groups;
}

function decodeUnicode(str) {
    return str.replace(/\\u([\dA-F]{4})/gi,
        (match, grp) => String.fromCharCode(parseInt(grp, 16))
    ).replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function fixUrl(url) {
    return url.replace(/\\\//g, '/').replace(/&amp;/g, '&');
}

function displayGroups(groups) {
    groupsContainer.innerHTML = '';
    groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.innerHTML = `
            <input type="checkbox" class="group-checkbox-input" value="${group.id}"
                   onchange="toggleGroup('${group.id}', this.checked)">
            <div class="group-image-container">
                <img src="${group.picture || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA0NSA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjIuNSIgY3k9IjIyLjUiIHI9IjIyLjUiIGZpbGw9IiNlNGU2ZWIiLz4KPHN2Zy8+PC9zdmc+'}"
                     alt="${group.name}" class="group-image"
                     onerror="this.src='image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA0NSA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjIuNSIgY3k9IjIyLjUiIHI9IjIyLjUiIGZpbGw9IiNlNGU2ZWIiLz4KPC9zdmc+'">
            </div>
            <div class="group-info">
                <div class="group-name">${group.name}</div>
                <a href="${group.url}" target="_blank" class="group-link">View</a>
            </div>
        `;
        groupsContainer.appendChild(groupItem);
    });
}

function toggleGroup(groupId, isSelected) {
    if (isSelected) {
        selectedGroups.add(groupId);
    } else {
        selectedGroups.delete(groupId);
    }
    updateSelectionInfo();
}

function updateSelectionInfo() {
    const count = selectedGroups.size;
    selectedCount.textContent = count;
    selectionInfo.textContent = count > 0 ?
        `Ready to post to ${count} group(s)` :
        'Select groups to post';
    selectionInfo.style.backgroundColor = count > 0 ? '#f0fff4' : '#e7f3ff';
}

function enableControls(isEnabled) {
    searchInput.disabled = !isEnabled;
    sortSelect.disabled = !isEnabled;
    selectAllButton.disabled = !isEnabled;
    deselectAllButton.disabled = !isEnabled;
    previewPostButton.disabled = !isEnabled;
    postToGroupsButton.disabled = !isEnabled;
    groupsetName.disabled = !isEnabled;
    saveGroupsetButton.disabled = !isEnabled;
}

// Load saved groupsets
function loadSavedGroupsets() {
    if (savedGroupsets.length === 0) return;
    groupsetList.innerHTML = '';
    savedGroupsets.forEach((groupset, index) => {
        const item = document.createElement('div');
        item.className = 'groupset-item';
        item.innerHTML = `
            <span>${groupset.name}</span>
            <div class="groupset-actions">
                <button class="groupset-btn" onclick="loadGroupset(${index})">Load</button>
                <button class="groupset-btn" onclick="deleteGroupset(${index})">Delete</button>
            </div>
        `;
        groupsetList.appendChild(item);
    });
}

// Global functions for HTML event handlers
window.toggleGroup = toggleGroup;
window.loadGroupset = function(index) {
    const groupset = savedGroupsets[index];
    selectedGroups.clear();
    document.querySelectorAll('.group-checkbox-input').forEach(cb => cb.checked = false);
    groupset.groups.forEach(groupId => {
        const checkbox = document.querySelector(`.group-checkbox-input[value="${groupId}"]`);
        if (checkbox) {
            checkbox.checked = true;
            selectedGroups.add(groupId);
        }
    });
    updateSelectionInfo();
    showToast(`Loaded "${groupset.name}"`, 'success');
};

window.deleteGroupset = async function(index) {
    const groupset = savedGroupsets[index];
    const confirmed = await showModal(
        'Delete Groupset',
        `Are you sure you want to delete "${groupset.name}"?`,
        'Delete',
        'Cancel'
    );
    
    if (confirmed) {
        savedGroupsets.splice(index, 1);
        localStorage.setItem('fb_groupsets', JSON.stringify(savedGroupsets));
        loadSavedGroupsets();
        showToast('Groupset deleted', 'success');
    }
};

// Event listeners
selectAllButton.addEventListener('click', () => {
    document.querySelectorAll('.group-checkbox-input').forEach(checkbox => {
        checkbox.checked = true;
        selectedGroups.add(checkbox.value);
    });
    updateSelectionInfo();
});

deselectAllButton.addEventListener('click', () => {
    document.querySelectorAll('.group-checkbox-input').forEach(checkbox => {
        checkbox.checked = false;
    });
    selectedGroups.clear();
    updateSelectionInfo();
});

searchInput.addEventListener('input', filterAndSortGroups);
sortSelect.addEventListener('change', filterAndSortGroups);

function filterAndSortGroups() {
    const searchTerm = searchInput.value.toLowerCase();
    const sortBy = sortSelect.value;
    let filtered = allGroups;
    if (searchTerm) {
        filtered = allGroups.filter(group =>
            group.name.toLowerCase().includes(searchTerm)
        );
    }
    filtered.sort((a, b) => {
        if (sortBy === 'nameDesc') {
            return b.name.localeCompare(a.name);
        }
        return a.name.localeCompare(b.name);
    });
    displayGroups(filtered);
}

// Image upload
imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        handleImageDrop([file]);
    }
});

// Save groupset
saveGroupsetButton.addEventListener('click', async function() {
    const name = groupsetName.value.trim();
    if (!name) {
        showToast('Please enter a name for your groupset', 'warning');
        return;
    }
    if (selectedGroups.size === 0) {
        showToast('Please select at least one group', 'warning');
        return;
    }
    
    const groupset = {
        name: name,
        groups: Array.from(selectedGroups),
        createdAt: new Date().toISOString()
    };
    savedGroupsets.push(groupset);
    localStorage.setItem('fb_groupsets', JSON.stringify(savedGroupsets));
    loadSavedGroupsets();
    groupsetName.value = '';
    showToast(`Groupset "${name}" saved!`, 'success');
});

// Post function

postToGroupsButton.addEventListener('click', async function() {
    const content = postContent.value.trim();
    const groupsToPost = Array.from(selectedGroups);
    if (!content) {
        showToast('Please write some post content first!', 'warning');
        return;
    }
    if (groupsToPost.length === 0) {
        showToast('Please select at least one group to post in!', 'warning');
        return;
    }
    
    // Confirm before posting with enhanced modal
    const preview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    const confirmed = await showModal(
        'Confirm Posting',
        `Post to ${groupsToPost.length} groups?\n\n"${preview}"`,
        'Post Now',
        'Cancel'
    );
    
    if (confirmed) {
        startPostingProcess(content, groupsToPost);
    }
});

// Add this function to poll for individual post results
function pollPostResults(requestId, groupIds) {
    let pollInterval = setInterval(() => {
        fetch(`/post_results/${requestId}`)
            .then(response => response.json())
            .then(data => {
                // Update each post result
                groupIds.forEach(groupId => {
                    if (data[groupId]) {
                        const result = data[groupId];
                        updatePostResultUI(
                            groupId,
                            result.status,
                            result.message,
                            result.post_url
                        );
                    }
                });
                // Check if all posts are completed
                const allCompleted = groupIds.every(groupId => {
                    const result = data[groupId] || {};
                    return result.status === 'success' || result.status === 'error';
                });
                if (allCompleted) {
                    clearInterval(pollInterval);
                    // Close EventSource when all posts are completed
                    if (eventSource) {
                        eventSource.close();
                        eventSource = null;
                    }
                    // Reset posting state
                    isPosting = false;
                    shouldStopPosting = false;
                    shouldSkipCurrent = false;
                    // Re-enable main button and hide posting controls
                    postToGroupsButton.disabled = false;
                    postingControls.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Error polling post results:', error);
            });
    }, 2000); // Poll every 2 seconds
    return pollInterval;
}

// Function to handle the actual posting
function startPostingProcess(content, groupIds) {
    // Generate a unique request ID
    currentRequestId = 'req_' + Date.now();
    
    // Reset state variables
    isPosting = true;
    shouldStopPosting = false;
    shouldSkipCurrent = false;
    
    // Reset UI
    postResults.innerHTML = '';
    resultsMessage.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = '0/0 groups completed';
    progressPercent.textContent = '0%';
    // Reset counters
    processingCount.textContent = groupIds.length;
    successCount.textContent = '0';
    failedCount.textContent = '0';
    // Initialize post results tracking
    postResultsData = {};
    groupIds.forEach(groupId => {
        postResultsData[groupId] = {
            status: 'processing',
            groupName: groupIdToNameMap[groupId] || `Group ${groupId}`,
            message: 'Waiting to start...',
            timestamp: new Date()
        };
    });
    // Create initial UI for all groups
    updateAllPostResultsUI();
    // Show posting controls and disable main button
    postToGroupsButton.disabled = true;
    postingControls.style.display = 'flex';
    stopPostingButton.disabled = false;
    // Prepare post data
    const postData = {
        content: content,
        groups: groupIds,
        delay: 3
    };
    // Start polling for results
    const pollInterval = pollPostResults(currentRequestId, groupIds);
    // Add photo if available
    if (currentImageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            postData.photo = e.target.result;
            sendPostRequest(postData, pollInterval);
        };
        reader.readAsDataURL(currentImageFile);
    } else {
        sendPostRequest(postData, pollInterval);
    }
}

// Function to send the post request
function sendPostRequest(postData, pollInterval) {
    fetch('/post_to_groups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': currentRequestId
        },
        body: JSON.stringify(postData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'processing') {
            // Start EventSource for real-time progress updates
            startProgressStream(currentRequestId);
        } else {
            throw new Error('Unexpected response from server');
        }
    })
    .catch(error => {
        console.error('Post request error:', error);
        alert('Error starting posting process. Check if proxy server is running.');
        resultsMessage.textContent = 'Posting failed - check console for details';
        resultsMessage.style.display = 'block';
        postToGroupsButton.disabled = false;
        previewPostButton.disabled = false;
        clearInterval(pollInterval);
    });
}

// Function to start EventSource for real-time progress updates
function startProgressStream(requestId) {
    // Close existing EventSource if any
    if (eventSource) {
        eventSource.close();
    }
    
    // Create new EventSource connection
    eventSource = new EventSource(`/post_progress?id=${requestId}`);
    
    eventSource.onmessage = function(event) {
        try {
            const progress = JSON.parse(event.data);
            
            // Update progress bar based on backend progress
            if (progress.percentage !== undefined) {
                progressFill.style.width = `${progress.percentage}%`;
                progressPercent.textContent = `${progress.percentage}%`;
            }
            
            if (progress.processed !== undefined && progress.total !== undefined) {
                progressText.textContent = `${progress.processed}/${progress.total} groups completed`;
            }
            
            // Check if posting is completed
            if (progress.status === 'completed') {
                console.log('Posting completed via EventSource');
                eventSource.close();
                eventSource = null;
            } else if (progress.status === 'error') {
                console.error('Posting error via EventSource:', progress.message);
                eventSource.close();
                eventSource = null;
            }
        } catch (error) {
            console.error('Error parsing progress data:', error);
        }
    };
    
    eventSource.onerror = function(event) {
        console.error('EventSource error:', event);
        // Don't close automatically, let it retry
    };
    
    eventSource.onopen = function(event) {
        console.log('EventSource connection opened for progress updates');
    };
}

// Function to update individual post result UI
function updatePostResultUI(groupId, status, message, postUrl) {
    if (postResultsData[groupId]) {
        postResultsData[groupId].status = status;
        postResultsData[groupId].message = message;
        postResultsData[groupId].postUrl = postUrl;
        postResultsData[groupId].timestamp = new Date();
        // Update counters
        updateCounters();
        // Update UI
        const resultElement = document.getElementById(`post-result-${groupId}`);
        if (resultElement) {
            // Update existing element
            resultElement.className = `post-result ${status}`;
            const statusIcon = resultElement.querySelector('.post-status-icon');
            const messageEl = resultElement.querySelector('.post-message');
            const actionsEl = resultElement.querySelector('.post-actions');
            const timestampEl = resultElement.querySelector('.post-timestamp');
            statusIcon.innerHTML = status === 'processing'
                ? '<div class="status-spinner"></div>'
                : status === 'success'
                    ? '<div class="status-success">✓</div>'
                    : '<div class="status-error">✗</div>';
            messageEl.textContent = message;
            timestampEl.textContent = new Date().toLocaleTimeString();
            // Update actions
            actionsEl.innerHTML = '';
            if (status === 'success' && postUrl) {
                actionsEl.innerHTML = `
                    <a href="${postUrl}" target="_blank" class="view-post-btn">
                        👁️ View Post
                    </a>
                `;
            }
        }
    }
}

// Function to update counters
function updateCounters() {
    let processing = 0;
    let success = 0;
    let failed = 0;
    Object.values(postResultsData).forEach(result => {
        if (result.status === 'processing') processing++;
        else if (result.status === 'success') success++;
        else if (result.status === 'error') failed++;
    });
    processingCount.textContent = processing;
    successCount.textContent = success;
    failedCount.textContent = failed;
    // Update progress bar based on completed posts
    const total = Object.keys(postResultsData).length;
    const completed = success + failed;
    const percent = (completed / total) * 100;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${completed}/${total} groups completed`;
    progressPercent.textContent = `${Math.round(percent)}%`;
    // Show completion message if all posts are done
    if (processing === 0 && total > 0) {
        resultsMessage.textContent = `Posting completed! ${success} successful, ${failed} failed.`;
        resultsMessage.style.display = 'block';
    }
}

// Function to update all post results UI
function updateAllPostResultsUI() {
    postResults.innerHTML = '';
    Object.keys(postResultsData).forEach(groupId => {
        createPostResultElement(groupId, postResultsData[groupId]);
    });
}

// Function to create a new post result element
function createPostResultElement(groupId, result) {
    const resultElement = document.createElement('div');
    resultElement.id = `post-result-${groupId}`;
    resultElement.className = `post-result ${result.status}`;
    resultElement.innerHTML = `
        <div class="post-status-icon">
            ${result.status === 'processing'
                ? '<div class="status-spinner"></div>'
                : result.status === 'success'
                    ? '<div class="status-success">✓</div>'
                    : '<div class="status-error">✗</div>'}
        </div>
        <div class="post-info">
            <div class="post-group-name">${result.groupName}</div>
            <div class="post-message">${result.message}</div>
            <div class="post-actions">
                ${result.status === 'success' && result.postUrl
                    ? `<a href="${result.postUrl}" target="_blank" class="view-post-btn">👁️ View Post</a>`
                    : ''}
            </div>
            <div class="post-timestamp">${result.timestamp.toLocaleTimeString()}</div>
        </div>
    `;
    postResults.appendChild(resultElement);
}
