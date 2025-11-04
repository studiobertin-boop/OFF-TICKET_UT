import { supabase, ensureValidSession } from '../supabase'
import { DeletionArchive, Request, RequestHistory } from '@/types'
import { generateDeletionArchivePDF, generateDeletionArchiveFilename } from '../pdfService'

interface RequestWithHistory extends Request {
  history: RequestHistory[]
}

export const deletionArchivesApi = {
  // Get all deletion archives (admin only)
  getAll: async (): Promise<DeletionArchive[]> => {
    const { data, error } = await supabase
      .from('deletion_archives')
      .select(`
        *,
        deleted_by_user:users!deletion_archives_deleted_by_fkey(id, email, full_name, role)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Get single deletion archive by ID
  getById: async (id: string): Promise<DeletionArchive> => {
    const { data, error } = await supabase
      .from('deletion_archives')
      .select(`
        *,
        deleted_by_user:users!deletion_archives_deleted_by_fkey(id, email, full_name, role)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Download PDF from storage
  downloadPDF: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage
      .from('deletion-archives')
      .download(filePath)

    if (error) throw error
    return data
  },

  // Get public URL for PDF (with signed URL for private bucket)
  getSignedURL: async (filePath: string, expiresIn: number = 3600): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('deletion-archives')
      .createSignedUrl(filePath, expiresIn)

    if (error) throw error
    return data.signedUrl
  },

  // Bulk delete requests with PDF archive generation
  bulkDeleteWithArchive: async (requestIds: string[]): Promise<DeletionArchive> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      throw new Error('Non autenticato')
    }

    // 1. Fetch requests with full details and history
    const { data: requests, error: fetchError } = await supabase
      .from('requests')
      .select(`
        *,
        request_type:request_types(*),
        assigned_user:users!requests_assigned_to_fkey(id, email, full_name, role),
        creator:users!requests_created_by_fkey(id, email, full_name, role),
        customer:customers(*)
      `)
      .in('id', requestIds)

    if (fetchError) throw fetchError
    if (!requests || requests.length === 0) {
      throw new Error('Nessuna richiesta trovata')
    }

    // 2. Fetch history for each request
    const { data: histories, error: historyError } = await supabase
      .from('request_history')
      .select(`
        *,
        changed_by_user:users!request_history_changed_by_fkey(id, email, full_name, role)
      `)
      .in('request_id', requestIds)
      .order('created_at', { ascending: true })

    if (historyError) throw historyError

    // 3. Combine requests with their history
    const requestsWithHistory: RequestWithHistory[] = requests.map(request => ({
      ...request,
      history: (histories || []).filter(h => h.request_id === request.id)
    }))

    // 4. Generate PDF
    const deletionDate = new Date()
    const pdfBlob = await generateDeletionArchivePDF(requestsWithHistory, deletionDate)
    const fileName = generateDeletionArchiveFilename(deletionDate)

    // 5. Upload PDF to storage
    const userId = session.session.user.id
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('deletion-archives')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) throw uploadError

    // 6. Get file size
    const fileSize = pdfBlob.size

    // 7. Create deletion archive record
    const { data: archive, error: archiveError } = await supabase
      .from('deletion_archives')
      .insert({
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        deleted_count: requests.length,
        deleted_by: userId
      })
      .select(`
        *,
        deleted_by_user:users!deletion_archives_deleted_by_fkey(id, email, full_name, role)
      `)
      .single()

    if (archiveError) throw archiveError

    // 8. Get all attachments for these requests
    const { data: attachments, error: attachmentsFetchError } = await supabase
      .from('attachments')
      .select('file_path')
      .in('request_id', requestIds)

    if (attachmentsFetchError) throw attachmentsFetchError

    // 9. Delete attachments from storage if any exist
    if (attachments && attachments.length > 0) {
      const filePaths = attachments.map(a => a.file_path)
      const { error: storageError } = await supabase.storage
        .from('request-attachments')
        .remove(filePaths)

      if (storageError) {
        console.error('Error deleting attachments from storage:', storageError)
        // Continue with request deletion even if storage deletion fails
      }
    }

    // 10. Delete requests (cascade will delete attachments records, history, blocks, etc.)
    const { error: deleteError } = await supabase
      .from('requests')
      .delete()
      .in('id', requestIds)

    if (deleteError) {
      if (deleteError.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono eliminare richieste.')
      }
      throw deleteError
    }

    return archive
  },

  // Delete archive record and PDF file (admin only, for cleanup)
  delete: async (id: string): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    // Get archive to find file path
    const archive = await deletionArchivesApi.getById(id)

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('deletion-archives')
      .remove([archive.file_path])

    if (storageError) {
      console.error('Error deleting PDF from storage:', storageError)
      // Continue with record deletion even if storage deletion fails
    }

    // Delete record
    const { error } = await supabase
      .from('deletion_archives')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono eliminare archivi.')
      }
      throw error
    }
  }
}
