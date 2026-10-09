/* eslint-disable @typescript-eslint/unbound-method */
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { AccountingPermission } from './accounting.permissions';
import { CashbookController } from './cashbook.controller';
import { JournalsController } from './journals.controller';
import { PayablesController } from './payables.controller';
import { ReceivablesController } from './receivables.controller';

const permissionsOf = (handler: object) =>
  Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];

describe('draft invoice and cashbook routes authorization', () => {
  it('editing a draft needs the permission to create that kind of document', () => {
    expect(
      permissionsOf(ReceivablesController.prototype.updateInvoiceDraft),
    ).toEqual([AccountingPermission.RECEIVABLES_CREATE]);
    expect(
      permissionsOf(CashbookController.prototype.updateDraftTransaction),
    ).toEqual([AccountingPermission.CASHBOOK_CREATE]);
  });

  it('rejecting a draft is an approval decision, so it needs the post permission', () => {
    expect(
      permissionsOf(ReceivablesController.prototype.rejectInvoice),
    ).toEqual([AccountingPermission.RECEIVABLES_POST]);
    expect(
      permissionsOf(CashbookController.prototype.rejectTransaction),
    ).toEqual([AccountingPermission.CASHBOOK_POST]);
  });

  it('deleting a draft needs the post permission, like rejecting it', () => {
    expect(
      permissionsOf(ReceivablesController.prototype.deleteInvoiceDraft),
    ).toEqual([AccountingPermission.RECEIVABLES_POST]);
    expect(
      permissionsOf(ReceivablesController.prototype.deleteCreditNoteDraft),
    ).toEqual([AccountingPermission.RECEIVABLES_POST]);
    expect(permissionsOf(PayablesController.prototype.deleteBillDraft)).toEqual(
      [AccountingPermission.PAYABLES_POST],
    );
    expect(
      permissionsOf(PayablesController.prototype.deleteCreditNoteDraft),
    ).toEqual([AccountingPermission.PAYABLES_POST]);
    expect(
      permissionsOf(CashbookController.prototype.deleteDraftTransaction),
    ).toEqual([AccountingPermission.CASHBOOK_POST]);
    expect(permissionsOf(JournalsController.prototype.deleteDraft)).toEqual([
      AccountingPermission.JOURNALS_POST,
    ]);
  });
});
