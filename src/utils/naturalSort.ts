/**
 * Ordinamento naturale dei codici di scheda DM329 (S1, S2, ..., S10, E1, E1.1, E2, ...).
 */
export function naturalSortComparator(a: string, b: string): number {
  const regex = /([A-Z]+)(\d+)(?:\.(\d+))?/
  const matchA = a.match(regex)
  const matchB = b.match(regex)

  if (!matchA || !matchB) {
    return a.localeCompare(b)
  }

  const [, letterA, numA, subNumA] = matchA
  const [, letterB, numB, subNumB] = matchB

  if (letterA !== letterB) {
    return letterA.localeCompare(letterB)
  }

  const numCompare = parseInt(numA, 10) - parseInt(numB, 10)
  if (numCompare !== 0) {
    return numCompare
  }

  const subA = subNumA ? parseInt(subNumA, 10) : 0
  const subB = subNumB ? parseInt(subNumB, 10) : 0
  return subA - subB
}
