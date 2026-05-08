export enum Role {
  CITIZEN = 'CITIZEN',
  OFFICER = 'OFFICER',
  ADMIN = 'ADMIN',
}

export enum EmergencyStatus {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

export enum OfficerStatus {
  OFFLINE = 'OFFLINE',
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  RESPONDING = 'RESPONDING',
}
