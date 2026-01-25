let tasaCambio = 0;
let tramosComision = [];

async function inicializar() {
    const startTime = Date.now();

    try {
        const { data: config } = await supabaseClient.from('config').select('tasa_cambio').limit(1).single();
        tasaCambio = config?.tasa_cambio || 0;
        document.getElementById('tasa-promo').innerText = tasaCambio;

        const { data: comisiones } = await supabaseClient.from('comisiones').select('*').order('monto_min',{ascending:true});
        tramosComision = comisiones || [];
    } catch (e) {
        console.error("Error de carga:", e);
    }

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(4000 - elapsed, 0); // Forzar 4 segundos

    setTimeout(() => {
        const loader = document.getElementById('loader-wrapper');
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 1000);
    }, remaining);
}

inicializar();

// --- Navegación del Modal ---
function abrirModal() {
    document.getElementById('modalTransferencia').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Bloquear scroll de fondo
}

function cerrarModal() {
    document.getElementById('modalTransferencia').style.display = 'none';
    document.body.style.overflow = 'auto';
    resetForm();
}

function nextStep(step) {
    if (step === 2) {
        const monto = parseFloat(document.getElementById('monto_usd').value);
        if (!monto || monto < 50) {
            Swal.fire({ icon: 'error', title: 'Monto inválido', text: 'El mínimo es $50 USD', background: '#24243e', color: '#fff' });
            return;
        }
    }
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    // Scroll al inicio del modal al cambiar paso
    document.querySelector('.modal-content').scrollTop = 0;
}

function resetForm() {
    document.getElementById('form-transaccion').reset();
    document.getElementById('total_cup').innerText = "0.00 CUP";
    document.getElementById('total_usd').innerText = "$0.00";
    nextStep(1);
}

// --- Cálculos ---
function obtenerComision(monto) {
    const tramo = tramosComision.find(t => monto >= t.monto_min && monto <= t.monto_max);
    return tramo ? parseFloat(tramo.comision) : 0;
}

document.getElementById('monto_usd').addEventListener('input', e => {
    const monto = parseFloat(e.target.value) || 0;
    const comision = obtenerComision(monto);
    document.getElementById('total_usd').innerText = `$${(monto + comision).toFixed(2)}`;
    document.getElementById('total_cup').innerText = `${(monto * tasaCambio).toLocaleString('es-CU')} CUP`;
});

// --- Registro y Subida ---
async function subirImagen(file) {
    const carpeta = new Date().toISOString().split('T')[0];
    const extension = file.name.split('.').pop();
    const ruta = `${carpeta}/${Date.now()}.${extension}`;
    
    const { data, error } = await supabaseClient.storage.from('comprobantes').upload(ruta, file);
    if (error) return null;
    return supabaseClient.storage.from('comprobantes').getPublicUrl(ruta).data.publicUrl;
}

document.getElementById('form-transaccion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-enviar');
    btn.disabled = true;
    btn.innerText = "Procesando...";

    Swal.fire({ title: 'Enviando Datos', text: 'Por favor no cierres la ventana', background: '#24243e', color: '#fff', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
        const file = document.getElementById('comprobante').files[0];
        const url = await subirImagen(file);
        if(!url) throw new Error("Error al subir comprobante.");

        const monto = parseFloat(document.getElementById('monto_usd').value);
        const data = {
            monto_usd: monto,
            comision_usd: obtenerComision(monto),
            tasa_cambio: tasaCambio,
            remitente_nombre: document.getElementById('remitente_nombre').value,
            remitente_whatsapp: document.getElementById('remitente_whatsapp').value,
            beneficiario_nombre: document.getElementById('beneficiario_nombre').value,
            beneficiario_provincia: document.getElementById('beneficiario_provincia').value,
            beneficiario_whatsapp: document.getElementById('beneficiario_whatsapp').value,
            comprobante_url: url,
            estado: 'pendiente'
        };

        const { error } = await supabaseClient.from('transacciones').insert([data]);
        if(error) throw error;

        Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'Transacción registrada correctamente.', background: '#24243e', color: '#fff' });
        cerrarModal();

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
        btn.disabled = false;
        btn.innerText = "Finalizar";
    }
});