
export interface FetchedPractice {
  request_id: string
  request_type: 'DM329' | 'DM329-Integrazioni'
  customer_id: string
  codice_cliente: string
  cliente: string
  title: string
  indirizzo: string
  status: string
  created_at: string
}

export interface ProposedAssignment {
  request_id: string
  request_type: string
  customer_id: string
  codice_cliente: string
  cliente: string
  title: string
  indirizzo: string
  status: string
  created_at: string
  prop_sala_lettera: string
  prop_denominazione_sala: string
  prop_progressivo: number
  prop_anno: number
  pratica_padre: string
  note_override: string
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const normAddr = (s: string) =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

const yearOf = (iso: string) => new Date(iso).getUTCFullYear()

export function proposeAssignments(practices: FetchedPractice[]): ProposedAssignment[] {
  const primaries = practices.filter(p => p.request_type === 'DM329')
  const integrazioni = practices.filter(p => p.request_type === 'DM329-Integrazioni')
  const out: ProposedAssignment[] = []

  // Raggruppa le primarie per cliente
  const byCustomer = new Map<string, FetchedPractice[]>()
  for (const p of primaries) {
    if (!byCustomer.has(p.customer_id)) byCustomer.set(p.customer_id, [])
    byCustomer.get(p.customer_id)!.push(p)
  }

  for (const [, rows] of byCustomer) {
    // Ordina per data crescente
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
    // Assegna una lettera per indirizzo distinto (ordine di prima comparsa)
    const letterOf = new Map<string, string>()
    const progOf = new Map<string, number>()
    let nextLetterIdx = 0
    for (const p of sorted) {
      const key = normAddr(p.indirizzo)
      if (!letterOf.has(key)) {
        letterOf.set(key, LETTERS[nextLetterIdx] || 'Z')
        nextLetterIdx++
        progOf.set(key, 0)
      }
      const lettera = letterOf.get(key)!
      const progressivo = progOf.get(key)!
      progOf.set(key, progressivo + 1)
      out.push({
        request_id: p.request_id,
        request_type: p.request_type,
        customer_id: p.customer_id,
        codice_cliente: p.codice_cliente,
        cliente: p.cliente,
        title: p.title,
        indirizzo: p.indirizzo,
        status: p.status,
        created_at: p.created_at,
        prop_sala_lettera: lettera,
        prop_denominazione_sala: '',
        prop_progressivo: progressivo,
        prop_anno: yearOf(p.created_at),
        pratica_padre: '',
        note_override: '',
      })
    }
  }

  // Integrazioni: proponi come padre la primaria più recente dello stesso cliente
  for (const i of integrazioni) {
    const candidates = primaries
      .filter(p => p.customer_id === i.customer_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    const parentId = candidates[0]?.request_id ?? ''
    const parentAssignment = parentId ? out.find(o => o.request_id === parentId) : undefined

    out.push({
      request_id: i.request_id,
      request_type: i.request_type,
      customer_id: i.customer_id,
      codice_cliente: i.codice_cliente,
      cliente: i.cliente,
      title: i.title,
      indirizzo: i.indirizzo,
      status: i.status,
      created_at: i.created_at,
      prop_sala_lettera: parentAssignment?.prop_sala_lettera ?? '',
      prop_denominazione_sala: parentAssignment?.prop_denominazione_sala ?? '',
      prop_progressivo: parentAssignment?.prop_progressivo ?? 0,
      prop_anno: parentAssignment?.prop_anno ?? yearOf(i.created_at),
      pratica_padre: parentId,
      note_override: '',
    })
  }

  return out
}

export interface ReviewedAssignment {
  request_id: string
  request_type: string
  customer_id: string
  sala_lettera: string
  denominazione_sala: string
  progressivo: number
  anno: number
  indirizzo_impianto: string
  pratica_padre: string
}

export interface ValidationError {
  request_id: string
  message: string
}

export interface ValidationReport {
  valid: ReviewedAssignment[]
  errors: ValidationError[]
}

export function validateAssignments(rows: ReviewedAssignment[]): ValidationReport {
  const errors: ValidationError[] = []
  const invalidIds = new Set<string>()
  const fail = (id: string, message: string) => {
    errors.push({ request_id: id, message })
    invalidIds.add(id)
  }

  const primaries = rows.filter(r => !r.pratica_padre)
  const integrazioni = rows.filter(r => r.pratica_padre)

  // Vincoli di formato/range sulle primarie
  const seen = new Map<string, string>() // "cust|sala|prog" -> request_id
  for (const r of primaries) {
    if (!/^[A-Z]$/.test(r.sala_lettera)) fail(r.request_id, `sala_lettera non valida: "${r.sala_lettera}"`)
    if (!Number.isInteger(r.progressivo) || r.progressivo < 0 || r.progressivo > 99)
      fail(r.request_id, `progressivo fuori range: ${r.progressivo}`)
    if (!Number.isInteger(r.anno) || r.anno < 2000 || r.anno > 2100)
      fail(r.request_id, `anno fuori range: ${r.anno}`)
    const key = `${r.customer_id}|${r.sala_lettera}|${r.progressivo}`
    if (seen.has(key)) fail(r.request_id, `codice duplicato con ${seen.get(key)} (cliente+sala+progressivo)`)
    else seen.set(key, r.request_id)
  }

  // Integrazioni: il padre deve essere una primaria dello stesso cliente (in questo batch)
  const primaryById = new Map(primaries.map(p => [p.request_id, p]))
  for (const i of integrazioni) {
    const parent = primaryById.get(i.pratica_padre)
    if (!parent) fail(i.request_id, `pratica_padre inesistente o non primaria: "${i.pratica_padre}"`)
    else if (parent.customer_id !== i.customer_id)
      fail(i.request_id, `pratica_padre di un altro cliente`)
  }

  const valid = rows.filter(r => !invalidIds.has(r.request_id))
  return { valid, errors }
}
