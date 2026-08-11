/**
 * Vocabolario del fascicolo apparecchiatura.
 *
 * Il fascicolo è un PDF unico che raccoglie, in un ordine prescritto, i documenti di
 * un'apparecchiatura: il suo certificato CE, le sue istruzioni, quelli della valvola di
 * sicurezza che la protegge, la foto della targhetta e — se l'apparecchiatura è collegata a
 * un'altra che la contiene — certificato e targhetta di quest'ultima.
 */

/** Ruolo che un documento ricopre nel fascicolo. L'ordine di dichiarazione è quello del PDF. */
export type RuoloDocumento =
  | 'CERT_APPARECCHIATURA'
  | 'ISTR_APPARECCHIATURA'
  | 'CERT_VALVOLA'
  | 'ISTR_VALVOLA'
  | 'FOTO_TARGHETTA'
  | 'CERT_PRINCIPALE'
  | 'FOTO_TARGHETTA_PRINCIPALE'

/**
 * I sette ruoli nell'ordine in cui compaiono nel fascicolo.
 *
 * È l'unica dichiarazione dell'ordine: chi deve confrontare due ruoli usa il loro indice qui,
 * non una tabella propria.
 */
export const ORDINE_RUOLI = [
  'CERT_APPARECCHIATURA',
  'ISTR_APPARECCHIATURA',
  'CERT_VALVOLA',
  'ISTR_VALVOLA',
  'FOTO_TARGHETTA',
  'CERT_PRINCIPALE',
  'FOTO_TARGHETTA_PRINCIPALE',
] as const satisfies readonly RuoloDocumento[]

/** Ruoli che riguardano la valvola di sicurezza: si ripetono per ogni valvola censita. */
export const RUOLI_VALVOLA = ['CERT_VALVOLA', 'ISTR_VALVOLA'] as const

/** Ruoli che riguardano l'apparecchiatura principale, presenti solo se esiste. */
export const RUOLI_PRINCIPALE = ['CERT_PRINCIPALE', 'FOTO_TARGHETTA_PRINCIPALE'] as const

export const indiceRuolo = (ruolo: RuoloDocumento): number => ORDINE_RUOLI.indexOf(ruolo)

/**
 * Etichette dei ruoli. `{app}` e `{princ}` si sostituiscono con tipo e codice
 * dell'apparecchiatura, così l'elenco dice «Certificato CE — disoleatore C1.1» e non
 * «Certificato CE dell'apparecchiatura»: chi rivede la classificazione deve riconoscere il
 * documento a colpo d'occhio.
 */
export const RUOLO_LABELS: Record<RuoloDocumento, string> = {
  CERT_APPARECCHIATURA: 'Certificato CE — {app}',
  ISTR_APPARECCHIATURA: 'Istruzioni uso e manutenzione — {app}',
  CERT_VALVOLA: 'Certificato CE — valvola di sicurezza',
  ISTR_VALVOLA: 'Istruzioni uso e manutenzione — valvola di sicurezza',
  FOTO_TARGHETTA: 'Foto targhetta — {app}',
  CERT_PRINCIPALE: 'Certificato CE — {princ}',
  FOTO_TARGHETTA_PRINCIPALE: 'Foto targhetta — {princ}',
}

/** Dati di targa di un'apparecchiatura: sono le prove con cui si attribuisce un documento. */
export interface DatiIdentificativi {
  marca?: string | null
  modello?: string | null
  anno?: number | string | null
  n_fabbrica?: string | null
  /** Pressione di taratura per le valvole, PS per i recipienti: distingue fra loro le gemelle. */
  pressione?: number | string | null
}

/** Apparecchiatura nominata nel fascicolo, con il suo codice di scheda. */
export interface Apparecchiatura extends DatiIdentificativi {
  codice: string
  /** Nome del tipo, minuscolo e senza articolo: «disoleatore», «valvola di sicurezza». */
  tipo: string
}

/** Etichetta di un ruolo per questo fascicolo: «Certificato CE — disoleatore C1.1». */
export const etichettaRuolo = (ruolo: RuoloDocumento, contesto: ContestoFascicolo): string => {
  const nome = (a: Apparecchiatura | null) => (a ? `${a.tipo} ${a.codice}` : 'apparecchiatura principale')
  return RUOLO_LABELS[ruolo]
    .replace('{app}', nome(contesto.apparecchiatura))
    .replace('{princ}', nome(contesto.principale))
}

/**
 * Tutto ciò che la scheda già sa dell'apparecchiatura e del suo intorno.
 *
 * Serve due volte: alla classificazione, per attribuire un certificato all'una o all'altra
 * apparecchiatura confrontando i dati di targa, e all'ordinamento, per sapere quante valvole
 * esistono e se c'è un'apparecchiatura principale.
 */
export interface ContestoFascicolo {
  apparecchiatura: Apparecchiatura
  /** In ordine di codice: la principale prima, poi le aggiuntive. */
  valvole: Apparecchiatura[]
  /** Il compressore del disoleatore, l'essiccatore dello scambiatore, il filtro del recipiente. */
  principale: Apparecchiatura | null
}

/** Un documento del fascicolo: caricato ora, o già salvato e riletto dal database. */
export interface DocumentoFascicolo {
  id: string
  nome: string
  /** Byte. Si tiene a parte perché per i documenti salvati il file non è in memoria. */
  peso: number
  mime?: string | null
  /** Presente per ciò che si è appena trascinato, prima che il caricamento finisca. */
  file?: File
  /** Presente per ciò che sta nel bucket `fascicoli`. Almeno uno dei due c'è sempre. */
  filePath?: string
  /** `fascicolo` è il PDF composto, che convive con i suoi sorgenti. */
  tipo?: 'sorgente' | 'fascicolo'
  /**
   * Ruoli che il documento ricopre. Sono più d'uno quando un file contiene sia il certificato
   * sia le istruzioni: in quel caso entra nel fascicolo una volta sola, al primo dei suoi posti.
   * Vuoto = non riconosciuto, e resta fuori finché non gliene si assegna uno a mano.
   */
  ruoli: RuoloDocumento[]
  /** Codice della valvola a cui il documento si riferisce, quando le valvole sono più d'una. */
  valvola?: string | null
  /** 0-1. Sotto la soglia di fiducia la classificazione si mostra come da verificare. */
  confidenza?: number
  /** Una riga sul perché di quel ruolo, mostrata accanto al file. */
  motivazione?: string
  /** `euristica` quando la classificazione è un ripiego senza AI. */
  origine?: 'ai' | 'euristica' | 'manuale'
}
