# WorkPhelo Reinsurance Module

## Phase 1 User Acceptance Testing Document

**Document version:** Draft 1  
**Module:** Reinsurance Operations  
**UAT phase:** Phase 1 - Integrated Core Workflows  
**Prepared for:** Business stakeholders, operations users, finance users, and QA reviewers  
**Prepared by:** WorkPhelo Product and Engineering Team  
**Date:** June 2026

---

## 1. Purpose

This document defines the Phase 1 User Acceptance Testing scope for the WorkPhelo Reinsurance module. The purpose of this UAT is to confirm that the integrated core Reinsurance workflows are usable, business-aligned, and ready for stakeholder feedback in a controlled test environment.

Phase 1 focuses on the core placement lifecycle, market distribution, confirmed placement closings, payment recording and reversal, placement locking behavior, basic claims, cash calls, dashboard review, and backend-rendered placement closing slip PDFs.

This document does not present the Reinsurance module as fully complete. It identifies the areas included in Phase 1 and clearly separates deferred functionality that will be tested in later phases.

---

## 2. Scope

The following areas are included in Phase 1 UAT:

- User login and tenant access.
- Facultative placement creation.
- Placement editing before financial lock.
- Reinsurer distribution list management.
- Participant acceptance using the backend placement acceptance workflow.
- Real placement closing visibility.
- Backend-rendered placement closing slip PDF generation and viewing.
- Premium payment recording.
- Payment reversal.
- Financial lock behavior after payment.
- Basic claim creation.
- Claim allocation generation.
- Cash call creation and issue flow.
- Reinsurance dashboard overview review.
- Negative validation for payment without confirmed closing.
- Negative validation for deleting participants with financial records.

---

## 3. Out Of Scope

The following areas are deferred from Phase 1 UAT:

- Placement email send/reply workflows.
- Full document/PDF suite.
- Debit note and credit note PDF rendering.
- Full endorsement UAT.
- Claim settlement payment.
- Treaty, facultative obligatory, and excess of loss workflows.
- Email attachments.
- Document email attachments.
- S3 signed download URL UAT.
- Full accounting integration.
- Advanced dashboard reporting validation.

---

## 4. UAT Environment

| Item | Value |
| --- | --- |
| Environment name | `[To be confirmed]` |
| Frontend URL | `[To be confirmed]` |
| API URL | `[To be confirmed]` |
| Tenant / Company | `[To be confirmed]` |
| Test user accounts | `[To be confirmed]` |
| Test data owner | `[To be confirmed]` |
| UAT start date | `[To be confirmed]` |
| UAT end date | `[To be confirmed]` |

---

## 5. UAT Roles

| Role | UAT Responsibility |
| --- | --- |
| Company Admin | Confirms tenant access, user permissions, and overall module availability. |
| Broker / Reinsurance Officer | Creates placements, manages reinsurer distribution, accepts lines, and reviews closings. |
| Finance Officer | Records payments, reverses payments, and confirms financial lock behavior. |
| Claims Officer | Creates claims, generates allocations, and creates or issues cash calls. |
| Operations Manager | Reviews dashboard summaries and confirms workflow readiness. |
| QA Reviewer | Records test evidence, actual results, status, and comments. |

---

## 6. Entry Criteria

Phase 1 UAT may begin when:

- UAT environment is accessible.
- Test users can log in successfully.
- Reinsurance module is enabled for the selected tenant.
- Required test counterparties, cedants, reinsurers, currencies, risk classes, and risk types are available.
- Backend services and API gateway are running.
- The frontend build deployed for UAT includes the Phase 1 Reinsurance integration.
- Known deferred items have been communicated to UAT participants.

---

## 7. Exit Criteria

Phase 1 UAT may be considered complete when:

- All in-scope scenarios have been executed.
- Critical and high-severity defects have been resolved or formally accepted.
- Business users confirm that the core workflow is understandable and usable.
- Any deferred or failed scenarios are documented with owners and follow-up actions.
- UAT sign-off is provided by the agreed business owner.

---

## 8. Test Data Requirements

The following test data should be prepared before testing:

- At least one active tenant/company.
- At least one Company Admin user.
- At least one Broker or Reinsurance Officer user.
- At least one Finance Officer user.
- At least one Claims Officer user.
- At least one cedant.
- At least two reinsurers.
- Active currency setup.
- Active risk class and risk type setup.
- Sample placement details, including:
  - Policy/reference number.
  - Insured name/title.
  - Sum insured.
  - Premium.
  - Facultative offer percentage.
  - Commission/brokerage values.
  - Inception and expiry dates.
- Sample claim details, including:
  - Loss date.
  - Reported date.
  - Claim cause.
  - Estimated loss amount.

---

## 9. Test Scenarios

### 9.1 Access And Navigation

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-001 |
| Module | Access |
| Scenario | Login and open Reinsurance module |
| Preconditions | User account exists with access to the tenant and Reinsurance module. |
| Test steps | 1. Open the WorkPhelo app. 2. Log in using a valid user account. 3. Select/open the tenant workspace. 4. Navigate to Operations > Reinsurance. |
| Expected result | User logs in successfully and can view the Reinsurance landing/dashboard area without access errors. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.2 Placement Management

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-002 |
| Module | Placement Management |
| Scenario | Create a facultative placement |
| Preconditions | Cedant, currency, risk class, and risk type setup exist. |
| Test steps | 1. Open the Facultative placement area. 2. Create a new placement using valid business details. 3. Save the placement. 4. Open the placement detail page. |
| Expected result | Placement is created successfully and appears in the placement list and detail view. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-003 |
| Module | Placement Management |
| Scenario | Edit placement before financial lock |
| Preconditions | Placement exists and no payment has been recorded. |
| Test steps | 1. Open the placement detail page. 2. Click Edit. 3. Update an allowed placement field. 4. Save changes. 5. Refresh the placement detail page. |
| Expected result | Placement updates successfully and the updated value remains after refresh. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.3 Market Distribution

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-004 |
| Module | Market Distribution |
| Scenario | Add reinsurer to distribution list |
| Preconditions | Placement exists and is not financially locked. Reinsurer exists in settings. |
| Test steps | 1. Open placement detail. 2. Open Distribution List. 3. Add a reinsurer. 4. Confirm the reinsurer appears in the distribution table. |
| Expected result | Reinsurer is added to the placement distribution list. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-005 |
| Module | Market Distribution |
| Scenario | Accept participant using backend workflow |
| Preconditions | Placement exists with at least one reinsurer in distribution list. Placement is not financially locked. |
| Test steps | 1. Enter or confirm the reinsurer share/signed line. 2. Click the accept/check action. 3. Wait for the action to complete. 4. Refresh the placement detail page. |
| Expected result | Participant becomes accepted and the backend acceptance workflow creates and confirms the related placement closing. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.4 Closings

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-006 |
| Module | Closings |
| Scenario | Confirm real closing appears after participant acceptance |
| Preconditions | Participant has been accepted through the acceptance workflow. |
| Test steps | 1. Open the placement detail page. 2. Open Placement Closings tab. 3. Review the closing row. |
| Expected result | A real backend placement closing appears with the expected reinsurer, signed share, premium values, and closing status. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-007 |
| Module | Documents |
| Scenario | Generate and view placement closing slip PDF |
| Preconditions | Placement has a confirmed backend closing. |
| Test steps | 1. Open Placement Closings tab. 2. Click View Slip on a closing row. 3. Wait for the PDF to open or download. |
| Expected result | Backend generates a closing slip document and renders a PDF successfully. The PDF opens or downloads for review. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.5 Payments And Locking

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-008 |
| Module | Payments |
| Scenario | Record premium payment |
| Preconditions | Placement has at least one confirmed closing. |
| Test steps | 1. Open Record Payment. 2. Enter valid payment details. 3. Submit the payment. 4. Open payment history. |
| Expected result | Payment is recorded successfully and appears in payment history. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-009 |
| Module | Payments |
| Scenario | Reverse premium payment |
| Preconditions | Placement has a recorded payment that is eligible for reversal. |
| Test steps | 1. Open Payment History. 2. Select the reverse action for the recorded payment. 3. Confirm or complete the reversal. 4. Refresh payment history. |
| Expected result | Payment reversal is recorded and payment history refreshes to show the updated payment state. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-010 |
| Module | Payments / Locking |
| Scenario | Verify locked placement behavior |
| Preconditions | Placement has at least one recorded payment. |
| Test steps | 1. Refresh placement detail after recording payment. 2. Attempt structural actions such as edit placement, add reinsurer, edit participant, accept, decline, revert, or delete participant. 3. Confirm Record Payment remains available where applicable. |
| Expected result | Structural placement and participant changes are disabled or guarded after financial lock. Record Payment remains available according to business rules. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.6 Claims And Cash Calls

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-011 |
| Module | Claims |
| Scenario | Create basic claim |
| Preconditions | Placement exists and is eligible for claim registration. |
| Test steps | 1. Open Claims area. 2. Select or open a placement. 3. Create a claim using valid loss details. 4. Save the claim. |
| Expected result | Claim is created successfully and remains available after refresh. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-012 |
| Module | Claims |
| Scenario | Generate claim allocations |
| Preconditions | Claim exists for a placement with accepted/confirmed reinsurance participation. |
| Test steps | 1. Open the claim detail. 2. Generate allocations. 3. Review generated allocation rows. |
| Expected result | Claim allocations are generated and show reinsurer liability information. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-013 |
| Module | Claims / Cash Calls |
| Scenario | Create and issue cash call |
| Preconditions | Claim allocations exist. |
| Test steps | 1. Select an allocation. 2. Create a cash call. 3. Issue the cash call. 4. Refresh the claim detail page. |
| Expected result | Cash call is created and issued successfully. Cash call status remains visible after refresh. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.7 Dashboard

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-014 |
| Module | Dashboard |
| Scenario | Review Reinsurance dashboard overview |
| Preconditions | At least one placement, closing, payment, and/or claim exists in the test tenant. |
| Test steps | 1. Open the Reinsurance dashboard. 2. Review overview, placement, financial, and claim summary cards. 3. Compare displayed values with known test data at a high level. |
| Expected result | Dashboard loads successfully and presents understandable summary information without errors. |
| Actual result |  |
| Status |  |
| Comments |  |

### 9.8 Negative Tests

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-015 |
| Module | Payments |
| Scenario | Payment blocked when no confirmed closing exists |
| Preconditions | Placement exists with no confirmed placement closing. |
| Test steps | 1. Open Record Payment for the placement. 2. Enter valid payment details. 3. Attempt to submit. |
| Expected result | Payment is blocked before completion and the user is informed that at least one confirmed closing is required before recording payment. |
| Actual result |  |
| Status |  |
| Comments |  |

| Field | Details |
| --- | --- |
| Test ID | RE-UAT-016 |
| Module | Market Distribution |
| Scenario | Delete participant with financial records |
| Preconditions | Placement participant has related financial or workflow records, such as a confirmed closing or payment. |
| Test steps | 1. Open Distribution List. 2. Attempt to delete the participant with dependent records. |
| Expected result | Delete action is prevented or rejected with a clear business message. Existing financial/workflow records remain unchanged. |
| Actual result |  |
| Status |  |
| Comments |  |

---

## 10. Deferred Functionality Register

| Area | Deferred item | Phase 1 expectation |
| --- | --- | --- |
| Email | Email send and reply | Not tested in Phase 1. |
| Email | Attachments and document emailing | Not tested in Phase 1. |
| Documents | Full document/PDF suite | Only placement closing slip PDF is included. |
| Documents | Debit/credit note PDF rendering | Deferred. Local previews may still exist. |
| Documents | S3 signed download URLs | Deferred from Phase 1 UAT. |
| Endorsements | Full endorsement UAT | Deferred. Basic creation may be visible but full lifecycle is not Phase 1 scope. |
| Claims | Claim settlement payment | Deferred. |
| Reinsurance products | Treaty, facultative obligatory, excess of loss | Deferred. |
| Accounting | Full accounting integration | Deferred. |

---

## 11. UAT Sign-Off

| Name | Role | Decision | Signature / Confirmation | Date |
| --- | --- | --- | --- | --- |
|  |  | Accepted / Accepted with issues / Rejected |  |  |
|  |  | Accepted / Accepted with issues / Rejected |  |  |
|  |  | Accepted / Accepted with issues / Rejected |  |  |

