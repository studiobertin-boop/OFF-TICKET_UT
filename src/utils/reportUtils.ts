/**
 * Utility functions per la generazione della Relazione Tecnica DM329
 */

import { AddressComponents } from '../types/index';
import {
  ApparecchiaturaFormattata,
  VerificaInfo,
  PlaceholderFlags,
} from '../types/report';
import {
  Serbatoio,
  Compressore,
  Disoleatore,
  Essiccatore,
  Scambiatore,
  Filtro,
  RecipienteFiltro,
  Separatore,
} from '../types/technicalSheet';

/**
 * Formatta componenti indirizzo in stringa leggibile
 */
export function formatAddress(components: AddressComponents): {
  via: string;
  civico: string;
  cap: string;
  citta: string;
  provincia: string;
} {
  // Estrai via e civico dalla stringa street se presente
  const street = components.street || '';
  const streetParts = street.split(',');
  const via = streetParts[0] || '';
  const civico = streetParts[1]?.trim() || '';

  return {
    via,
    civico,
    cap: components.postal_code || '',
    citta: components.city || '',
    provincia: components.province || '',
  };
}

/**
 * Formatta indirizzo completo in stringa
 */
export function formatFullAddress(components: AddressComponents): string {
  const { via, civico, cap, citta, provincia } = formatAddress(components);
  return `${via}${civico ? ', ' + civico : ''} - ${cap} ${citta} (${provincia})`;
}

/**
 * Calcola PS × V per classificazione serbatoi/recipienti
 */
export function calcolaPSxV(pressioneMax: number | undefined, volume: number | undefined): number {
  if (!pressioneMax || !volume) return 0;
  return pressioneMax * volume;
}

/**
 * Determina tipo di verifica richiesta per un serbatoio
 */
export function determinaVerificaSerbatoio(
  volume: number | undefined,
  pressioneMax: number | undefined
): VerificaInfo {
  if (!volume || !pressioneMax) {
    return {
      tipo: 'esclusa',
      motivazione: 'Dati insufficienti',
    };
  }

  // Volume < 50 litri: escluso
  if (volume < 50) {
    return {
      tipo: 'esclusa',
      motivazione: 'Volume < 50 litri (Art. 2.i DM 329/2004)',
    };
  }

  const psxv = calcolaPSxV(pressioneMax, volume);

  // PS × V > 8000: verifica richiesta
  if (psxv > 8000) {
    return {
      tipo: 'verifica',
      motivazione: `PS × V = ${psxv.toFixed(0)} > 8000 (Art. 4 e 5 DM 329/2004)`,
    };
  }

  // PS × V <= 8000: solo dichiarazione
  return {
    tipo: 'dichiarazione',
    motivazione: `PS × V = ${psxv.toFixed(0)} ≤ 8000 (Art. 4 e 5 DM 329/2004)`,
  };
}

/**
 * Determina tipo di verifica per disoleatore
 */
export function determinaVerificaDisoleatore(
  volume: number | undefined,
  pressioneMax: number | undefined
): VerificaInfo {
  if (!volume || !pressioneMax) {
    return {
      tipo: 'esclusa',
      motivazione: 'Dati insufficienti',
    };
  }

  // Volume < 25 litri: escluso
  if (volume < 25) {
    return {
      tipo: 'esclusa',
      motivazione: 'Volume < 25 litri (Art. 2.i DM 329/2004)',
    };
  }

  // Volume >= 25 litri E pressione > 12 bar: verifica richiesta
  if (volume >= 25 && pressioneMax > 12) {
    return {
      tipo: 'verifica',
      motivazione: 'Volume ≥ 25 litri e PS > 12 bar (Art. 4 e 5 DM 329/2004)',
    };
  }

  return {
    tipo: 'dichiarazione',
    motivazione: 'Volume ≥ 25 litri ma PS ≤ 12 bar',
  };
}

/**
 * Determina tipo di verifica per scambiatore
 */
export function determinaVerificaScambiatore(
  volume: number | undefined,
  pressioneMax: number | undefined
): VerificaInfo {
  if (!volume || !pressioneMax) {
    return {
      tipo: 'esclusa',
      motivazione: 'Dati insufficienti',
    };
  }

  // Volume < 25 litri: escluso
  if (volume < 25) {
    return {
      tipo: 'esclusa',
      motivazione: 'Volume < 25 litri (Art. 2.i DM 329/2004)',
    };
  }

  // Volume >= 25 litri E pressione > 12 bar: verifica richiesta
  if (volume >= 25 && pressioneMax > 12) {
    return {
      tipo: 'verifica',
      motivazione: 'Volume ≥ 25 litri e PS > 12 bar (Art. 4 e 5 DM 329/2004)',
    };
  }

  return {
    tipo: 'dichiarazione',
    motivazione: 'Volume ≥ 25 litri ma PS ≤ 12 bar',
  };
}

/**
 * Determina tipo di verifica per recipiente filtro
 */
export function determinaVerificaRecipienteFiltro(
  volume: number | undefined,
  pressioneMax: number | undefined
): VerificaInfo {
  // Stessa logica degli scambiatori
  return determinaVerificaScambiatore(volume, pressioneMax);
}

/**
 * Formatta apparecchiature serbatoio per la relazione
 */
export function formatSerbatoio(serbatoio: Serbatoio): ApparecchiaturaFormattata[] {
  const apparecchiature: ApparecchiaturaFormattata[] = [];

  // Serbatoio principale
  const verificaInfo = determinaVerificaSerbatoio(
    serbatoio.volume,
    serbatoio.ps_pressione_max
  );

  apparecchiature.push({
    posizione: serbatoio.codice,
    descrizione: 'Serbatoio aria verticale',
    costruttore: serbatoio.marca || '',
    modello: serbatoio.modello || '',
    capacita: serbatoio.volume || '',
    pressioneMassima: serbatoio.ps_pressione_max,
    temperatura: serbatoio.ts_temperatura ? `${serbatoio.ts_temperatura}` : '-10 ÷ +120',
    categoria: serbatoio.categoria_ped || '',
    anno: serbatoio.anno,
    numeroFabbrica: serbatoio.n_fabbrica || '',
    verificaInfo,
  });

  // Valvola di sicurezza associata
  if (serbatoio.valvola_sicurezza) {
    const vs = serbatoio.valvola_sicurezza;
    apparecchiature.push({
      posizione: `${serbatoio.codice}.1`,
      descrizione: 'Valvola di sicurezza',
      costruttore: vs.marca || '',
      modello: vs.modello || '',
      capacita: vs.volume_aria_scaricato || vs.portata_max,
      pressioneTaratura: vs.pressione_taratura || vs.pressione,
      temperatura: vs.ts_temperatura ? `${vs.ts_temperatura}` : '-10 ÷ +200',
      categoria: vs.categoria_ped || 'IV',
      anno: vs.anno,
      numeroFabbrica: vs.n_fabbrica || '',
      // Valvole non hanno verifica separata, incluse nella verifica del recipiente
    });
  }

  return apparecchiature;
}

/**
 * Formatta compressore e disoleatore per la relazione
 */
export function formatCompressore(
  compressore: Compressore,
  disoleatore?: Disoleatore
): ApparecchiaturaFormattata[] {
  const apparecchiature: ApparecchiaturaFormattata[] = [];

  // Compressore principale (escluso da verifica - Art. 1.3.L D.L. 93/2000)
  apparecchiature.push({
    posizione: compressore.codice,
    descrizione: 'Compressore',
    costruttore: compressore.marca || '',
    modello: compressore.modello || '',
    capacita: compressore.volume_aria_prodotto || compressore.fad || '',
    pressioneMassima: compressore.pressione_max,
    anno: compressore.anno,
    numeroFabbrica: compressore.n_fabbrica || '',
  });

  // Disoleatore se presente
  if (disoleatore) {
    const verificaInfo = determinaVerificaDisoleatore(
      disoleatore.volume,
      disoleatore.ps_pressione_max
    );

    apparecchiature.push({
      posizione: disoleatore.codice,
      descrizione: 'Serbatoio disoleatore',
      costruttore: disoleatore.marca || '',
      modello: disoleatore.modello || '',
      capacita: disoleatore.volume || '',
      pressioneMassima: disoleatore.ps_pressione_max || disoleatore.pressione_max,
      temperatura: disoleatore.ts_temperatura ? `${disoleatore.ts_temperatura}` : '-10 ÷ +120',
      categoria: disoleatore.categoria_ped || '',
      anno: disoleatore.anno,
      numeroFabbrica: disoleatore.n_fabbrica || '',
      verificaInfo,
    });

    // Valvola di sicurezza del disoleatore
    if (disoleatore.valvola_sicurezza) {
      const vs = disoleatore.valvola_sicurezza;
      apparecchiature.push({
        posizione: `${disoleatore.codice}.1`,
        descrizione: 'Valvola di sicurezza',
        costruttore: vs.marca || '',
        modello: vs.modello || '',
        capacita: vs.volume_aria_scaricato || vs.portata_max,
        pressioneTaratura: vs.pressione_taratura || vs.pressione,
        temperatura: vs.ts_temperatura ? `${vs.ts_temperatura}` : '-10 ÷ +200',
        categoria: vs.categoria_ped || 'IV',
        anno: vs.anno,
        numeroFabbrica: vs.n_fabbrica || '',
      });
    }
  }

  return apparecchiature;
}

/**
 * Formatta essiccatore e scambiatore per la relazione
 */
export function formatEssiccatore(
  essiccatore: Essiccatore,
  scambiatore?: Scambiatore
): ApparecchiaturaFormattata[] {
  const apparecchiature: ApparecchiaturaFormattata[] = [];

  // Essiccatore principale
  apparecchiature.push({
    posizione: essiccatore.codice,
    descrizione: 'Essiccatore frigorifero',
    costruttore: essiccatore.marca || '',
    modello: essiccatore.modello || '',
    capacita: essiccatore.volume_aria_trattata || '',
    pressioneMassima: essiccatore.ps_pressione_max || essiccatore.pressione_max,
    temperatura: '70',
    anno: essiccatore.anno,
    numeroFabbrica: essiccatore.n_fabbrica || '',
  });

  // Scambiatore se presente
  if (scambiatore) {
    const verificaInfo = determinaVerificaScambiatore(
      scambiatore.volume,
      scambiatore.ps_pressione_max
    );

    apparecchiature.push({
      posizione: scambiatore.codice,
      descrizione: 'Scambiatore di calore',
      costruttore: scambiatore.marca || '',
      modello: scambiatore.modello || '',
      capacita: scambiatore.volume || '',
      pressioneMassima: scambiatore.ps_pressione_max || scambiatore.pressione_max,
      temperatura: scambiatore.ts_temperatura ? `${scambiatore.ts_temperatura}` : '-20 ÷ +120',
      categoria: '',
      anno: scambiatore.anno,
      numeroFabbrica: scambiatore.n_fabbrica || '',
      verificaInfo,
    });
  }

  return apparecchiature;
}

/**
 * Formatta filtro e recipiente per la relazione
 */
export function formatFiltro(
  filtro: Filtro,
  recipiente?: RecipienteFiltro
): ApparecchiaturaFormattata[] {
  const apparecchiature: ApparecchiaturaFormattata[] = [];

  // Filtro principale
  apparecchiature.push({
    posizione: filtro.codice,
    descrizione: 'Filtro di linea',
    costruttore: filtro.marca || '',
    modello: filtro.modello || '',
    anno: filtro.anno,
    numeroFabbrica: filtro.n_fabbrica || '',
  });

  // Recipiente se presente
  if (recipiente) {
    const verificaInfo = determinaVerificaRecipienteFiltro(
      recipiente.volume,
      recipiente.ps_pressione_max
    );

    apparecchiature.push({
      posizione: recipiente.codice,
      descrizione: 'Recipiente filtro',
      costruttore: recipiente.marca || '',
      modello: recipiente.modello || '',
      capacita: recipiente.volume || '',
      pressioneMassima: recipiente.ps_pressione_max,
      temperatura: recipiente.ts_temperatura ? `${recipiente.ts_temperatura}` : '-20 ÷ +120',
      anno: recipiente.anno,
      numeroFabbrica: recipiente.n_fabbrica || '',
      verificaInfo,
    });
  }

  return apparecchiature;
}

/**
 * Formatta separatore per la relazione
 */
export function formatSeparatore(separatore: Separatore): ApparecchiaturaFormattata {
  return {
    posizione: separatore.codice,
    descrizione: 'Separatore acqua-olio',
    costruttore: separatore.marca || '',
    modello: separatore.modello || '',
    anno: separatore.anno,
    numeroFabbrica: separatore.n_fabbrica || '',
    // Separatori tipicamente esclusi da verifica
  };
}

/**
 * Pluralizza parola in base al numero
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Genera lista formattata di codici apparecchiature
 */
export function formatApparecchiatureList(codici: string[]): string {
  if (codici.length === 0) return '';
  if (codici.length === 1) return codici[0];
  if (codici.length === 2) return `${codici[0]} e ${codici[1]}`;

  const last = codici[codici.length - 1];
  const rest = codici.slice(0, -1).join(', ');
  return `${rest} e ${last}`;
}

/**
 * Determina flags per placeholder condizionali dalla scheda dati
 */
export function determinaFlags(
  technicalData: any,
  spessimetricaList: string[]
): PlaceholderFlags {
  const datiImpianto = technicalData.equipment_data?.dati_impianto || {};

  return {
    localeDedicato: datiImpianto.locale_dedicato === true,
    accessoVietato: datiImpianto.accesso_locale_vietato === true,
    ariaAspirataPulita:
      datiImpianto.aria_aspirata?.includes('Pulita') ||
      !datiImpianto.aria_aspirata ||
      datiImpianto.aria_aspirata.length === 0,
    revisioneDiChiarata: false, // Default - va gestito manualmente
    verificheSpessimetriche: spessimetricaList.length > 0,
    listaApparecchiatureSpessimetriche: spessimetricaList,
  };
}
