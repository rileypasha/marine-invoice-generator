import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchVessels, createVessel, updateVessel, deleteVessel } from '../../api/vessels'
import type { Vessel, VesselFormData } from '../../types/Vessel'

export const VESSELS_QUERY_KEY = ['vessels']

export function useVessels() {
  return useQuery({
    queryKey: VESSELS_QUERY_KEY,
    queryFn: fetchVessels,
  })
}

export function useCreateVessel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: VesselFormData) => createVessel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VESSELS_QUERY_KEY })
    },
  })
}

export function useUpdateVessel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VesselFormData> }) =>
      updateVessel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VESSELS_QUERY_KEY })
    },
  })
}

export function useDeleteVessel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteVessel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VESSELS_QUERY_KEY })
    },
  })
}
