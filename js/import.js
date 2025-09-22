/* import.js - completo y listo
   Soporta: .txt/.csv (direcciones), .csv (lat,lng), .kml, .kmz, .xlsx
*/

async function loadFromText() { document.getElementById('textFileInput').click(); }
function loadFromCSV() { document.getElementById('csvFileInput').click(); }
function loadFromKML() { document.getElementById('kmlFileInput').click(); }
function loadFromXLSX() { document.getElementById('xlsxFileInput').click(); }

// Nueva función para detectar doble extensión y procesar correctamente
function handleSpecialFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    // Detecta doble extensión .xlsx.kml o .xlsx.kmz
    if (name.endsWith('.xlsx.kml') || name.endsWith('.xlsx.kmz')) {
        // Procesar como KMZ si el contenido es ZIP/KML
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;
                // Intentar abrir como ZIP (KMZ)
                try {
                    const zip = await JSZip.loadAsync(arrayBuffer);
                    const kmlFile = Object.keys(zip.files).find(f=>f.toLowerCase().endsWith('.kml'));
                    if (!kmlFile) throw new Error('KMZ no contiene KML');
                    const kmlContent = await zip.files[kmlFile].async('string');
                    parseKMLContent(kmlContent, file.name);
                    return;
                } catch (zipErr) {
                    // Si no es ZIP, intentar como texto KML
                    try {
                        const text = new TextDecoder().decode(arrayBuffer);
                        parseKMLContent(text, file.name);
                        return;
                    } catch (txtErr) {
                        // Si tampoco es texto, intentar como XLSX
                        try {
                            const data = new Uint8Array(arrayBuffer);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const sheet = workbook.Sheets[workbook.SheetNames[0]];
                            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                            let importCount = 0;
                            rows.forEach(row => {
                                if (!row || row.length===0) return;
                                // Si tiene columnas nombre y dirección, geocodificar
                                if (row.length>=2 && typeof row[0]==='string' && typeof row[1]==='string') {
                                    // Corrige typo: geocodeadresse -> geocodeAddresses
                                    geocodeAddresses([row[1]]);
                                    importCount++;
                                } else if (row.length>=3 && !isNaN(parseFloat(row[1])) && !isNaN(parseFloat(row[2]))) {
                                    const name = row[0] || ('Punto ' + (circuits[currentCircuit].length+1));
                                    circuits[currentCircuit].push({ address: name, lat: parseFloat(row[1]), lng: parseFloat(row[2]) });
                                    importCount++;
                                } else if (row.length>=2 && !isNaN(parseFloat(row[0])) && !isNaN(parseFloat(row[1]))) {
                                    circuits[currentCircuit].push({ address: ('Punto ' + (circuits[currentCircuit].length+1)), lat: parseFloat(row[0]), lng: parseFloat(row[1]) });
                                    importCount++;
                                } else if (row.length>=1 && typeof row[0] === 'string' && row[0].includes(',')) {
                                    const addr = row[0].trim();
                                    geocodeAddresses([addr]);
                                    importCount++;
                                }
                            });
                            if (importCount>0) {
                                updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
                                showSuccess('✅ ' + importCount + ' ubicaciones importadas desde archivo XLSX.KML/KMZ');
                            } else {
                                showError('No se detectaron ubicaciones válidas en el archivo XLSX.KML/KMZ');
                            }
                        } catch (xlsxErr) {
                            showError('Formato de archivo no soportado.');
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                showError('Error procesando archivo XLSX.KML/KMZ: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        // Si no tiene doble extensión, delega al handler original
        handleXLSXFileUpload(event);
    }
}

function handleTextFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const addresses = text.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
        if (addresses.length > 200) { showError('Máximo 200 líneas por importación'); return; }
        showLoading();
        await geocodeAddresses(addresses);
        hideLoading();
    };
    reader.readAsText(file);
}

function handleCSVFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSVWithCoordinates(text);
    };
    reader.readAsText(file);
}

async function handleKMLFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith('.kmz')) {
        showLoading();
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const kmlFile = Object.keys(zip.files).find(f=>f.toLowerCase().endsWith('.kml'));
            if (!kmlFile) { showError('KMZ no contiene KML'); hideLoading(); return; }
            const kmlContent = await zip.files[kmlFile].async('string');
            parseKMLContent(kmlContent, file.name);
        } catch (err) {
            console.error(err);
            showError('Error al procesar KMZ: ' + err.message);
        } finally { hideLoading(); }
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) { parseKMLContent(e.target.result, file.name); };
    reader.readAsText(file);
}

function handleXLSXFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            let importCount = 0;
            rows.forEach(row => {
                if (!row || row.length===0) return;
                // Accept common layouts: [name, lat, lng] or [lat, lng] or [address]
                if (row.length>=3 && !isNaN(parseFloat(row[1])) && !isNaN(parseFloat(row[2]))) {
                    const name = row[0] || ('Punto ' + (circuits[currentCircuit].length+1));
                    circuits[currentCircuit].push({ address: name, lat: parseFloat(row[1]), lng: parseFloat(row[2]) });
                    importCount++;
                } else if (row.length>=2 && !isNaN(parseFloat(row[0])) && !isNaN(parseFloat(row[1]))) {
                    circuits[currentCircuit].push({ address: ('Punto ' + (circuits[currentCircuit].length+1)), lat: parseFloat(row[0]), lng: parseFloat(row[1]) });
                    importCount++;
                } else if (row.length>=1 && typeof row[0] === 'string' && row[0].includes(',')) {
                    // maybe "address, city"
                    const addr = row[0].trim();
                    // Push for geocoding
                    pendingGeocodePush(addr);
                    importCount++;
                }
            });
            if (importCount>0) {
                updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
                showSuccess('✅ ' + importCount + ' ubicaciones importadas desde XLSX');
            } else {
                showError('No se detectaron coordenadas en el archivo XLSX');
            }
        } catch (err) {
            console.error(err);
            showError('Error procesando XLSX: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Helper to queue address for geocoding (keeps UX simple)
function pendingGeocodePush(address) {
    // geocode inmediatamente
    geocodeAddresses([address]);
}

function parseCSVWithCoordinates(csvText) {
    try {
        const lines = csvText.trim().split(/\r?\n/);
        let importCount = 0;
        lines.forEach(line => {
            if (!line || !line.trim()) return;
            const parts = line.split(',').map(p=>p.trim().replace(/^['"]|['"]$/g,''));
            // detect lat,lng or name,lat,lng
            if (parts.length>=3 && !isNaN(parseFloat(parts[parts.length-2])) && !isNaN(parseFloat(parts[parts.length-1]))) {
                const lat = parseFloat(parts[parts.length-2]);
                const lng = parseFloat(parts[parts.length-1]);
                const name = parts.slice(0, parts.length-2).join(', ') || ('Punto ' + (circuits[currentCircuit].length+1));
                circuits[currentCircuit].push({ address: name, lat, lng });
                importCount++;
            } else if (parts.length===2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                circuits[currentCircuit].push({ address: 'Punto ' + (circuits[currentCircuit].length+1), lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) });
                importCount++;
            } else {
                // fallback: treat as address string and geocode
                geocodeAddresses([line]);
            }
        });
        if (importCount>0) {
            updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
            showSuccess('✅ ' + importCount + ' ubicaciones importadas desde CSV');
        }
    } catch (err) {
        console.error(err); showError('Error al procesar CSV: ' + err.message);
    }
}

// KML parsing
function parseKMLContent(kmlContent, fileName) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length>0) throw new Error('KML inválido');

        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        let importCount = 0;

        if (placemarks.length===0) {
            // try coordinates elements directly
            const coords = xmlDoc.getElementsByTagName('coordinates');
            for (let i=0;i<coords.length;i++) {
                const txt = coords[i].textContent.trim();
                const p = parseKMLCoordinates(txt);
                if (p) {
                    circuits[currentCircuit].push({ address: 'Punto KML', lat: p.lat, lng: p.lng });
                    importCount++;
                }
            }
        } else {
            Array.from(placemarks).forEach((placemark, idx) => {
                const name = getKMLElementText(placemark, 'name') || ('Punto ' + (circuits[currentCircuit].length+1));
                const desc = getKMLElementText(placemark, 'description') || '';
                const coordsEl = placemark.getElementsByTagName('coordinates')[0];
                if (coordsEl) {
                    const coords = parseKMLCoordinates(coordsEl.textContent);
                    if (coords) {
                        circuits[currentCircuit].push({ address: desc || name, lat: coords.lat, lng: coords.lng });
                        importCount++;
                    }
                }
            });
        }

        if (importCount>0) {
            updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
            showSuccess('✅ ' + importCount + ' ubicaciones importadas desde ' + fileName);
        } else {
            showError('No se encontraron ubicaciones válidas en el archivo KML/KMZ.');
        }
    } catch (err) {
        console.error(err); showError('Error parseando KML: ' + err.message);
    } finally {
        hideLoading();
    }
}

function getKMLElementText(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0];
    return element ? element.textContent.trim() : '';
}

function parseKMLCoordinates(coordsText) {
    try {
        const coordLines = coordsText.split(/\s+/).filter(l=>l.trim().length>0);
        for (const coordLine of coordLines) {
            const parts = coordLine.split(',');
            if (parts.length>=2) {
                const lng = parseFloat(parts[0].trim());
                const lat = parseFloat(parts[1].trim());
                if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
            }
        }
        return null;
    } catch (err) {
        console.error('Error parseando coordenadas KML', err);
        return null;
    }
}

// attach listeners
document.addEventListener('DOMContentLoaded', function() {
    const textIn = document.getElementById('textFileInput');
    const csvIn = document.getElementById('csvFileInput');
    const kmlIn = document.getElementById('kmlFileInput');
    const xlsxIn = document.getElementById('xlsxFileInput');
    if (textIn) textIn.addEventListener('change', handleTextFileUpload);
    if (csvIn) csvIn.addEventListener('change', handleCSVFileUpload);
    if (kmlIn) kmlIn.addEventListener('change', handleKMLFileUpload);
    if (xlsxIn) xlsxIn.addEventListener('change', handleSpecialFileUpload);
});

const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
marker.on('dragend', function(e) {
    const newLatLng = e.target.getLatLng();
    location.lat = newLatLng.lat;
    location.lng = newLatLng.lng;
    updateAddressesList();
    showSuccess("📍 Punto actualizado manualmente en el mapa");
});
