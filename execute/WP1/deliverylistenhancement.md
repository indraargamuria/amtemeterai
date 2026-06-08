# README.md
### Target Agentic Workflow: Claude Code / Antigravity IDE

This repository instruction file contains the blueprint for upgrading your existing **Deliveries List** grid layout inside the frontend codebase. All backend API infrastructures are completely finalized and locked down—**do not modify or add any backend files**.

---

## 🚀 Core Objective

Surgically upgrade the existing dashboard table view inside **`pages/deliveries/DeliveriesPage.tsx`**. 
* **Do not create a new page or separate component file.** * Inject new high-density data columns, context-aware operational badges, a photo count indicator, and localized routing information directly into the file's existing data-grid or table matrix structure.
* Implement production-grade client-side **Search** and **Sorting** mechanics optimized for enterprise logistics usage patterns.

---

## 🔍 Search & Sort Engine Specifications

Update the component state logic inside `DeliveriesPage.tsx` to handle multi-field searching and deterministic sorting based on high-priority transactional fields:

### 1. Global Search Box Filter
Add/update a text search field that dynamically filters rows by checking if the query string matches any of the following fields (case-insensitive):
* **Delivery Number** (`deliveryNumber`) – For managers looking up a specific invoice/DO.
* **Customer Name or Code** (`customerName` / `customerCode`) – For filtering all drops designated for a specific client.
* **Salesperson Name** (`salesPersonName`) – For tracking down account-specific orders.

### 2. Multi-Field Sorting Trigger
Implement a sorting selector (or clickable table headers) that defaults to descending date order, but allows the user to switch sorting modes based on:
* **Delivery Date** (`deliveryDate` - *Newest to Oldest* / *Oldest to Newest*) – Crucial for managing dispatch queues.
* **Delivery Number** (`deliveryNumber` - *Alphanumeric A-Z / Z-A*) – For standard numerical tracking alignment.
* **Fulfillment Status** (`status` - *Group Discrepancies First*) – To immediately push problematic deliveries (`status == 2`) to the top of the workspace view.

---

## 📋 High-Density Column Mapping Specifications

Modify the column schema array definitions or table rows inside `DeliveriesPage.tsx` to handle the following layout mapping instructions:

1. **Combined Delivery Column**:
   * Format: Bold delivery number identifier (`deliveryNumber`) on top, with the short-form formatted date (`deliveryDate`) directly underneath using a muted text class.
   * Visual Concept: **DO-2026-0001** <br> *19 May 2026*

2. **Combined Customer Column**:
   * Format: Dense layout showing customer code (`customerCode`) as a thin accent badge followed by the prominent company name (`customerName`).
   * Visual Concept: `[CUST-001]` **PT. Arga Sukses Mandiri**

3. **Compliance Type Column (`type`)**:
   * Map the internal integer to theme badges:
     * `1` $\rightarrow$ **BC Compliance** (Emerald/Green subtle tint badge)
     * `2` $\rightarrow$ **Non-BC** (Slate/Gray subtle tint badge)

4. **Fulfillment State Column (`status`)**:
   * Map the header status tracking integer to actionable operational badges:
     * `1` $\rightarrow$ **Fully Received** (Solid Green/Emerald indicator check)
     * `2` $\rightarrow$ **Partial / Discrepancy** (Solid Amber/Orange warning layout with alert icon)
     * *Fallback / Null* $\rightarrow$ **Pending Delivery** (Subtle desaturated blue info border tag layout)

5. **Proof Tracker Column (`photosCount` or `photos.length`)**:
   * If a delivery row contains photo attachments (or `photos.length > 0`), display a clean camera icon indicator along with a counter badge (e.g., `📷 x2`). 
   * If the count is `0`, render a desaturated, muted empty indicator node.

6. **Geographical Routing Zone Column (`cityRegency` & `district`)**:
   * Combine location tokens into a single clean routing string to enable quick geographical scanning.
   * Example: `Kec. Sawangan, Kota Depok`

7. **Destination Owner Column (`plant` & `salesPersonName`)**:
   * Show internal logistics routing ownership clearly: `PLANT-A (Indra Arga)`

---

## 🛠️ Advanced Filtering Toolbar Upgrades

Surgically update the **existing filter toolbar** inside `DeliveriesPage.tsx` (or append to it if missing) to incorporate these control inputs alongside the new Search box:
* **Compliance Type Selector Toggle**: A select component or button group to shift row view filters between *All*, *BC Only*, and *Non-BC Only*.
* **Fulfillment Discrepancy Filter Checkbox**: A toggle switch or checkbox to instantly isolate only rows matching `status == 2` (Partial / Discrepancy), letting operators pinpoint active field errors instantly.

---

## 🤖 AI Execution Command Routine

To perform these updates using Claude Code, open your workspace repository terminal interface and run this execution query sequence:

```bash
claude "Read README.md. Open the file pages/deliveries/DeliveriesPage.tsx and surgically upgrade its existing layout to include the high-density table grid columns, localized routing strings, advanced status filter states, multi-field text search, and column sorting logic precisely as specified. Do not create new files or modify any backend C#/.cs code."