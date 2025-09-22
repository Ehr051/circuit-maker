/* geocoding.js - geocodificación con Nominatim mejorada.
   Usa NOMINATIM_URL desde config.js (ej: https://nominatim.openstreetmap.org/search)
*/

function cleanAddressInput(address) {
    if (!address) return '';
    return address
        .replace(/,\s*provincia de buenos aires/i, ', Buenos Aires')
        .replace(/,\s*buenos aires\s*,/i, ', Buenos Aires,')
        .replace(/\bgral\b/gi, 'General')
        .replace(/\bav\b/gi, 'Avenida')
        .replace(/\s+AR\s*$/i, '')
        .trim();
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
    try {
        const clean = cleanAddressInput(address);
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
            // preferimos coincidencias con altura exacta
            for (const d of data) {
                if (d && d.address && d.address.house_number) {
                    return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), display_name: d.display_name };
                }
            }
            // fallback: primer resultado
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
        }
        return null;
    } catch (err) {
        console.error('Error geocoding', err);
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
