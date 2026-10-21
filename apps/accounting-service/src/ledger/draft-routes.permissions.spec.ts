/* eslint-disable @typescript-eslint/unbound-method */
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';
import { AccountingPermission } from './accounting.permissions';
import { CashbookController } from './cashbook.controller';
import { JournalsController } from './journals.controller';
import { PayablesController } from './payables.controller';
import { ReceivablesController } from './receivables.controller';

const permissionsOf = (handler: object) =>
  Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];
const anyPermissionsOf = (handler: object) =>
  Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as string[];

describe('draft invoice and cashbook routes authorization', () => {
  it('editing a draft needs the permission to create that kind of document', () => {
    expect(
      permissionsOf(ReceivablesController.prototype.updateInvoiceDraft),
    ).toEqual([AccountingPermission.RECEIVABLES_CREATE]);
    expect(
      permissionsOf(CashbookController.prototype.updateDraftTransaction),
    ).toEqual([AccountingPermission.TRANSACTIONS_CREATE]);
  });

  it('rejecting a draft is an approval decision, so it needs the post permission', () => {
    expect(
      permissionsOf(ReceivablesController.prototype.rejectInvoice),
    ).toEqual([AccountingPermission.RECEIVABLES_POST]);
    expect(
      permissionsOf(CashbookController.prototype.rejectTransaction),
    ).toEqual([AccountingPermission.TRANSACTIONS_POST]);
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
    // A contra transfer is raised from Cash and Bank, so its maker can also discard the draft.
    expect(
      anyPermissionsOf(CashbookController.prototype.deleteDraftTransaction),
    ).toEqual([
      AccountingPermission.TRANSACTIONS_POST,
      AccountingPermission.CASH_ACCOUNTS_MANAGE,
    ]);
    expect(permissionsOf(JournalsController.prototype.deleteDraft)).toEqual([
      AccountingPermission.JOURNALS_POST,
    ]);
  });

  it('voiding, editing and restoring posted entries each have their own permission', () => {
    const routes: Array<[object, string]> = [
      [JournalsController.prototype.voidPosted, 'JOURNALS_VOID'],
      [JournalsController.prototype.editPosted, 'JOURNALS_POST'],
      [JournalsController.prototype.reverse, 'JOURNALS_REVERSE'],
      [CashbookController.prototype.voidPostedTransaction, 'TRANSACTIONS_VOID'],
      [CashbookController.prototype.editPostedTransaction, 'TRANSACTIONS_POST'],
      [CashbookController.prototype.reverseTransaction, 'TRANSACTIONS_REVERSE'],
      [ReceivablesController.prototype.voidInvoice, 'RECEIVABLES_POST'],
      [ReceivablesController.prototype.editPostedInvoice, 'RECEIVABLES_POST'],
      [ReceivablesController.prototype.voidReceipt, 'RECEIVABLES_POST'],
      [PayablesController.prototype.voidBill, 'PAYABLES_POST'],
      [PayablesController.prototype.editPostedBill, 'PAYABLES_POST'],
    ];
    for (const [handler, permission] of routes) {
      expect(permissionsOf(handler)).toEqual([
        AccountingPermission[permission as keyof typeof AccountingPermission],
      ]);
    }
  });

  it('restoring a voided entry of any kind is managing the archive', () => {
    const restores = [
      JournalsController.prototype.restoreVoided,
      CashbookController.prototype.restoreVoidedTransaction,
      ReceivablesController.prototype.restoreInvoice,
      ReceivablesController.prototype.restoreReceipt,
      PayablesController.prototype.restoreBill,
      PayablesController.prototype.restorePayment,
    ];
    for (const handler of restores) {
      expect(permissionsOf(handler)).toEqual([
        AccountingPermission.ARCHIVE_RESTORE,
      ]);
    }
  });

  it('contra transfers and deactivating a cash account belong to Cash and Bank', () => {
    expect(permissionsOf(CashbookController.prototype.createTransfer)).toEqual([
      AccountingPermission.CASH_ACCOUNTS_MANAGE,
    ]);
  });
});
