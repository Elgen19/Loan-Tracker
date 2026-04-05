# Loan Tracker App

## Overview

This is a shared web-based loan tracking application built for a small private group of users. It helps users organize loans into containers, monitor balances and due dates, record payments, and review summary insights across active obligations.

The app is designed for practical day-to-day loan monitoring rather than full accounting. It focuses on clarity, speed, and a clean user experience across desktop and mobile.

## Core Purpose

The app is meant to answer a few important questions quickly:

- What loans do we currently have?
- Which loans are due soon or overdue?
- How much has already been paid?
- How much is left to pay?
- What payment activity has happened recently?

## Main Features

### Authentication and Access

- Firebase Authentication using email and password
- Sign-in only flow for pre-created accounts
- Shared workspace model so approved users can see the same data
- Allowlist-based access control for approved email addresses only
- Optional email verification enforcement
- Special backend access rule support for container-specific visibility

### Container Organization

- Loans are grouped into containers
- Users open a container first before managing its loans
- Existing loans can be assigned into a container
- Container-first navigation keeps the data organized and less overwhelming

### Loan Management

- Add, edit, and delete loans
- Support for fixed and flexible loan types
- Compact loan summary cards with expandable detail view
- Loan fields include:
  - loan name
  - principal / loaned amount
  - term
  - payment agreement
  - monthly payment
  - total payable
  - interest cost
  - first repayment date
  - next due date
  - remaining balance
  - loan type
  - notes

### Payment Tracking

- Record payments with amount, date, and note
- View payment history per loan
- Payment entry uses a dedicated modal
- Fixed-loan schedule updates after payment
- Remaining balance and due logic update after payment recording

### Summary and Insights

- Financial snapshot cards
- Balance insights
- Payment activity summaries
- Due-soon summaries with selectable time window
- Due this month
- Overdue loans
- Partially paid loans
- Interest exposure
- Per-loan completion visuals

### UI and UX

- Built with React and Tailwind CSS
- Responsive mobile and desktop layouts
- Container and loan actions use icon buttons where appropriate
- Floating action buttons on mobile
- Expandable loan cards to reduce list overload
- Modal-based create/edit/payment flows
- Loading and error messaging for better user feedback

## Technical Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Firebase client SDK for authentication

### Backend

- Node.js
- Express
- Firebase Admin SDK

### Database and Auth

- Firebase Firestore
- Firebase Authentication

## Implementation Notes

### Data Model

The app stores:

- `loanContainers`
  - shared workspace grouping for loans
  - container name and description
  - audit metadata such as creator and timestamps

- `loans`
  - full loan details
  - payment history
  - computed values like total payable, interest cost, status
  - schedule-related fields for fixed loans

- `auditLogs`
  - sensitive activity history
  - create, update, delete, payment, and recalculation events

### Shared Access Model

- The app uses a shared `workspaceId`
- Approved users see the same shared data
- The backend verifies Firebase ID tokens on each request
- Access is restricted by server-side allowlist rules
- Additional policy rules can restrict specific users to specific containers

### Security Measures

- Firebase Admin credentials stay on the backend only
- Backend token verification required for protected routes
- Allowed-user email filtering
- API rate limiting
- Audit logging for important actions
- Optional email verification enforcement

### Query Strategy

For this small shared app, some Firestore reads are intentionally fetched and filtered in memory on the backend to avoid composite index friction while keeping the implementation simple and stable for a low-volume shared workspace.

## Intended Use Case

This application is best suited for:

- two shared users
- family or household loan tracking
- private loan monitoring
- personal finance oversight with simple collaboration

It is not currently intended to be a large multi-tenant SaaS platform.

## Future Improvements

- Password reset flow
- Stronger admin management for approved users
- Export and backup features
- More granular access roles
- Deployment hardening with HTTPS and production monitoring
- Optional notifications and reminders
- Better audit review UI
