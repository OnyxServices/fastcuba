const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    background: '#1e2332',
    color: '#fff',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

let tasaCambio = 0;
let tramosComision = [];
let cuentaZelle = "";

async function inicializar() {
    const startTime = Date.now();

    try {
        // Obtenemos tasa y cuenta zelle de la tabla config
        const { data: config } = await supabaseClient.from('config').select('*').limit(1).single();
        tasaCambio = config?.tasa_cambio || 0;
        cuentaZelle = config?.zelle_cuenta || "pago@fastcuba.com"; // Fallback
        
        document.getElementById('tasa-promo').innerText = tasaCambio;
        document.getElementById('zelle-account').innerText = cuentaZelle;

        const { data: comisiones } = await supabaseClient.from('comisiones').select('*').order('monto_min',{ascending:true});
        tamosComision = comisiones || [];
    } catch (e) {
        console.error("Error de carga:", e);
    }

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(4000 - elapsed, 0); 

    setTimeout(() => {
        const loader = document.getElementById('loader-wrapper');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 1000);
        }
    }, remaining);
}

inicializar();

// --- Función para copiar Zelle ---
function copiarZelle() {
    const texto = document.getElementById('zelle-account').innerText;
    
    navigator.clipboard.writeText(texto).then(() => {
        // Usamos Swal directamente con un zIndex alto por si acaso
        Swal.fire({
            toast: true,
            position: 'top', // Lo ponemos arriba al centro para que sea muy visible
            icon: 'success',
            title: '¡Copiado con éxito!',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            background: '#1e2332',
            color: '#fff',
            // Esta línea es clave si el CSS falla:
            didOpen: (toast) => {
                toast.style.zIndex = "10000"; 
            }
        });
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
}

// --- Navegación y Validación ---
function nextStep(step) {
    const currentStep = step > 0 ? step - 1 : 0;
    
    // Si intentamos avanzar (no retroceder), validamos el paso actual
    const activeStepDiv = document.querySelector('.step.active');
    const targetStepDiv = document.getElementById(`step-${step}`);
    
    // Solo validamos si el usuario intenta ir hacia adelante
    if (activeStepDiv && parseInt(activeStepDiv.id.split('-')[1]) < step) {
        const inputs = activeStepDiv.querySelectorAll('input[required]');
        for (let input of inputs) {
            if (!input.value.trim()) {
                // Obtener el nombre del campo desde el label
                const labelText = input.previousElementSibling ? input.previousElementSibling.innerText : "este campo";
                Swal.fire({
                    icon: 'warning',
                    title: 'Campo Requerido',
                    text: `Por favor completa: ${labelText}`,
                    background: '#24243e',
                    color: '#fff',
                    confirmButtonColor: '#00A9FF'
                });
                return; // Detiene la navegación
            }
        }

        // Validación extra para el monto en el Paso 1
        if (activeStepDiv.id === 'step-1') {
            const monto = parseFloat(document.getElementById('monto_usd').value);
            if (monto < 50) {
                Swal.fire({ icon: 'error', title: 'Monto insuficiente', text: 'El mínimo de envío es $50 USD', background: '#24243e', color: '#fff' });
                return;
            }
        }
    }

    // Cambiar de paso visualmente
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    targetStepDiv.classList.add('active');
    document.querySelector('.modal-content').scrollTop = 0;
}

function abrirModal() {
    // Ocultar la notificación al hacer clic
    const notification = document.getElementById('fab-notification');
    if(notification) notification.style.display = 'none';

    const modal = document.getElementById('modalTransferencia');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    nextStep(0);
}

function cerrarModal() {
    const modal = document.getElementById('modalTransferencia');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true'); // Decimos que vuelve a estar oculto
    document.body.style.overflow = 'auto';
    resetForm();
}

function resetForm() {
    document.getElementById('form-transaccion').reset();
    document.getElementById('total_cup').innerText = "0.00 CUP";
    document.getElementById('total_usd').innerText = "$0.00";
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-0').classList.add('active');
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

// --- Registro y Subida (Asegurar validación final antes de enviar) ---
async function subirImagen(file) {
    if(!file) return null;
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
    const fileInput = document.getElementById('comprobante');

    if (fileInput.files.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Falta el comprobante', text: 'Debes subir la imagen del pago Zelle.', background: '#24243e', color: '#fff' });
        return;
    }

    btn.disabled = true;
    btn.innerText = "Procesando...";

    Swal.fire({ 
        title: 'Enviando Datos', 
        text: 'Estamos procesando tu solicitud...', 
        background: '#24243e', 
        color: '#fff', 
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const url = await subirImagen(fileInput.files[0]);
        if(!url) throw new Error("Error al subir comprobante. Intenta de nuevo.");

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

        Swal.fire({ 
            icon: 'success', 
            title: '¡Recibido!', 
            text: 'Tu envío está siendo verificado. Te contactaremos por WhatsApp.', 
            background: '#24243e', 
            color: '#fff' 
        });
        cerrarModal();

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#24243e', color: '#fff' });
    } finally {
        btn.disabled = false;
        btn.innerText = "Finalizar Envío";
    }
});

window.copiarZelle = copiarZelle;
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.nextStep = nextStep;