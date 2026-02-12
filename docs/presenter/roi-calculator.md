# ROI Calculator for GitHub Copilot

> **[Version](../../VERSION.md)** | [Back to Presenter Resources](README.md)
>
> Build a business case for GitHub Copilot adoption using measured time savings from real Infrastructure-as-Code
> workflows.

This calculator combines scenario-based data with a customizable worksheet to help you calculate expected ROI for your
team.

---

## 🎯 Quick ROI Summary

**Break-Even Point**: Save **2-3 hours per month** to cover the $19/user/month subscription cost.

**Typical ROI**: 5-15x return on investment for active IaC developers.

**Why so fast?** At $19/month per user (~$0.12/hour for a full-time employee), even saving 10 minutes per day covers the
cost. Most IT Pros report saving 1-2 hours on their first day.

---

## 📊 Time Savings by Scenario

These measurements come from the repository's documented scenarios (S01-S11):

| Scenario                  | Manual Time | With Copilot | Time Saved    | Savings % |
| ------------------------- | ----------- | ------------ | ------------- | --------- |
| S01 - Bicep Baseline      | 4-6 hours   | 30-45 min    | 3.5-5.5 hours | 85-90%    |
| S02 - Agentic Workflow    | 18 hours    | 45 min       | 17.25 hours   | 96%       |
| S03 - E-Commerce Platform | 24 hours    | 60 min       | 23 hours      | 96%       |
| S04 - Documentation Gen   | 20 hours    | 90 min       | 18.5 hours    | 93%       |
| S05 - Service Validation  | 4-6 hours   | 30 min       | 3.5-5.5 hours | 85-90%    |
| S06 - Troubleshooting     | 30 hours    | 5 hours      | 25 hours      | 83%       |
| S07 - SBOM Generator      | 6 hours     | 75 min       | 4.75 hours    | 79%       |
| S08 - Diagrams as Code    | 45 min      | 20 min       | 25 min        | 56%       |
| S09 - Coding Agent        | 8+ hours    | 30 min       | 7.5+ hours    | 94%       |

📖 **Methodology**: See [Time Savings Evidence](time-savings-evidence.md) for measurement details.

---

## 🧮 ROI Calculator Worksheet

### Step 1: Enter Your Team Details

| Input                   | Your Value  | Example | Notes                                            |
| ----------------------- | ----------- | ------- | ------------------------------------------------ |
| **Number of IT Pros**   | **\_**      | 5       | Cloud architects, infra engineers, DevOps        |
| **Average hourly rate** | $**\_** /hr | $100    | Fully loaded cost (salary + benefits + overhead) |
| **Working hours/month** | **\_**      | 160     | Standard assumption                              |

---

### Step 2: Estimate Current Time Allocation

_Based on research, IT Pros typically spend their time as follows. Adjust percentages to match your reality._

| Task Category                             | Industry Avg | Your Team % | Hours/Month (per person) |
| ----------------------------------------- | ------------ | ----------- | ------------------------ |
| IaC Development (Bicep, ARM)              | 25%          | **\_**%     | **\_** hrs               |
| Scripting & Automation (PowerShell, Bash) | 15%          | **\_**%     | **\_** hrs               |
| Troubleshooting & Debugging               | 20%          | **\_**%     | **\_** hrs               |
| Documentation                             | 15%          | **\_**%     | **\_** hrs               |
| Research & Learning                       | 15%          | **\_**%     | **\_** hrs               |
| Strategic Architecture                    | 10%          | **\_**%     | **\_** hrs               |
| **TOTAL**                                 | 100%         | 100%        | 160 hrs                  |

---

### Step 3: Apply Time Savings Multipliers

_Research-backed savings percentages. Use conservative (low) estimates for pilot planning._

| Task Category          | Conservative | Moderate | Aggressive | Your Estimate |
| ---------------------- | ------------ | -------- | ---------- | ------------- |
| IaC Development        | 60%          | 75%      | 85%        | **\_**%       |
| Scripting & Automation | 55%          | 70%      | 80%        | **\_**%       |
| Troubleshooting        | 50%          | 65%      | 80%        | **\_**%       |
| Documentation          | 65%          | 80%      | 90%        | **\_**%       |
| Research & Learning    | 40%          | 55%      | 70%        | **\_**%       |

**Research Sources:**

- GitHub Copilot Study (2023): 55% task completion improvement
- Forrester TEI (2024): 88% reduction in repetitive tasks
- MIT Sloan (2024): 80% documentation time saved
- Stanford HAI (2023): 60-70% problem-solving acceleration

---

### Step 4: Calculate Monthly Savings

**Formula:**

```text
Hours Saved = (Current Hours × Savings %) for each task category
Monthly Value = Total Hours Saved × Hourly Rate
```

| Task Category          | Current Hrs | Savings % | Hours Saved        | Value Saved     |
| ---------------------- | ----------- | --------- | ------------------ | --------------- |
| IaC Development        | **\_**      | **\_**%   | **\_**             | $**\_**         |
| Scripting & Automation | **\_**      | **\_**%   | **\_**             | $**\_**         |
| Troubleshooting        | **\_**      | **\_**%   | **\_**             | $**\_**         |
| Documentation          | **\_**      | **\_**%   | **\_**             | $**\_**         |
| Research & Learning    | **\_**      | **\_**%   | **\_**             | $**\_**         |
| **TOTAL per IT Pro**   |             |           | \***\*\_** hrs\*\* | **$**\_\*\*\*\* |

---

### Step 5: Calculate Team ROI

| Metric                         | Calculation                | Result        |
| ------------------------------ | -------------------------- | ------------- |
| **Monthly savings per IT Pro** | From Step 4                | $**\_**       |
| **Team size**                  | From Step 1                | **\_** people |
| **Total monthly savings**      | Savings × Team size        | $**\_**       |
| **GitHub Copilot cost**        | $19 × Team size            | $**\_**       |
| **Net monthly benefit**        | Savings - Cost             | $**\_**       |
| **Monthly ROI**                | (Net benefit ÷ Cost) × 100 | **\_**%       |

---

## 📋 Pre-Built Examples

### Small Team (3 engineers, 4 projects/month)

| Metric                 | Value            |
| ---------------------- | ---------------- |
| Copilot Cost           | $57/month        |
| Hours Saved            | 16.3 hours/month |
| Dollar Savings         | $1,632/month     |
| Net Savings            | $1,575/month     |
| **Annual Net Savings** | **$18,900**      |
| ROI                    | 2,763%           |

### Medium Team (10 engineers, 12 projects/month)

| Metric                 | Value            |
| ---------------------- | ---------------- |
| Copilot Cost           | $190/month       |
| Hours Saved            | 48.9 hours/month |
| Dollar Savings         | $4,896/month     |
| Net Savings            | $4,706/month     |
| **Annual Net Savings** | **$56,472**      |
| ROI                    | 2,477%           |

### Large Team (25 engineers, 30 projects/month)

| Metric                 | Value             |
| ---------------------- | ----------------- |
| Copilot Cost           | $475/month        |
| Hours Saved            | 122.4 hours/month |
| Dollar Savings         | $12,240/month     |
| Net Savings            | $11,765/month     |
| **Annual Net Savings** | **$141,180**      |
| ROI                    | 2,477%            |

### Enterprise Team (50 IT Pros)

| Metric                 | Value                     |
| ---------------------- | ------------------------- |
| Copilot Cost           | $950/month                |
| Hours Saved            | 45 hours/month per person |
| Dollar Savings         | $225,000/month            |
| Net Savings            | $224,050/month            |
| **Annual Net Savings** | **$2.7M**                 |
| ROI                    | 23,584%                   |

---

## ⏱️ Break-Even Analysis

### How Fast Will You Break Even?

| Scenario                       | Break-Even Point |
| ------------------------------ | ---------------- |
| **Conservative (50% savings)** | < 1 day          |
| **Moderate (70% savings)**     | < 4 hours        |
| **Aggressive (85% savings)**   | < 2 hours        |

---

## 📈 Additional Value (Hard to Quantify)

Beyond direct time savings, consider these benefits:

### Quality Improvements

| Benefit                       | Impact                     |
| ----------------------------- | -------------------------- |
| Reduced misconfigurations     | Fewer production incidents |
| Built-in security defaults    | Lower security risk        |
| Consistent naming conventions | Easier maintenance         |
| Better documentation          | Faster knowledge transfer  |

### Team Benefits

| Benefit                | Impact                             |
| ---------------------- | ---------------------------------- |
| Faster onboarding      | Junior engineers productive sooner |
| Reduced cognitive load | Less burnout, higher retention     |
| Knowledge sharing      | Best practices spread organically  |
| Focus on architecture  | More time for high-value work      |

### Organizational Benefits

| Benefit                | Impact                         |
| ---------------------- | ------------------------------ |
| Faster time-to-market  | Competitive advantage          |
| Standardization        | Cross-team consistency         |
| Reduced technical debt | Cleaner codebase over time     |
| Audit trail            | Copilot history for compliance |

---

## 🎯 Presenting ROI to Stakeholders

### For Technical Leaders

- Specific time savings per task type
- Quality improvements (fewer incidents)
- Team productivity and morale

### For Financial Leaders

- Hard dollar savings (hours × rate)
- Break-even timeline (typically < 1 month)
- Comparison to other productivity investments

### For Executive Leadership

- Strategic value (faster delivery, reduced risk)
- Competitive positioning (AI-augmented teams)
- Talent attraction and retention

### Key Messages

1. **"Break-even in hours, not months"** — Unlike most software investments, Copilot pays for itself almost
   immediately.

2. **"Not a productivity tax"** — Learning curve is minimal (1-2 days), and productivity gains are visible from day
   one.

3. **"Multiplies existing expertise"** — Your senior architects can now implement their own designs. Junior staff
   learn faster.

4. **"Risk is minimal"** — At $19/user/month with month-to-month billing, you can pilot with zero commitment.

---

## 📊 Comparison: Copilot vs. Alternatives

| Alternative          | Cost               | Effectiveness      | Notes                      |
| -------------------- | ------------------ | ------------------ | -------------------------- |
| **Do Nothing**       | $0                 | 0% savings         | Status quo, no improvement |
| **More Training**    | $2-5K/person       | 10-20% improvement | One-time, decays over time |
| **Hire More Staff**  | $150K+/year        | Linear scaling     | Expensive, slow to ramp    |
| **Better Templates** | $0 (internal time) | 20-30% improvement | Maintenance overhead       |
| **GitHub Copilot**   | $228/year          | 85-95% improvement | Continuous improvement     |

---

## 🔢 Quick Reference Formulas

```text
Monthly Copilot Cost = Engineers × $19

Monthly Hours Saved = Projects × Avg_Project_Hours × 0.85 × Adoption_Rate

Monthly Dollar Savings = Hours_Saved × Hourly_Rate

Monthly Net Savings = Dollar_Savings - Copilot_Cost

Annual Net Savings = Monthly_Net_Savings × 12

ROI Percentage = (Net_Savings / Copilot_Cost) × 100

Break-Even Hours = $19 / Hourly_Rate
  (Example: $19 / $100 = 0.19 hours = 11 minutes saved per month to break even)
```

---

## 🧪 Suggested Pilot Structure

| Phase        | Duration | Team Size     | Success Criteria                  |
| ------------ | -------- | ------------- | --------------------------------- |
| Pilot        | 4 weeks  | 3-5 IT Pros   | 50%+ time savings on IaC tasks    |
| Expansion    | 4 weeks  | 10-15 IT Pros | Consistent results, team adoption |
| Full Rollout | Ongoing  | All IT Pros   | Standard tooling                  |

---

## 📚 Resources

- [Time Savings Evidence](time-savings-evidence.md) — Detailed methodology
- [GitHub Copilot Pricing](https://github.com/features/copilot) — Official pricing page
- [Objection Handling](objection-handling.md) — Address budget concerns

---

## Document Info

|                  |                                  |
| ---------------- | -------------------------------- |
| **Created**      | November 2025                    |
| **Purpose**      | Partner/customer ROI discussions |
| **Data Sources** | time-savings-evidence.md         |
| **Maintainer**   | Repository maintainers           |

---

_Download this worksheet, fill in your numbers, and use it to build the business case for your team._
