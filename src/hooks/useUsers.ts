import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  unsuspendUser,
  resetUserPassword,
  getTechnicians,
  getDM329Technicians,
  type CreateUserData,
  type UpdateUserData,
} from '../services/api/users'
import type { User } from '../types'

// Query keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: () => [...userKeys.lists()] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  technicians: () => [...userKeys.all, 'technicians'] as const,
  dm329Technicians: () => [...userKeys.all, 'dm329-technicians'] as const,
}

/**
 * Hook per recuperare tutti gli utenti
 */
export function useUsers() {
  return useQuery<User[], Error>({
    queryKey: userKeys.list(),
    queryFn: getAllUsers,
    staleTime: 1000 * 60 * 5, // 5 minuti
  })
}

/**
 * Hook per recuperare un singolo utente
 */
export function useUser(userId: string) {
  return useQuery<User, Error>({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUserById(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minuti
  })
}

/**
 * Hook per recuperare i tecnici (per dropdown)
 */
export function useTechnicians() {
  return useQuery({
    queryKey: userKeys.technicians(),
    queryFn: getTechnicians,
    staleTime: 1000 * 60 * 5, // 5 minuti
  })
}

/**
 * Hook per recuperare i tecnici DM329 (per assegnazione richieste DM329)
 */
export function useDM329Technicians() {
  return useQuery({
    queryKey: userKeys.dm329Technicians(),
    queryFn: getDM329Technicians,
    staleTime: 1000 * 60 * 5, // 5 minuti
  })
}

/**
 * Hook per creare un nuovo utente
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation<User, Error, CreateUserData>({
    mutationFn: createUser,
    onSuccess: () => {
      // Invalidare la cache degli utenti per ricaricare la lista
      queryClient.invalidateQueries({ queryKey: userKeys.list() })
      queryClient.invalidateQueries({ queryKey: userKeys.technicians() })
      queryClient.invalidateQueries({ queryKey: userKeys.dm329Technicians() })
    },
  })
}

/**
 * Hook per aggiornare un utente
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation<User, Error, { userId: string; updates: UpdateUserData }>({
    mutationFn: ({ userId, updates }) => updateUser(userId, updates),
    onSuccess: (data) => {
      // Invalidare la cache per l'utente specifico e la lista
      queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) })
      queryClient.invalidateQueries({ queryKey: userKeys.list() })
      queryClient.invalidateQueries({ queryKey: userKeys.technicians() })
      queryClient.invalidateQueries({ queryKey: userKeys.dm329Technicians() })
    },
  })
}

/**
 * Hook per eliminare un utente
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: deleteUser,
    onSuccess: () => {
      // Invalidare la cache degli utenti
      queryClient.invalidateQueries({ queryKey: userKeys.list() })
      queryClient.invalidateQueries({ queryKey: userKeys.technicians() })
      queryClient.invalidateQueries({ queryKey: userKeys.dm329Technicians() })
    },
  })
}

/**
 * Hook per sospendere un utente
 */
export function useSuspendUser() {
  const queryClient = useQueryClient()

  return useMutation<User, Error, string>({
    mutationFn: suspendUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) })
      queryClient.invalidateQueries({ queryKey: userKeys.list() })
      queryClient.invalidateQueries({ queryKey: userKeys.technicians() })
      queryClient.invalidateQueries({ queryKey: userKeys.dm329Technicians() })
    },
  })
}

/**
 * Hook per riattivare un utente sospeso
 */
export function useUnsuspendUser() {
  const queryClient = useQueryClient()

  return useMutation<User, Error, string>({
    mutationFn: unsuspendUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) })
      queryClient.invalidateQueries({ queryKey: userKeys.list() })
      queryClient.invalidateQueries({ queryKey: userKeys.technicians() })
      queryClient.invalidateQueries({ queryKey: userKeys.dm329Technicians() })
    },
  })
}

/**
 * Hook per resettare la password di un utente
 */
export function useResetUserPassword() {
  return useMutation<void, Error, { userId: string; newPassword: string }>({
    mutationFn: ({ userId, newPassword }) => resetUserPassword(userId, newPassword),
  })
}
