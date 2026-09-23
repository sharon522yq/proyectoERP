# DATABASE SCHEMA

Última actualización: 2026-09-22

## Colecciones

### Core

#### users
```javascript
{
  name: String (required, maxlength: 120),
  email: String (required, unique, lowercase, index),
  passwordHash: String (required, select: false),
  role: String (required, uppercase),
  companyId: ObjectId (ref: Company, index),
  active: Boolean (default: true),
  refreshTokenHash: String (select: false),
  resetTokenHash: String (select: false),
  resetExpires: Date (select: false),
  timestamps: true
}
```

#### companies
```javascript
{
  name: String (required, maxlength: 150),
  taxId: String (trim, maxlength: 40),
  email: String (trim, lowercase),
  active: Boolean (default: true),
  timestamps: true
}
```

#### branches
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  name: String (required, maxlength: 150),
  address: String (trim, maxlength: 300),
  phone: String (trim, maxlength: 30),
  active: Boolean (default: true),
  timestamps: true
}
```

#### roles
```javascript
{
  name: String (required, unique, uppercase),
  permissions: [String],
  timestamps: true
}
```

#### audit_logs
```javascript
{
  userId: ObjectId (ref: User),
  companyId: ObjectId (ref: Company),
  action: String (required),
  module: String (required),
  documentId: String,
  previousData: Mixed,
  newData: Mixed,
  ip: String,
  timestamps: true
}
```

#### settings
```javascript
{
  companyId: ObjectId (ref: Company, unique),
  timezone: String (default: 'America/Mexico_City'),
  currency: String (default: 'MXN'),
  locale: String (default: 'es-MX'),
  timestamps: true
}
```

#### counters
```javascript
{
  _id: String (companyId_prefix),
  seq: Number
}
```

### CRM

#### leads
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  branchId: ObjectId (ref: Branch),
  name: String (required, maxlength: 150),
  email: String (trim, lowercase),
  phone: String (trim, maxlength: 30),
  company: String (trim, maxlength: 150),
  source: Enum ['WEB','PHONE','EMAIL','REFERRAL','SOCIAL','EVENT','OTHER'],
  status: Enum ['NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST'],
  priority: Enum ['LOW','MEDIUM','HIGH','URGENT'],
  assignedTo: ObjectId (ref: User),
  notes: String (maxlength: 2000),
  estimatedValue: Number (min: 0),
  convertedAt: Date,
  customerId: ObjectId (ref: Customer),
  deletedAt: Date,
  timestamps: true
}
// Índices: (companyId, status), (companyId, assignedTo)
```

#### customers
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  branchId: ObjectId (ref: Branch),
  name: String (required, maxlength: 150),
  email: String (trim, lowercase),
  phone: String (trim, maxlength: 30),
  address: String (trim, maxlength: 300),
  taxId: String (trim, maxlength: 40),
  type: Enum ['INDIVIDUAL','BUSINESS'],
  status: Enum ['ACTIVE','INACTIVE','BLOCKED'],
  assignedTo: ObjectId (ref: User),
  leadId: ObjectId (ref: Lead),
  notes: String (maxlength: 2000),
  deletedAt: Date,
  timestamps: true
}
// Índices: (companyId, status), (companyId, assignedTo), text(name, email)
```

#### contacts
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  customerId: ObjectId (ref: Customer, required, index),
  name: String (required, maxlength: 150),
  email: String (trim, lowercase),
  phone: String (trim, maxlength: 30),
  position: String (trim, maxlength: 100),
  isPrimary: Boolean (default: false),
  deletedAt: Date,
  timestamps: true
}
// Índice: (companyId, customerId)
```

#### activities
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  leadId: ObjectId (ref: Lead),
  customerId: ObjectId (ref: Customer),
  type: Enum ['CALL','MEETING','EMAIL','NOTE','TASK','FOLLOW_UP'] (required),
  subject: String (required, maxlength: 200),
  description: String (maxlength: 2000),
  date: Date (default: now),
  dueDate: Date,
  status: Enum ['PENDING','COMPLETED','CANCELLED'],
  assignedTo: ObjectId (ref: User),
  outcome: String (maxlength: 500),
  deletedAt: Date,
  timestamps: true
}
// Índices: (companyId, date DESC), (companyId, assignedTo, status)
```

### Products

#### categories
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  name: String (required, maxlength: 100),
  description: String (maxlength: 300),
  parentId: ObjectId (ref: Category),
  active: Boolean (default: true),
  deletedAt: Date,
  timestamps: true
}
// Índices: unique(companyId, name), (companyId, parentId)
```

#### units
```javascript
{
  name: String (required, unique),
  symbol: String (required, unique),
  type: Enum ['WEIGHT','VOLUME','LENGTH','AREA','UNIT','TIME'],
  timestamps: true
}
```

#### products
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  sku: String (required, maxlength: 50),
  name: String (required, maxlength: 200),
  description: String (maxlength: 1000),
  categoryId: ObjectId (ref: Category, index),
  unitId: ObjectId (ref: Unit),
  cost: Number (min: 0, default: 0),
  price: Number (required, min: 0),
  currency: String (default: 'MXN', maxlength: 3),
  taxRate: Number (min: 0, max: 100, default: 0),
  minimumStock: Number (min: 0, default: 0),
  maximumStock: Number (min: 0),
  status: Enum ['ACTIVE','INACTIVE','DISCONTINUED'],
  deletedAt: Date,
  timestamps: true
}
// Índices: unique(companyId, sku), text(name, description), (companyId, categoryId), (companyId, status)
```

### Inventory

#### warehouses
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  branchId: ObjectId (ref: Branch, index),
  name: String (required, maxlength: 150),
  code: String (required, maxlength: 20),
  address: String (maxlength: 300),
  responsible: ObjectId (ref: User),
  active: Boolean (default: true),
  deletedAt: Date,
  timestamps: true
}
// Índice: unique(companyId, code)
```

#### inventory
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  warehouseId: ObjectId (ref: Warehouse, required, index),
  productId: ObjectId (ref: Product, required, index),
  quantity: Number (required, min: 0, default: 0),
  reservedQty: Number (min: 0, default: 0),
  lastMovementAt: Date,
  timestamps: true
}
// Índice: unique(companyId, warehouseId, productId)
```

#### inventory_movements
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  warehouseId: ObjectId (ref: Warehouse, required, index),
  productId: ObjectId (ref: Product, required, index),
  type: Enum ['PURCHASE_ENTRY','SALE_EXIT','TRANSFER','ADJUSTMENT','RETURN','INITIAL_STOCK'] (required),
  quantity: Number (required),
  previousStock: Number (required),
  newStock: Number (required),
  reason: String (maxlength: 500),
  referenceType: String,
  referenceId: ObjectId,
  userId: ObjectId (ref: User, required),
  branchId: ObjectId (ref: Branch),
  timestamps: true
}
// Índices: (companyId, createdAt DESC), (companyId, productId, createdAt DESC)
```

### Sales

#### quotes
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  branchId: ObjectId (ref: Branch),
  folio: String (required),
  customerId: ObjectId (ref: Customer, required, index),
  items: [{ productId, description, quantity, unitPrice, discount, taxRate, subtotal }],
  subtotal: Number (required),
  discountTotal: Number (default: 0),
  taxTotal: Number (default: 0),
  total: Number (required),
  currency: String (default: 'MXN'),
  status: Enum ['DRAFT','SENT','APPROVED','REJECTED','CANCELLED','CONVERTED'],
  notes: String (maxlength: 2000),
  assignedTo: ObjectId (ref: User),
  validUntil: Date,
  deletedAt: Date,
  timestamps: true
}
```

#### sales_orders
```javascript
{
  // Similar a quotes
  quoteId: ObjectId (ref: Quote),
  status: Enum ['DRAFT','CONFIRMED','PREPARING','SHIPPED','DELIVERED','CANCELLED'],
  ...
}
```

#### invoices
```javascript
{
  // Similar a orders
  salesOrderId: ObjectId (ref: SalesOrder),
  status: Enum ['DRAFT','SENT','PAID','PARTIAL','CANCELLED','OVERDUE'],
  dueDate: Date,
  paidAmount: Number (default: 0),
  ...
}
```

#### payments
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  folio: String (required),
  invoiceId: ObjectId (ref: Invoice, required, index),
  customerId: ObjectId (ref: Customer, required),
  amount: Number (required, min: 0.01),
  method: Enum ['CASH','CARD','TRANSFER','CHECK','OTHER'] (required),
  reference: String (maxlength: 100),
  status: Enum ['PENDING','CONFIRMED','REJECTED'],
  paidAt: Date,
  receivedBy: ObjectId (ref: User),
  timestamps: true
}
```

### Purchases

#### purchase_orders
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  folio: String (required),
  supplierId: ObjectId (ref: Customer, required, index),
  items: [{ productId, description, quantity, unitCost, subtotal }],
  subtotal: Number (required),
  taxTotal: Number (default: 0),
  total: Number (required),
  status: Enum ['DRAFT','SENT','CONFIRMED','RECEIVED','CANCELLED'],
  notes: String (maxlength: 2000),
  requestedBy: ObjectId (ref: User),
  deletedAt: Date,
  timestamps: true
}
```

### Finance

#### accounts
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  code: String (required, maxlength: 20),
  name: String (required, maxlength: 150),
  type: Enum ['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'] (required),
  parentId: ObjectId (ref: Account),
  balance: Number (default: 0),
  active: Boolean (default: true),
  timestamps: true
}
// Índice: unique(companyId, code)
```

#### transactions
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  branchId: ObjectId (ref: Branch),
  accountId: ObjectId (ref: Account, required, index),
  type: Enum ['INCOME','EXPENSE','TRANSFER'] (required),
  amount: Number (required, min: 0.01),
  description: String (maxlength: 500),
  referenceType: String,
  referenceId: ObjectId,
  category: String (maxlength: 100),
  date: Date (default: now),
  createdBy: ObjectId (ref: User, required),
  timestamps: true
}
```

### HR

#### departments
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  name: String (required, maxlength: 100),
  description: String (maxlength: 300),
  managerId: ObjectId (ref: Employee),
  active: Boolean (default: true),
  timestamps: true
}
// Índice: unique(companyId, name)
```

#### employees
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  userId: ObjectId (ref: User),
  employeeId: String (required, maxlength: 20),
  name: String (required, maxlength: 150),
  email: String (trim, lowercase),
  phone: String (maxlength: 30),
  departmentId: ObjectId (ref: Department, index),
  position: String (maxlength: 100),
  hireDate: Date,
  salary: Number (min: 0),
  status: Enum ['ACTIVE','INACTIVE','TERMINATED'],
  timestamps: true
}
// Índice: unique(companyId, employeeId)
```

### Projects

#### projects
```javascript
{
  companyId: ObjectId (ref: Company, required, index),
  name: String (required, maxlength: 200),
  description: String (maxlength: 2000),
  status: Enum ['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'],
  priority: Enum ['LOW','MEDIUM','HIGH','URGENT'],
  managerId: ObjectId (ref: User),
  startDate: Date,
  endDate: Date,
  budget: Number (min: 0, default: 0),
  progress: Number (min: 0, max: 100, default: 0),
  timestamps: true
}
```

#### tasks
```javascript
{
  projectId: ObjectId (ref: Project, required, index),
  companyId: ObjectId (ref: Company, required, index),
  title: String (required, maxlength: 200),
  description: String (maxlength: 2000),
  status: Enum ['TODO','IN_PROGRESS','DONE','CANCELLED'],
  priority: Enum ['LOW','MEDIUM','HIGH'],
  assignedTo: ObjectId (ref: User),
  dueDate: Date,
  timestamps: true
}
```
