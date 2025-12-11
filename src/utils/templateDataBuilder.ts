/**
 * Helper per costruire il contesto dati per i template DM329
 */

import type { DM329TechnicalData, Request, Customer } from '@/types';
import type { ReportGenerationInput } from '@/types/report';

/**
 * Costruisce il contesto completo dei placeholder per template DM329
 */
export function buildDM329PlaceholderContext(
  customer: Customer,
  technicalData: DM329TechnicalData,
  request: Request,
  additionalInfo: ReportGenerationInput
) {
  const equipmentData = technicalData.equipment_data || {};

  // Prepara dati compressori con info aggiuntive
  const compressori = (equipmentData.compressori || []).map((comp: any) => ({
    ...comp,
    tipo_giri: additionalInfo.compressoriGiri[comp.codice] === 'variabili'
      ? 'variabili (inverter)'
      : 'fissi',
    serbatoi_collegati: additionalInfo.collegamentiCompressoriSerbatoi[comp.codice] || []
  }));

  // Prepara dati serbatoi con info spessimetrica
  const serbatoi = (equipmentData.serbatoi || []).map((serb: any) => ({
    ...serb,
    sottoposto_spessimetrica: additionalInfo.spessimetrica.includes(serb.codice)
  }));

  // Prepara dati disoleatori con info spessimetrica
  const disoleatori = (equipmentData.disoleatori || []).map((dis: any) => ({
    ...dis,
    sottoposto_spessimetrica: additionalInfo.spessimetrica.includes(dis.codice)
  }));

  // Prepara dati scambiatori con info spessimetrica
  const scambiatori = (equipmentData.scambiatori || []).map((sc: any) => ({
    ...sc,
    sottoposto_spessimetrica: additionalInfo.spessimetrica.includes(sc.codice)
  }));

  // Prepara dati recipienti filtro con info spessimetrica
  const recipientiFiltro = (equipmentData.recipienti_filtro || []).map((rec: any) => ({
    ...rec,
    sottoposto_spessimetrica: additionalInfo.spessimetrica.includes(rec.codice)
  }));

  return {
    // Dati cliente
    cliente: {
      ragione_sociale: customer.ragione_sociale,
      sede_legale: {
        via: customer.via || '',
        civico: '',
        cap: customer.cap || '',
        citta: customer.comune || '',
        provincia: customer.provincia || ''
      }
    },

    // Sito impianto (per ora uguale a sede legale, potrebbe essere diverso)
    sito_impianto: {
      via: customer.via || '',
      civico: '',
      cap: customer.cap || '',
      citta: customer.comune || '',
      provincia: customer.provincia || ''
    },

    // Dati generali
    data_sopralluogo: request.created_at ? new Date(request.created_at).toLocaleDateString('it-IT') : '',
    nome_tecnico: '', // Da compilare manualmente o prendere da utente assegnato
    descrizione_attivita: additionalInfo.descrizioneAttivita,

    // Dati impianto
    dati_impianto: {
      locale_dedicato: (technicalData as any).impianto_info?.locale_dedicato ?? false,
      accesso_locale_vietato: (technicalData as any).impianto_info?.accesso_vietato ?? false,
      aria_aspirata: (technicalData as any).impianto_info?.aria_aspirata || [],
      raccolta_condense: (technicalData as any).impianto_info?.raccolta_condense || [],
      lontano_materiale_infiammabile: (technicalData as any).impianto_info?.lontano_materiale_infiammabile ?? false
    },

    // Apparecchiature
    compressori,
    serbatoi,
    disoleatori,
    essiccatori: equipmentData.essiccatori || [],
    scambiatori,
    filtri: equipmentData.filtri || [],
    recipienti_filtro: recipientiFiltro,
    separatori: equipmentData.separatori || [],
    valvole_sicurezza: equipmentData.valvole_sicurezza || [],

    // Statistiche e dati calcolati
    stats: {
      num_compressori: compressori.length,
      num_serbatoi: serbatoi.length,
      num_disoleatori: disoleatori.length,
      num_essiccatori: (equipmentData.essiccatori || []).length,
      num_filtri: (equipmentData.filtri || []).length,
      volume_totale_serbatoi: serbatoi.reduce((sum: number, s: any) => sum + (s.volume || 0), 0),
      portata_totale_compressori: compressori.reduce((sum: number, c: any) => sum + (c.volume_aria_prodotto || 0), 0)
    },

    // Apparecchiature per spessimetrica
    apparecchiature_spessimetrica: [
      ...serbatoi.filter((s: any) => s.sottoposto_spessimetrica).map((s: any) => s.codice),
      ...disoleatori.filter((d: any) => d.sottoposto_spessimetrica).map((d: any) => d.codice),
      ...scambiatori.filter((s: any) => s.sottoposto_spessimetrica).map((s: any) => s.codice),
      ...recipientiFiltro.filter((r: any) => r.sottoposto_spessimetrica).map((r: any) => r.codice)
    ],

    // Helper flags booleani utili per condizioni
    flags: {
      ha_compressori: compressori.length > 0,
      ha_serbatoi: serbatoi.length > 0,
      ha_disoleatori: disoleatori.length > 0,
      ha_essiccatori: (equipmentData.essiccatori || []).length > 0,
      ha_filtri: (equipmentData.filtri || []).length > 0,
      ha_spessimetrica: additionalInfo.spessimetrica.length > 0,
      ha_compressori_inverter: compressori.some((c: any) => c.tipo_giri.includes('variabili'))
    },

    // Metadata
    metadata: {
      data_generazione: new Date().toLocaleDateString('it-IT'),
      ora_generazione: new Date().toLocaleTimeString('it-IT'),
      request_id: request.id,
      request_title: request.title
    }
  };
}
