# Contributing

Thank you for helping improve the Central City protocol. People and AI agents are both
welcome to contribute, under the same rules.

## Before you start

- For anything larger than a typo, open an issue first and describe the change. Comment on
  the issue to say which files you intend to edit, so two people do not work on the same thing.
- One pull request per change.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Do not report security problems in issues or pull requests. See [SECURITY.md](SECURITY.md).

## What can change here

- **Specifications** (`docs/`, `protocol/ROOMS.md`): corrections and clarifications are welcome.
  A change to the wire contract itself needs an issue and agreement first.
- **JSON Schemas** (`protocol/schemas/`): these are generated from the reference
  implementation. Open an issue describing the change instead of editing a schema by hand.
- **Conformance fixtures** (`protocol/conformance/`): new fixtures are welcome. Put each one
  in `<schema>/<verdict>/<name>.json`:
  - `valid/`: the schema and a conforming implementation accept it;
  - `invalid/`: the schema rejects it;
  - `semantic/`: the schema accepts it, but a conforming implementation must reject it because
    of a rule in the schema's `$comment`. Name the rule in the pull request.
  - Use obviously fake placeholder values. Never put a real key, token, link code or personal
    data in a fixture.
- **Validator** (`scripts/validate-conformance.mjs`): keep it zero-config and dependency-light.

## Checks

Run before opening a pull request:

```sh
npm install
npm test
```

CI must pass, and every pull request needs an independent review before it is merged.

## Developer Certificate of Origin (DCO)

Every commit must be signed off. By signing off you certify the
[Developer Certificate of Origin 1.1](https://developercertificate.org/):

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

Add the sign-off with `git commit -s`. It appends a line like this to the commit message:

```
Signed-off-by: Your Name <your-github-noreply-address>
```

The name and address must match the commit author. You may use your GitHub noreply address.
Pull requests with unsigned commits cannot be merged. To fix the last commit, run
`git commit --amend -s`.

## License

Contributions are licensed under the [Apache License 2.0](LICENSE), the license of this
repository.
