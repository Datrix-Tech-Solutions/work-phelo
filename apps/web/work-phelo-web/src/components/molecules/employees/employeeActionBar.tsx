import { Button } from '@/components/atoms/Button';
import { Icons } from '@/lib/icons';

interface EmployeeActionsBarProps {
  isPendingInvite: boolean;
  isOffboarded: boolean;
  onAssignAsset: () => void;
  onOffboard: () => void;
  onEdit: () => void;
}

export function EmployeeActionsBar({
  isPendingInvite,
  isOffboarded,
  onAssignAsset,
  onOffboard,
  onEdit,
}: EmployeeActionsBarProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      {isPendingInvite ? (
        <Button variant="outline" size="sm">
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
