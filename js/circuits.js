// Funciones de gestión de circuitos

function addCircuit() {
    const circuitName = prompt('Nombre del nuevo circuito:');
    if (circuitName && !circuits[circuitName]) {
        circuits[circuitName] = [];
        currentCircuit = circuitName;
        updateCircuitTabs();
        updateAddressesList();
        clearMap();
        optimizedRouteData = null;
    } else if (circuits[circuitName]) {
        alert('Ya existe un circuito con ese nombre');
    }
}

function deleteCurrentCircuit() {
    if (Object.keys(circuits).length === 1) {
        alert('Debe mantener al menos un circuito');
        return;
    }
    
    if (confirm(`¿Eliminar el circuito "${currentCircuit}"?`)) {
        delete circuits[currentCircuit];
        currentCircuit = Object.keys(circuits)[0];
        updateCircuitTabs();
        updateAddressesList();
        clearMap();
        optimizedRouteData = null;
    }
}

function switchCircuit(circuitName) {
    currentCircuit = circuitName;
    updateCircuitTabs();
    updateAddressesList();
    clearMap();
    showAddressesOnMap();
    optimizedRouteData = null;
}

function updateCircuitTabs() {
    const tabsContainer = document.getElementById('circuitTabs');
    tabsContainer.innerHTML = '';
    
    Object.keys(circuits).forEach(name => {
        const tab = document.createElement('div');
        tab.className = `circuit-tab ${name === currentCircuit ? 'active' : ''}`;
        tab.textContent = `${name} (${circuits[name].length})`;
        tab.onclick = () => switchCircuit(name);
        tabsContainer.appendChild(tab);
    });
}

// Gestión de direcciones
async function addAddress() {
    const addressInput = document.getElementById('addressInput');
    const address = addressInput.value.trim();
    
    if (!address) {
        showError('Por favor ingresa una dirección');
        return;
    }

    if (circuits[currentCircuit].length >= 40) {
        showError('Máximo 40 direcciones por circuito');
        return;
    }

    showLoading();
    showSuccess('Buscando dirección...');
    
    try {
        const result = await geocodeAddress(address);
        
        if (result) {
            circuits[currentCircuit].push({
                address: result.display_name,
                originalInput: address,
                lat: result.lat,
                lng: result.lng
            });
            
            addressInput.value = '';
            updateAddressesList();
            updateCircuitTabs();
            showAddressesOnMap();
            hideError();
            showSuccess(`✅ Dirección agregada: ${result.display_name}`);
            optimizedRouteData = null;
        } else {
            showError(`❌ No se encontró "${address}". Intenta con formato: "Avenida María 1450, Don Torcuato"`);
            
            if (confirm('¿Quieres agregar esta dirección manualmente? (Se ubicará en el centro de Buenos Aires)')) {
                circuits[currentCircuit].push({
                    address: `${address} (ubicación manual)`,
                    originalInput: address,
                    lat: BUENOS_AIRES_CENTER.lat,
                    lng: BUENOS_AIRES_CENTER.lng
                });
                
                addressInput.value = '';
                updateAddressesList();
                updateCircuitTabs();
                showAddressesOnMap();
                showSuccess('Dirección agregada manualmente');
                optimizedRouteData = null;
            }
        }
    } catch (error) {
        showError('Error al procesar la dirección. Intenta nuevamente.');
        console.error('Error:', error);
    } finally {
        hideLoading();
    }
}

function addCurrentLocation() {
    if ("geolocation" in navigator) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                circuits[currentCircuit].push({
                    address: `Mi ubicación (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                    lat: lat,
                    lng: lng
                });
                
                updateAddressesList();
                updateCircuitTabs();
                showAddressesOnMap();
                showSuccess('Ubicación actual agregada');
                optimizedRouteData = null;
                hideLoading();
            },
            (error) => {
                hideLoading();
                showError('No se pudo obtener la ubicación actual');
            }
        );
    } else {
        showError('Geolocalización no disponible en este navegador');
    }
}

function removeAddress(index) {
    circuits[currentCircuit].splice(index, 1);
    updateAddressesList();
    updateCircuitTabs();
    showAddressesOnMap();
    optimizedRouteData = null;
}

function clearAddresses() {
    if (confirm('¿Eliminar todas las direcciones del circuito actual?')) {
        circuits[currentCircuit] = [];
        updateAddressesList();
        updateCircuitTabs();
        clearMap();
        optimizedRouteData = null;
    }
}

function updateAddressesList() {
    const list = document.getElementById('addressesList');
    list.innerHTML = '';
    
    circuits[currentCircuit].forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'address-item';
        div.innerHTML = `
            <div class="address-text">${index + 1}. ${item.address}</div>
            <button class="delete-btn" onclick="removeAddress(${index})">✕</button>
        `;
        list.appendChild(div);
    });
}