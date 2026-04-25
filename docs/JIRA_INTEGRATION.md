# Jira Integration

ContextOS can turn the enterprise export into Jira planning context. It supports a safe dry-run first, then real Jira Cloud issue creation when credentials are configured.

## Dry Run

```bash
./bin/contextos.js jira-plan retail-platform --ticket "Change refund eligibility logic"
```

This prints impacted repositories, services, endpoints, tables, topics, source files, and suggested subtasks.

## Show Jira JSON Payload

```bash
./bin/contextos.js jira-plan retail-platform \
  --ticket "Change refund eligibility logic" \
  --project CTX \
  --json
```

This prints the Jira Cloud `/rest/api/3/issue` payload, including Atlassian Document Format for the description.

## Create A Real Jira Issue

Set these environment variables:

```bash
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="you@example.com"
export JIRA_API_TOKEN="your_atlassian_api_token"
export JIRA_PROJECT_KEY="CTX"
export JIRA_ISSUE_TYPE="Task"
```

Then run:

```bash
./bin/contextos.js jira-plan retail-platform \
  --ticket "Change refund eligibility logic" \
  --create
```

## How To Get The API Token

For Jira Cloud, Atlassian documents Basic authentication using your Atlassian account email and an API token. Generate the token from your Atlassian account security settings, then use it as `JIRA_API_TOKEN`.

Official references:

- [Atlassian Basic auth for REST APIs](https://developer.atlassian.com/cloud/jira/service-desk/basic-auth-for-rest-apis/)
- [Atlassian API token support docs](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)

## Notes

- The command creates one Jira issue, not multiple subtasks yet.
- The issue body is generated from graph facts, not from LLM output.
- The integration does not store Jira credentials.
- If Jira returns a project or issue-type error, verify the project key and issue type in your Jira site.
