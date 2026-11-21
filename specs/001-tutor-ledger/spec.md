# Feature Specification: Tutor Ledger

**Feature Branch**: `001-tutor-ledger`
**Created**: 2026-11-21
**Status**: Draft
**Input**: User description: "Tutor Ledger: a WhatsApp-first, mobile back office that turns each day's money into a short list of actions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record, chase and recover payments (Priority: P1)

A tutor opens the app each day and wants to know who has not paid. She creates each family's invoice in one step using that family's saved defaults. When a family pays, she marks the invoice paid in full or in part in two taps. Each morning she opens the "Chase Today" list, which shows overdue invoices in priority order. For each item she gets a drafted reminder, reviews it, and sends it from her own WhatsApp.

**Why this priority**: Collecting money already owed is the core value of the product. Without it, no other screen matters.

**Independent Test**: With a few families set up, create one invoice, record one full and one partial payment, and confirm that an overdue invoice appears on Chase Today with a reviewable reminder that opens in the owner's WhatsApp for sending.

**Acceptance Scenarios**:

1. **Given** a family with saved defaults (fee and payment term), **When** the owner creates an invoice for that family, **Then** the invoice is created with the defaults filled in after a single confirmation step.
2. **Given** an open invoice, **When** the owner marks it paid in full, **Then** the invoice closes and the family's outstanding balance drops by that amount, using no more than two taps after opening the invoice.
3. **Given** an open invoice, **When** the owner records a partial payment, **Then** the invoice stays open with the remaining balance shown.
4. **Given** overdue invoices exist, **When** the owner opens Chase Today, **Then** each overdue invoice is listed once in priority order with its family, amount owed and days overdue.
5. **Given** an item on Chase Today, **When** the owner opens it, **Then** a reminder is drafted for review and nothing is sent until the owner confirms the send from her own WhatsApp.

---

### User Story 2 - First-run setup with defaults (Priority: P2)

A new owner sets up the ledger once. She enters her families (name, phone number, default fee, default payment term and default reminder tone), her opening bank balance, her recurring monthly bills, and the minimum balance she wants to keep. Everything else is optional. For a demo or a first look, she can choose a sample data mode that loads a realistic tutor dataset: 12 families with a mix of on-time and late payers, two bill cycles, and one cash dip in week 7.

**Why this priority**: Every other story depends on families, defaults and balances being in place. Setup must be quick, or the owner will not start.

**Independent Test**: On a new ledger, complete setup using only the required items and confirm that the ledger is usable. Separately, load sample data and confirm that the 12 families and the week 7 cash dip appear.

**Acceptance Scenarios**:

1. **Given** a new ledger, **When** the owner enters the required setup items (families with their defaults, opening bank balance, recurring monthly bills, minimum balance), **Then** the ledger is ready to use without any optional item being filled in.
2. **Given** a new ledger, **When** the owner skips every optional item, **Then** setup still completes and the owner can reach the main screens.
3. **Given** a new ledger, **When** the owner chooses sample data mode, **Then** 12 families, two bill cycles and a week 7 cash dip are loaded and clearly labelled as sample data.
4. **Given** sample data is loaded, **When** the owner chooses to remove it, **Then** only the sample records are removed and the owner's own entries remain.

---

### User Story 3 - Who owes me (Priority: P3)

The owner opens one screen to see every family with an outstanding balance, the oldest unpaid date, and the total owed. The screen also shows the total owed across all families and the average number of days families take to pay. When a list is long, the screen shows the top entries and offers a "show all" option.

**Why this priority**: This gives the owner a single view of exposure. It supports collection and forecasting, but the owner can still chase individual invoices without it.

**Independent Test**: With families holding a mix of paid and unpaid invoices, open the screen and confirm each family's balance, oldest unpaid date, total, and the overall totals match the underlying invoices and payments.

**Acceptance Scenarios**:

1. **Given** families with unpaid invoices, **When** the owner opens "Who owes me", **Then** each family with a balance appears with its outstanding amount, oldest unpaid date and total owed.
2. **Given** the list of families, **When** the screen loads, **Then** it shows the total owed across all families and the average days to pay.
3. **Given** more families than fit on screen, **When** the owner views the list, **Then** the top entries are shown first with a "show all" option that reveals the rest.
4. **Given** a family with no outstanding balance, **When** the owner views the list, **Then** that family is not listed among those who owe money.

---

### User Story 4 - Cash forecast (Priority: P4)

The owner sees a 13-week cash forecast, one point per week. A baseline line shows expected cash, with a shaded band between best and worst cases. Money coming in is placed in the week of each open invoice's expected payment date, which is the due date plus that family's average historical delay. Money going out comes from recurring bills and one-off expenses. Every figure can be traced back to the record it came from. When a family's payment history is thin, the forecast says so.

**Why this priority**: The forecast turns collections and bills into a view of whether the owner will have enough cash. It depends on the records built in the earlier stories.

**Independent Test**: With known invoices, bills and expenses, check that each week's inflows and outflows equal the matching source records, that expected payment dates follow the due date plus the family's average delay, and that a family with no history shows a wide band and a confidence note.

**Acceptance Scenarios**:

1. **Given** a ledger with open invoices, bills and expenses, **When** the owner opens the forecast, **Then** a 13-week view appears with a baseline line and a shaded best/worst band.
2. **Given** an open invoice and a family with a known average payment delay, **When** the forecast is built, **Then** the inflow appears in the week of the due date plus that average delay.
3. **Given** any figure in the forecast, **When** the owner selects it, **Then** the owner can see the source records (invoices, bills or expenses) that make it up.
4. **Given** a family with little or no payment history, **When** the forecast is shown, **Then** that family's inflows widen the best/worst band and a low-confidence note is displayed.

---

### User Story 5 - What-if scenarios (Priority: P5)

The owner switches on built-in scenarios to ask "what if" questions: a named family pays 15 days late; a family leaves at month end; a new family joins from a chosen date; a bill rises by a chosen percentage; or two or more of these combine. She can also define one custom scenario. The forecast shows the scenario next to the baseline, identifies the lowest cash week, and says whether cash falls below the minimum balance.

**Why this priority**: Scenarios let the owner test decisions and risks before acting. They build on the forecast and are valuable but not required for the basic ledger.

**Independent Test**: Turn on one built-in scenario and confirm the side-by-side view shows the baseline and scenario results, the correct lowest cash week, and a below-minimum flag that matches the threshold.

**Acceptance Scenarios**:

1. **Given** a baseline forecast, **When** the owner turns on "a named family pays 15 days late", **Then** that family's inflows move 15 days later and the scenario view shows the change against baseline.
2. **Given** a scenario is on, **When** the owner views the result, **Then** the lowest cash week and whether cash falls below the minimum balance are shown.
3. **Given** two or more built-in scenarios, **When** the owner turns them on together, **Then** their effects are combined in the forecast.
4. **Given** the owner defines a custom scenario, **When** it is switched on, **Then** it appears next to the baseline in the same way as built-in scenarios.
5. **Given** a scenario is switched on or off, **When** the owner toggles it, **Then** the forecast updates immediately.

---

### User Story 6 - Smart alerts with next actions (Priority: P6)

The app raises a small number of rule-based alerts, capped at most 3 alerts per week, so the owner is not overwhelmed. Each alert has exactly one action button: open the drafted reminder, open the scenario that shows the cause, or open the Chase Today queue. The owner sets the minimum-balance threshold that triggers cash alerts.

**Why this priority**: Alerts make the product proactive, but they add value only once the records, forecast and scenarios they refer to exist.

**Independent Test**: Create conditions that trigger each alert rule and confirm that no more than the weekly cap is shown, that each alert has exactly one button, and that each button opens the named destination.

**Acceptance Scenarios**:

1. **Given** the forecast falls below the minimum balance, **When** the alert rules run, **Then** a cash alert appears whose single action opens the scenario or forecast showing the cause.
2. **Given** a family has an overdue invoice, **When** the alert rules run, **Then** an alert appears whose single action opens the drafted reminder for that family.
3. **Given** several alerts would be triggered in one week, **When** the owner views alerts, **Then** no more than the weekly cap is shown, with the most urgent first.
4. **Given** the owner sets a new minimum-balance threshold, **When** the change is saved, **Then** cash alerts are re-evaluated against the new threshold.

---

### Edge Cases

- A family has no payment history: the forecast shows a wide best/worst band for that family and a low-confidence note; no average delay is invented.
- Repeat invoice generation runs twice, or is repeated for the same family and period: the owner sees only one set of invoices for that period, and no duplicates are created.
- A payment is partial: the invoice stays open with the remaining balance, and the forecast uses only the remaining amount.
- A pasted or forwarded WhatsApp "paid" message is ambiguous or mis-reads an amount: the payment form is pre-filled with the best reading, the uncertain amount is flagged, and the owner must correct it before anything is recorded.
- Payments are logged while the device has no connectivity: the payment is saved on the device and synced once connectivity returns, without loss or duplication.
- A family pays an invoice after a reminder was drafted but before it was sent: the drafted reminder is flagged as out of date, and the owner is shown that the invoice is now paid before the reminder can be sent.

## Requirements *(mandatory)*

### Functional Requirements

**Access, privacy and security**

- **FR-001**: The app MUST require the owner to authenticate before any family, phone number, invoice, or payment data is shown or changed.
  Acceptance: Given the app is opened with no active session, when a family, phone, invoice or payment screen is requested, then the owner is asked to authenticate and no data is shown.
- **FR-002**: The app MUST end the owner's session after 15 minutes of inactivity and require authentication again.
  Acceptance: Given an authenticated session, when 15 minutes pass without owner activity, then the session ends and the owner must authenticate again.
- **FR-003**: The app MUST enforce authorization on every data read and every data write; there MUST be exactly one owner account per ledger in this version.
  Acceptance: Given a ledger with one owner account, when any other account or unauthenticated request tries to read or write its data, then the request is refused.
- **FR-004**: The app MUST store only the personal data needed for the ledger: family name, phone number, amounts, and dates.
  Acceptance: Given a family record is saved, when its stored fields are inspected, then only name, phone number, amounts and dates are present.
- **FR-005**: The app MUST let the owner export all of the ledger's data.
  Acceptance: Given a ledger with records, when the owner requests an export, then the export contains every record in the ledger.
- **FR-006**: The app MUST let the owner permanently delete a family and all of that family's records, and the deletion MUST not be recoverable from within the app.
  Acceptance: Given a family with records, when the owner confirms permanent deletion, then the family and all its records are removed and cannot be restored from within the app.
- **FR-007**: The app MUST NOT write family names or phone numbers to logs, analytics, or error messages.
  Acceptance: Given a log entry, analytics event or error message is generated, when it is inspected, then it contains no family name or phone number.
- **FR-008**: The app MUST protect all data in transit and at rest, and MUST NOT store payment credentials or bank login details.
  Acceptance: Given data is sent or stored, when it is inspected, then it is encrypted in transit and at rest and contains no payment credential or bank login detail.
- **FR-009**: The app MUST NOT move money; it only records and plans.
  Acceptance: Given any payment, bill or forecast action, when it is performed, then no money transfer is initiated and only records or plans change.
- **FR-010**: The app MUST record each payment, invoice change, and deletion in an audit trail that the owner can view.
  Acceptance: Given a payment, invoice change or deletion is saved, when the owner opens the audit trail, then an entry for that change is listed.

**First-run setup (Story 2)**

- **FR-011**: The app MUST collect, during first-run setup, each family's name, phone number, default fee, default payment term, and default reminder tone.
  Acceptance: Given first-run setup, when the owner reaches the family step, then name, phone number, default fee, default payment term and default reminder tone fields are present and saved.
- **FR-012**: The app MUST collect, during first-run setup, the opening bank balance, recurring monthly bills, and the minimum balance to keep.
  Acceptance: Given first-run setup, when the owner reaches the balance step, then opening bank balance, recurring monthly bills and minimum balance fields are present and saved.
- **FR-013**: The app MUST treat every setup item other than those listed in FR-011 and FR-012 as optional, and MUST allow setup to complete without them.
  Acceptance: Given a new ledger, when the owner skips every setup item other than those in FR-011 and FR-012, then setup completes and the main screens are reachable.
- **FR-014**: The app MUST offer a sample data mode that loads 12 families with a mix of on-time and late payers, two bill cycles, and one cash dip in week 7, clearly labelled as sample data.
  Acceptance: Given a new ledger, when the owner chooses sample data mode, then 12 families, two bill cycles and a week 7 cash dip are loaded and labelled as sample data.
- **FR-015**: The app MUST let the owner choose one currency for the ledger, and MUST keep that currency for all amounts in the ledger.
  Acceptance: Given the owner has chosen a currency, when any amount in the ledger is shown or stored, then it is in that currency.

**Recording and chasing payments (Story 1)**

- **FR-016**: The app MUST let the owner create an invoice for a family in one step, using that family's saved defaults.
  Acceptance: Given a family with saved defaults, when the owner creates an invoice and confirms once, then the invoice is created with the fee and payment term filled in from those defaults.
- **FR-017**: The app MUST let the owner mark an invoice paid in full or in part in no more than two taps after opening the invoice.
  Acceptance: Given an open invoice, when the owner marks it paid in full or in part, then this takes no more than two taps after the invoice is opened.
- **FR-018**: The app MUST keep an invoice open with its remaining balance after a partial payment.
  Acceptance: Given an open invoice, when a partial payment is recorded, then the invoice stays open and shows the remaining balance.
- **FR-019**: The app MUST provide a "Chase Today" list of overdue invoices, ordered by priority, with each invoice listed once. Priority is defined as a score that combines the amount owed and days overdue; the list is ordered highest score first, and ties are broken by the older due date.
  Acceptance: Given overdue invoices exist, when the owner opens Chase Today, then each overdue invoice appears once, ordered highest score first, with ties ordered by the older due date.
- **FR-020**: The app MUST draft a reminder for each Chase Today item for the owner to review.
  Acceptance: Given an item on Chase Today, when the owner opens it, then a reminder is drafted and shown for review.
- **FR-021**: Repeat invoices generated by the app MUST be in a "due, awaiting confirmation" state until the owner confirms each one.
  Acceptance: Given a repeat invoice has been generated, when the owner has not yet confirmed it, then it shows the "due, awaiting confirmation" state.
- **FR-022**: The app MUST NOT create duplicate invoices when repeat invoice generation is run more than once for the same family and period.
  Acceptance: Given repeat invoice generation has already run for a family and period, when it runs again, then no second invoice is created.
- **FR-023**: Pasted or forwarded payment messages MUST only pre-fill a payment form; nothing MUST be recorded until the owner confirms the entry.
  Acceptance: Given a pasted or forwarded payment message, when it is read, then only a payment form is pre-filled and nothing is recorded until the owner confirms.
- **FR-024**: When a pasted or forwarded payment message is ambiguous or an amount may be mis-read, the app MUST flag that amount for the owner to check before confirmation.
  Acceptance: Given a pasted message is ambiguous or an amount may be mis-read, when the payment form is pre-filled, then that amount is flagged and the entry cannot be confirmed until the owner has checked it.
- **FR-025**: Reminders MUST never be sent automatically; the owner MUST review each drafted reminder before it leaves the app, and the send MUST happen from the owner's own WhatsApp.
  Acceptance: Given a drafted reminder has not been reviewed and confirmed by the owner, when time passes or no action is taken, then nothing is sent; and when the owner confirms, the send happens from the owner's own WhatsApp.
- **FR-026**: The app MUST flag a drafted reminder as out of date when its invoice is paid after the reminder was drafted, and MUST show the paid status before the reminder can be sent.
  Acceptance: Given a reminder was drafted for an invoice, when that invoice is paid afterwards, then the reminder is flagged out of date and the paid status is shown before it can be sent.
- **FR-027**: Payments logged without connectivity MUST be saved on the device and synced after connectivity returns, without loss or duplication.
  Acceptance: Given the device has no connectivity, when the owner logs a payment, then it is saved on the device and, after connectivity returns, appears once in the ledger.

**Who owes me (Story 3)**

- **FR-028**: The app MUST show every family with an outstanding balance, with the family's outstanding amount, oldest unpaid date, and total owed.
  Acceptance: Given families with unpaid invoices, when the owner opens "Who owes me", then each family with a balance shows its outstanding amount, oldest unpaid date and total owed.
- **FR-029**: The app MUST show the total owed across all families and the average number of days families take to pay.
  Acceptance: Given the "Who owes me" list loads, when the screen is shown, then the total owed across all families and the average days to pay are displayed.
- **FR-030**: When a list exceeds the visible entries, the app MUST show the top entries first and provide a "show all" option.
  Acceptance: Given a list has more entries than fit on screen, when the owner views it, then the top entries are shown first and a "show all" option reveals the rest.

**Cash forecast (Story 4)**

- **FR-031**: The app MUST show a 13-week weekly cash forecast with a baseline line and a shaded best/worst band.
  Acceptance: Given a ledger with open invoices, bills and expenses, when the owner opens the forecast, then a 13-week view appears with a baseline line and a shaded best/worst band.
- **FR-032**: The app MUST place each open invoice's expected inflow in the week of its due date plus that family's average historical payment delay.
  Acceptance: Given an open invoice and a family with a known average payment delay, when the forecast is built, then the inflow appears in the week of the due date plus that average delay.
- **FR-033**: The app MUST place outflows from recurring bills and one-off expenses in the weeks in which they fall due.
  Acceptance: Given a recurring bill or one-off expense with a due date, when the forecast is built, then its outflow appears in the week it falls due.
- **FR-034**: Every figure in the forecast MUST be traceable to the source invoice, payment, bill, or expense that produced it.
  Acceptance: Given any figure in the forecast, when the owner selects it, then the source invoice, payment, bill or expense that produced it is shown.
- **FR-035**: A family's payment history is "thin" when the family has fewer than 3 recorded payments. The app MUST show forecast confidence as "low" for thin families, and MUST widen the best/worst band for any family with no payment history.
  Acceptance: Given a family with fewer than 3 recorded payments, when the forecast is shown, then that family's forecast confidence is "low"; and given a family with no payment history, then its best/worst band is widened.

**What-if scenarios (Story 5)**

- **FR-036**: The app MUST offer these built-in scenarios: a named family pays 15 days late; a family leaves at month end; a new family joins from a chosen date; a bill rises by a chosen percentage; and any combination of two or more of these. It MUST also let the owner define one custom scenario.
  Acceptance: Given the scenario options, when the owner views them, then the four built-in scenarios, any combination of two or more of them, and one custom scenario are available.
- **FR-037**: The app MUST show the scenario forecast side by side with the baseline, identify the lowest cash week, and state whether cash falls below the minimum balance.
  Acceptance: Given a scenario is switched on, when the owner views the result, then the scenario sits beside the baseline, the lowest cash week is shown, and whether cash falls below the minimum balance is stated.
- **FR-038**: Switching a scenario on or off MUST update the displayed forecast immediately, and scenarios MUST NOT change the recorded ledger.
  Acceptance: Given a scenario is toggled on or off, when the change is made, then the displayed forecast updates immediately and the recorded ledger is unchanged.

**Alerts (Story 6)**

- **FR-039**: The app MUST raise rule-based alerts, showing at most 3 alerts per week.
  Acceptance: Given several alerts would be triggered in one week, when the owner views alerts, then no more than 3 are shown, most urgent first.
- **FR-040**: Each alert MUST offer exactly one action, which opens either the drafted reminder, the scenario that shows the cause, or the Chase Today queue.
  Acceptance: Given an alert is shown, when the owner views it, then it displays exactly one action button, and that button opens the drafted reminder, the scenario or the Chase Today queue.
- **FR-041**: The owner MUST be able to set the minimum-balance threshold, and the app MUST re-evaluate cash alerts when that threshold changes.
  Acceptance: Given the owner saves a new minimum-balance threshold, when the change is saved, then cash alerts are re-evaluated against the new threshold.

### Key Entities *(include if feature involves data)*

- **Family**: A tutoring family. Attributes: name, phone number, default fee, default payment term, default reminder tone, average payment delay (derived from history).
- **Invoice**: A request for payment owed by one family. Attributes: family, amount, issue date, due date, status (open, partly paid, paid, due awaiting confirmation), and the period it covers.
- **Payment**: Money received against one or more invoices. Attributes: family, amount, date received, source (owner entry or confirmed pasted message), and whether it was logged offline.
- **Recurring Bill**: A regular outgoing cost. Attributes: name, amount, frequency, next due date, and whether it is active.
- **One-off Expense**: A single outgoing cost. Attributes: description, amount, and date.
- **Scenario**: A what-if setting applied to the forecast. Attributes: name, type (built-in or custom), parameters (family, date, percentage, or other inputs), and whether it is on.
- **Alert**: A notice raised by a rule. Attributes: rule, severity, date raised, linked record, and the single action it offers.
- **Reminder Draft**: A proposed message to a family for an invoice. Attributes: family, invoice, tone, text, drafted date, and whether it is out of date.
- **Owner Account**: The one person who uses a ledger. Attributes: chosen currency, minimum-balance threshold, session timeout setting, and sign-in status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new owner can complete first-run setup using only the required items in under 5 minutes.
- **SC-002**: The owner can create a repeat invoice for a family in under 10 seconds.
- **SC-003**: The owner can find a late family and send it a reminder in under 60 seconds.
- **SC-004**: 100% of forecast figures can be traced to a source record when the owner checks them.
- **SC-005**: Toggling a scenario updates the forecast immediately, with no visible delay to the owner.
- **SC-006**: Every alert offers exactly one action, and that action completes the named task.
- **SC-007**: The owner can complete weekly data entry in under 10 minutes.
- **SC-008**: The owner can log a payment with no connectivity, and the payment is saved and appears in the ledger after reconnecting.

## Assumptions

- Each ledger uses a single currency, chosen by the owner.
- Tax and accounting are out of scope.
- The product is a record and planning tool, not a bank or accounting system.
- No paid messaging API is used in this version; reminders open in the owner's own WhatsApp for the owner to send.
- Bank-feed sync is deferred.
- WhatsApp-message parsing is pre-fill only; the owner always confirms what is recorded.
- Target users are individual tutors.
- The owner is the only user of each ledger.
- Families in scope belong to one tutoring practice.

## Out of Scope (Later)

- Bank-feed sync
- Automated reminders via a messaging API
- Native app store distribution
- Multi-device sync
- Multiple users per ledger
- Salons and clinics expansion
- Machine-learning forecasting
