// Test automático: carga direcciones de Don Torcuato y muestra en consola
async function runAutoTest() {
    const testAddresses = [
        'Avenida María 1450, Don Torcuato',
        'General Avalos 189, Don Torcuato',
        'Av. del Trabajo 800, Don Torcuato',
        'Av. Hipólito Yrigoyen 1200, Don Torcuato'
    ];
    circuits[currentCircuit] = [];
    updateAddressesList(); updateCircuitTabs(); clearMap();
    showLoading();
    for (const addr of testAddresses) {
        const res = await geocodeAddress(addr);
        if (res) {
            circuits[currentCircuit].push({ address: res.display_name, lat: res.lat, lng: res.lng });
            console.log('Geocodificado:', res.display_name, res.lat, res.lng);
        } else {
            console.warn('No se pudo geocodificar:', addr);
        }
        await new Promise(r => setTimeout(r, 1100));
    }
    updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
    hideLoading();
    showSuccess('Test automático: direcciones cargadas. Ahora puedes optimizar la ruta.');
}
// Archivo principal de inicialización
// Importación unificada de archivos
async function handleUnifiedImport(event) {
    console.log('[Import] Archivo seleccionado:', file.name);
    const file = event.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = async function(e) {
        let text = e.target.result;
        let rows = [];
        let importCount = 0;
        let geocodeList = [];
        // Detectar tipo de archivo por extensión
        if (name.endsWith('.csv') || name.endsWith('.txt')) {
            console.log('[Import] Procesando como CSV/TXT');
            rows = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        } else if (name.endsWith('.xlsx') || name.endsWith('.xlsx.csv')) {
            console.log('[Import] Procesando como XLSX');
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            } catch (err) {
                showError('Error procesando archivo XLSX: ' + err.message);
                return;
            }
        } else if (name.endsWith('.kmz') || name.endsWith('.kml') || name.endsWith('.xlsx.kml') || name.endsWith('.xlsx.kmz')) {
            console.log('[Import] Procesando como KML/KMZ');
            try {
                let kmlText = text;
                if (name.endsWith('.kmz') || name.endsWith('.xlsx.kmz')) {
                    const zip = await JSZip.loadAsync(file);
                    const kmlFile = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.kml'));
                    if (!kmlFile) { showError('KMZ no contiene KML'); return; }
                    kmlText = await zip.files[kmlFile].async('string');
                }
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
                const placemarks = xmlDoc.getElementsByTagName('Placemark');
                Array.from(placemarks).forEach((placemark, idx) => {
                    const schoolName = placemark.getElementsByTagName('name')[0]?.textContent || ('Punto ' + (circuits[currentCircuit].length+1));
                    const coordsEl = placemark.getElementsByTagName('coordinates')[0];
                    if (coordsEl) {
                        const coords = coordsEl.textContent.trim().split(',');
                        if (coords.length >= 2) {
                            circuits[currentCircuit].push({ address: schoolName, lat: parseFloat(coords[1]), lng: parseFloat(coords[0]) });
                            importCount++;
                        }
                    }
                });
                if (importCount > 0) {
                    updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
                    showSuccess('✅ ' + importCount + ' ubicaciones importadas desde KML/KMZ');
                } else {
                    showError('No se encontraron ubicaciones válidas en el archivo KML/KMZ.');
                }
                return;
            } catch (err) {
                showError('Error procesando KML/KMZ: ' + err.message);
                return;
            }
        } else {
            console.error('[Import] Formato de archivo no soportado:', name);
            showError('Formato de archivo no soportado.');
            return;
        }

        // Procesar filas (CSV/TXT/XLSX)
        for (let row of rows) {
            console.log('[Import] Procesando fila:', row);
            let parts = Array.isArray(row) ? row : row.split(',');
            let lat = null, lng = null, schoolName = '', address = '';
            // Separar nombre y dirección si corresponde
            if (parts.length === 2) {
                schoolName = parts[0].trim();
                address = parts[1].trim();
            } else if (parts.length >= 3 && !isNaN(parseFloat(parts[parts.length-2])) && !isNaN(parseFloat(parts[parts.length-1]))) {
                lat = parseFloat(parts[parts.length-2]);
                lng = parseFloat(parts[parts.length-1]);
                schoolName = parts.slice(0, parts.length-2).join(', ');
            } else {
                address = Array.isArray(row) ? row.join(', ') : row;
            }
            // Si hay coordenadas, usar directamente
            if (lat !== null && lng !== null) {
                circuits[currentCircuit].push({ address: schoolName || address, lat, lng });
                importCount++;
            } else if (address) {
                geocodeList.push(schoolName ? `${schoolName}, ${address}` : address);
                importCount++;
            }
        }
        // Geocodificar si es necesario
        if (geocodeList.length > 0) {
            console.log('[Import] Geocodificando', geocodeList.length, 'direcciones...');
            await geocodeAddresses(geocodeList);
        }
        if (importCount > 0) {
            updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
            showSuccess('✅ ' + importCount + ' ubicaciones importadas');
        }
    };
    if (name.endsWith('.xlsx') || name.endsWith('.xlsx.csv') || name.endsWith('.xlsx.kml') || name.endsWith('.xlsx.kmz')) {
        reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.kmz') || name.endsWith('.kml')) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    updateCircuitTabs();
    updateAddressesList();
    showAddressSuggestions();
    
    // Event listeners solo para inputs activos
    const addressInput = document.getElementById('addressInput');
    if (addressInput) {
        addressInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addAddress();
            }
        });
    }
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleUnifiedImport);
    }
    console.log('Aplicación inicializada correctamente');
});

// Función para mostrar sugerencias de direcciones
function showAddressSuggestions() {
    const suggestions = [
        'Avenida María 1450, Don Torcuato',
        'General Avalos 189, Don Torcuato', 
        'Av. Libertador 1000, San Isidro',
        'Av. Corrientes 1000, Buenos Aires',
        'Palermo, Buenos Aires',
        'Obelisco, Buenos Aires'
    ];

    let suggestionHtml = '<div style="margin-top: 10px; padding: 15px; background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 8px; font-size: 12px; border-left: 4px solid #2196f3;">';
    suggestionHtml += '<strong>💡 Ejemplos que funcionan bien:</strong><br><br>';
    
    suggestionHtml += '<strong>📍 Gran Buenos Aires:</strong><br>';
    suggestions.slice(0, 3).forEach(suggestion => {
        suggestionHtml += `<button onclick="document.getElementById('addressInput').value='${suggestion}'" style="background: linear-gradient(45deg, #2196f3, #21cbf3); color: white; border: none; margin: 2px; padding: 6px 10px; cursor: pointer; border-radius: 5px; font-size: 11px;">${suggestion}</button><br>`;
    });
    
    suggestionHtml += '<br><strong>🏢 Capital Federal:</strong><br>';
    suggestions.slice(3).forEach(suggestion => {
        suggestionHtml += `<button onclick="document.getElementById('addressInput').value='${suggestion}'" style="background: linear-gradient(45deg, #4caf50, #81c784); color: white; border: none; margin: 2px; padding: 6px 10px; cursor: pointer; border-radius: 5px; font-size: 11px;">${suggestion}</button><br>`;
    });
    
    suggestionHtml += '<br><div style="background: rgba(255, 193, 7, 0.1); padding: 8px; border-radius: 5px; margin-top: 10px;">';
    suggestionHtml += '<strong>⚡ Consejos:</strong><br>';
    suggestionHtml += '• Incluye el nombre de la localidad (Don Torcuato, Tigre, etc.)<br>';
    suggestionHtml += '• Usa "Avenida" o "Av." completo en lugar de abreviaturas<br>';
    suggestionHtml += '• La altura (número) es opcional pero ayuda a la precisión<br>';
    suggestionHtml += '• Si no funciona, prueba sin el número de altura</div>';
    suggestionHtml += '</div>';

    const addressSection = document.querySelector('.section:nth-child(2)');
    const existingSuggestions = addressSection.querySelector('.suggestions');
    
    if (!existingSuggestions) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';
        suggestionsDiv.innerHTML = suggestionHtml;
        addressSection.appendChild(suggestionsDiv);
    }
}