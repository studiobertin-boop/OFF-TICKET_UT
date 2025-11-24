import { supabase } from '../supabase'

export interface Attachment {
  id: string
  request_id: string
  file_name: string
  file_path: string
  file_size: number
  uploaded_by: string
  created_at: string
  uploaded_by_user?: {
    full_name: string
    email: string
  }
}

export interface UploadAttachmentInput {
  requestId: string
  file: File
}

export const attachmentsApi = {
  // Get all attachments for a request
  getByRequestId: async (requestId: string): Promise<Attachment[]> => {
    const { data, error } = await supabase
      .from('attachments')
      .select(`
        *,
        uploaded_by_user:users!uploaded_by(full_name, email)
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Upload a new attachment
  upload: async ({ requestId, file }: UploadAttachmentInput): Promise<Attachment> => {
    // Check file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Il file supera la dimensione massima di 10MB')
    }

    // Get current user
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      throw new Error('Non autenticato')
    }

    // Generate unique file path: requests/{requestId}/{timestamp}_{filename}
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `requests/${requestId}/${timestamp}_${sanitizedFileName}`

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error(`Errore nel caricamento del file: ${uploadError.message}`)
    }

    // Create attachment record in database
    const { data, error: dbError } = await supabase
      .from('attachments')
      .insert({
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: session.session.user.id,
      })
      .select(`
        *,
        uploaded_by_user:users!uploaded_by(full_name, email)
      `)
      .single()

    if (dbError) {
      // If database insert fails, try to delete the uploaded file
      await supabase.storage.from('attachments').remove([filePath])
      throw new Error(`Errore nel salvataggio dell'allegato: ${dbError.message}`)
    }

    return data
  },

  // Delete an attachment
  delete: async (attachmentId: string): Promise<void> => {
    // Get attachment details first
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('file_path')
      .eq('id', attachmentId)
      .single()

    if (fetchError) {
      throw new Error(`Errore nel recupero dell'allegato: ${fetchError.message}`)
    }

    if (!attachment) {
      throw new Error('Allegato non trovato')
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('attachments')
      .remove([attachment.file_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId)

    if (dbError) {
      throw new Error(`Errore nell'eliminazione dell'allegato: ${dbError.message}`)
    }
  },

  // Download an attachment
  download: async (filePath: string, fileName: string): Promise<void> => {
    const { data, error } = await supabase.storage
      .from('attachments')
      .download(filePath)

    if (error) {
      throw new Error(`Errore nel download: ${error.message}`)
    }

    // Create download link
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
