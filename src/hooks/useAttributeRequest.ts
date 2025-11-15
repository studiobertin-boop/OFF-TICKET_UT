import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { attributeRequest, getAllUsers } from '@/services/requestService'
import { useAuth } from './useAuth'

/**
 * Hook to fetch all users for attribution dropdown
 */
export function useAllUsers() {
  return useQuery({
    queryKey: ['users', 'all'],
    queryFn: getAllUsers,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  })
}

/**
 * Hook to attribute a request to a user (admin only)
 */
export function useAttributeRequest() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      requestId,
      attributedToUserId,
      notes,
    }: {
      requestId: string
      attributedToUserId: string
      notes?: string
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }
      return attributeRequest(requestId, attributedToUserId, user.id, notes)
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate requests queries to update attributed_to field
        queryClient.invalidateQueries({
          queryKey: ['requests'],
        })
        queryClient.invalidateQueries({
          queryKey: ['request', variables.requestId],
        })

        // Invalidate notifications (attributed user will see new notification)
        queryClient.invalidateQueries({
          queryKey: ['notifications'],
        })

        // Invalidate request history
        queryClient.invalidateQueries({
          queryKey: ['request-history', variables.requestId],
        })
      }
    },
  })
}
