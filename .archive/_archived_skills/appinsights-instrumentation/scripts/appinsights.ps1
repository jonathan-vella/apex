<#
.SYNOPSIS
    Creates Application Insights resource and configures app settings.
.DESCRIPTION
    Creates a Log Analytics workspace, Application Insights component,
    and sets the connection string as an environment variable on the target app.
.PARAMETER ResourceGroupName
    Name of the Azure resource group.
.PARAMETER AzureRegionName
    Azure region for the resources.
.PARAMETER LogAnalyticsWorkspaceName
    Name for the Log Analytics workspace.
.PARAMETER ApplicationInsightsResourceName
    Name for the Application Insights resource.
.PARAMETER AppType
    Type of app to configure: WebApp, ContainerApp, or FunctionApp.
.PARAMETER AppName
    Name of the target app resource.
.PARAMETER SettingKey
    App setting key name (e.g., APPLICATIONINSIGHTS_CONNECTION_STRING).
.EXAMPLE
    ./appinsights.ps1 -ResourceGroupName "rg-myapp" -AzureRegionName "swedencentral" `
        -LogAnalyticsWorkspaceName "law-myapp" -ApplicationInsightsResourceName "ai-myapp" `
        -AppType "WebApp" -AppName "app-myapp" -SettingKey "APPLICATIONINSIGHTS_CONNECTION_STRING"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory)]
    [string]$AzureRegionName,

    [Parameter(Mandatory)]
    [string]$LogAnalyticsWorkspaceName,

    [Parameter(Mandatory)]
    [string]$ApplicationInsightsResourceName,

    [Parameter(Mandatory)]
    [ValidateSet('WebApp', 'ContainerApp', 'FunctionApp')]
    [string]$AppType,

    [Parameter(Mandatory)]
    [string]$AppName,

    [Parameter()]
    [string]$SettingKey = 'APPLICATIONINSIGHTS_CONNECTION_STRING'
)

# Add the Application Insights extension
az extension add -n application-insights

# Create a Log Analytics workspace
az monitor log-analytics workspace create `
    --resource-group $ResourceGroupName `
    --workspace-name $LogAnalyticsWorkspaceName `
    --location $AzureRegionName

# Create the Application Insights resource
az monitor app-insights component create `
    --app $ApplicationInsightsResourceName `
    --location $AzureRegionName `
    --resource-group $ResourceGroupName `
    --workspace $LogAnalyticsWorkspaceName

# Query connection string of App Insights
$connectionString = az monitor app-insights component show `
    --app $ApplicationInsightsResourceName `
    --resource-group $ResourceGroupName `
    --query connectionString --output tsv

# Set environment variable on the target app
switch ($AppType) {
    'WebApp' {
        az webapp config appsettings set `
            --resource-group $ResourceGroupName `
            --name $AppName `
            --settings "$SettingKey=$connectionString"
    }
    'ContainerApp' {
        az containerapp update `
            -n $AppName `
            -g $ResourceGroupName `
            --set-env-vars "$SettingKey=$connectionString"
    }
    'FunctionApp' {
        az functionapp config appsettings set `
            --name $AppName `
            --resource-group $ResourceGroupName `
            --settings "$SettingKey=$connectionString"
    }
}
