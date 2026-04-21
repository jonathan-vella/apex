---
title: "Functional Requirements"
description: "Core capabilities, user types, integrations, and data types for the Malta catering ordering app"
sidebar:
  order: 2
---

## Core Capabilities

| #   | Capability                     | Priority  | Acceptance Criteria                                      |
| --- | ------------------------------ | --------- | -------------------------------------------------------- |
| 1   | Browse menu (pastizzi, drinks) | 🔴 Must   | Customer sees current menu with prices                   |
| 2   | Place an order with delivery   | 🔴 Must   | Customer submits name, address, items; gets confirmation |
| 3   | View order status              | 🟡 Should | Customer can check if order is being prepared            |
| 4   | Social login (Google, etc.)    | 🟡 Should | Customer authenticates via social identity provider      |
| 5   | Admin: view incoming orders    | 🔴 Must   | Outlet staff see new orders in real time                 |

## User Types

| User Type    | Description                       | Est. Count | Access Level |
| ------------ | --------------------------------- | ---------- | ------------ |
| Customer     | Orders food/drinks online         | 100-1,000  | Reader       |
| Outlet Staff | Views and fulfils incoming orders | 1-5        | Contributor  |
| Outlet Owner | Manages menu, views sales         | 1          | Admin        |

## Integrations

| System                    | Direction | Protocol  | Auth Method  | SLA         |
| ------------------------- | --------- | --------- | ------------ | ----------- |
| Social Identity Providers | Inbound   | OAuth 2.0 | OAuth / OIDC | Best-effort |

## Data Types

| Category      | Sensitivity | Est. Volume   | Retention  | Residency |
| ------------- | ----------- | ------------- | ---------- | --------- |
| Customer PII  | 🟡 Medium   | < 10 KB/order | 90 days    | EU        |
| Order records | 🟢 Low      | ~86K rows/day | 1 year     | EU        |
| Menu items    | 🟢 Low      | < 1 KB        | Indefinite | EU        |
