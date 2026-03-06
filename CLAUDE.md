## Core Architecture Rules

DO NOT build disconnected feature modules.
Build around shared core entities that link to each other.

Core entities:
- Organization, Owner, Building, Unit, Tenant/Resident
- User/Staff, Vendor/Broker/Attorney

Every operational record (Vacancy, CollectionCase, LegalCase,
Violation, WorkOrder, Inspection, MoveOutAssessment) MUST link to:
- building
- unit (where applicable)
- tenant (where applicable)
- assigned user (where applicable)

Shared ActivityEvent model is required so all modules feed into:
- building history
- unit history
- tenant history
- owner dashboard
- portfolio recent activity

Work orders must support source relationships:
- created_from: inspection | violation | vacancy_turnover | move_out

Never create isolated modules that cannot relate to each other.
