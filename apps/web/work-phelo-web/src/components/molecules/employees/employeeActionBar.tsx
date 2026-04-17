import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';

interface EmployeeActionsBarProps {
  isPendingInvite: boolean;
  isOffboarded: boolean;
  resendInvite: () => void;
  isResending?: boolean;
  onAssignAsset: () => void;
  onAssignRole?: () => void;
  onOffboard: () => void;
  onEdit: () => void;
}

export function EmployeeActionsBar({
  isPendingInvite,
  isOffboarded,
  resendInvite,
  isResending,
  onAssignAsset,
  onAssignRole,
  onOffboard,
  onEdit,
}: EmployeeActionsBarProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      {onAssignRole && !isOffboarded && !isPendingInvite && (
        <Button variant="outline" size="sm" onClick={onAssignRole} className="gap-2">
          Assign Role
          <ShieldCheck className="w-4 h-4" />
        </Button>
      )}

      {isPendingInvite ? (
        <Button
          variant="outline"
          size="sm"
          onClick={resendInvite}
          isLoading={isResending}
          loadingText="Sending..."
        >
          Resend Invite
        </Button>
      ) : !isOffboarded ? (
        <>
          <Button variant="outline" size="sm" onClick={onAssignAsset}>
            Assign Asset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOffboard}
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          >
            Off-Board
            <Icons.UserMinus className="w-5 h-5" />
          </Button>
        </>
      ) : null}

      <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
        Edit
        <Icons.UserPen className="w-5 h-5" />
      </Button>
    </div>
  );
}
