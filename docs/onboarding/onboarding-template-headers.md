# Onboarding Spreadsheet — Proposed Headers (from the questionnaire)

**Status:** Draft v1 for review · **Date:** 2026-09-16
**Source evidence:** completed Requirements Questionnaire — Angels Nest Crèche, Tracy McIvor (Manager), 10/09/26, 65 children / 12 staff / 4 rooms.
**Deliverable file:** [creche-onboarding-template.xlsx](creche-onboarding-template.xlsx) (10 sheets, with illustrative fictional example rows).

These headers are the columns a crèche like Angels Nest already keeps in spreadsheets, derived from what they ticked. Each tab maps to an **import type** in the wizard (spec §5.4) and feeds specific FEE tickets. Records **link by name** across tabs.

---

## 1. Children  → CHD / FEE-02
Child First Name · Child Last Name · Preferred Name · Date of Birth · Gender · Start Date · Current Room · Session Type · Status (Enrolled/Waiting/Left) · **PPSN (optional, secure)** · Allergies · Dietary Needs · Medical Conditions · Medication Required (Y/N) · Medication Details · Additional Needs/Notes · Primary Parent/Guardian · Authorised Collectors
- *From Q2:* emergency contacts, allergies/dietary, medical conditions, medication permissions, room/session, authorised collection, waiting-list record.
- ⚠️ PPSN + medical = special-category → encrypted, never logged (FEE-02 / security §10).

## 2. Parents & Guardians  → CHD
Parent First Name · Parent Last Name · Relationship to Child · Child Name(s) · Mobile Number · Email · Address · Preferred Contact (SMS/Email/App) · Primary Payer (Y/N)
- *Manager's examples:* "parents' name", contact for messaging (Q5), payer for fees (Q8). Mobile/email drive SMS+email channels.

## 3. Emergency Contacts  → CHD
Child Name · Contact Name · Relationship · Phone · Priority (1=first)  *(Q2)*

## 4. Authorised Collectors  → CHD / ATT
Child Name · Collector Name · Relationship · Phone · Collection Password/PIN (optional)  *(Q2 collection list, Q3 collector verification)*

## 5. Staff  → STF
Staff First Name · Staff Last Name · Role · Assigned Room · Email · Mobile · Contracted Hours/Week · Start Date · Qualification · **Garda Vetting Expiry** · Training/Cert Expiry · Status
- *From Q4:* rosters, timesheets, ratio/cover, payroll export; handwritten "Garda vetting renewal" + "weekly rota".

## 6. Rooms & Sessions  → ORG
Room Name · Age Range From · Age Range To · Capacity · **Required Ratio (Adults:Children)** · Sessions Offered · Opening Time · Closing Time
- *From Q3/Q9:* real-time room numbers, ratio alerts, occupancy by room/session, capacity planning. ("time" the manager mentioned = session opening/closing.)

## 7. Fees & Funding  → FEE-01/02/03/05  ⭐ the magic-wand sheet
Child Name · Room/Service · Fee Frequency (Weekly/Monthly/Term/Annual) · **Gross Fee Amount (€)** · Hours per Week · ECCE (Y/N) · ECCE Programme Year · ECCE Higher Capitation (Y/N) · NCS (Y/N) · **NCS CHICK Code** · NCS Subsidy Type (Universal/Income-Assessed) · NCS Awarded Hourly Rate (€) · NCS Awarded Weekly Hours · Subsidy Start Date · Subsidy End Date · Sibling/Custom Discount · Outstanding Balance (€)
- *From Q8 + magic wand ("log fees due yearly to avoid weekly messaging") + Q11 NCS journey.* This is the "cost" the manager mentioned and the input to the subvention engine (FEE-05). NCS fields = authoritative CHICK award data (FEE-02).

## 8. Waiting List & Enquiries  → CRM
Child/Family Name · Parent Name · Contact Phone · Contact Email · Enquiry Date · Child DOB · Desired Start Date · Room/Session Preference · Days Required · Status (New→…→Registered/Lost) · Priority/Rank · Reason for Loss · Follow-up Date
- *From Q9/Q11:* waiting list, ranking, place offers, conversion. Current process: "waiting lists, cancellations, turning of age".

## 9. Additional Services  → FEE / service catalogue
Service Name · Charge Type (Per Session/Occurrence/Hourly/Weekly) · Amount (€) · Applies To (Room/All) · Notes
- *From Q12:* after-school, breakfast/meal, **late-collection charges** ("enforced late collection fees").

---

## Conventions
- Dates **DD/MM/YYYY**; money in euro; Yes/No columns literal.
- Not every column is required — the wizard validates and shows warnings before writing (spec §5.4 steps 4–6).
- Cross-tab links are by **name** (v1); the importer resolves them to IDs.

## Open questions for the manager (to refine v2)
1. Do fees vary by **session type** within a room (full day vs morning), i.e. multiple fee rows per child?
2. Is the gross fee **before or after** NCS/ECCE in their current sheet? (Affects import mapping.)
3. Do they track **deposits/registration fees** as a column today?
4. Any columns in their real sheet not represented here?
