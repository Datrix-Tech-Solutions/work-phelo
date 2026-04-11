'use client';
import { useState } from 'react';
import { useCompanyRoles, useCreateCompanyRole, useDeleteCompanyRole } from '@/hooks/useTenants';
import { extractError } from '@/lib/extractError';

export default function RolesPage() {
  const [error, setError] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: roles = [], isLoading } = useCompanyRoles();
  const createRole = useCreateCompanyRole();
  const deleteRole = useDeleteCompanyRole();

  const handleCreate = async () => {
    try {
      await createRole.mutateAsync({ name: newRoleName });
      setNewRoleName('');
      setShowForm(false);
    } catch (err) {
      setError(extractError(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this role?')) return;
    try {
      await deleteRole.mutateAsync(id);
    } catch (err) {
      setError(extractError(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create roles and define what each role can access
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand/90"
        >
          New Role
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex gap-3">
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Role name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!newRoleName || createRole.isPending}
            className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {createRole.isPending ? 'Creating...' : 'Create'}
          </button>
          <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">
            Cancel
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading roles...</p>
      ) : (
        <div className="space-y-3">
          {roles.map(
            (role: {
              id: string;
              name: string;
              isSystem?: boolean;
              _count?: { users: number };
            }) => (
              <div
                key={role.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{role.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {role.isSystem ? 'System role' : 'Custom role'} · {role._count?.users ?? 0}{' '}
                    users
                  </p>
                </div>
                {!role.isSystem && (
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
