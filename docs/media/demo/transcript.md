# QueryTrace demo transcript

Silent demonstration with burned-in English captions. The application footage is continuous; the opening/closing cards and caption band are editorial additions.

## 00:00:00 · QueryTrace

Which evidence reaches the model?

## 00:00:03 · 01  Start with a question

QueryTrace shows which source fragments can enter a model context — and why.

## 00:00:07 · 01  Start with a question

Atlas Capital is a fictional workspace. Here, the guest is simulating an Analyst.

## 00:00:12 · 02  Inspect the context

Run returns 6 documents and 8 fragments. It retrieves context; it does not generate an answer.

## 00:00:17 · 02  Inspect the context

2,013 estimated context tokens fit within the 2,048-token budget.

## 00:00:22 · 03  Read the evidence

Open the actual source. The fictional Form 10-K reports 34.2% ARR growth and 118% net revenue retention.

## 00:00:31 · 04  Follow the decision

Decision Trace separates included, excluded and blocked fragments. A document can be partially included.

## 00:00:36 · 04  Follow the decision

This fragment requires VP access. The simulated Analyst cannot include it under Full Policy.

## 00:00:44 · 05  Compare the policies

Same question, same role: the unfiltered Top-k baseline includes 2 documents that Full Policy blocks.

## 00:00:51 · 05  Compare the policies

Top-k uses 2,390 estimated tokens; Full Policy uses 2,013. Their selection limits differ.

## 00:00:56 · 05  Compare the policies

Export JSON preserves the executed query, role, metrics and decisions for inspection outside the interface.

## 00:01:00 · 06  Check the benchmark

All 12 configured PE queries completed. This benchmark reports no unauthorized returns; it is not a production guarantee.

## 00:01:09 · 07  Keep the execution record

Audit records the workspace, identity, effective role and policy. These local records reset when the server restarts.

## 00:01:17 · 08  Enforce an actual identity

The demo accounts have different access. Sign in as Julia to use an authenticated Analyst role.

## 00:01:21 · 08  Enforce an actual identity

Julia’s document role is enforced by the server. It is no longer a guest simulation.

## 00:01:28 · 08  Enforce an actual identity

Documents exposes the six sources Julia may read. The other ten documents are withheld from this account.

## 00:01:35 · 09  Bring another workspace

Nimbus has its own corpus, roles and scenarios. Switching workspaces clears the previous result.

## 00:01:42 · 09  Bring another workspace

Guide walks through the same real workflow. Optional Ask can generate an answer when a provider is configured.

## 00:01:49 · Inspect. Compare. Trace.

An auditable context gateway · Fictional demo data
