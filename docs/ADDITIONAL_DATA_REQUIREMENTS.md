# Additional source data required

The current sample workbook does not fully support every requested manufacturing and finance decision. Add validated source data before publishing the corresponding live KPI.

- Finance: dated receipts/payments, capex and maintenance cash flows, freight/commission/penalty/rework cost definitions, tax and financing assumptions.
- Production: date, line, style, operation, planned/available minutes, earned minutes, actual output, rejection/rework quantities, downtime reason, overtime and attendance.
- WIP and delivery: daily WIP snapshots, order due date, shipment date, partial shipment quantities.
- Procurement: purchase orders, goods receipts, item/lot, supplier, ordered/received quantities, actual unit prices, promised/actual dates, quality inspection results.
- Inventory: dated stock snapshot, SKU/lot, stock quantity, unit cost, last movement date and expiry/obsolescence rules where relevant.
- Marketing: CRM lead ID, campaign/channel, spend date, buyer, sample date, linked order ID, attributed revenue and contribution profit.
- Governance: source owner, refresh timestamp, allowed roles, row-level security policy and audit trail.

Do not infer absent measures from unrelated dimensions or use demo values as operational truth.
