# ghas-compliance

A GitHub App built with [Probot](https://github.com/probot/probot) that to set compliance policies.  
App will block merges for high severity alerts for critical apps and allow merges of PRs for Non critical, no internet access (NCNIA) apps.  
The various workflows this app will address are illustrated below:


```mermaid
graph TD
    A(Migration complete) -->|Enable GHAS | B[[`GHAS Compliance` create an initial check]]
    B --> C[[`GHAS Compliance` create branch protections with the required checks]]
    C --> D[[`GHAS Compliance` enable Codescanning and secret scanning]]
    D --> E((End))

    PR1[User wants to merge] --> PR2(Pull Request)
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

    DPR1[User dismisses alert] -->|Webhook| DPR2{`GHAS Compliance` Is the app NCNIA?}
    DPR2 -->|Yes| DPR8[Allow Dismiss]
    DPR2 -->|No| DPR4[[`GHAS Compliance` check for compliance]]
    DPR4 -->|Pass| DPR8
    DPR4 -->|Fail| DPR5(Reopen the alert)
    DPR8 --> DPR6((end))
    DPR5 --> DPR6
```
## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t ghas-compliance .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> ghas-compliance
```

## Contributing

If you have suggestions for how ghas-compliance could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2022 Yadhav Jayaraman <decyjphr@github.com>
