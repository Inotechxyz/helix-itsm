"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = exports.ServiceRequestStatus = exports.ServiceStatus = exports.ArticleStatus = exports.TeamType = exports.TicketPriority = exports.TicketStatus = exports.TicketType = exports.UserRole = void 0;
// User roles
var UserRole;
(function (UserRole) {
    UserRole["REQUESTER"] = "requester";
    UserRole["AGENT"] = "agent";
    UserRole["APPROVER"] = "approver";
    UserRole["MANAGER"] = "manager";
    UserRole["SUPERADMIN"] = "superadmin";
})(UserRole || (exports.UserRole = UserRole = {}));
// Ticket types
var TicketType;
(function (TicketType) {
    TicketType["INCIDENT"] = "incident";
    TicketType["SERVICE_REQUEST"] = "service_request";
})(TicketType || (exports.TicketType = TicketType = {}));
// Ticket statuses
var TicketStatus;
(function (TicketStatus) {
    TicketStatus["NEW"] = "new";
    TicketStatus["ASSIGNED"] = "assigned";
    TicketStatus["IN_PROGRESS"] = "in_progress";
    TicketStatus["PENDING"] = "pending";
    TicketStatus["RESOLVED"] = "resolved";
    TicketStatus["CLOSED"] = "closed";
})(TicketStatus || (exports.TicketStatus = TicketStatus = {}));
// Priority levels
var TicketPriority;
(function (TicketPriority) {
    TicketPriority["CRITICAL"] = "critical";
    TicketPriority["HIGH"] = "high";
    TicketPriority["MEDIUM"] = "medium";
    TicketPriority["LOW"] = "low";
})(TicketPriority || (exports.TicketPriority = TicketPriority = {}));
// Team types
var TeamType;
(function (TeamType) {
    TeamType["FIRST_LINE"] = "first_line";
    TeamType["SECOND_LINE"] = "second_line";
    TeamType["THIRD_LINE"] = "third_line";
})(TeamType || (exports.TeamType = TeamType = {}));
// Knowledge base article status
var ArticleStatus;
(function (ArticleStatus) {
    ArticleStatus["DRAFT"] = "draft";
    ArticleStatus["PUBLISHED"] = "published";
    ArticleStatus["ARCHIVED"] = "archived";
})(ArticleStatus || (exports.ArticleStatus = ArticleStatus = {}));
// Service status
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus["DRAFT"] = "draft";
    ServiceStatus["ACTIVE"] = "active";
    ServiceStatus["INACTIVE"] = "inactive";
    ServiceStatus["RETIRED"] = "retired";
})(ServiceStatus || (exports.ServiceStatus = ServiceStatus = {}));
// Service request status
var ServiceRequestStatus;
(function (ServiceRequestStatus) {
    ServiceRequestStatus["DRAFT"] = "draft";
    ServiceRequestStatus["SUBMITTED"] = "submitted";
    ServiceRequestStatus["PENDING_APPROVAL"] = "pending_approval";
    ServiceRequestStatus["APPROVED"] = "approved";
    ServiceRequestStatus["REJECTED"] = "rejected";
    ServiceRequestStatus["IN_PROGRESS"] = "in_progress";
    ServiceRequestStatus["COMPLETED"] = "completed";
    ServiceRequestStatus["CANCELLED"] = "cancelled";
})(ServiceRequestStatus || (exports.ServiceRequestStatus = ServiceRequestStatus = {}));
// Email notification types
var NotificationType;
(function (NotificationType) {
    NotificationType["TICKET_CREATED"] = "ticket_created";
    NotificationType["TICKET_ASSIGNED"] = "ticket_assigned";
    NotificationType["TICKET_UPDATED"] = "ticket_updated";
    NotificationType["TICKET_COMMENT"] = "ticket_comment";
    NotificationType["TICKET_RESOLVED"] = "ticket_resolved";
    NotificationType["TICKET_CLOSED"] = "ticket_closed";
    NotificationType["SERVICE_REQUEST_SUBMITTED"] = "service_request_submitted";
    NotificationType["SERVICE_REQUEST_APPROVED"] = "service_request_approved";
    NotificationType["SERVICE_REQUEST_REJECTED"] = "service_request_rejected";
    NotificationType["SERVICE_REQUEST_COMPLETED"] = "service_request_completed";
    NotificationType["SLA_WARNING"] = "sla_warning";
    NotificationType["SLA_BREACHED"] = "sla_breached";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
