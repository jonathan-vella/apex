# Workshop Delivery Checklist

> **Version 5.3.0** | [Back to Presenter Resources](README.md)
>
> A comprehensive checklist for trainers delivering Agentic InfraOps workshops.
> Use this before, during, and after your sessions to ensure smooth delivery.

---

## 📋 Table of Contents

- [Pre-Workshop (1-2 Days Before)](#-pre-workshop-1-2-days-before)
- [Day-Of Setup (2 Hours Before)](#-day-of-setup-2-hours-before)
- [During Workshop](#-during-workshop)
- [Post-Workshop](#-post-workshop)
- [Emergency Procedures](#-emergency-procedures)

---

## 🗓️ Pre-Workshop (1-2 Days Before)

### Environment Preparation

- [ ] **Run prerequisites check script**

  ```powershell
  ./scripts/check-prerequisites.ps1
  ```

- [ ] **Verify Azure subscription access**
  - [ ] Contributor role on target subscription
  - [ ] No blocking policies for demo resources
  - [ ] Sufficient quota in `swedencentral` region

- [ ] **Test VS Code setup**
  - [ ] GitHub Copilot extension active
  - [ ] Copilot Chat responding
  - [ ] Custom agents visible (Ctrl+Shift+A)
  - [ ] Bicep extension installed and working

- [ ] **Pre-create resources if needed**
  - [ ] For S06/S07: Pre-deploy infrastructure for troubleshooting scenarios
  - [ ] For S03: Have backup completed deployment ready

### Content Review

- [ ] **Review scenario README**
  - [ ] Understand learning objectives
  - [ ] Note time estimates per section
  - [ ] Review "Common Stumbling Points" in Trainer Notes

- [ ] **Prepare talking points**
  - [ ] Character backstory (see `character-reference.md`)
  - [ ] Key value propositions to emphasize
  - [ ] Real-world examples to share

- [ ] **Check documentation links**
  - [ ] All referenced docs accessible
  - [ ] Glossary available for terminology questions

### Logistics

- [ ] **Confirm attendee list**
  - [ ] Number of participants
  - [ ] Experience levels
  - [ ] Specific interests or use cases

- [ ] **Prepare materials**
  - [ ] Slide deck (if using)
  - [ ] Handout: Quick reference card
  - [ ] Feedback survey link ready

- [ ] **Backup plans**
  - [ ] Offline code samples ready
  - [ ] Screenshots of expected outputs
  - [ ] Alternative scenarios if primary fails

---

## ⏰ Day-Of Setup (2 Hours Before)

### Technical Setup

- [ ] **Fresh terminal/shell session**
  - [ ] No leftover environment variables
  - [ ] Clean working directory

- [ ] **Azure authentication**

  ```bash
  az login
  az account show  # Verify correct subscription
  ```

- [ ] **VS Code clean state**
  - [ ] Close unnecessary files/tabs
  - [ ] Reset Copilot Chat history
  - [ ] Set font size for visibility (Ctrl+= to zoom)

- [ ] **Test connectivity**
  - [ ] Internet stable
  - [ ] Azure portal accessible
  - [ ] GitHub Copilot responding

### Screen Setup

- [ ] **Display settings**
  - [ ] Resolution appropriate for audience
  - [ ] Dark/light theme visible
  - [ ] Terminal font size readable

- [ ] **Notifications off**
  - [ ] System notifications disabled
  - [ ] Teams/Slack DND mode
  - [ ] Email closed

- [ ] **Windows arranged**
  - [ ] VS Code maximized
  - [ ] Azure Portal in secondary tab
  - [ ] Terminal visible

### Mental Preparation

- [ ] **Review first 10 minutes**
  - [ ] Opening hook ready
  - [ ] Character introduction practiced
  - [ ] First prompt memorized

- [ ] **Have water/coffee ready**
- [ ] **Quick stretch/breathing exercise**

---

## 🎯 During Workshop

### Opening (First 10 Minutes)

- [ ] **Welcome and context**
  - [ ] Introduce yourself
  - [ ] State learning objectives
  - [ ] Set expectations (interactive, questions welcome)

- [ ] **Introduce the character**
  - [ ] Name and role
  - [ ] Challenge they're facing
  - [ ] Why this matters to them

- [ ] **Quick poll** (if virtual)
  - [ ] "How many have used Copilot before?"
  - [ ] "Who's worked with Bicep?"

### Core Delivery

- [ ] **Pace check every 15 minutes**
  - [ ] On schedule?
  - [ ] Engagement level?
  - [ ] Questions piling up?

- [ ] **Interactive elements**
  - [ ] Ask prediction questions before Copilot responses
  - [ ] "What do you think happens next?"
  - [ ] "How would you approach this?"

- [ ] **Capture questions**
  - [ ] Note complex questions for follow-up
  - [ ] Park tangential topics professionally

- [ ] **Handle errors gracefully**
  - [ ] Copilot gives different response? Explore it!
  - [ ] Deployment fails? Debug live - it's teaching!
  - [ ] Network issues? Switch to backup materials

### Key Teaching Moments

- [ ] **Agent selection** - Explain WHY each agent
- [ ] **Approval workflow** - Show the human-in-the-loop value
- [ ] **Iteration** - Demonstrate refining prompts
- [ ] **Real value** - Connect to business outcomes

### Time Checkpoints

| Checkpoint | Action                      |
| ---------- | --------------------------- |
| 25%        | Should be past introduction |
| 50%        | Core concept demonstrated   |
| 75%        | Hands-on or advanced topics |
| 90%        | Start wrap-up               |
| 100%       | Q&A and next steps          |

---

## 📊 Post-Workshop

### Immediate (Within 30 Minutes)

- [ ] **Send feedback survey**
  - [ ] Use template from `feedback-survey.md`
  - [ ] Personalize thank you message

- [ ] **Share resources**
  - [ ] Repository link
  - [ ] Documentation links
  - [ ] Recording (if applicable)

- [ ] **Clean up Azure resources**

  ```bash
  az group delete --name rg-demo-* --yes --no-wait
  ```

### Within 24 Hours

- [ ] **Personal notes**
  - [ ] What worked well?
  - [ ] What could improve?
  - [ ] Interesting questions asked?

- [ ] **Follow up on parking lot items**
  - [ ] Complex questions promised to answer
  - [ ] Resources to share

- [ ] **Update materials if needed**
  - [ ] Found an error? Fix it
  - [ ] Better example? Add it
  - [ ] New FAQ? Document it

### Within 1 Week

- [ ] **Review feedback survey responses**
- [ ] **Report metrics** (if tracking)
  - [ ] Attendance
  - [ ] Satisfaction scores
  - [ ] Net Promoter Score

- [ ] **Share learnings with team**
  - [ ] Best practices discovered
  - [ ] Common questions
  - [ ] Improvement suggestions

---

## 🚨 Emergency Procedures

### Copilot Not Responding

1. Check Copilot status: <https://githubstatus.com>
2. Try: Sign out and back in to Copilot
3. Fallback: Use pre-recorded demo clips
4. Continue with explanation of what WOULD happen

### Azure Deployment Failing

1. Check Azure status: <https://status.azure.com>
2. Try: Different resource group name
3. Try: Alternative region (`germanywestcentral`)
4. Fallback: Show portal screenshots of completed deployment

### Network Issues

1. Have offline copies of:
   - [ ] Scenario README
   - [ ] Example Bicep files
   - [ ] Screenshot walkthrough
2. Switch to whiteboard/diagram explanation
3. Focus on concepts over live demo

### Running Over Time

1. Skip optional sections (mark in README)
2. Summarize instead of demonstrate
3. Offer follow-up session for advanced content
4. Share recording for missed sections

### Attendee Technical Issues

1. Have them observe first
2. Share your screen for them to follow
3. Provide completed code samples
4. Offer 1:1 help after session

---

## 📝 Quick Reference

### Keyboard Shortcuts

| Action             | Shortcut     |
| ------------------ | ------------ |
| Open Copilot Chat  | Ctrl+Shift+I |
| Select Agent       | Ctrl+Shift+A |
| Accept suggestion  | Tab          |
| Dismiss suggestion | Esc          |
| Zoom in VS Code    | Ctrl+=       |
| Zoom out VS Code   | Ctrl+-       |
| Toggle terminal    | Ctrl+`       |

### Important Links

- **Repository**: <https://github.com/jonathan-vella/azure-agentic-infraops>
- **Documentation**: `/docs/README.md`
- **Troubleshooting**: `/docs/troubleshooting.md`
- **Character Reference**: `/docs/presenter/character-reference.md`

### Support Contacts

- **Technical Issues**: Open GitHub issue
- **Content Questions**: Repository maintainers
- **Azure Issues**: <https://azure.microsoft.com/support>

---

**📖 See Also:**

- [Character Reference](character-reference.md) - Scenario personas
- [Troubleshooting Guide](../troubleshooting.md) - Common issues and solutions
