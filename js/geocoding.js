/* geocoding.js - geocodificación con Nominatim mejorada.
   Usa NOMINATIM_URL desde config.js (ej: https://nominatim.openstreetmap.org/search)
*/

function cleanAddressInput(address) {
    if (!address) return '';
    let clean = address;
    // Normalizar abreviaturas
    clean = clean.replace(/\bAv\.?\b/gi, 'Avenida');
    clean = clean.replace(/\bGral\.?\b/gi, 'General');
    clean = clean.replace(/\bPcia\.?\b/gi, 'Provincia');
    clean = clean.replace(/\bBs\.?\s*As\.?\b/gi, 'Buenos Aires');
    clean = clean.replace(/,\s*provincia de buenos aires/i, ', Buenos Aires');
    clean = clean.replace(/,\s*buenos aires\s*,/i, ', Buenos Aires,');
    // Extraer y eliminar código postal
    clean = clean.replace(/,?\s*CP\s*\d{4,}/i, '');
    clean = clean.replace(/,?\s*\d{4,}\s*$/i, '');
    // Extraer nombre de calle y altura si existen
    const match = clean.match(/([^,\d]+)\s+(\d+)[,\s]*(.*)/);
    if (match) {
        // match[1]: nombre de calle, match[2]: altura, match[3]: resto (localidad, provincia)
        clean = `${match[1].trim()} ${match[2].trim()}, ${match[3].trim()}`;
    }
    // Si falta localidad, agregar Buenos Aires por defecto
    if (!/buenos aires|don torcuato|tigre|san isidro|vicente lópez|morón|quilmes|lanús|avellaneda|la plata|escobar|pilar|san miguel|lomas de zamora|berazategui|merlo|ituzaingó|ezeiza|almirante brown|san fernando|san martín|malvinas argentinas|hurlingham|moreno|caba|capital federal/i.test(clean)) {
        clean += ', Buenos Aires';
    }
    clean = clean.replace(/\s+AR\s*$/i, '');
    return clean.trim();
}

function buildNominatimParams(address) {
    // Si contiene número, intentamos separar calle + número
    const streetNumberMatch = address.match(/^(.*?)(\s+\d+[-\d\/a-zA-Z]*)\s*,?\s*(.*)$/);
    if (streetNumberMatch) {
        const street = streetNumberMatch[1].trim();
        const number = streetNumberMatch[2].trim();
        const rest = streetNumberMatch[3] ? streetNumberMatch[3].trim() : '';
        return `street=${encodeURIComponent(street + ' ' + number)}&city=${encodeURIComponent(rest)}&country=Argentina&format=json&addressdetails=1&limit=3`;
    }
    // fallback con query libre
    return `q=${encodeURIComponent(address)}&countrycodes=ar&format=json&addressdetails=1&limit=3`;
}

async function geocodeAddress(address) {
    if (!address) return null;
    const clean = cleanAddressInput(address);
    // 1. Intentar geocodificación con OpenRouteService
    const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVkNmU1OGVmOGNjZjQ2M2JhNDc3ZGY4MTc4M2FlYzc2IiwiaCI6Im11cm11cjY0In0=";
    try {
        const orsUrl = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(clean)}&boundary.country=AR&size=3`;
        const resp = await fetch(orsUrl);
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.features && data.features.length > 0) {
                // Buscar coincidencia con altura si existe
                for (const f of data.features) {
                    const props = f.properties;
                    if (props && props.name && props.housenumber) {
                        return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], display_name: props.label };
                    }
                }
                // Si no hay altura, usar el primer resultado
                const f = data.features[0];
                return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], display_name: f.properties.label };
            }
        }
    } catch (err) {
        console.error('Error ORS geocoding', err);
    }
    // 2. Fallback: Nominatim solo si ORS falla
    try {
        const params = buildNominatimParams(clean);
        const url = `${NOMINATIM_URL}?${params}`;
        const headers = {
            'User-Agent': 'RouteOptimizer/1.0',
            'Accept': 'application/json'
        };
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            console.warn('Nominatim response not ok', resp.status);
            return null;
        }
        const data = await resp.json();
        if (data && data.length > 0) {
            for (const d of data) {
                if (d && d.address && d.address.house_number) {
                    return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), display_name: d.display_name };
                }
            }
            for (const d of data) {
                if (d && d.address && d.address.road && d.address.city) {
                    return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), display_name: d.display_name };
                }
            }
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
        }
        return null;
    } catch (err) {
        console.error('Error Nominatim geocoding', err);
        return null;
    }
}

async function geocodeAddresses(addresses) {
    if (!Array.isArray(addresses)) addresses = [addresses];
    let success = 0;
    for (let i=0; i<addresses.length; i++) {
        const addr = addresses[i];
        const res = await geocodeAddress(addr);
        if (res) {
            circuits[currentCircuit].push({ address: res.display_name, lat: res.lat, lng: res.lng });
            success++;
        } else {
            console.warn('No se encontró geocodificación para', addr);
        }
        // Respetar rate limit de Nominatim (~1 req/s)
        await new Promise(r => setTimeout(r, 1100));
    }
    if (success > 0) {
        updateAddressesList(); updateCircuitTabs(); showAddressesOnMap();
        showSuccess(success + ' direcciones geocodificadas correctamente');
    } else {
        showError('No se pudieron geocodificar las direcciones proporcionadas');
    }
}
