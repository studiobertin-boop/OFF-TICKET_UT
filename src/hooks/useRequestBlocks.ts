import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getRequestBlocks,
  getActiveBlock,
  blockRequest,
  unblockRequest,
} from '@/services/requestService'
import { useAuth } from './useAuth'

/**
 * Hook to fetch all blocks (active and resolved) for a request
 */
export function useRequestBlocks(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-blocks', requestId],
    queryFn: () => {
      if (!requestId) {
        return Promise.resolve([])
      }
      return getRequestBlocks(requestId)
    },
    enabled: !!requestId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

/**
 * Hook to fetch active block for a request
 */
export function useActiveBlock(requestId: string | undefined) {
  return useQuery({
    queryKey: ['active-block', requestId],
    queryFn: () => {
      if (!requestId) {
        return Promise.resolve(null)
      }
      return getActiveBlock(requestId)
    },
    enabled: !!requestId,
    staleTime: 1000 * 60 * 1, // 1 minute
  })
}

/**
 * Hook to block a request
 */
export function useBlockRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string
      reason: string
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }
      return blockRequest(requestId, user.id, reason)
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate blocks queries
        queryClient.invalidateQueries({
          queryKey: ['request-blocks', variables.requestId],
        })
        queryClient.invalidateQueries({
          queryKey: ['active-block', variables.requestId],
        })

        // Invalidate requests queries to update is_blocked field
        queryClient.invalidateQueries({
          queryKey: ['requests'],
        })
        queryClient.invalidateQueries({
          queryKey: ['request', variables.requestId],
        })

        // Invalidate notifications (user will see new notification)
        queryClient.invalidateQueries({
          queryKey: ['notifications'],
        })
      }
    },
  })
}

/**
 * Hook to unblock (resolve) a request
 */
export function useUnblockRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      blockId,
      resolutionNotes,
    }: {
      blockId: string
      requestId: string
      resolutionNotes?: string
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }
      return unblockRequest(blockId, user.id, resolutionNotes)
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate blocks queries
        queryClient.invalidateQueries({
          queryKey: ['request-blocks', variables.requestId],
        })
        queryClient.invalidateQueries({
          queryKey: ['active-block', variables.requestId],
        })

        // Invalidate requests queries to update is_blocked field
        queryClient.invalidateQueries({
          queryKey: ['requests'],
        })
        queryClient.invalidateQueries({
          queryKey: ['request', variables.requestId],
        })

        // Invalidate notifications (tecnico will see resolution notification)
        queryClient.invalidateQueries({
          queryKey: ['notifications'],
        })
      }
    },
  })
}
