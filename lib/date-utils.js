// lib/date-utils.js

export const TIMEZONE = 'America/Santiago';

/**
 * Obtiene la fecha actual formateada como YYYY-MM-DD en hora de Chile
 * Ideal para filtros de Supabase .eq('fecha', getChileISO())
 */
export const getChileISO = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', { // sv-SE genera formato YYYY-MM-DD
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
};

/**
 * Convierte cualquier fecha de la DB (UTC) a formato legible en Chile
 */
export const formatToChile = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};