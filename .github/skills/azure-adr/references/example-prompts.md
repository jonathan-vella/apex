<!-- ref:adr-example-prompts-v1 -->

# ADR Example Prompts

## Design Phase ADR

```text
Create an ADR documenting our decision to use Azure Cosmos DB
instead of Azure SQL for the e-commerce catalog service.
Consider WAF implications and cost trade-offs.
```

## As-Built ADR

```text
Document the architectural decision we made during implementation
to use Azure Front Door instead of Application Gateway.
Include the performance testing results that informed this choice.
```

## From Assessment

```text
Use the azure-adr skill to document the database decision from
the architecture assessment above as a formal ADR.
```

## Common ADR Topics

| Category        | Example Decisions                                    |
| --------------- | ---------------------------------------------------- |
| **Compute**     | AKS vs App Service, Container Apps vs Functions      |
| **Data**        | Cosmos DB vs SQL, Redis vs Table Storage             |
| **Networking**  | Hub-spoke vs flat, Private Link vs Service Endpoints |
| **Security**    | Managed Identity vs SPN, Key Vault vs App Config     |
| **Integration** | Event Grid vs Service Bus, API Management tiers      |
