# ghas-compliance

A GitHub App built with [Probot](https://github.com/probot/probot) for enforcing GHAS compliance policies.  
App will block merges for high severity alerts for critical apps and allow merges of PRs for non-critical, no-internet access (NCNIA) apps.  


## Workflows
The various workflows this app will address are illustrated below:


```mermaid
graph TD
    A(Migration complete) -->|Enable GHAS | B[[`GHAS Compliance` create an initial check]]
    B --> C[[`GHAS Compliance` create branch protections with the required checks]]
    C --> D[[`GHAS Compliance` enable Codescanning and secret scanning]]
    D --> E((End))

    PR1[User wants to merge] --> |Opens|PR2(Pull Request)
    PR2 -->|Webhook| PR3[CI code scan]
    PR3 -->|upload results with ref and sha| PR4((done))
    PR11[More commits] -->|Webhook| PR3
    PR2 -->|Webhook| PR5[[`GHAS Compliance` check for compliance]]
    PR11 -->|Webhook| PR5
    PR5 -->|Pass| PR8[Allow merge]
    PR8 --> PR11
    PR5 -->|Fail| PR6(Block)
    PR6 --> PR11
    PR8 --> PR7((end))
    PR6 --> PR7

    DPR1[User dismisses alert] -->|Webhook| DPR2{Non-critical app}
    DPR2 -->|Yes| DPR8[Allow Dismiss]
    DPR2 -->|No| DPR4[[`GHAS Compliance` check for compliance]]
    DPR4 -->|Pass| DPR8
    DPR4 -->|Fail| DPR5(Reopen the alert)
    DPR8 --> DPR6((end))
    DPR5 --> DPR6
```

## Sequence Diagram

```mermaid
sequenceDiagram
    Jenkins Migration-->>+GHAS Compliance App: [Webhook] Repository Dispatch(Enable GHAS)
    GHAS Compliance App->>+GitHub: Create `GHAS Compliance` Check Run
    GHAS Compliance App->>GitHub: Complete `GHAS Compliance` Check Run
    GHAS Compliance App->>GitHub: Create Branch protection
    GHAS Compliance App->>GitHub: Enable Adv Sec: Code Scanning
    GitHub-->>-GHAS Compliance App: Done
    GHAS Compliance App-->>-Jenkins Migration: Done


    Developer->>+GitHub:Create PR
    GitHub-->>+GHAS Compliance App: [Webhook] PR Opened
    GitHub-->>+Jenkins CI: [Webhook] PR Opened
    GHAS Compliance App->>GitHub: Create `GHAS Compliance` Check Run
    GHAS Compliance App->>GitHub: Check for other pending Check Runs
    Jenkins CI->>GitHub: Create `Jenkins` Check Run
    Jenkins CI->>Jenkins CI: Build and Scan
    Jenkins CI->>GitHub: Upload Scan Results
    Jenkins CI->>GitHub: Complete `Jenkins` Check Run
    Jenkins CI-->>-GitHub: Done
    GHAS Compliance App->>GHAS Compliance App: No other pending Check Runs
    GHAS Compliance App->>GHAS Compliance App: Run policy checks
    GHAS Compliance App->>-GitHub: Complete `GHAS Compliance` Check Run
    GitHub-->>-Developer:Checks Complete


    Developer->>+GitHub:Commit to the Branch
    GitHub-->>+GHAS Compliance App: [Webhook] Check Suite Created
    GitHub-->>+Jenkins CI: [Webhook] Check Suite Created
    GHAS Compliance App->>GitHub: Create `GHAS Compliance` Check Run
    GHAS Compliance App->>GitHub: Check for other pending Check Runs
    Jenkins CI->>GitHub: Create `Jenkins` Check Run
    Jenkins CI->>Jenkins CI: Build and Scan
    Jenkins CI->>GitHub: Upload Scan Results
    Jenkins CI->>GitHub: Complete `Jenkins` Check Run
    Jenkins CI-->>-GitHub: Done
    GHAS Compliance App->>GHAS Compliance App: No other pending Check Runs
    GHAS Compliance App->>GHAS Compliance App: Run policy checks
    GHAS Compliance App->>-GitHub: Complete `GHAS Compliance` Check Run
    GitHub-->>-Developer:Checks Complete
```
## Setup

Follow the instructions in [Deploy.md](docs/deploy.md)

## Contributing

If you have suggestions for how ghas-compliance could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2022 Yadhav Jayaraman <decyjphr@github.com>
