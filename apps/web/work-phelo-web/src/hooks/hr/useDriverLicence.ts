import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DriverLicenceDetails, DriverLicenceView, EmployeeDocument } from '@/types/hr';

/** `null` is the signed-in user's own licence; an id is that employee's, for HR. */
export type DriverLicenceScope = string | null;

const basePath = (scope: DriverLicenceScope) =>
  scope ? `/hr/employees/${scope}` : '/hr/employees/me';

const key = (scope: DriverLicenceScope) => ['employees', scope ?? 'me', 'driver-licence'] as const;

export function useDriverLicence(scope: DriverLicenceScope) {
  return useQuery({
    queryKey: key(scope),
    queryFn: async () => {
      const res = await api.get<DriverLicenceView>(`${basePath(scope)}/driver-licence`);
      return res.data;
    },
    retry: false,
  });
}

export interface SaveDriverLicenceInput {
  /** The licence image. Required the first time, optional when only the details change. */
  file?: File | null;
  details: DriverLicenceDetails;
  /** Whether the licence record already exists (so it is updated, not created). */
  exists: boolean;
}

/**
 * Uploads the licence image (when given) and then creates or updates the details, in that order,
 * because the details are only accepted once an image is on file.
 */
export function useSaveDriverLicence(scope: DriverLicenceScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, details, exists }: SaveDriverLicenceInput) => {
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const config = { headers: { 'Content-Type': 'multipart/form-data' } };
        if (scope) {
          form.append('type', 'DRIVER_LICENCE');
          await api.post<EmployeeDocument>(`${basePath(scope)}/documents`, form, config);
        } else {
          await api.post<EmployeeDocument>('/hr/employees/me/driver-licence/image', form, config);
        }
      }
      const res = exists
        ? await api.patch<DriverLicenceView>(`${basePath(scope)}/driver-licence`, details)
        : await api.post<DriverLicenceView>(`${basePath(scope)}/driver-licence`, details);
      return res.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key(scope) });
      queryClient.invalidateQueries({ queryKey: ['employees', scope ?? 'me', 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['employees', 'me', 'documents'] });
      // The request form's "can drive yourself" answer follows the licence.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'requests'] });
    },
  });
}

/** Invalidates the licence view; used after the image document is deleted. */
export function useInvalidateDriverLicence(scope: DriverLicenceScope) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: key(scope) });
}
