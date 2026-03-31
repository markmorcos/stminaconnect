import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPersons,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
  CreatePersonInput,
  UpdatePersonInput,
} from '../api/queries/persons';

export const PERSONS_QUERY_KEY = ['persons'] as const;

export function usePersons() {
  return useQuery({
    queryKey: PERSONS_QUERY_KEY,
    queryFn: listPersons,
  });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: [...PERSONS_QUERY_KEY, id],
    queryFn: () => getPerson(id),
    enabled: !!id,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonInput) => createPerson(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONS_QUERY_KEY });
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePersonInput }) =>
      updatePerson(id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: PERSONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...PERSONS_QUERY_KEY, id] });
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERSONS_QUERY_KEY });
    },
  });
}
