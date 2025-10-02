/**
 * Optimistic Mutations Hook
 *
 * Provides hooks for common mutations with optimistic UI updates
 * and offline queue support.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueRequest } from '../../db/queue'

interface UseOptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>
  queryKey: unknown[]
  optimisticUpdate?: (oldData: TData[] | undefined, variables: TVariables) => TData[]
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: unknown, variables: TVariables) => void
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url?: string
}

/**
 * Generic optimistic mutation hook
 */
export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  onSuccess,
  onError,
  method = 'POST',
  url,
}: UseOptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData[]>(queryKey)

      // Optimistically update if function provided
      if (optimisticUpdate) {
        queryClient.setQueryData<TData[]>(queryKey, (old) =>
          optimisticUpdate(old, variables)
        )
      }

      return { previousData }
    },
    onError: async (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }

      // Queue for retry if offline or network error
      if (!navigator.onLine && url) {
        await enqueueRequest(method, url, variables)
      }

      onError?.(error, variables)
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables)
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Hook for creating requests with optimistic updates
 */
export function useCreateRequest() {
  return useOptimisticMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    },
    queryKey: ['/api/requests'],
    method: 'POST',
    url: '/api/requests',
    optimisticUpdate: (oldData, newRequest) => {
      const optimisticRequest = {
        ...newRequest,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _optimistic: true,
      }

      return oldData ? [optimisticRequest, ...oldData] : [optimisticRequest]
    },
  })
}

/**
 * Hook for updating request status with optimistic updates
 */
export function useUpdateRequestStatus() {
  return useOptimisticMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    },
    queryKey: ['/api/requests'],
    method: 'PATCH',
    optimisticUpdate: (oldData, { id, status }) => {
      if (!oldData) return []

      return oldData.map((request: any) =>
        request.id === id
          ? { ...request, status, _syncing: true, updatedAt: new Date().toISOString() }
          : request
      )
    },
  })
}

/**
 * Hook for deleting requests with optimistic updates
 */
export function useDeleteRequest() {
  return useOptimisticMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return { id }
    },
    queryKey: ['/api/requests'],
    method: 'DELETE',
    optimisticUpdate: (oldData, id) => {
      if (!oldData) return []
      return oldData.filter((request: any) => request.id !== id)
    },
  })
}

/**
 * Hook for creating customers with optimistic updates
 */
export function useCreateCustomer() {
  return useOptimisticMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    },
    queryKey: ['/api/customers'],
    method: 'POST',
    url: '/api/customers',
    optimisticUpdate: (oldData, newCustomer) => {
      const optimisticCustomer = {
        ...newCustomer,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _optimistic: true,
      }

      return oldData ? [optimisticCustomer, ...oldData] : [optimisticCustomer]
    },
  })
}

/**
 * Hook for updating customers with optimistic updates
 */
export function useUpdateCustomer() {
  return useOptimisticMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    },
    queryKey: ['/api/customers'],
    method: 'PUT',
    optimisticUpdate: (oldData, { id, data }) => {
      if (!oldData) return []

      return oldData.map((customer: any) =>
        customer.id === id
          ? { ...customer, ...data, _syncing: true, updatedAt: new Date().toISOString() }
          : customer
      )
    },
  })
}

/**
 * Hook for creating vessels with optimistic updates
 */
export function useCreateVessel() {
  return useOptimisticMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/vessels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    },
    queryKey: ['/api/vessels'],
    method: 'POST',
    url: '/api/vessels',
    optimisticUpdate: (oldData, newVessel) => {
      const optimisticVessel = {
        ...newVessel,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _optimistic: true,
      }

      return oldData ? [optimisticVessel, ...oldData] : [optimisticVessel]
    },
  })
}
