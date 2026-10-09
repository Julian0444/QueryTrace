# Docker validation and local review

The daemon became available after the initial remediation. The final image was built and exercised on Docker **29.1.5**, **Linux ARM64**, Python 3.11, on 2026-10-08 local time (2026-10-09 UTC in the logs). No remote deployment or paid provider request was made.

The review container `querytrace-docker-review` is available at [localhost:8002/app/](http://localhost:8002/app/) and [127.0.0.1:8002/app/](http://127.0.0.1:8002/app/). It uses the original demo corpora, has no host data mounts and leaves the separate server on port 8000 untouched. Use **Guide**, then Query and Compare; the public demo accounts are listed in the [README](../README.md#explore). Ask is disabled.

## Results

| Check | Observed result | Evidence |
|---|---|---|
| Build and runtime | Build exit 0; appuser UID/GID 1000; Uvicorn is PID 1; PORT=8080; Docker health check passes | [Build log](evidence/docker/build.log), [runtime](evidence/docker/runtime.json) |
| Complete backend suite in Linux | **505 passed**, two upstream dependency deprecation warnings; Ruff passes | [pytest](evidence/docker/pytest-linux.log), [Ruff](evidence/docker/ruff-linux.log), [installed dependencies](evidence/docker/dependencies.json) |
| Offline benchmarks | `--network none`; 12/12 completed for each of three policies in each workspace; no failures | [Network/exit evidence](evidence/docker/offline-runtime.json), [CLI log](evidence/docker/offline-benchmarks.log) |
| Metric parity | Every aggregate and corpus fingerprint matches the previous local benchmark; full-policy unauthorized queries remain **0/12** in each workspace | [Parity with run IDs](evidence/docker/benchmark-parity.json), [PE](evidence/docker/benchmark-pe.json), [SaaS](evidence/docker/benchmark-saas.json) |
| Real browser workflows | Welcome/Guide, Query, Compare, trace, Documents, Evaluations and workspace switching; no page errors; no test control routes | [Browser report](evidence/docker/production-smoke.json), [log](evidence/docker/production-smoke.log) |
| Sessions and administration | Eight login/query/reload/logout cases: analyst, partner/admin, employee and exec/admin, each on localhost and 127.0.0.1; HttpOnly/Lax cookies; manual Analyst simulation applied | [Container browser report](evidence/docker/container-smoke.json) |
| Real DOCX upload and restart | Table fixture indexed as doc_017; document count 16 → 17; corpus version changes; retrieved after restart; signed session survives using a configured secret | [Report](evidence/docker/container-smoke.json), [upload screenshot](evidence/docker/container-upload.png) |

The offline benchmarks exercise every role in the configured evaluation sets. They use actual local embeddings, FAISS, BM25 and policies. The browser tests use the production server and no mocked endpoints. This supplements the broader 48-test local browser suite; it does not claim that entire suite ran inside Docker.

The first test-container setup omitted the repository Ruff configuration and the historical evaluation fixture directory: 503 tests passed, two failed for missing files, and Ruff used its defaults. Copying the actual configuration and fixtures produced the complete passing run, without changing tests or lint rules. The first new browser script also checked logout before the asynchronous request finished; it now waits for the signed-in UI to disappear before asserting `/me` returns 401. Initial logs are retained: [pytest](evidence/docker/pytest-linux-initial.log), [Ruff](evidence/docker/ruff-linux-initial.log), [browser](evidence/docker/container-smoke-initial.log).

Saved text logs omit terminal escape codes and trailing whitespace; diagnostic content and outcomes are preserved.

## Run a fresh review instance

From the repository root, with an unused host port and container name:

```bash
docker build -t querytrace:review .
export QUERYTRACE_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
docker run -d --name querytrace-review \
  -p 127.0.0.1:8003:8000 \
  -e QUERYTRACE_SECRET_KEY \
  querytrace:review
```

Open [localhost:8003/app/](http://localhost:8003/app/). Keep one hostname per session. The model/tokenizer are downloaded at build time; the verified image can retrieve and evaluate without network access. Build itself needs access to the base image, Python packages and model distribution. No provider key is forwarded by these commands.

For the instance already left running:

```bash
docker logs --tail 30 querytrace-docker-review
docker inspect --format '{{.State.Health.Status}}' querytrace-docker-review
docker restart querytrace-docker-review
```

Uploads survive a restart of the same container. Removing/replacing it discards its writable layer. The final review instance was deliberately recreated from the image after the upload test, so it starts with unmodified demo data. The image does not configure durable volumes; an operator would need to preserve `/app/corpora` and `/app/artifacts` together with suitable permissions. External volume lifecycle, Linux AMD64, HTTPS/reverse proxies, multi-worker execution and live Anthropic calls were not tested here.

## Reproduce the checks

Install the [browser test dependencies](../README.md#validate), then run the non-mutating smoke against a separately running server:

```bash
QUERYTRACE_SMOKE_BASE_URL=http://localhost:8002 \
QUERYTRACE_SMOKE_OUTPUT_DIR=/tmp/querytrace-docker-browser \
  node tests/browser/production-smoke.cjs
```

The additional container smoke **uploads a fixture and restarts its target**. Use a fresh disposable container without mounts, a stable random signing secret and the validation label:

```bash
docker run -d --name querytrace-validation \
  --label querytrace.validation=true \
  -p 127.0.0.1:8004:8080 -e PORT=8080 \
  -e QUERYTRACE_SECRET_KEY querytrace:review
QUERYTRACE_SMOKE_CONTAINER=querytrace-validation \
QUERYTRACE_SMOKE_BASE_URL=http://localhost:8004 \
QUERYTRACE_SMOKE_OUTPUT_DIR=/tmp/querytrace-container-browser \
  node tests/browser/container-smoke.cjs
```

For offline retrieval benchmarks:

```bash
docker run --rm --network none querytrace:review \
  python -m src.evaluator --workspace pe-deal --compare
docker run --rm --network none querytrace:review \
  python -m src.evaluator --workspace saas-internal --compare
```

To run the complete backend tests in a disposable container, copy the tests **and their repository configuration/fixtures**. These are validation-only files, not extra production dependencies:

```bash
docker run -d --name querytrace-tests querytrace:review sleep infinity
tar --exclude=__pycache__ -cf - tests evals pyproject.toml requirements-dev.txt \
  | docker exec -i querytrace-tests tar -xf - -C /app
docker exec querytrace-tests python -m pip install --user -r requirements-dev.txt
docker exec querytrace-tests python -m pytest tests/ -q
docker exec querytrace-tests python -m ruff check src/ tests/
```

Remove only your disposable validation containers when finished. No other existing containers were stopped or changed in this verification.
