// import { Employee } from '@/types';
// import { useForm } from 'react-hook-form';
// import { SidePanel } from '../shared/SidePanel';
// import { Button } from '@/components/atoms/Button';
// import { FormField } from '@/components/molecules/shared/FormField';

// interface resignationPanelProps {
//   isOpen: boolean;
//   onClose: () => void;
//   employee: Employee;
//   onSave: () => void;
//   isResigning: boolean;
// }

// export function resignationPanel({
//   isOpen,
//   onClose,
//   employee,
//   onSave,
//   isResigning,
// }: resignationPanelProps) {
//   // const form = useForm<>();
//   // const {reset} = form;

//   return (
//     <SidePanel
//       isOpen={isOpen}
//       onClose={onClose}
//       title="Edit Profile"
//       description={`${employee.firstName} ${employee.lastName}`}
//       footer={
//         <div className="flex justify-end gap-3">
//           <Button variant="outline" onClick={onClose}>
//             Cancel
//           </Button>
//           <Button isLoading={isResigning} loadingText="Submitting…" onClick={}>
//             Submit
//           </Button>
//         </div>
//       }
//     >
//       <div className="flex flex-col gap-4">
//         <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
//           Personal Information
//         </p>
//       </div>
//     </SidePanel>
//   );
// }
