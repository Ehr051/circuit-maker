/* geocoding.js - geocodificación con Nominatim mejorada.
   Usa NOMINATIM_URL desde config.js (ej: https://nominatim.openstreetmap.org/search)
*/



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
    // Usar la dirección tal cual aparece, sin limpiar ni normalizar
    const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImVkNmU1OGVmOGNjZjQ2M2JhNDc3ZGY4MTc4M2FlYzc2IiwiaCI6Im11cm11cjY0In0=";
    let orsResult = null;
    try {
        const orsUrl = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=AR&size=5`;
        console.log('[Geocoding] ORS request:', orsUrl);
        const resp = await fetch(orsUrl);
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.features && data.features.length > 0) {
                // Buscar el feature más preciso (con housenumber o street)
                let best = null;
                for (const f of data.features) {
                    const props = f.properties;
                    if (props && (props.housenumber || props.street)) {
                        best = f;
                        break;
                    }
                }
                if (best) {
                    console.log('[Geocoding] ORS resultado preciso:', best.properties.label, best.geometry.coordinates);
                    orsResult = { lat: best.geometry.coordinates[1], lng: best.geometry.coordinates[0], display_name: best.properties.label };
                } else {
                    // Si solo hay localidad, loguear y no usar
                    const f = data.features[0];
                    console.warn('[Geocoding] ORS solo localidad:', f.properties.label, f.geometry.coordinates);
                }
            }
        } else {
            console.warn('[Geocoding] ORS response not ok:', resp.status);
        }
    } catch (err) {
        console.error('[Geocoding] Error ORS geocoding', err);
        console.warn('[Geocoding] Forzando fallback a Nominatim por error ORS/CORS');
    }
    // Si ORS no da resultado preciso, usar Nominatim
    if (orsResult) return orsResult;
    // 2. Fallback: Nominatim solo si ORS falla
    try {
        const params = buildNominatimParams(address);
        const url = `${NOMINATIM_URL}?${params}`;
        const headers = {
            'User-Agent': 'RouteOptimizer/1.0',
            'Accept': 'application/json'
        };
        console.log('[Geocoding] Nominatim request:', url);
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            console.warn('[Geocoding] Nominatim response not ok', resp.status);
            return null;
        }
        const data = await resp.json();
        if (data && data.length > 0) {
            for (const d of data) {
                if (d && d.address && (d.address.house_number || d.address.road)) {
                    console.log('[Geocoding] Nominatim resultado preciso:', d.display_name, d.lat, d.lon);
                    return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), display_name: d.display_name };
                }
            }
            // Si no hay resultado preciso, usar el primero
            console.log('[Geocoding] Nominatim primer resultado:', data[0].display_name, data[0].lat, data[0].lon);
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
        }
        console.warn('[Geocoding] Nominatim sin resultados para', address);
        return null;
    } catch (err) {
        console.error('[Geocoding] Error Nominatim geocoding', err);
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
