/**
 * Engine — elenco ALLEGATI.
 * La tabella VERIFICHE PERIODICHE è statica e vive nel template Word.
 * Qui si risolve solo l'unica voce condizionale: le verifiche di integrità,
 * presenti solo se almeno un'apparecchiatura è sottoposta a spessimetrica.
 */
import type { AdditionalInfo } from '../types'

export function buildAllegati(additionalInfo: AdditionalInfo): string[] {
  const voci = [
    'Attestazioni di conformità/Documenti di omologazione apparecchiature oggetto di ' +
      'verifica/denuncia e relativi organi di sicurezza',
    "Manuali d'uso e manutenzione apparecchiature oggetto di verifica/denuncia e relativi " +
      'organi di sicurezza',
  ]
  if ((additionalInfo.spessimetrica ?? []).length > 0) {
    voci.push('Verifiche di integrità, ove previste')
  }
  return voci
}
