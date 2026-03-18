# Contoso Request for Quotation (RFQ)

## Selection of Cloud Services Provider

## Table of Contents

1. Purpose
2. The Company
3. Service Hub
4. RFQ Scope and Objectives
5. Proposal Submission Requirements
6. RFQ Process and Timeline
7. RFQ Terms and Conditions

## 1. Purpose

Contoso invites qualified Cloud Services Providers, referred to in this document as the Candidates, to submit a quotation for secure, scalable, and highly available cloud hosting and managed services for its digital services platform and mobile application, referred to as the Service Hub.

The selected provider will be responsible for delivering cloud services that satisfy Contoso's technical, operational, security, and compliance requirements. This RFQ sets out the scope of services, high-level expectations, proposal content requirements, and the commercial and procedural terms applicable to the procurement process.

## 2. The Company

Contoso operates digital and operational services that support residents, visitors, tenants, partners, and internal business users across a large mixed-use real estate and lifestyle ecosystem within the European Union.

Contoso's service areas include the following:

1. Management and administration of residential communities and mixed-use properties.
2. Management and maintenance of common areas, amenities, and facilities.
3. Operation and commercialization of sports, leisure, and community venues.
4. Lifestyle, convenience, and day-to-day support services for end users.
5. Operational and financial support services for leased and managed properties.
6. Development and operation of digital services and smart environment capabilities.
7. Parking and mobility-related services.

## 3. Service Hub

The Service Hub is the digital channel through which Contoso provides a unified experience for its users across mobile and digital touchpoints. The platform acts as a one-stop destination for booking services, accessing digital content, making payments, interacting with venues and service providers, and supporting customer engagement across the broader service ecosystem.

The Service Hub is intended to expose Contoso's product and service portfolio to a broad audience, improve customer adoption, and support a consistent digital experience for residents, visitors, and partners.

The current indicative product roadmap is shown below.

| Release               | Target Date    |
| --------------------- | -------------- |
| MVP + utilities sales | May 2026       |
| Release 1.0           | July 2026      |
| Release 1.1           | October 2026   |
| Release 2.0           | March 2027     |
| Release 2.1           | September 2027 |

Table 1: Service Hub Delivery Milestones

## 4. RFQ Scope and Objectives

### 4.1 Introduction

This RFQ covers public cloud infrastructure and managed services across IaaS and PaaS categories for a period of three years, from March 2026 through February 2029.

The requested scope includes, at a minimum, the following service domains:

1. Compute.
2. Storage.
3. Databases.
4. In-memory caching.
5. Networking.
6. Security.
7. CDN and DNS.
8. Observability and monitoring.
9. Backup.
10. Managed Kubernetes.
11. Serverless capabilities.
12. SDLC and DevOps-enabling services where applicable.

Disaster recovery across multiple regions is not included in the current RFQ scope.

### 4.2 High-Level Application Architecture

The Service Hub consists of multiple digital channels and shared backend capabilities. The overall solution is expected to support customer-facing applications, internal administrative functions, API-based integrations, transaction processing, content delivery, and centralized monitoring and security controls.

The table below lists the proposed cloud services and indicative volumetrics for the 2026 production environment.

| #   | Cloud Service                                  | Indicative Volumetrics / Sizing                                                  |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Web Application Firewall (WAF)                 | 1,500,000 requests per month                                                     |
| 2   | Edge Security and CDN                          | 1,500,000 requests per month                                                     |
| 3   | Customer Identity and Access Management (CIAM) | 15,000 monthly active users                                                      |
| 4   | API Management                                 | 5,000,000 API requests per month                                                 |
| 5   | Container Engine                               | Standard 8 vCPU virtual machines                                                 |
| 6   | Database (PostgreSQL)                          | General purpose tier, 256 GB                                                     |
| 7   | Object Storage                                 | 200 GB                                                                           |
| 8   | File Storage                                   | 256 GB SSD                                                                       |
| 9   | Block Storage                                  | 256 GB SSD                                                                       |
| 10  | In-memory Cache                                | 128 GB                                                                           |
| 11  | Key and Secrets Management                     | 100,000 operations per month                                                     |
| 12  | Virtual Machine                                | Standard 8 vCPU virtual machines                                                 |
| 13  | Network Services                               | As required                                                                      |
| 14  | SDLC Services (DevOps)                         | CI/CD pipelines, source code and artifact repository, security tooling hosting   |
| 15  | Observability and Monitoring Services          | Hosted on general purpose 8 vCPU virtual machines or equivalent managed services |

Table 2: Proposed Cloud Services

### 4.3 Regions and Data Residency Requirements

The proposed production deployment region must be located within the European Union and must comply with GDPR requirements. All production data must be stored and processed within EU regions.

Candidates must state the exact region or regions proposed and confirm that no data will be transferred outside the EU without prior written approval from Contoso.

The following requirements apply:

1. The primary cloud region must be located within the European Union and should provide low latency to the core user base.
2. All customer data, application logs, backups, and service metadata must remain within EU borders.
3. No processing, replication, caching, indexing, telemetry analysis, or backup outside the EU is permitted unless explicitly authorized in writing by Contoso.
4. Any remote support access must be performed under GDPR-compliant safeguards, including Standard Contractual Clauses where relevant.

### 4.4 Cloud Environments

Three cloud environments are required: Development, Staging, and Production.

The environments are expected to support development, release management, operations, and controlled change deployment as follows:

1. The Production environment must support high availability, auto-scaling, strong security controls, continuous monitoring, and optimized performance for end users.
2. The Staging environment should closely mirror Production to support realistic functional, load, and security validation before release.
3. The Development environment should provide flexible and cost-efficient infrastructure for engineering activities, integration testing, and CI/CD execution.

### 4.5 Performance Requirements and Expected Volume

Contoso projects approximately 50,000 transactions during 2026, covering the period from May through December, with growth to nearly 2,000,000 transactions in 2027.

The initial active user base is expected to be approximately 5,000 users, with continued growth over the term of the contract. The target service availability for the Service Hub is at least 99.9%.

In the event that the selected Cloud Services Provider fails to meet agreed SLA availability or performance commitments during any billing period, the provider shall grant service credits as a financial remedy for such breach.

The service credit mechanism must:

1. Be defined as a percentage of the monthly fees associated with the affected service or services.
2. Be tiered according to the degree to which the actual service level falls below the committed SLA threshold.
3. Be clearly described in the proposed SLA schedule submitted with the proposal.

## 5. Proposal Submission Requirements

### 5.1 Technical Proposal

The Technical Proposal must provide a comprehensive description of the Candidate's proposed solution for supporting the Service Hub.

At a minimum, the Technical Proposal must include the following:

1. Solution architecture overview.
2. Description of the cloud services to be used.
3. Assumptions regarding usage volumes and scale.
4. Proposed SLAs.
5. Approach to scalability, availability, and operational resilience.
6. Security and compliance approach.
7. Operating model and support approach.

Candidates may additionally propose provisional professional services related to solution architecture, design, migration planning, implementation setup, or service onboarding.

The Technical Proposal must also include:

1. A draft proposed agreement or contract terms.
2. All applicable payment terms.
3. Proposed SLA commitments and reimbursement mechanisms.
4. A statement of any corporate insurance policies in force and the scope of their coverage.

### 5.2 Financial Proposal

The Financial Proposal must include a clear breakdown of all costs associated with the proposed cloud and managed services.

This includes, as applicable:

1. Compute resources.
2. Storage.
3. Databases.
4. Networking.
5. CDN.
6. Monitoring and observability.
7. Security-related services.
8. Managed platform services.
9. One-time onboarding or setup costs.
10. Optional professional services, if included.

The Financial Proposal must clearly describe pricing structure, including pay-as-you-go, reserved capacity, fixed recurring charges, assumptions, volume tiers, scaling behavior, and any discounts.

The Financial Proposal must also describe:

1. The proposed service credits mechanism or equivalent reimbursement arrangements in the event of SLA breach.
2. Any provisional professional services referred to in the Technical Proposal.

## 6. RFQ Process and Timeline

### 6.1 RFQ Milestones

The RFQ process will follow a structured timeline to ensure transparency, consistency, and adequate response time for all participating providers. Contoso reserves the right to request clarifications and conduct negotiations before award.

| Milestone                        | Date / Time (Local) |
| -------------------------------- | ------------------- |
| Launch of RFQ                    | 18 FEB 2026         |
| Deadline for Questions (Q&A)     | 24 FEB 2026, 23:59  |
| Deadline for Proposal Submission | 03 MAR 2026, 23:59  |
| Bid Clarifications, if required  | 06 MAR 2026, 23:59  |

Table 3: RFQ Milestones

### 6.2 Submission Method

This RFQ is issued to Candidates through Contoso's approved procurement portal.

The main RFQ workspace will include the following folders or sections:

1. RFQ Documents: RFQ chapters, appendices, schedules, templates, annexes, attachments, and supporting information to be downloaded by Candidates.
2. Answers to Tender Queries: Responses issued by Contoso during the Q&A period.
3. Tender Bulletins: Announcements, amendments, and addenda related to the RFQ.
4. Technical Proposal: Upload location for the Candidate's technical submission in compressed electronic format.
5. Financial Proposal: Upload location for the Candidate's financial submission in compressed electronic format.

Following receipt of this RFQ, Candidates may submit written clarification questions during the Q&A period in accordance with the milestone dates set out above.

The following submission rules apply:

1. Clarification requests must be submitted in writing through the procurement portal by the deadline stated in Section 6.1.
2. Responses to clarification requests may be issued to all Candidates on an anonymous basis where appropriate.
3. Contoso reserves the right not to answer a query.
4. Where a response could reveal commercially sensitive information about the requesting Candidate, Contoso may respond only to that Candidate, provided equal treatment obligations are maintained.
5. Candidates must upload Technical and Financial Proposals separately.
6. Proposals must be submitted in PDF and native editable formats where applicable.
7. Proposals must be fully compliant with the requirements of this RFQ. Material qualifications, exceptions, or deviations may result in disqualification.
8. No proposal may be edited, amended, or withdrawn after the submission deadline without Contoso's written consent.
9. False statements, omissions, or failure to disclose material information may result in exclusion from the procedure.

## 7. RFQ Terms and Conditions

Contoso assumes no responsibility and accepts no liability for the completeness of RFQ documents, updates, or amendments obtained from any source other than the approved procurement portal.

### 7.1 Confidential Information

1. The contents of this RFQ are confidential and may be used only for the purposes of preparing and submitting a proposal.
2. Candidates may acquire access to confidential information during the RFQ process and must not use, publish, or disclose such information to any third party except as permitted for the RFQ.
3. Contoso and each Candidate shall take reasonable steps to protect confidential information and shall not disclose it to third parties without prior written consent, except to personnel or advisors directly involved in the RFQ and bound by equivalent confidentiality obligations.
4. Each Candidate remains responsible for any confidentiality breach by its employees, agents, consultants, subcontractors, or advisors.

### 7.2 Conflict of Interest

Each Candidate must fully disclose in writing, on or before the RFQ closing date, any actual, potential, or perceived conflict of interest that could arise if the Candidate were selected.

Contoso reserves the right to reject any proposal where, in its judgment, a conflict of interest exists or may reasonably be perceived to exist.

### 7.3 Ethics

1. Candidates must not attempt to influence the RFQ process through inducements, gifts, rewards, or personal benefit to any representative of Contoso.
2. Contoso reserves the right to request declarations or supporting evidence to ensure the probity of the procurement process.
3. Candidates must not engage in collusive, deceptive, or improper conduct in preparing their proposals or in discussions with Contoso.
4. Participation in the RFQ constitutes a representation that the proposal is genuine, not collusive, and not submitted on behalf of any undisclosed party.

### 7.4 Submission and Cost of Participating in the Tender

1. Each Candidate must submit its proposal by the stated deadline.
2. No proposal may be added to, amended, or withdrawn after submission without written consent from Contoso.
3. Contoso may request clarification or supplementary information in relation to any submitted proposal.
4. Each Candidate bears its own costs associated with preparing, presenting, and submitting its proposal, including any negotiations.
5. Contoso shall not be liable for any such costs under any circumstances.

### 7.5 Ownership of Documents and Intellectual Property

1. This RFQ and its contents remain the property of Contoso. All intellectual property rights in the RFQ remain with Contoso or its licensors.
2. RFQ materials may not be reproduced, copied, stored, or distributed except as necessary to prepare a proposal.
3. Contoso may request destruction or return of RFQ materials and any copies, and Candidates must comply promptly.
4. All submitted proposal documents become the property of Contoso and will not be returned.
5. Intellectual property rights in each proposal remain with the Candidate or its licensors, but the Candidate grants Contoso a non-exclusive, perpetual, royalty-free license to retain, use, copy, and disclose proposal content for purposes related to the RFQ process.

### 7.6 Non-Binding Legal Relations

1. This RFQ is not an offer and does not create a binding contract or commitment by Contoso.
2. Contoso reserves the right to reject any or all proposals and to negotiate with any Candidate in the manner it considers appropriate.
3. Contoso may award all, part, or separate portions of the requirements described in this RFQ.
4. No legal relationship is created between Contoso and any Candidate except with respect to binding confidentiality, representations made by the Candidate, and any terms expressly stated to be binding.
5. No contract shall exist unless and until a definitive agreement is signed by both parties.
6. No Candidate may assign any rights or obligations arising from this RFQ without prior written consent from Contoso.

### 7.7 Contoso's Additional Rights

Contoso may, at its discretion and with or without prior notice where legally permissible:

1. Amend, suspend, cancel, or re-issue the RFQ or any part of it.
2. Amend the timeline, requirements, or evaluation approach.
3. Accept a late proposal.
4. Answer a question submitted after the formal deadline.
5. Accept or reject any proposal, in whole or in part.
6. Accept or reject any non-compliant, non-conforming, or alternative proposal.
7. Decide not to accept the lowest priced proposal.
8. Decide not to enter into a contract with any Candidate.
9. Liaise or negotiate with any Candidate without being required to do the same with all Candidates.
10. Provide or withhold information where it considers this appropriate, reasonable, or necessary for legal, contractual, or confidentiality reasons.
11. Waive irregularities or formal defects where it considers it appropriate to do so.

Contoso may also request that any Candidate confirm whether individual elements of its proposal can be awarded separately unless the proposal expressly states otherwise.

Contoso is not bound to award any contract and is not required to provide reasons for rejecting a proposal.

### 7.8 Governing Law

This RFQ and the procurement process shall be governed by the laws of the applicable EU member state identified by Contoso in the final contract documentation. Each Candidate agrees to submit to the jurisdiction identified in that documentation for disputes relating to the RFQ or subsequent tender process.

### 7.9 Disclaimer

1. Contoso makes no representation, warranty, or undertaking as to the accuracy or completeness of the information provided in or in connection with this RFQ.
2. Contoso shall not be liable for any inaccuracy, omission, misleading statement, or failure to update information provided through the RFQ process.
3. Nothing in this RFQ or in any communication with Candidates constitutes legal, financial, or other professional advice.
4. Contoso shall not be liable, whether in contract, tort, equity, or otherwise, for any direct or indirect loss, damage, cost, or expense incurred by any Candidate in connection with this RFQ or the tender process.

### 7.10 Precedence

1. If there is any conflict or inconsistency between documents having the same level of precedence, the later-issued document shall prevail.
2. This RFQ and its associated documents supersede prior written or oral communications relating to the services described herein.

### 7.11 Acceptance of Terms and Conditions

Participation in this RFQ process constitutes acceptance by each Candidate of the terms and conditions set out in this RFQ and any ancillary procurement documents.

### 7.12 Tender Currency

All prices, rates, and commercial values submitted in response to this RFQ must be expressed in Euros. Candidates must include all applicable taxes, duties, and charges, excluding VAT unless otherwise stated.

### 7.13 Validity of Proposals

Proposals shall remain valid and binding for a period of one hundred twenty calendar days from the proposal submission deadline, unless extended by Contoso.

### 7.14 Compliance with Applicable Laws

Each Candidate is solely responsible for complying with all applicable laws and regulations relating to its participation in the RFQ process, the preparation and submission of its proposal, and any subsequent contractual performance.

### 7.15 Language

All proposals, appendices, supporting documentation, presentations, resumes, certifications, and correspondence submitted in connection with this RFQ must be in English.
