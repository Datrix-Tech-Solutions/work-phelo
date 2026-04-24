interface Props {
  count: number;
  isActive: boolean;
  isHeadOffice: boolean;
}

export function BranchStatus({ count, isActive, isHeadOffice }: Props) {
  if (!isActive)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        {isHeadOffice ? 'Head Office' : 'Inactive'}
      </span>
    );
  if (count === 0)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        {isHeadOffice ? 'Head Office' : 'Empty'}
      </span>
    );
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      {isHeadOffice ? 'Head Office' : 'Active'}
    </span>
  );
}
