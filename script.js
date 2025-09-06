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

// Authentication Elements
const authSection = document.getElementById('authSection');
const accountInfo = document.getElementById('accountInfo');
const showInstructionsButton = document.getElementById('showInstructionsButton');
const instructionsModal = document.getElementById('instructionsModal');
const instructionsModalClose = document.getElementById('instructionsModalClose');
const connectButton = document.getElementById('connectButton');
const cookieInput = document.getElementById('cookieInput');
const dtsgtokenInput = document.getElementById('dtsgtokenInput');
const useridInput = document.getElementById('useridInput');
const accountName = document.getElementById('accountName');
const logoutButton = document.getElementById('logoutButton');
const authSpinner = document.getElementById('authSpinner');
const authStatusText = document.getElementById('authStatusText');

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
let isAuthenticated = false;
let userName = '';
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
    try {
        // Try to parse as JSON first
        const jsonData = JSON.parse(content);
        const groups = [];
        const seen = new Set(); // To avoid duplicate groups
        
        // Helper function to extract groups from edges
        function extractGroupsFromEdges(edges, isAdmin = false) {
            edges.forEach(edge => {
                if (edge.node && !seen.has(edge.node.id)) {
                    const node = edge.node;
                    const group = {
                        id: node.id,
                        name: node.name || 'Unknown Group',
                        url: node.url || `https://facebook.com/groups/${node.id}`,
                        picture: node.profile_picture && node.profile_picture.uri ? node.profile_picture.uri : '',
                        isAdmin: isAdmin // Mark admin groups
                    };
                    groups.push(group);
                    seen.add(node.id);
                }
            });
        }
        
        // Parse non-admin groups (member groups)
        if (jsonData.data && jsonData.data.nonAdminGroups && 
            jsonData.data.nonAdminGroups.groups_tab && 
            jsonData.data.nonAdminGroups.groups_tab.tab_groups_list && 
            jsonData.data.nonAdminGroups.groups_tab.tab_groups_list.edges) {
            
            const memberEdges = jsonData.data.nonAdminGroups.groups_tab.tab_groups_list.edges;
            extractGroupsFromEdges(memberEdges, false);
        }
        
        // Parse admin groups - try multiple possible locations in response
        const adminPaths = [
            'adminGroups.groups_tab.tab_groups_list.edges',
            'adminGroups.edges', 
            'viewer.groups.admin_groups.edges',
            'viewer.groups.admin.edges'
        ];
        
        for (const path of adminPaths) {
            const pathParts = path.split('.');
            let current = jsonData.data;
            
            // Navigate through the path
            for (const part of pathParts) {
                if (current && current[part]) {
                    current = current[part];
                } else {
                    current = null;
                    break;
                }
            }
            
            if (current && Array.isArray(current)) {
                console.log(`Found admin groups at path: ${path}, count: ${current.length}`);
                extractGroupsFromEdges(current, true);
                break;
            }
        }
        
        // If no admin groups found, log the response structure for debugging
        if (groups.filter(g => g.isAdmin).length === 0) {
            console.log("Admin groups not found. Response keys:", Object.keys(jsonData.data || {}));
            if (jsonData.data) {
                for (const key of Object.keys(jsonData.data)) {
                    if (key !== 'nonAdminGroups') {
                        console.log(`Other data key: ${key}:`, jsonData.data[key]);
                    }
                }
            }
        }
        
        console.log(`Successfully parsed ${groups.length} groups (${groups.filter(g => g.isAdmin).length} admin, ${groups.filter(g => !g.isAdmin).length} member) from JSON response`);
        return groups;
        
    } catch (jsonError) {
        console.log("Failed to parse as JSON, trying regex patterns...", jsonError);
        
        // Fallback to regex patterns if JSON parsing fails
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
}

function decodeUnicode(str) {
    return str.replace(/\\u([\dA-F]{4})/gi,
        (match, grp) => String.fromCharCode(parseInt(grp, 16))
    ).replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function fixUrl(url) {
    return url.replace(/\\\//g, '/').replace(/&amp;/g, '&');
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function displayGroups(groups) {
    groupsContainer.innerHTML = '';
    groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        
        // Create elements safely without innerHTML to avoid HTML injection issues
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'group-checkbox-input';
        checkbox.value = group.id;
        checkbox.onchange = function() { toggleGroup(group.id, this.checked); };
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'group-image-container';
        
        const img = document.createElement('img');
        img.src = group.picture || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA0NSA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjIuNSIgY3k9IjIyLjUiIHI9IjIyLjUiIGZpbGw9IiNlNGU2ZWIiLz4KPHN2Zy8+PC9zdmc+';
        img.alt = group.name;
        img.className = 'group-image';
        img.onerror = function() { 
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA0NSA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjIuNSIgY3k9IjIyLjUiIHI9IjIyLjUiIGZpbGw9IiNlNGU2ZWIiLz4KPHN2Zy8+PC9zdmc+'; 
        };
        
        const groupInfo = document.createElement('div');
        groupInfo.className = 'group-info';
        
        const groupName = document.createElement('div');
        groupName.className = 'group-name';
        // Add admin indicator if user is admin of this group
        const displayName = group.isAdmin ? `👑 ${group.name}` : group.name;
        groupName.textContent = displayName; // textContent automatically escapes
        
        const groupLink = document.createElement('a');
        groupLink.href = group.url;
        groupLink.target = '_blank';
        groupLink.className = 'group-link';
        groupLink.textContent = 'View';
        
        // Assemble the elements
        imageContainer.appendChild(img);
        groupInfo.appendChild(groupName);
        groupInfo.appendChild(groupLink);
        
        groupItem.appendChild(checkbox);
        groupItem.appendChild(imageContainer);
        groupItem.appendChild(groupInfo);
        
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
    postToGroupsButton.disabled = !isEnabled;
    groupsetName.disabled = !isEnabled;
    saveGroupsetButton.disabled = !isEnabled;
}

// Load saved groupsets as pressable chips
function loadSavedGroupsets() {
    if (savedGroupsets.length === 0) {
        groupsetList.innerHTML = '<div class="empty-state">No saved group sets yet</div>';
        return;
    }
    groupsetList.innerHTML = '';
    savedGroupsets.forEach((groupset, index) => {
        const chip = document.createElement('div');
        chip.className = 'groupset-chip';
        
        // Create the main button area
        const button = document.createElement('button');
        button.className = 'groupset-button';
        button.onclick = () => loadGroupset(index);
        button.textContent = groupset.name;
        button.title = `Click to load "${groupset.name}" (${groupset.groups.length} groups)`;
        
        // Create the delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'groupset-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent loading the groupset when delete is clicked
            deleteGroupset(index);
        };
        deleteBtn.title = `Delete "${groupset.name}"`;
        
        // Assemble the chip
        chip.appendChild(button);
        chip.appendChild(deleteBtn);
        groupsetList.appendChild(chip);
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

// ===============================
// FACEBOOK AUTHENTICATION SYSTEM
// ===============================

// Check authentication status on page load
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth_status');
        const data = await response.json();
        
        isAuthenticated = data.authenticated;
        userName = data.user_name;
        
        updateAuthUI();
        
        if (isAuthenticated) {
            // Auto-load groups if authenticated
            await fetchGroups();
        } else {
            // Show login interface
            hideMainContent();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showToast('Error checking authentication status', 'error');
        hideMainContent();
    }
}

// Update authentication UI based on current state
function updateAuthUI() {
    if (isAuthenticated) {
        authSection.style.display = 'none';
        accountInfo.style.display = 'block';
        accountName.textContent = userName;
        showMainContent();
        statusText.textContent = 'Ready to post!';
        statusSpinner.style.display = 'none';
    } else {
        authSection.style.display = 'block';
        accountInfo.style.display = 'none';
        hideMainContent();
        statusText.textContent = 'Please connect your Facebook account first';
        statusSpinner.style.display = 'none';
    }
}

// Hide main content when not authenticated
function hideMainContent() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.opacity = '0.5';
        mainContent.style.pointerEvents = 'none';
    }
}

// Show main content when authenticated
function showMainContent() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.opacity = '1';
        mainContent.style.pointerEvents = 'auto';
    }
}

// Handle Facebook login button click
function handleFacebookLogin() {
    authSpinner.style.display = 'inline-block';
    authStatusText.textContent = 'Opening Facebook login...';
    
    // Show login popup
    loginPopup.classList.add('show');
    loginFrame.src = '/facebook_auth';
    
    // Listen for authentication success
    const messageHandler = (event) => {
        if (event.data && event.data.type === 'facebook_auth_success') {
            handleAuthSuccess(event.data.data);
            window.removeEventListener('message', messageHandler);
        }
    };
    
    window.addEventListener('message', messageHandler);
}

// Handle successful Facebook authentication
async function handleAuthSuccess(authData) {
    try {
        authStatusText.textContent = 'Saving authentication...';
        
        const response = await fetch('/save_auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(authData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            isAuthenticated = true;
            userName = result.user_name;
            
            // Hide popup and update UI
            loginPopup.classList.remove('show');
            updateAuthUI();
            
            showToast(`Welcome, ${userName}! 🎉`, 'success');
            
            // Load groups for the authenticated user
            await fetchGroups();
        } else {
            throw new Error(result.error || 'Failed to save authentication');
        }
    } catch (error) {
        console.error('Error saving authentication:', error);
        showToast('Failed to save authentication', 'error');
        authStatusText.textContent = 'Authentication failed';
    } finally {
        authSpinner.style.display = 'none';
    }
}

// Handle logout
async function handleLogout() {
    try {
        const confirmed = await showModal(
            'Confirm Logout',
            'Are you sure you want to logout? You will need to login again to use the app.',
            true
        );
        
        if (confirmed) {
            const response = await fetch('/logout', {
                method: 'POST'
            });
            
            if (response.ok) {
                isAuthenticated = false;
                userName = '';
                allGroups = [];
                selectedGroups.clear();
                
                // Clear UI
                groupsContainer.innerHTML = '<div class="empty-state">Please login to see your groups</div>';
                updateAuthUI();
                updateSelectedGroupsUI();
                
                showToast('Successfully logged out', 'success');
            }
        }
    } catch (error) {
        console.error('Error during logout:', error);
        showToast('Error during logout', 'error');
    }
}

// Close login popup
// Authentication Functions
function showInstructionsModal() {
    instructionsModal.style.display = 'flex';
}

function hideInstructionsModal() {
    instructionsModal.style.display = 'none';
}

async function handleManualConnect() {
    const cookies = cookieInput.value.trim();
    const dtsgToken = dtsgtokenInput.value.trim();
    const userId = useridInput.value.trim();
    
    if (!cookies || !dtsgToken || !userId) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    // Show loading state
    authSpinner.style.display = 'inline-block';
    authStatusText.textContent = 'Connecting to Facebook...';
    connectButton.disabled = true;
    
    try {
        // Send credentials to backend
        const response = await fetch('/connect_facebook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cookies: cookies,
                dtsg_token: dtsgToken,
                user_id: userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            userName = data.user_name || 'Facebook User';
            
            // Clear form
            cookieInput.value = '';
            dtsgtokenInput.value = '';
            useridInput.value = '';
            
            updateAuthUI();
            showToast('Successfully connected to Facebook!', 'success');
            
            // Fetch groups with new credentials
            await fetchGroups();
        } else {
            throw new Error(data.message || 'Failed to connect');
        }
    } catch (error) {
        console.error('Connection error:', error);
        showToast('Failed to connect: ' + error.message, 'error');
        authStatusText.textContent = 'Connection failed';
    } finally {
        authSpinner.style.display = 'none';
        connectButton.disabled = false;
    }
}

// Event Listeners for Authentication
showInstructionsButton.addEventListener('click', showInstructionsModal);
instructionsModalClose.addEventListener('click', hideInstructionsModal);
connectButton.addEventListener('click', handleManualConnect);
logoutButton.addEventListener('click', handleLogout);

// Close modal when clicking outside
instructionsModal.addEventListener('click', (e) => {
    if (e.target === instructionsModal) {
        hideInstructionsModal();
    }
});

// Initialize authentication check when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
});
