// State Management
let state = {
    schoolTitle: "우리학교 교실 배치도",
    buildings: [],
    rooms: {}, // Key: roomId (buildingId_floor_roomIndex), Value: { usage, color, code }
    selectedRooms: []
};

// DOM Elements
const elements = {
    schoolTitle: document.getElementById('schoolTitle'),
    editTitleBtn: document.getElementById('editTitleBtn'),
    addBuildingBtn: document.getElementById('addBuildingBtn'),
    buildingList: document.getElementById('buildingList'),
    canvasGrid: document.getElementById('canvasGrid'),
    canvasContainer: document.getElementById('canvasContainer'),
    emptyState: document.getElementById('emptyState'),
    
    // Batch Edit
    selectionBox: document.getElementById('selectionBox'),
    batchActionBar: document.getElementById('batchActionBar'),
    batchCountDisplay: document.getElementById('batchCountDisplay'),
    cancelBatchBtn: document.getElementById('cancelBatchBtn'),
    editBatchBtn: document.getElementById('editBatchBtn'),
    
    // Zoom
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomLevel: document.getElementById('zoomLevel'),
    printAllBtn: document.getElementById('printAllBtn'),
    
    // Building Modal
    buildingModalOverlay: document.getElementById('buildingModalOverlay'),
    buildingForm: document.getElementById('buildingForm'),
    buildingModalTitle: document.getElementById('buildingModalTitle'),
    buildingIdInput: document.getElementById('buildingId'),
    buildingNameInput: document.getElementById('buildingName'),
    buildingFloorsInput: document.getElementById('buildingFloors'),
    roomsPerFloorInput: document.getElementById('roomsPerFloor'),
    saveBuildingBtn: document.getElementById('saveBuildingBtn'),
    
    // Room Modal
    roomModalOverlay: document.getElementById('roomModalOverlay'),
    roomForm: document.getElementById('roomForm'),
    roomIdInput: document.getElementById('roomId'),
    displayRoomCode: document.getElementById('displayRoomCode'),
    roomUsageInput: document.getElementById('roomUsage'),
    roomIsBlankInput: document.getElementById('roomIsBlank'),
    roomColorInput: document.getElementById('roomColor'),
    customColorInput: document.getElementById('customColorInput'),
    colorOptions: document.querySelectorAll('.color-option'),
    saveRoomBtn: document.getElementById('saveRoomBtn'),
    mergeLeftBtn: document.getElementById('mergeLeftBtn'),
    mergeRightBtn: document.getElementById('mergeRightBtn'),
    mergeUpBtn: document.getElementById('mergeUpBtn'),
    mergeDownBtn: document.getElementById('mergeDownBtn'),
    shrinkLeftBtn: document.getElementById('shrinkLeftBtn'),
    shrinkRightBtn: document.getElementById('shrinkRightBtn'),
    shrinkUpBtn: document.getElementById('shrinkUpBtn'),
    shrinkDownBtn: document.getElementById('shrinkDownBtn'),
    splitRoomBtn: document.getElementById('splitRoomBtn'),
    resetRoomBtn: document.getElementById('resetRoomBtn'),
    deleteRoomBtn: document.getElementById('deleteRoomBtn'),
    deleteRightRoomBtn: document.getElementById('deleteRightRoomBtn'),
    
    // Title Modal
    titleModalOverlay: document.getElementById('titleModalOverlay'),
    schoolTitleInput: document.getElementById('schoolTitleInput'),
    saveTitleBtn: document.getElementById('saveTitleBtn'),

    // Data
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importInput: document.getElementById('importInput'),
    clearDataBtn: document.getElementById('clearDataBtn'),
};

let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX, startY;
let initialPanX, initialPanY;
let isDragAction = false;

let isSelecting = false;
let selectStartX = 0;
let selectStartY = 0;

// Building Drag State
let draggingBuildingId = null;
let bDragStartX, bDragStartY;
let initialBuildingX, initialBuildingY;

// Initialization
function init() {
    loadState();
    renderAll();
}

function loadState() {
    const saved = localStorage.getItem('classmapState');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.selectedRooms) state.selectedRooms = [];
            if (!state.rooms) state.rooms = {};
        } catch (e) {
            console.error("Failed to parse state", e);
        }
    }
}

function saveState() {
    localStorage.setItem('classmapState', JSON.stringify(state));
}

// Render Logic
function renderAll() {
    sanitizeVerticalMerges();
    healLostSpans();
    elements.schoolTitle.textContent = state.schoolTitle;
    renderSidebar();
    renderCanvas();
}

function healLostSpans() {
    state.buildings.forEach(building => {
        for (let floor = 1; floor <= building.floors; floor++) {
            const bIdAndFloor = `${building.id}_${floor}`;
            
            let topSpan = 0;
            for (let i = 1; i <= building.roomsPerFloor; i++) {
                const roomId = `${bIdAndFloor}_${i}`;
                if (state.rooms[roomId]) {
                    if (!state.rooms[roomId].hidden || state.rooms[roomId].hidden === 'placeholder') {
                        topSpan += parseFloat(state.rooms[roomId].span || 1);
                    }
                    if (state.rooms[roomId].subRooms) {
                        state.rooms[roomId].subRooms.forEach((sub, subIdx) => {
                            const subId = `${roomId}_sub${subIdx}`;
                            if (!state.rooms[subId] || !state.rooms[subId].hidden || state.rooms[subId].hidden === 'placeholder') {
                                topSpan += parseFloat((state.rooms[subId] && state.rooms[subId].span) ? state.rooms[subId].span : 0.5);
                            }
                        });
                    }
                }
            }
            if (topSpan < building.roomsPerFloor) {
                let missing = building.roomsPerFloor - topSpan;
                for (let i = building.roomsPerFloor; i >= 1 && missing >= 1.0; i--) {
                    const roomId = `${bIdAndFloor}_${i}`;
                    if (state.rooms[roomId] && state.rooms[roomId].hidden === true) {
                        state.rooms[roomId].hidden = false;
                        state.rooms[roomId].span = 1;
                        missing -= 1;
                    }
                }
                if (missing > 0) {
                    let lastBaseId = null;
                    for (let i = building.roomsPerFloor; i >= 1; i--) {
                        const rId = `${bIdAndFloor}_${i}`;
                        if (state.rooms[rId] && !state.rooms[rId].hidden) {
                            lastBaseId = rId;
                            break;
                        }
                    }
                    if (lastBaseId) {
                        if (!state.rooms[lastBaseId].subRooms) state.rooms[lastBaseId].subRooms = [];
                        let chunks = Math.floor(missing / 0.5);
                        let remainder = missing % 0.5;
                        for (let c = 0; c < chunks; c++) {
                            const newSubIdx = state.rooms[lastBaseId].subRooms.length;
                            state.rooms[lastBaseId].subRooms.push({});
                            const subId = `${lastBaseId}_sub${newSubIdx}`;
                            state.rooms[subId] = { usage: '', color: '#ffffff', code: '', span: 0.5, isBlank: true };
                        }
                        if (remainder > 0) {
                            const newSubIdx = state.rooms[lastBaseId].subRooms.length;
                            state.rooms[lastBaseId].subRooms.push({});
                            const subId = `${lastBaseId}_sub${newSubIdx}`;
                            state.rooms[subId] = { usage: '', color: '#ffffff', code: '', span: remainder, isBlank: true };
                        }
                    }
                }
            } else if (topSpan > building.roomsPerFloor) {
                let overflow = topSpan - building.roomsPerFloor;
                while (overflow > 0) {
                    let lastId = null;
                    for (let i = building.roomsPerFloor; i >= 1; i--) {
                        const rId = `${bIdAndFloor}_${i}`;
                        if (state.rooms[rId] && !state.rooms[rId].hidden && parseFloat(state.rooms[rId].span || 1) > 0) {
                            lastId = rId;
                            if (state.rooms[rId].subRooms && state.rooms[rId].subRooms.length > 0) {
                                for (let s = state.rooms[rId].subRooms.length - 1; s >= 0; s--) {
                                    const subId = `${rId}_sub${s}`;
                                    if ((!state.rooms[subId] || !state.rooms[subId].hidden) && parseFloat((state.rooms[subId] && state.rooms[subId].span) ? state.rooms[subId].span : 0.5) > 0) {
                                        lastId = subId; break;
                                    }
                                }
                            }
                            break;
                        }
                    }
                    if (!lastId) break;
                    if (!state.rooms[lastId]) {
                        state.rooms[lastId] = { usage: '', color: '#ffffff', code: '', span: 0.5, isBlank: true };
                    }
                    const currentSpan = parseFloat(state.rooms[lastId].span || (lastId.includes('_sub') ? 0.5 : 1));
                    const shrinkAmount = Math.min(currentSpan, overflow);
                    state.rooms[lastId].span = currentSpan - shrinkAmount;
                    if (state.rooms[lastId].span <= 0) state.rooms[lastId].hidden = true;
                    overflow -= shrinkAmount;
                }
            }
            
            if (building.corridorStyle === 'double') {
                let bottomSpan = 0;
                for (let i = building.roomsPerFloor + 1; i <= building.roomsPerFloor * 2; i++) {
                    const roomId = `${bIdAndFloor}_${i}`;
                    if (state.rooms[roomId]) {
                        if (!state.rooms[roomId].hidden || state.rooms[roomId].hidden === 'placeholder') {
                            bottomSpan += parseFloat(state.rooms[roomId].span || 1);
                        }
                        if (state.rooms[roomId].subRooms) {
                            state.rooms[roomId].subRooms.forEach((sub, subIdx) => {
                                const subId = `${roomId}_sub${subIdx}`;
                                if (!state.rooms[subId] || !state.rooms[subId].hidden || state.rooms[subId].hidden === 'placeholder') {
                                    bottomSpan += parseFloat((state.rooms[subId] && state.rooms[subId].span) ? state.rooms[subId].span : 0.5);
                                }
                            });
                        }
                    }
                }
                if (bottomSpan < building.roomsPerFloor) {
                    let missing = building.roomsPerFloor - bottomSpan;
                    for (let i = building.roomsPerFloor * 2; i > building.roomsPerFloor && missing >= 1.0; i--) {
                        const roomId = `${bIdAndFloor}_${i}`;
                        if (state.rooms[roomId] && state.rooms[roomId].hidden === true) {
                            state.rooms[roomId].hidden = false;
                            state.rooms[roomId].span = 1;
                            missing -= 1;
                        }
                    }
                    if (missing > 0) {
                        let lastBaseId = null;
                        for (let i = building.roomsPerFloor * 2; i > building.roomsPerFloor; i--) {
                            const rId = `${bIdAndFloor}_${i}`;
                            if (state.rooms[rId] && !state.rooms[rId].hidden) {
                                lastBaseId = rId;
                                break;
                            }
                        }
                        if (lastBaseId) {
                            if (!state.rooms[lastBaseId].subRooms) state.rooms[lastBaseId].subRooms = [];
                            let chunks = Math.floor(missing / 0.5);
                            let remainder = missing % 0.5;
                            for (let c = 0; c < chunks; c++) {
                                const newSubIdx = state.rooms[lastBaseId].subRooms.length;
                                state.rooms[lastBaseId].subRooms.push({});
                                const subId = `${lastBaseId}_sub${newSubIdx}`;
                                state.rooms[subId] = { usage: '', color: '#ffffff', code: '', span: 0.5, isBlank: true };
                            }
                            if (remainder > 0) {
                                const newSubIdx = state.rooms[lastBaseId].subRooms.length;
                                state.rooms[lastBaseId].subRooms.push({});
                                const subId = `${lastBaseId}_sub${newSubIdx}`;
                                state.rooms[subId] = { usage: '', color: '#ffffff', code: '', span: remainder, isBlank: true };
                            }
                        }
                    }
                } else if (bottomSpan > building.roomsPerFloor) {
                    let overflow = bottomSpan - building.roomsPerFloor;
                    while (overflow > 0) {
                        let lastId = null;
                        for (let i = building.roomsPerFloor * 2; i > building.roomsPerFloor; i--) {
                            const rId = `${bIdAndFloor}_${i}`;
                            if (state.rooms[rId] && !state.rooms[rId].hidden && parseFloat(state.rooms[rId].span || 1) > 0) {
                                lastId = rId;
                                if (state.rooms[rId].subRooms && state.rooms[rId].subRooms.length > 0) {
                                    for (let s = state.rooms[rId].subRooms.length - 1; s >= 0; s--) {
                                        const subId = `${rId}_sub${s}`;
                                        if ((!state.rooms[subId] || !state.rooms[subId].hidden) && parseFloat((state.rooms[subId] && state.rooms[subId].span) ? state.rooms[subId].span : 0.5) > 0) {
                                            lastId = subId; break;
                                        }
                                    }
                                }
                                break;
                            }
                        }
                        if (!lastId) break;
                        if (!state.rooms[lastId]) {
                            state.rooms[lastId] = { usage: '', color: '#ffffff', code: '', span: 0.5, isBlank: true };
                        }
                        const currentSpan = parseFloat(state.rooms[lastId].span || (lastId.includes('_sub') ? 0.5 : 1));
                        const shrinkAmount = Math.min(currentSpan, overflow);
                        state.rooms[lastId].span = currentSpan - shrinkAmount;
                        if (state.rooms[lastId].span <= 0) state.rooms[lastId].hidden = true;
                        overflow -= shrinkAmount;
                    }
                }
            }
        }
    });
}

function sanitizeVerticalMerges() {
    for (const roomId in state.rooms) {
        const roomData = state.rooms[roomId];
        
        if (roomData.hidden === true) {
            if (roomData.mergedDown) {
                const tId = getVerticalTargetRoomId(roomId, 'down');
                if (tId && state.rooms[tId]) state.rooms[tId].hidden = false;
                roomData.mergedDown = false;
            }
            if (roomData.mergedUp) {
                const tId = getVerticalTargetRoomId(roomId, 'up');
                if (tId && state.rooms[tId]) state.rooms[tId].hidden = false;
                roomData.mergedUp = false;
            }
        }
        
        if (roomData.hidden === 'placeholder') {
            const tIdUp = getVerticalTargetRoomId(roomId, 'up');
            const tIdDown = getVerticalTargetRoomId(roomId, 'down');
            
            let hasValidSource = false;
            if (tIdUp && state.rooms[tIdUp] && state.rooms[tIdUp].mergedDown && !state.rooms[tIdUp].hidden) hasValidSource = true;
            if (tIdDown && state.rooms[tIdDown] && state.rooms[tIdDown].mergedUp && !state.rooms[tIdDown].hidden) hasValidSource = true;
            
            if (!hasValidSource) {
                roomData.hidden = false;
            }
        }
    }
}

function updateBatchUI() {
    if (state.selectedRooms.length > 0) {
        elements.batchActionBar.style.display = 'flex';
        elements.batchCountDisplay.textContent = `${state.selectedRooms.length}개 교실 선택됨`;
    } else {
        elements.batchActionBar.style.display = 'none';
    }
}

function renderSidebar() {
    elements.buildingList.innerHTML = '';
    
    if (state.buildings.length === 0) {
        elements.buildingList.innerHTML = '<li style="text-align:center; color: var(--text-muted); font-size:0.875rem;">등록된 건물이 없습니다.</li>';
        return;
    }

    state.buildings.forEach(building => {
        const li = document.createElement('li');
        li.className = 'building-item';
        
        const totalRooms = building.corridorStyle === 'double' ? building.floors * building.roomsPerFloor * 2 : building.floors * building.roomsPerFloor;
        const formatText = building.codeFormat === 'floor-room' ? '층수포함' : '순차번호';
        const styleText = building.corridorStyle === 'double' ? '중복도' : '편복도';

        li.innerHTML = `
            <div class="building-info">
                <h4>${building.name}</h4>
                <p>${building.floors}층 / 한쪽 ${building.roomsPerFloor}실 / ${styleText} / ${formatText}</p>
            </div>
            <div class="building-actions">
                <button class="btn btn-icon edit-building" data-id="${building.id}"><ion-icon name="pencil-outline"></ion-icon></button>
                <button class="btn btn-icon delete-building" data-id="${building.id}" style="color: var(--danger);"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        `;
        elements.buildingList.appendChild(li);
    });

    // Attach events
    document.querySelectorAll('.edit-building').forEach(btn => {
        btn.addEventListener('click', (e) => openBuildingModal(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.delete-building').forEach(btn => {
        btn.addEventListener('click', (e) => deleteBuilding(e.currentTarget.dataset.id));
    });
}

function getRoomHtml(roomId, physicalCode) {
    const roomData = state.rooms[roomId];
    
    let html = '';
    
    if (roomData.hidden === 'placeholder') {
        const span = roomData.span || 1;
        const width = span * 120;
        html += `<div class="map-room placeholder" data-id="${roomId}" style="width: ${width}px;"></div>`;
    } else if (!roomData.hidden) {
        const span = roomData.span || 1;
        const width = span * 120;
        const isBlankClass = roomData.isBlank ? 'blank' : '';
        const isSelectedClass = (state.selectedRooms && state.selectedRooms.includes(roomId)) ? 'selected' : '';
        const isNarrowClass = span < 1 ? 'narrow' : '';
        const mergeClass = roomData.mergedDown ? 'merged-down' : (roomData.mergedUp ? 'merged-up' : '');
        
        html += `
            <div class="map-room ${isBlankClass} ${isSelectedClass} ${isNarrowClass} ${mergeClass}" data-id="${roomId}" style="background-color: ${roomData.color}; width: ${width}px;">
                <div class="room-usage">${roomData.usage}</div>
                <div class="room-code">${physicalCode}</div>
            </div>
        `;
    }

    if (roomData.subRooms && roomData.subRooms.length > 0) {
        roomData.subRooms.forEach((sub, subIdx) => {
            const subId = `${roomId}_sub${subIdx}`;
            const subCode = `${physicalCode}-${subIdx + 1}`;
            if (!state.rooms[subId]) {
                state.rooms[subId] = { usage: '', color: '#ffffff', code: subCode, span: 0.5 };
            }
            const subData = state.rooms[subId];
            if (subData.hidden === 'placeholder') {
                const subSpan = subData.span || 0.5;
                const subWidth = subSpan * 120;
                html += `<div class="map-room placeholder" data-id="${subId}" style="width: ${subWidth}px;"></div>`;
                return;
            }
            if (subData.hidden) return;
            
            const subSpan = subData.span || 0.5;
            const subWidth = subSpan * 120;
            const subBlankClass = subData.isBlank ? 'blank' : '';
            const subSelectedClass = (state.selectedRooms && state.selectedRooms.includes(subId)) ? 'selected' : '';
            const subNarrowClass = subSpan < 1 ? 'narrow' : '';
            const mergeClass = subData.mergedDown ? 'merged-down' : (subData.mergedUp ? 'merged-up' : '');
            
            html += `
                <div class="map-room ${subBlankClass} ${subSelectedClass} ${subNarrowClass} ${mergeClass}" data-id="${subId}" style="background-color: ${subData.color}; width: ${subWidth}px;">
                    <div class="room-usage">${subData.usage}</div>
                    <div class="room-code">${subCode}</div>
                </div>
            `;
        });
    }
    return html;
}

function renderCanvas() {
    elements.canvasGrid.innerHTML = '';
    
    if (state.buildings.length === 0) {
        elements.canvasGrid.appendChild(elements.emptyState);
        return;
    }

    state.buildings.forEach((building, idx) => {
        if (building.x === undefined) building.x = 50 + (idx * 50);
        if (building.y === undefined) building.y = 50 + (idx * 50);

        const bEl = document.createElement('div');
        bEl.className = 'map-building';
        bEl.style.left = building.x + 'px';
        bEl.style.top = building.y + 'px';
        
        let floorsHtml = '';
        let stateModified = false;
        
        // Render floors from top to bottom
        for (let floor = building.floors; floor >= 1; floor--) {
            if (building.corridorStyle === 'double') {
                let topRoomsHtml = '';
                let bottomRoomsHtml = '';
                
                for (let i = 1; i <= building.roomsPerFloor; i++) {
                    const topRoomIdx = i;
                    const bottomRoomIdx = i + building.roomsPerFloor;
                    
                    const topRoomId = `${building.id}_${floor}_${topRoomIdx}`;
                    const bottomRoomId = `${building.id}_${floor}_${bottomRoomIdx}`;
                    
                    const topPhysicalCode = generatePhysicalCode(building, floor, topRoomIdx);
                    const bottomPhysicalCode = generatePhysicalCode(building, floor, bottomRoomIdx);
                    
                    if (!state.rooms[topRoomId]) {
                        state.rooms[topRoomId] = { usage: '', color: '#ffffff', code: topPhysicalCode, span: 1, isBlank: false };
                        stateModified = true;
                    } else {
                        state.rooms[topRoomId].code = topPhysicalCode;
                    }
                    
                    if (!state.rooms[bottomRoomId]) {
                        state.rooms[bottomRoomId] = { usage: '', color: '#ffffff', code: bottomPhysicalCode, span: 1, isBlank: false };
                        stateModified = true;
                    } else {
                        state.rooms[bottomRoomId].code = bottomPhysicalCode;
                    }
                    
                    topRoomsHtml += getRoomHtml(topRoomId, topPhysicalCode);
                    bottomRoomsHtml += getRoomHtml(bottomRoomId, bottomPhysicalCode);
                }
                
                floorsHtml += `
                    <div class="map-floor">
                        <div class="floor-label">${floor}F</div>
                        <div class="floor-content">
                            <div class="floor-rooms">${topRoomsHtml}</div>
                            <div class="corridor">중앙 복도</div>
                            <div class="floor-rooms">${bottomRoomsHtml}</div>
                        </div>
                    </div>
                `;
            } else {
                let roomsHtml = '';
                for (let roomIdx = 1; roomIdx <= building.roomsPerFloor; roomIdx++) {
                    const roomId = `${building.id}_${floor}_${roomIdx}`;
                    const physicalCode = generatePhysicalCode(building, floor, roomIdx);
                    
                    if (!state.rooms[roomId]) {
                        state.rooms[roomId] = { usage: '', color: '#ffffff', code: physicalCode, span: 1, isBlank: false };
                        stateModified = true;
                    } else {
                        state.rooms[roomId].code = physicalCode;
                    }
                    
                    roomsHtml += getRoomHtml(roomId, physicalCode);
                }
                
                floorsHtml += `
                    <div class="map-floor">
                        <div class="floor-label">${floor}F</div>
                        <div class="floor-content">
                            <div class="floor-rooms">${roomsHtml}</div>
                        </div>
                    </div>
                `;
            }
        }

        bEl.innerHTML = `
            <div class="map-building-header" data-id="${building.id}">
                <h3>${building.name}</h3>
                <button class="btn btn-icon print-building-btn" data-id="${building.id}" title="건물 인쇄" style="position: absolute; right: 10px; top: 10px; padding: 2px;"><ion-icon name="print-outline"></ion-icon></button>
            </div>
            <div class="map-floors">
                ${floorsHtml}
            </div>
        `;
        elements.canvasGrid.appendChild(bEl);
    });

    // Attach room click events
    document.querySelectorAll('.map-room').forEach(room => {
        room.addEventListener('click', (e) => {
            if (isDragAction) return;
            const roomId = e.currentTarget.dataset.id;
            
            if (e.shiftKey) {
                if (state.selectedRooms.includes(roomId)) {
                    state.selectedRooms = state.selectedRooms.filter(id => id !== roomId);
                } else {
                    state.selectedRooms.push(roomId);
                }
                updateBatchUI();
                renderAll();
            } else {
                if (state.selectedRooms.length > 0) {
                    state.selectedRooms = [];
                    updateBatchUI();
                    renderAll();
                }
                openRoomModal(roomId);
            }
        });
    });

    // Attach building drag events
    document.querySelectorAll('.map-building-header').forEach(header => {
        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation(); // Prevent canvas pan
            const buildingId = e.currentTarget.dataset.id;
            draggingBuildingId = buildingId;
            const building = state.buildings.find(b => b.id === buildingId);
            initialBuildingX = building.x;
            initialBuildingY = building.y;
            bDragStartX = e.clientX;
            bDragStartY = e.clientY;
            const bEl = e.currentTarget.closest('.map-building');
            bEl.style.zIndex = 100;
            isDragAction = false;
        });
    });

    // Attach building print events
    document.querySelectorAll('.print-building-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bEl = e.currentTarget.closest('.map-building');
            smartPrint('single', bEl);
        });
    });

    if (stateModified) {
        saveState();
    }
}

function generatePhysicalCode(building, floor, roomIdx) {
    if (building.codeFormat === 'floor-room') {
        const floorStr = floor.toString();
        const roomStr = roomIdx.toString().padStart(2, '0');
        return `${building.name}-${floorStr}${roomStr}`;
    } else {
        // Sequential
        const roomsPerFloorTotal = building.corridorStyle === 'double' ? building.roomsPerFloor * 2 : building.roomsPerFloor;
        const totalIdx = ((floor - 1) * roomsPerFloorTotal) + roomIdx;
        return `${building.name}-${totalIdx}`;
    }
}

// Modal Logic
function openModal(overlay) {
    overlay.classList.add('active');
}

function closeModal(overlay) {
    overlay.classList.remove('active');
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        closeModal(e.target.closest('.modal-overlay'));
    });
});

// Building Management
function openBuildingModal(id = null) {
    if (id) {
        const b = state.buildings.find(b => b.id === id);
        elements.buildingModalTitle.textContent = "건물 수정";
        elements.buildingIdInput.value = b.id;
        elements.buildingNameInput.value = b.name;
        elements.buildingFloorsInput.value = b.floors;
        elements.roomsPerFloorInput.value = b.roomsPerFloor;
        
        const codeFormatRadio = document.querySelector(`input[name="codeFormat"][value="${b.codeFormat}"]`);
        if (codeFormatRadio) codeFormatRadio.checked = true;
        
        const corridorRadio = document.querySelector(`input[name="corridorStyle"][value="${b.corridorStyle || 'single'}"]`);
        if (corridorRadio) corridorRadio.checked = true;
    } else {
        elements.buildingModalTitle.textContent = "건물 추가";
        elements.buildingForm.reset();
        elements.buildingIdInput.value = '';
    }
    openModal(elements.buildingModalOverlay);
}

elements.addBuildingBtn.addEventListener('click', () => openBuildingModal());

elements.saveBuildingBtn.addEventListener('click', () => {
    if (!elements.buildingNameInput.value) return alert("건물 이름을 입력하세요.");
    
    const id = elements.buildingIdInput.value || 'b_' + Date.now();
    const newBuilding = {
        id,
        name: elements.buildingNameInput.value,
        floors: parseInt(elements.buildingFloorsInput.value),
        roomsPerFloor: parseInt(elements.roomsPerFloorInput.value),
        codeFormat: document.querySelector('input[name="codeFormat"]:checked').value,
        corridorStyle: document.querySelector('input[name="corridorStyle"]:checked').value
    };

    const existingIdx = state.buildings.findIndex(b => b.id === id);
    if (existingIdx >= 0) {
        state.buildings[existingIdx] = newBuilding;
    } else {
        state.buildings.push(newBuilding);
    }

    saveState();
    renderAll();
    closeModal(elements.buildingModalOverlay);
});

function deleteBuilding(id) {
    if (confirm('이 건물을 삭제하시겠습니까? 건물 안의 모든 교실 설정이 삭제됩니다.')) {
        state.buildings = state.buildings.filter(b => b.id !== id);
        // Clean up rooms
        Object.keys(state.rooms).forEach(key => {
            if (key.startsWith(id + '_')) {
                delete state.rooms[key];
            }
        });
        saveState();
        renderAll();
    }
}

function getRoomContext(roomId) {
    const targetId = roomId.includes('_sub') ? roomId.split('_sub')[0] : roomId;
    const parts = targetId.split('_');
    const roomIdx = parseInt(parts.pop());
    const floor = parts.pop();
    const buildingId = parts.join('_');
    const bIdAndFloor = `${buildingId}_${floor}`;
    const building = state.buildings.find(b => b.id === buildingId);
    return { bIdAndFloor, building, baseRoomIdx: roomIdx };
}

function getVisibleRoomsOnFloor(bIdAndFloor, building, baseRoomIdx) {
    let startIdx = 1;
    let endIdx = building.roomsPerFloor;
    if (building.corridorStyle === 'double' && baseRoomIdx > building.roomsPerFloor) {
        startIdx = building.roomsPerFloor + 1;
        endIdx = building.roomsPerFloor * 2;
    }
    
    let visible = [];
    for (let i = startIdx; i <= endIdx; i++) {
        const roomId = `${bIdAndFloor}_${i}`;
        const roomData = state.rooms[roomId];
        if (!roomData) continue;
        
        if (!roomData.hidden) {
            visible.push({ id: roomId, span: roomData.span || 1, data: roomData, isBase: true, baseIdx: i });
        }
        
        if (roomData.subRooms && roomData.subRooms.length > 0) {
            roomData.subRooms.forEach((sub, subIdx) => {
                const subId = `${roomId}_sub${subIdx}`;
                const subData = state.rooms[subId];
                if (subData && !subData.hidden) {
                    visible.push({ id: subId, span: subData.span || 1, data: subData, isBase: false, baseIdx: i, subIdx: subIdx });
                }
            });
        }
    }
    return visible;
}

// Room Management
function openRoomModal(roomId) {
    const isBatch = state.selectedRooms.length > 0 && !roomId;
    
    if (isBatch) {
        elements.roomIdInput.value = 'BATCH';
        elements.displayRoomCode.textContent = `다중 선택됨 (${state.selectedRooms.length}개)`;
        elements.roomUsageInput.value = '';
        elements.roomUsageInput.placeholder = '입력 시 일괄 변경, 비워두면 유지';
        elements.roomColorInput.value = '';
        elements.roomIsBlankInput.checked = false;
        
        elements.colorOptions.forEach(opt => opt.classList.remove('selected'));
        
        const actions = document.querySelector('.room-size-actions');
        if (actions) actions.style.display = 'none';
    } else {
        const room = state.rooms[roomId];
        elements.roomIdInput.value = roomId;
        elements.displayRoomCode.textContent = room.code;
        elements.roomUsageInput.value = room.usage;
        elements.roomUsageInput.placeholder = '예: 1-1, 음악실, 교무실';
        elements.roomColorInput.value = room.color;
        elements.roomIsBlankInput.checked = room.isBlank || false;

        elements.colorOptions.forEach(opt => {
            if (opt.dataset.color === room.color) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
        
        const actions = document.querySelector('.room-size-actions');
        if (actions) actions.style.display = '';
    }

    openModal(elements.roomModalOverlay);
    setTimeout(() => {
        elements.roomUsageInput.focus();
        elements.roomUsageInput.select();
    }, 100);
}

elements.colorOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
        elements.colorOptions.forEach(o => o.classList.remove('selected'));
        e.target.classList.add('selected');
        elements.roomColorInput.value = e.target.dataset.color;
    });
});

if (elements.customColorInput) {
    elements.customColorInput.addEventListener('input', (e) => {
        elements.roomColorInput.value = e.target.value;
        elements.colorOptions.forEach(o => o.classList.remove('selected'));
    });
}

if (elements.printAllBtn) {
    elements.printAllBtn.addEventListener('click', () => {
        smartPrint('all');
    });
}

elements.saveRoomBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    const newUsage = elements.roomUsageInput.value;
    const newColor = elements.roomColorInput.value;
    const newIsBlank = elements.roomIsBlankInput.checked;
    
    if (roomId === 'BATCH') {
        state.selectedRooms.forEach(id => {
            if (state.rooms[id]) {
                if (newUsage.trim() !== '') state.rooms[id].usage = newUsage;
                if (newColor !== '') state.rooms[id].color = newColor;
                state.rooms[id].isBlank = newIsBlank;
            }
        });
        state.selectedRooms = [];
        updateBatchUI();
    } else {
        state.rooms[roomId].usage = newUsage;
        state.rooms[roomId].color = newColor;
        state.rooms[roomId].isBlank = newIsBlank;
    }
    
    saveState();
    renderAll();
    closeModal(elements.roomModalOverlay);
});

elements.roomUsageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        elements.saveRoomBtn.click();
    }
});

if (elements.buildingForm) {
    elements.buildingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        elements.saveBuildingBtn.click();
    });
}

if (elements.roomForm) {
    elements.roomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        elements.saveRoomBtn.click();
    });
}

function getVerticalTargetRoomId(roomId, direction) {
    const { bIdAndFloor, building, baseRoomIdx } = getRoomContext(roomId);
    if (building.corridorStyle !== 'double') return null;
    
    let targetBaseIdx;
    if (direction === 'down') {
        if (baseRoomIdx > building.roomsPerFloor) return null;
        targetBaseIdx = baseRoomIdx + building.roomsPerFloor;
    } else {
        if (baseRoomIdx <= building.roomsPerFloor) return null;
        targetBaseIdx = baseRoomIdx - building.roomsPerFloor;
    }
    
    return roomId.includes('_sub') 
        ? `${bIdAndFloor}_${targetBaseIdx}_sub${roomId.split('_sub')[1]}`
        : `${bIdAndFloor}_${targetBaseIdx}`;
}

function handleVerticalMerge(direction) {
    const roomId = elements.roomIdInput.value;
    const roomData = state.rooms[roomId];
    
    const targetRoomId = getVerticalTargetRoomId(roomId, direction);
    if (!targetRoomId) return alert(direction === 'up' ? "위쪽에 합칠 방이 없습니다." : "아래쪽에 합칠 방이 없습니다.");
    
    const targetData = state.rooms[targetRoomId];
    if (!targetData) return alert("대상 방이 존재하지 않습니다.");
    if (targetData.hidden) return alert("대상 방이 이미 다른 방과 합쳐져 있습니다.");
    
    const mySpan = roomData.span || (roomId.includes('_sub') ? 0.5 : 1);
    const targetSpan = targetData.span || (targetRoomId.includes('_sub') ? 0.5 : 1);
    
    if (mySpan !== targetSpan) {
        return alert("위아래 교실의 폭(칸 수)이 정확히 일치해야만 합칠 수 있습니다.");
    }
    
    if (direction === 'down') roomData.mergedDown = true;
    else roomData.mergedUp = true;
    
    targetData.hidden = 'placeholder';
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
}

function handleVerticalShrink(direction) {
    const roomId = elements.roomIdInput.value;
    const roomData = state.rooms[roomId];
    
    if (direction === 'down') {
        if (!roomData.mergedDown) return alert("아래로 합쳐진 상태가 아닙니다.");
        roomData.mergedDown = false;
    } else {
        if (!roomData.mergedUp) return alert("위로 합쳐진 상태가 아닙니다.");
        roomData.mergedUp = false;
    }
    
    const targetRoomId = getVerticalTargetRoomId(roomId, direction);
    if (targetRoomId && state.rooms[targetRoomId]) {
        state.rooms[targetRoomId].hidden = false;
    }
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
}

elements.mergeUpBtn.addEventListener('click', () => handleVerticalMerge('up'));
elements.mergeDownBtn.addEventListener('click', () => handleVerticalMerge('down'));
elements.shrinkUpBtn.addEventListener('click', () => handleVerticalShrink('up'));
elements.shrinkDownBtn.addEventListener('click', () => handleVerticalShrink('down'));

elements.mergeRightBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    const { bIdAndFloor, building, baseRoomIdx } = getRoomContext(roomId);
    
    const visibleRooms = getVisibleRoomsOnFloor(bIdAndFloor, building, baseRoomIdx);
    const myIndex = visibleRooms.findIndex(r => r.id === roomId);
    
    if (myIndex === -1 || myIndex === visibleRooms.length - 1) return alert("오른쪽에 더 이상 합칠 방이 없습니다.");
    const rightRoom = visibleRooms[myIndex + 1];
    
    const myData = state.rooms[roomId];
    const rightData = state.rooms[rightRoom.id];
    
    myData.span = (myData.span || 1) + (rightData.span || 1);
    rightData.hidden = true;
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
});

elements.mergeLeftBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    const { bIdAndFloor, building, baseRoomIdx } = getRoomContext(roomId);
    
    const visibleRooms = getVisibleRoomsOnFloor(bIdAndFloor, building, baseRoomIdx);
    const myIndex = visibleRooms.findIndex(r => r.id === roomId);
    
    if (myIndex <= 0) return alert("왼쪽에 합칠 방이 없습니다.");
    const leftRoom = visibleRooms[myIndex - 1];
    
    const myData = state.rooms[roomId];
    const leftData = state.rooms[leftRoom.id];
    
    leftData.span = (leftData.span || 1) + (myData.span || 1);
    myData.hidden = true;
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
});

elements.shrinkRightBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    const roomData = state.rooms[roomId];
    if ((roomData.span || 1) <= 1.0) return alert("더 이상 줄일 수 없습니다.");
    
    const { bIdAndFloor, baseRoomIdx } = getRoomContext(roomId);
    const offset = roomId.includes('_sub') ? baseRoomIdx - 1 + 0.5 : baseRoomIdx - 1;
    
    roomData.span -= 1.0;
    
    const unhideIdx = Math.floor(offset + roomData.span) + 1;
    const unhideRoomId = `${bIdAndFloor}_${unhideIdx}`;
    
    if (state.rooms[unhideRoomId]) {
        state.rooms[unhideRoomId].hidden = false;
        state.rooms[unhideRoomId].span = 1;
        state.rooms[unhideRoomId].usage = '';
        state.rooms[unhideRoomId].color = '#ffffff';
    }
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
});

elements.shrinkLeftBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    if (roomId.includes('_sub')) return alert("반 칸이 포함된 방은 왼쪽으로 줄일 수 없습니다. '원래대로'를 사용해주세요.");
    
    const roomData = state.rooms[roomId];
    if ((roomData.span || 1) <= 1.0) return alert("더 이상 줄일 수 없습니다.");
    
    const { bIdAndFloor, baseRoomIdx, building } = getRoomContext(roomId);
    const endIdx = (building.corridorStyle === 'double' && baseRoomIdx <= building.roomsPerFloor) ? building.roomsPerFloor : (building.corridorStyle === 'double' ? building.roomsPerFloor * 2 : building.roomsPerFloor);
    if (baseRoomIdx >= endIdx) return alert("해당 줄의 가장 마지막 방은 왼쪽으로 줄일 수 없습니다.");
    
    const nextRoomId = `${bIdAndFloor}_${baseRoomIdx + 1}`;
    const nextRoomData = state.rooms[nextRoomId];
    
    if (nextRoomData) {
        nextRoomData.hidden = false;
        nextRoomData.span = roomData.span - 1.0;
        nextRoomData.usage = roomData.usage;
        nextRoomData.color = roomData.color;
    }
    
    roomData.span = 1;
    roomData.usage = '';
    roomData.color = '#ffffff';
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
});

elements.splitRoomBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    if (roomId.includes('_sub')) return alert("이미 분할된 방입니다.");
    
    const roomData = state.rooms[roomId];
    if (roomData.span && roomData.span > 1) return alert("합쳐진 방은 나눌 수 없습니다. 원래대로 복구해 주세요.");
    
    roomData.span = 0.5;
    roomData.subRooms = [{}];
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
});

elements.resetRoomBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    const targetId = roomId.includes('_sub') ? roomId.split('_sub')[0] : roomId;
    
    if (state.rooms[targetId]) {
        if (state.rooms[targetId].mergedDown) {
            const tId = getVerticalTargetRoomId(targetId, 'down');
            if (tId && state.rooms[tId]) state.rooms[tId].hidden = false;
        }
        if (state.rooms[targetId].mergedUp) {
            const tId = getVerticalTargetRoomId(targetId, 'up');
            if (tId && state.rooms[tId]) state.rooms[tId].hidden = false;
        }
        if (state.rooms[targetId].subRooms) {
            state.rooms[targetId].subRooms.forEach((sub, subIdx) => {
                const subId = `${targetId}_sub${subIdx}`;
                const subData = state.rooms[subId];
                if (subData) {
                    if (subData.mergedDown) {
                        const tId = getVerticalTargetRoomId(subId, 'down');
                        if (tId && state.rooms[tId]) state.rooms[tId].hidden = false;
                    }
                    if (subData.mergedUp) {
                        const tId = getVerticalTargetRoomId(subId, 'up');
                        if (tId && state.rooms[tId]) state.rooms[tId].hidden = false;
                    }
                }
            });
        }
    }
    
    const roomData = state.rooms[targetId];
    let totalOldSpan = roomData.span || 1;
    if (roomData.subRooms) {
        roomData.subRooms.forEach((sub, subIdx) => {
            const subId = `${targetId}_sub${subIdx}`;
            if (state.rooms[subId]) totalOldSpan += state.rooms[subId].span || 0.5;
        });
    }
    
    if (roomId.includes('_sub')) delete state.rooms[roomId];
    
    roomData.span = 1;
    roomData.subRooms = [];
    roomData.mergedDown = false;
    roomData.mergedUp = false;
    roomData.hidden = false;
    
    if (totalOldSpan > 1) {
        const lastIdx = targetId.lastIndexOf('_');
        const bIdAndFloor = targetId.substring(0, lastIdx);
        const startRoomIdx = parseInt(targetId.substring(lastIdx + 1));

        for (let i = 1; i <= Math.round(totalOldSpan) - 1; i++) {
            const nextId = `${bIdAndFloor}_${startRoomIdx + i}`;
            if (state.rooms[nextId]) state.rooms[nextId].hidden = false;
        }
    }
    
    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
});

elements.deleteRoomBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    if (confirm("이 공간을 완전히 강제 삭제하시겠습니까? (건물 모양 자체를 줄이거나 찌꺼기 공간을 제거할 때 사용합니다.)")) {
        if (state.rooms[roomId]) {
            state.rooms[roomId].hidden = true;
            state.rooms[roomId].span = 0;
            if (roomId.includes('_sub')) {
                delete state.rooms[roomId]; // Complete removal from state for subrooms
            }
        }
        saveState(); renderAll(); closeModal(elements.roomModalOverlay);
    }
});

elements.deleteRightRoomBtn.addEventListener('click', () => {
    const roomId = elements.roomIdInput.value;
    if (confirm("현재 칸의 바로 우측에 있는 공간을 강제 삭제하시겠습니까?")) {
        let targetToDelete = null;
        const { bIdAndFloor, baseRoomIdx, building } = getRoomContext(roomId);
        
        const baseId = roomId.includes('_sub') ? roomId.split('_sub')[0] : roomId;
        const startSubIdx = roomId.includes('_sub') ? parseInt(roomId.split('_sub')[1]) + 1 : 0;
        
        // 1. Search subrooms of current base room
        const baseRoom = state.rooms[baseId];
        if (baseRoom && baseRoom.subRooms) {
            for (let s = startSubIdx; s < baseRoom.subRooms.length; s++) {
                const subId = `${baseId}_sub${s}`;
                if (state.rooms[subId] && state.rooms[subId].hidden !== true && parseFloat(state.rooms[subId].span || 0) > 0) {
                    targetToDelete = subId; break;
                }
            }
        }

        // 2. Search next base rooms and their subrooms
        if (!targetToDelete) {
            const endIdx = (building.corridorStyle === 'double' && baseRoomIdx <= building.roomsPerFloor) ? building.roomsPerFloor : (building.corridorStyle === 'double' ? building.roomsPerFloor * 2 : building.roomsPerFloor);
            for (let i = baseRoomIdx + 1; i <= endIdx; i++) {
                const nextId = `${bIdAndFloor}_${i}`;
                if (state.rooms[nextId] && state.rooms[nextId].hidden !== true && parseFloat(state.rooms[nextId].span || 1) > 0) {
                    targetToDelete = nextId; break;
                }
                if (state.rooms[nextId] && state.rooms[nextId].subRooms) {
                    for (let s = 0; s < state.rooms[nextId].subRooms.length; s++) {
                        const subId = `${nextId}_sub${s}`;
                        if (state.rooms[subId] && state.rooms[subId].hidden !== true && parseFloat(state.rooms[subId].span || 0) > 0) {
                            targetToDelete = subId; break;
                        }
                    }
                    if (targetToDelete) break;
                }
            }
        }

        if (targetToDelete) {
            state.rooms[targetToDelete].hidden = true;
            state.rooms[targetToDelete].span = 0;
            if (targetToDelete.includes('_sub')) {
                delete state.rooms[targetToDelete];
            }
            alert(`삭제 완료 (대상: ${targetToDelete})`);
            saveState(); renderAll(); closeModal(elements.roomModalOverlay);
        } else {
            const currentRoomSpan = parseFloat(state.rooms[roomId] ? state.rooms[roomId].span || 1 : 0);
            if (currentRoomSpan > 1.0) {
                if (confirm(`우측에 별도의 방이 없습니다. 대신 현재 칸(${roomId})의 크기가 1칸보다 큽니다(${currentRoomSpan}칸). 이걸 강제로 1.0칸으로 잘라낼까요?`)) {
                    state.rooms[roomId].span = 1.0;
                    alert("1.0칸으로 강제 축소 완료!");
                    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
                }
            } else {
                if (confirm("우측에 삭제할 방이 없습니다. (현재 칸이 제일 끝이거나 우측이 비어있음)\n대신 현재 선택된 칸 자체를 강제로 삭제할까요?")) {
                    if (state.rooms[roomId]) {
                        state.rooms[roomId].hidden = true;
                        state.rooms[roomId].span = 0;
                        if (roomId.includes('_sub')) delete state.rooms[roomId];
                    }
                    alert(`현재 칸(${roomId}) 강제 삭제 완료`);
                    saveState(); renderAll(); closeModal(elements.roomModalOverlay);
                }
            }
        }
    }
});

// Title Management
elements.editTitleBtn.addEventListener('click', () => {
    elements.schoolTitleInput.value = state.schoolTitle;
    openModal(elements.titleModalOverlay);
});

elements.saveTitleBtn.addEventListener('click', () => {
    state.schoolTitle = elements.schoolTitleInput.value || '우리학교 교실 배치도';
    saveState();
    renderAll();
    closeModal(elements.titleModalOverlay);
});

elements.schoolTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        elements.saveTitleBtn.click();
    }
});

// Zoom & Pan Management
function applyZoom() {
    elements.canvasGrid.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    elements.zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
}

elements.zoomInBtn.addEventListener('click', () => {
    if (currentZoom < 2) {
        currentZoom += 0.1;
        applyZoom();
    }
});

elements.zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > 0.3) {
        currentZoom -= 0.1;
        applyZoom();
    }
});

// Mouse Wheel Zoom
elements.canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        if (currentZoom < 2) currentZoom += 0.1;
    } else {
        if (currentZoom > 0.3) currentZoom -= 0.1;
    }
    applyZoom();
}, { passive: false });

// Mouse Drag Pan
elements.canvasContainer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    
    if (e.shiftKey) {
        isSelecting = true;
        selectStartX = e.clientX;
        selectStartY = e.clientY;
        elements.selectionBox.style.display = 'block';
        elements.selectionBox.style.left = selectStartX + 'px';
        elements.selectionBox.style.top = selectStartY + 'px';
        elements.selectionBox.style.width = '0px';
        elements.selectionBox.style.height = '0px';
        return;
    }

    isDragging = true;
    isDragAction = false;
    startX = e.clientX;
    startY = e.clientY;
    initialPanX = panX;
    initialPanY = panY;
    elements.canvasContainer.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (draggingBuildingId) {
        const building = state.buildings.find(b => b.id === draggingBuildingId);
        const dx = (e.clientX - bDragStartX) / currentZoom;
        const dy = (e.clientY - bDragStartY) / currentZoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragAction = true;
        building.x = initialBuildingX + dx;
        building.y = initialBuildingY + dy;
        const bEl = document.querySelector(`.map-building-header[data-id="${draggingBuildingId}"]`).closest('.map-building');
        bEl.style.left = building.x + 'px';
        bEl.style.top = building.y + 'px';
        return;
    }

    if (isSelecting) {
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const left = Math.min(selectStartX, currentX);
        const top = Math.min(selectStartY, currentY);
        const width = Math.abs(currentX - selectStartX);
        const height = Math.abs(currentY - selectStartY);
        
        elements.selectionBox.style.left = left + 'px';
        elements.selectionBox.style.top = top + 'px';
        elements.selectionBox.style.width = width + 'px';
        elements.selectionBox.style.height = height + 'px';
        return;
    }

    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragAction = true;
    }
    
    panX = initialPanX + dx;
    panY = initialPanY + dy;
    applyZoom();
});

window.addEventListener('mouseup', (e) => {
    if (draggingBuildingId) {
        const bEl = document.querySelector(`.map-building-header[data-id="${draggingBuildingId}"]`).closest('.map-building');
        if (bEl) bEl.style.zIndex = '';
        draggingBuildingId = null;
        saveState();
        setTimeout(() => isDragAction = false, 50);
        return;
    }
    
    if (isSelecting) {
        isSelecting = false;
        elements.selectionBox.style.display = 'none';
        
        const boxRect = {
            left: Math.min(selectStartX, e.clientX),
            right: Math.max(selectStartX, e.clientX),
            top: Math.min(selectStartY, e.clientY),
            bottom: Math.max(selectStartY, e.clientY)
        };
        
        document.querySelectorAll('.map-room').forEach(roomEl => {
            const rect = roomEl.getBoundingClientRect();
            if (
                rect.left < boxRect.right &&
                rect.right > boxRect.left &&
                rect.top < boxRect.bottom &&
                rect.bottom > boxRect.top
            ) {
                const id = roomEl.dataset.id;
                if (id && !state.selectedRooms.includes(id)) {
                    state.selectedRooms.push(id);
                }
            }
        });
        
        updateBatchUI();
        renderAll();
        return;
    }

    if (isDragging) {
        isDragging = false;
        elements.canvasContainer.style.cursor = 'grab';
        setTimeout(() => isDragAction = false, 50);
    }
});

// Data Management
elements.exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `교실배치도_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

elements.importBtn.addEventListener('click', () => {
    elements.importInput.click();
});

elements.importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedState = JSON.parse(event.target.result);
            if (importedState && importedState.buildings) {
                state = importedState;
                saveState();
                renderAll();
                alert("배치도 데이터를 성공적으로 불러왔습니다.");
            } else {
                throw new Error("Invalid format");
            }
        } catch (error) {
            alert("파일 형식이 잘못되었습니다.");
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

elements.clearDataBtn.addEventListener('click', () => {
    if (confirm('정말로 모든 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        state = {
            schoolTitle: "우리학교 교실 배치도",
            buildings: [],
            rooms: {}
        };
        saveState();
        renderAll();
    }
});

// Run Init
init();

function smartPrint(mode, targetElement = null) {
    let contentWidth, contentHeight;
    let minX = Infinity, minY = Infinity;
    const buildings = document.querySelectorAll('.map-building');
    const originalPositions = new Map();
    
    if (mode === 'all') {
        let maxX = -Infinity, maxY = -Infinity;
        if (buildings.length === 0) {
            window.print();
            return;
        }
        
        buildings.forEach(b => {
            const l = b.offsetLeft;
            const t = b.offsetTop;
            const w = b.offsetWidth;
            const h = b.offsetHeight;
            if (l < minX) minX = l;
            if (t < minY) minY = t;
            if (l + w > maxX) maxX = l + w;
            if (t + h > maxY) maxY = t + h;
            
            originalPositions.set(b, { left: b.style.left, top: b.style.top });
        });
        
        contentWidth = maxX - minX;
        contentHeight = maxY - minY;
    } else {
        contentWidth = targetElement.offsetWidth;
        contentHeight = targetElement.offsetHeight;
        minX = 0;
        minY = 0;
    }

    const isLandscape = mode === 'all' ? (contentWidth > contentHeight) : false;
    // Use conservative A4 dimensions (pixels) to ensure it fits on one page
    const a4W = isLandscape ? 1050 : 720;
    const a4H = isLandscape ? 720 : 1050;
    
    const padding = 20;
    const totalW = contentWidth + padding * 2;
    const totalH = contentHeight + padding * 2;

    const scaleW = a4W / totalW;
    const scaleH = a4H / totalH;
    const scale = Math.min(scaleW, scaleH);

    // Apply temporary layout shifts for 'all' mode
    if (mode === 'all') {
        buildings.forEach(b => {
            const l = b.offsetLeft;
            const t = b.offsetTop;
            b.style.left = (l - minX + padding) + 'px';
            b.style.top = (t - minY + padding) + 'px';
        });
    }

    const style = document.createElement('style');
    style.id = 'dynamic-print-style';
    style.textContent = `
        @media print {
            @page {
                size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                margin: 5mm;
            }
            html, body {
                width: 100% !important;
                height: 100% !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box !important;
            }
            .app-container, .main-content {
                width: 100% !important;
                height: 100% !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .canvas-container {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                height: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .canvas-grid {
                zoom: ${scale} !important;
                width: ${totalW}px !important;
                height: ${totalH}px !important;
                position: relative !important;
                display: block !important;
                transform: none !important;
            }
            ${mode === 'all' ? `
            .map-building {
                position: absolute !important;
                margin: 0 !important;
                page-break-inside: avoid;
            }
            ` : `
            .map-building.printing {
                position: absolute !important;
                margin: 0 !important;
                left: ${padding}px !important;
                top: ${padding}px !important;
                page-break-inside: avoid;
            }
            `}
        }
    `;
    document.head.appendChild(style);

    if (mode === 'single') {
        document.body.classList.add('print-single-mode');
        targetElement.classList.add('printing');
    }

    window.print();

    // Cleanup
    setTimeout(() => {
        const s = document.getElementById('dynamic-print-style');
        if (s) s.remove();
        
        if (mode === 'single') {
            document.body.classList.remove('print-single-mode');
            targetElement.classList.remove('printing');
        } else if (mode === 'all') {
            buildings.forEach(b => {
                const orig = originalPositions.get(b);
                if (orig) {
                    b.style.left = orig.left;
                    b.style.top = orig.top;
                }
            });
        }
    }, 1000);
}
