/**
 * CIVAEquipmentBrowser Component
 *
 * Mostra i dati CIVA di una sola apparecchiatura alla volta. Le frecce per sfogliare
 * l'apparecchiatura precedente/successiva sono integrate nell'intestazione della
 * card (accanto al codice), non in un controllo separato.
 */

import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import type { CIVAApparecchio } from '@/types/civa'
import type { Customer, Installer } from '@/types'
import { CIVAApparecchioColumn } from './CIVAApparecchioColumn'

interface CIVAEquipmentBrowserProps {
  apparecchi: CIVAApparecchio[]
  customer: Customer
  installer: Installer
  indirizzoImpianto: string
  spessimetricaCodes: Set<string>
  width?: number
}

export const CIVAEquipmentBrowser = ({
  apparecchi,
  customer,
  installer,
  indirizzoImpianto,
  spessimetricaCodes,
  width = 362
}: CIVAEquipmentBrowserProps) => {
  const [index, setIndex] = useState(0)
  const total = apparecchi.length
  const safeIndex = ((index % total) + total) % total
  const current = apparecchi[safeIndex]

  return (
    <Box sx={{ width, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <CIVAApparecchioColumn
        key={current.codice}
        apparecchio={current}
        customer={customer}
        installer={installer}
        indirizzoImpianto={indirizzoImpianto}
        verificaIntegrita={spessimetricaCodes.has(current.codice)}
        width={width}
        nav={{
          onPrev: () => setIndex(safeIndex - 1),
          onNext: () => setIndex(safeIndex + 1),
          enabled: total > 1
        }}
      />

      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
        Clic su un valore per copiarlo. Larghezza pensata per stare affiancata alla finestra del portale CIVA.
      </Typography>
    </Box>
  )
}
