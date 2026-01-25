// js/supabase.js

const SUPABASE_URL = "https://pwbemdkqgdufxicztpwv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3YmVtZGtxZ2R1ZnhpY3p0cHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDA2NjUsImV4cCI6MjA4NDkxNjY2NX0.FVa2QSJVbHZVIDJSbqawSJexxOt8drvJubXXv8840HM";

// Inicializamos el cliente. 
// Usamos 'supabaseClient' para no confundirlo con la librería global 'supabase'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Función robusta para envolver peticiones y manejar errores
 * Devuelve { data, error }
 */
async function ejecutarOperacion(promesa, etiqueta = "Operación") {
    try {
        const resultado = await promesa;
        if (resultado.error) {
            console.error(`🔴 Error en ${etiqueta}:`, resultado.error.message);
            return { data: null, error: resultado.error };
        }
        return { data: resultado.data, error: null };
    } catch (err) {
        console.error(`❌ Fallo crítico en ${etiqueta}:`, err);
        return { data: null, error: err };
    }
}

// Verificar conexión al cargar
(async () => {
    const { error } = await supabaseClient.from('config').select('id').limit(1).single();
    if (error) console.warn("⚠️ Conexión establecida pero con advertencia (RLS):", error.message);
    else console.log("✅ Conexión con Supabase lista.");
})();